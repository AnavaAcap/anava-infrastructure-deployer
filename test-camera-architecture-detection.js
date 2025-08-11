#!/usr/bin/env node

/**
 * Camera Architecture Detection Test Script
 * 
 * This script tests the camera architecture and OS detection logic
 * to ensure the correct ACAP file is selected for deployment.
 * 
 * Usage: node test-camera-architecture-detection.js <camera-ip> <username> <password>
 * Example: node test-camera-architecture-detection.js 192.168.50.156 anava baton
 */

const axios = require('axios');
const https = require('https');
const colors = require('colors/safe');

// Disable SSL verification for self-signed certificates
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

class CameraArchitectureDetector {
  constructor(ip, username, password) {
    this.ip = ip;
    this.username = username;
    this.password = password;
    this.auth = Buffer.from(`${username}:${password}`).toString('base64');
  }

  async makeRequest(endpoint) {
    const url = `https://${this.ip}${endpoint}`;
    try {
      console.log(colors.gray(`Making request to: ${endpoint}`));
      const response = await axios({
        method: 'GET',
        url,
        httpsAgent,
        timeout: 10000,
        headers: {
          'Authorization': `Basic ${this.auth}`
        }
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Authentication failed. Check username/password.');
      }
      throw error;
    }
  }

  async detectArchitecture() {
    console.log(colors.cyan('\n=== CAMERA ARCHITECTURE DETECTION ===\n'));
    console.log(`Camera IP: ${this.ip}`);
    console.log(`Username: ${this.username}`);
    console.log(`Password: ${'*'.repeat(this.password.length)}\n`);

    const results = {
      ip: this.ip,
      timestamp: new Date().toISOString(),
      firmware: null,
      osVersion: null,
      architecture: null,
      soc: null,
      deviceId: null,
      model: null,
      detectionMethod: null,
      availableProperties: [],
      recommendedAcap: null,
      allProperties: {}
    };

    try {
      // Step 1: Get firmware version
      console.log(colors.yellow('1. Checking firmware version...'));
      const firmwareData = await this.makeRequest('/axis-cgi/param.cgi?action=list&group=Properties.Firmware.Version');
      const firmwareMatch = firmwareData.match(/Properties\.Firmware\.Version=([^\r\n]+)/);
      if (firmwareMatch) {
        results.firmware = firmwareMatch[1].trim();
        console.log(colors.green(`   ✓ Firmware: ${results.firmware}`));
        
        // Determine OS version based on firmware
        const majorVersion = parseInt(results.firmware.split('.')[0], 10);
        results.osVersion = majorVersion >= 11 ? 'OS12' : 'OS11';
        console.log(colors.green(`   ✓ OS Version: ${results.osVersion} (based on firmware ${majorVersion}.x)`));
      } else {
        console.log(colors.red('   ✗ Could not determine firmware version'));
      }

      // Step 2: Try specific Architecture property
      console.log(colors.yellow('\n2. Checking Architecture property...'));
      try {
        const archData = await this.makeRequest('/axis-cgi/param.cgi?action=list&group=Properties.System.Architecture');
        const archMatch = archData.match(/Properties\.System\.Architecture=([^\r\n]+)/);
        if (archMatch) {
          results.architecture = archMatch[1].toLowerCase().trim();
          results.detectionMethod = 'Properties.System.Architecture';
          console.log(colors.green(`   ✓ Architecture: ${results.architecture}`));
          console.log(colors.green(`   ✓ Detection method: Direct property`));
        } else {
          console.log(colors.gray('   - Architecture property not found'));
        }
      } catch (error) {
        console.log(colors.gray('   - Architecture property not available'));
      }

      // Step 3: Get all system properties
      console.log(colors.yellow('\n3. Checking all System properties...'));
      const systemData = await this.makeRequest('/axis-cgi/param.cgi?action=list&group=Properties.System');
      const lines = systemData.split('\n');
      
      for (const line of lines) {
        const match = line.match(/Properties\.System\.(\w+)=([^\r\n]+)/);
        if (match) {
          const [, property, value] = match;
          results.allProperties[property] = value.trim();
          results.availableProperties.push(property);
          
          // Check for SOC
          if (property === 'Soc' || property === 'SOC') {
            results.soc = value.trim();
            console.log(colors.green(`   ✓ System on Chip: ${results.soc}`));
            
            // Infer architecture from SOC if not already detected
            if (!results.architecture) {
              if (value.includes('CV25') || value.includes('Artpec-8') || value.includes('ARTPEC-8')) {
                results.architecture = 'aarch64';
                results.detectionMethod = 'Inferred from SOC (ARTPEC-8/CV25)';
              } else if (value.includes('ARTPEC-7') || value.includes('Artpec-7')) {
                results.architecture = 'armv7hf';
                results.detectionMethod = 'Inferred from SOC (ARTPEC-7)';
              } else if (value.includes('ARTPEC-6') || value.includes('Artpec-6')) {
                results.architecture = 'armv7hf';
                results.detectionMethod = 'Inferred from SOC (ARTPEC-6)';
              }
              
              if (results.architecture) {
                console.log(colors.yellow(`   → Inferred architecture: ${results.architecture}`));
              }
            }
          }
          
          // Check for Architecture in system properties
          if (property === 'Architecture' && !results.architecture) {
            results.architecture = value.toLowerCase().trim();
            results.detectionMethod = 'Properties.System.Architecture';
            console.log(colors.green(`   ✓ Architecture: ${results.architecture}`));
          }
        }
      }

      console.log(colors.gray(`   - Found ${results.availableProperties.length} system properties`));

      // Step 4: Get device info
      console.log(colors.yellow('\n4. Checking device information...'));
      const brandData = await this.makeRequest('/axis-cgi/param.cgi?action=list&group=Brand');
      const modelMatch = brandData.match(/Brand\.ProdNbr=([^\r\n]+)/);
      if (modelMatch) {
        results.model = modelMatch[1].trim();
        console.log(colors.green(`   ✓ Model: ${results.model}`));
      }

      // Step 5: Try to get device ID from applications list
      console.log(colors.yellow('\n5. Checking device ID...'));
      try {
        const appListData = await this.makeRequest('/axis-cgi/applications/list.cgi');
        const realmMatch = appListData.match(/AXIS_([A-F0-9]{12})/i);
        if (realmMatch) {
          results.deviceId = realmMatch[1];
          console.log(colors.green(`   ✓ Device ID (MAC): ${results.deviceId}`));
        } else {
          // Try alternative patterns
          const macPatterns = [
            /([A-F0-9]{12})/i,
            /([A-F0-9]{2}:[A-F0-9]{2}:[A-F0-9]{2}:[A-F0-9]{2}:[A-F0-9]{2}:[A-F0-9]{2})/i
          ];
          
          for (const pattern of macPatterns) {
            const match = appListData.match(pattern);
            if (match) {
              results.deviceId = match[1].replace(/:/g, '');
              console.log(colors.green(`   ✓ Device ID (MAC): ${results.deviceId}`));
              break;
            }
          }
        }
      } catch (error) {
        console.log(colors.gray('   - Could not retrieve device ID'));
      }

      // Default architecture if none detected
      if (!results.architecture) {
        results.architecture = 'aarch64';
        results.detectionMethod = 'Default (most common)';
        console.log(colors.yellow(`\n⚠ Using default architecture: ${results.architecture}`));
      }

      // Recommend ACAP file
      results.recommendedAcap = this.recommendAcapFile(results);

      // Display summary
      this.displaySummary(results);

      // Display curl commands for verification
      this.displayCurlCommands(results);

      return results;

    } catch (error) {
      console.error(colors.red(`\n✗ Error: ${error.message}`));
      if (error.code === 'ECONNREFUSED') {
        console.error(colors.red('  Camera is not reachable. Check IP address and network connection.'));
      } else if (error.code === 'ETIMEDOUT') {
        console.error(colors.red('  Connection timed out. Camera may be offline or IP is incorrect.'));
      }
      process.exit(1);
    }
  }

  recommendAcapFile(results) {
    const osVersion = results.osVersion?.toLowerCase() || 'os11';
    const arch = results.architecture || 'aarch64';
    
    // Map common architecture names
    const archMap = {
      'aarch64': 'aarch64',
      'arm64': 'aarch64',
      'armv7hf': 'armv7hf',
      'armv7l': 'armv7hf',
      'armv7': 'armv7hf',
      'x86_64': 'x86_64',
      'amd64': 'x86_64'
    };
    
    const normalizedArch = archMap[arch] || arch;
    
    return `anava-baton-${osVersion}-${normalizedArch}.eap`;
  }

  displaySummary(results) {
    console.log(colors.cyan('\n=== DETECTION SUMMARY ===\n'));
    
    const table = [
      ['Property', 'Value', 'Status'],
      ['─'.repeat(20), '─'.repeat(40), '─'.repeat(10)],
      ['Camera IP', results.ip, '✓'],
      ['Model', results.model || 'Unknown', results.model ? '✓' : '⚠'],
      ['Device ID', results.deviceId || 'Not detected', results.deviceId ? '✓' : '⚠'],
      ['Firmware', results.firmware || 'Unknown', results.firmware ? '✓' : '✗'],
      ['OS Version', results.osVersion || 'Unknown', results.osVersion ? '✓' : '✗'],
      ['Architecture', results.architecture || 'Unknown', results.architecture ? '✓' : '✗'],
      ['SOC', results.soc || 'Not detected', results.soc ? '✓' : '-'],
      ['Detection Method', results.detectionMethod || 'N/A', '-'],
      ['System Properties', `${results.availableProperties.length} available`, '-']
    ];

    for (const row of table) {
      const [prop, value, status] = row;
      let statusColor = status === '✓' ? colors.green : 
                        status === '✗' ? colors.red : 
                        status === '⚠' ? colors.yellow : 
                        colors.gray;
      console.log(`${colors.cyan(prop.padEnd(20))} ${value.padEnd(40)} ${statusColor(status)}`);
    }

    console.log(colors.cyan('\n=== RECOMMENDED ACAP FILE ===\n'));
    console.log(colors.green.bold(`  ${results.recommendedAcap}`));
    
    if (results.detectionMethod === 'Default (most common)') {
      console.log(colors.yellow('\n⚠ WARNING: Architecture was not detected and defaulted to aarch64.'));
      console.log(colors.yellow('  Please verify this is correct for your camera model.'));
    }
  }

  displayCurlCommands(results) {
    console.log(colors.cyan('\n=== CURL COMMANDS FOR MANUAL VERIFICATION ===\n'));
    
    const commands = [
      {
        desc: 'Get firmware version',
        cmd: `curl -k -u ${this.username}:${this.password} "https://${this.ip}/axis-cgi/param.cgi?action=list&group=Properties.Firmware.Version"`
      },
      {
        desc: 'Get architecture',
        cmd: `curl -k -u ${this.username}:${this.password} "https://${this.ip}/axis-cgi/param.cgi?action=list&group=Properties.System.Architecture"`
      },
      {
        desc: 'Get all system properties',
        cmd: `curl -k -u ${this.username}:${this.password} "https://${this.ip}/axis-cgi/param.cgi?action=list&group=Properties.System"`
      },
      {
        desc: 'Get installed applications',
        cmd: `curl -k -u ${this.username}:${this.password} "https://${this.ip}/axis-cgi/applications/list.cgi"`
      }
    ];

    for (const { desc, cmd } of commands) {
      console.log(colors.gray(`# ${desc}`));
      console.log(cmd);
      console.log();
    }

    // Display all available system properties
    if (Object.keys(results.allProperties).length > 0) {
      console.log(colors.cyan('\n=== ALL SYSTEM PROPERTIES ===\n'));
      for (const [key, value] of Object.entries(results.allProperties)) {
        console.log(colors.gray(`Properties.System.${key}=`) + value);
      }
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log(colors.yellow('Usage: node test-camera-architecture-detection.js <camera-ip> <username> <password>'));
    console.log(colors.gray('Example: node test-camera-architecture-detection.js 192.168.50.156 anava baton'));
    process.exit(1);
  }

  const [ip, username, password] = args;
  
  const detector = new CameraArchitectureDetector(ip, username, password);
  await detector.detectArchitecture();
}

// Check if colors module is installed
try {
  require.resolve('colors');
  main();
} catch (e) {
  console.log('Installing required dependency: colors');
  require('child_process').execSync('npm install colors', { stdio: 'inherit' });
  console.log('Dependency installed. Please run the script again.');
}