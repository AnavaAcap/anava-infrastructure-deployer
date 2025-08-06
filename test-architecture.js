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

    const response1 = await axios(config1);

    if (response1.status === 401) {
      const wwwAuth = response1.headers['www-authenticate'];
      
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
        
        // Second request with auth
        const config2 = {
          ...config1,
          headers: {
            'Authorization': authHeader
          }
        };

        const response2 = await axios(config2);
        return response2;
      }
    } else if (response1.status === 200) {
      return response1;
    }
    
    throw new Error(`Unexpected response: ${response1.status}`);
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}

async function checkArchitecture() {
  try {
    console.log('=== Checking Camera Architecture ===\n');
    
    // Try different property groups to find architecture info
    const propertyGroups = [
      'Properties.System.Architecture',
      'Properties.System',
      'Properties.API.HTTP.Version',
      'Properties'
    ];
    
    for (const group of propertyGroups) {
      console.log(`\nTrying group: ${group}`);
      console.log('-'.repeat(50));
      
      try {
        const response = await digestAuth(
          CAMERA_IP,
          USERNAME,
          PASSWORD,
          'GET',
          `/axis-cgi/param.cgi?action=list&group=${group}`
        );
        
        if (response && response.data) {
          const data = String(response.data);
          
          // Show first 1000 chars to see what's available
          console.log('Response (first 1000 chars):');
          console.log(data.substring(0, 1000));
          
          // Look for architecture patterns
          if (data.toLowerCase().includes('arch')) {
            console.log('\n✓ Found architecture-related info!');
            const lines = data.split('\n');
            lines.forEach(line => {
              if (line.toLowerCase().includes('arch')) {
                console.log(`  ${line}`);
              }
            });
          }
          
          // Look for SOC info
          if (data.includes('Soc=')) {
            const socMatch = data.match(/Soc=([^\r\n]+)/);
            if (socMatch) {
              console.log(`\n✓ System on Chip: ${socMatch[1]}`);
              // CV25 = aarch64 (ARM 64-bit)
              // ARTPEC-7 = armv7hf (ARM 32-bit)
              // ARTPEC-8 = aarch64 (ARM 64-bit)
              const soc = socMatch[1];
              let arch = 'unknown';
              if (soc.includes('CV25') || soc.includes('ARTPEC-8')) {
                arch = 'aarch64';
              } else if (soc.includes('ARTPEC-7')) {
                arch = 'armv7hf';
              }
              console.log(`  Inferred architecture: ${arch}`);
            }
          }
        }
      } catch (error) {
        console.log(`Error fetching ${group}: ${error.message}`);
      }
    }
    
    console.log('\n=== Test Complete ===');
    
  } catch (error) {
    console.error('\nError:', error.message);
    process.exit(1);
  }
}

// Run the test
checkArchitecture().catch(console.error);