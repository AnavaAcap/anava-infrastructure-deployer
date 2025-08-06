#!/usr/bin/env node

const axios = require('axios');
const crypto = require('crypto');
const https = require('https');

// Camera credentials
const CAMERA_IP = '192.168.50.156';
const USERNAME = 'anava';
const PASSWORD = 'baton';

async function digestAuth(ip, username, password, method, uri) {
  try {
    const url = `http://${ip}${uri}`;
    const httpsAgent = new https.Agent({ rejectUnauthorized: false });
    
    // First request to get digest challenge
    const config1 = {
      method,
      url,
      httpsAgent,
      timeout: 5000,
      validateStatus: () => true
    };

    console.log(`[digestAuth] ${method} ${url}`);
    const response1 = await axios(config1);

    if (response1.status === 401) {
      const wwwAuth = response1.headers['www-authenticate'];
      console.log('[digestAuth] Got 401 challenge:', wwwAuth);
      
      if (wwwAuth && wwwAuth.includes('Digest')) {
        // Parse digest parameters
        const digestData = {};
        const regex = /(\w+)=(?:"([^"]+)"|([^,]+))/g;
        let match;
        while ((match = regex.exec(wwwAuth)) !== null) {
          digestData[match[1]] = match[2] || match[3];
        }

        // Build digest header
        const nc = '00000001';
        const cnonce = crypto.randomBytes(8).toString('hex');
        const ha1 = crypto.createHash('md5')
          .update(`${username}:${digestData.realm}:${password}`)
          .digest('hex');
        const ha2 = crypto.createHash('md5')
          .update(`${method}:${uri}`)
          .digest('hex');
        const response = crypto.createHash('md5')
          .update(`${ha1}:${digestData.nonce}:${nc}:${cnonce}:${digestData.qop}:${ha2}`)
          .digest('hex');
        
        let authHeader = `Digest username="${username}", realm="${digestData.realm}", nonce="${digestData.nonce}", uri="${uri}", qop="${digestData.qop}", nc=${nc}, cnonce="${cnonce}", response="${response}"`;
        
        if (digestData.algorithm) {
          authHeader += `, algorithm=${digestData.algorithm}`;
        }
        
        console.log('[digestAuth] Sending authenticated request...');
        
        // Second request with auth
        const config2 = {
          ...config1,
          headers: {
            'Authorization': authHeader
          }
        };

        const response2 = await axios(config2);
        console.log('[digestAuth] Response status:', response2.status);
        return response2;
      }
    } else if (response1.status === 200) {
      console.log('[digestAuth] No authentication required');
      return response1;
    }
    
    throw new Error(`Unexpected response: ${response1.status}`);
  } catch (error) {
    console.error('[digestAuth] Error:', error.message);
    throw error;
  }
}

async function getFirmwareVersion() {
  try {
    console.log('\n=== Testing Firmware Version Detection ===');
    console.log(`Camera IP: ${CAMERA_IP}`);
    console.log(`Username: ${USERNAME}`);
    
    // Test 1: Get firmware version
    console.log('\n1. Fetching firmware version...');
    const firmwareResponse = await digestAuth(
      CAMERA_IP,
      USERNAME,
      PASSWORD,
      'GET',
      '/axis-cgi/param.cgi?action=list&group=Properties.Firmware.Version'
    );
    
    if (firmwareResponse && firmwareResponse.data) {
      const data = String(firmwareResponse.data);
      console.log('Raw firmware response:');
      console.log(data);
      
      const versionMatch = data.match(/Properties\.Firmware\.Version=([^\r\n]+)/);
      if (versionMatch) {
        const version = versionMatch[1].trim();
        console.log(`\n✓ Firmware version: ${version}`);
        
        // Determine OS version
        const parts = version.split('.');
        const majorVersion = parseInt(parts[0], 10);
        const isOS12 = majorVersion >= 11;
        console.log(`✓ Major version: ${majorVersion}`);
        console.log(`✓ Operating System: ${isOS12 ? 'OS12' : 'OS11'}`);
        
        return { version, isOS12 };
      } else {
        console.log('✗ Could not extract firmware version from response');
      }
    }
    
    // Test 2: Get system properties (including architecture if available)
    console.log('\n2. Fetching system properties...');
    const systemResponse = await digestAuth(
      CAMERA_IP,
      USERNAME,
      PASSWORD,
      'GET',
      '/axis-cgi/param.cgi?action=list&group=Properties.System'
    );
    
    if (systemResponse && systemResponse.data) {
      const data = String(systemResponse.data);
      console.log('Raw system properties (first 500 chars):');
      console.log(data.substring(0, 500));
      
      // Look for architecture
      if (data.includes('Architecture=')) {
        const archMatch = data.match(/Architecture=([^\r\n]+)/);
        if (archMatch) {
          console.log(`\n✓ Architecture: ${archMatch[1]}`);
        }
      } else {
        console.log('\n✗ Architecture information not found in Properties.System');
      }
      
      // Look for SOC (System on Chip) info
      if (data.includes('Soc=')) {
        const socMatch = data.match(/Soc=([^\r\n]+)/);
        if (socMatch) {
          console.log(`✓ System on Chip: ${socMatch[1]}`);
        }
      }
    }
    
    // Test 3: Get device info
    console.log('\n3. Fetching device info...');
    const deviceResponse = await digestAuth(
      CAMERA_IP,
      USERNAME,
      PASSWORD,
      'GET',
      '/axis-cgi/param.cgi?action=list&group=Brand'
    );
    
    if (deviceResponse && deviceResponse.data) {
      const data = String(deviceResponse.data);
      console.log('Device info:');
      
      const brandMatch = data.match(/Brand=([^\r\n]+)/);
      const modelMatch = data.match(/ProdNbr=([^\r\n]+)/);
      const typeMatch = data.match(/ProdType=([^\r\n]+)/);
      
      if (brandMatch) console.log(`✓ Brand: ${brandMatch[1]}`);
      if (modelMatch) console.log(`✓ Model: ${modelMatch[1]}`);
      if (typeMatch) console.log(`✓ Product Type: ${typeMatch[1]}`);
    }
    
    console.log('\n=== Test Complete ===');
    
  } catch (error) {
    console.error('\nError during firmware detection test:', error.message);
    process.exit(1);
  }
}

// Run the test
getFirmwareVersion().catch(console.error);