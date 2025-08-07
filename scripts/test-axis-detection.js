#!/usr/bin/env node

/**
 * Test the new Axis device detection approach
 * 1. First detect which IPs have Axis devices (no auth needed)
 * 2. Then classify them with credentials
 */

const axios = require('axios');
const https = require('https');

// Create axios instance that ignores SSL errors
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  }),
  timeout: 2000,
  validateStatus: () => true // Accept any status
});

async function checkIfAxisDevice(ip, port = 80) {
  const protocol = port === 443 ? 'https' : 'http';
  const url = `${protocol}://${ip}:${port}/axis-cgi/param.cgi?action=list&group=Brand`;
  
  console.log(`Checking ${ip}:${port}...`);
  
  try {
    const response = await axiosInstance.get(url);
    
    // Check if we get 401 with Digest auth (Axis device that needs auth)
    if (response.status === 401) {
      const wwwAuth = response.headers['www-authenticate'];
      if (wwwAuth && wwwAuth.includes('Digest')) {
        console.log(`  ✓ Found Axis device (requires auth)`);
        return true;
      } else {
        console.log(`  ✗ 401 but not Digest auth: ${wwwAuth}`);
      }
    } else if (response.status === 200) {
      // Check if response contains Axis brand
      const data = response.data?.toString() || '';
      if (data.includes('Brand=AXIS') || data.includes('root.Brand.Brand=AXIS')) {
        console.log(`  ✓ Found Axis device (no auth required)`);
        return true;
      } else {
        console.log(`  ✗ 200 but not Axis: ${data.substring(0, 100)}`);
      }
    } else {
      console.log(`  ✗ Status ${response.status}`);
    }
  } catch (error) {
    console.log(`  ✗ Connection error: ${error.message}`);
  }
  
  return false;
}

async function classifyDevice(ip, username, password) {
  console.log(`\nClassifying ${ip} with credentials ${username}:${password}...`);
  
  try {
    // Try with basic auth first (simpler for testing)
    const response = await axiosInstance.get(
      `http://${ip}/axis-cgi/param.cgi?action=list&group=Brand`,
      {
        auth: { username, password }
      }
    );
    
    if (response.status === 200) {
      const data = response.data?.toString() || '';
      
      // Extract model and type
      const typeMatch = data.match(/(?:root\.Brand\.)?ProdType=([^\r\n]+)/);
      const modelMatch = data.match(/(?:root\.Brand\.)?ProdNbr=([^\r\n]+)/);
      
      const productType = typeMatch ? typeMatch[1] : 'Unknown';
      const model = modelMatch ? modelMatch[1] : 'Unknown';
      
      // Determine if it's a speaker or camera
      const isSpeaker = productType.toLowerCase().includes('speaker') || 
                       productType.toLowerCase().includes('audio') ||
                       productType.toLowerCase().includes('sound');
      
      console.log(`  Model: ${model}`);
      console.log(`  Type: ${productType}`);
      console.log(`  Classification: ${isSpeaker ? 'SPEAKER' : 'CAMERA'}`);
      
      return { model, productType, isSpeaker };
    } else {
      console.log(`  ✗ Failed to authenticate: ${response.status}`);
    }
  } catch (error) {
    console.log(`  ✗ Error: ${error.message}`);
  }
  
  return null;
}

async function main() {
  console.log('=== Axis Device Detection Test ===\n');
  
  const testIPs = [
    '192.168.50.156', // Your camera
    '192.168.50.121', // Your speaker
    '192.168.50.1',   // Probably router (should fail)
  ];
  
  const axisDevices = [];
  
  // Step 1: Detect Axis devices (no auth needed)
  console.log('STEP 1: Detecting Axis devices (no credentials)...\n');
  
  for (const ip of testIPs) {
    const isAxis = await checkIfAxisDevice(ip, 80);
    if (isAxis) {
      axisDevices.push(ip);
    }
  }
  
  console.log(`\n=== Found ${axisDevices.length} Axis devices: ${axisDevices.join(', ')}\n`);
  
  // Step 2: Classify with credentials
  if (axisDevices.length > 0) {
    console.log('STEP 2: Classifying devices with credentials...\n');
    
    // Try common credentials
    const credentials = [
      { username: 'root', password: '' },
      { username: 'root', password: 'pass' },
      { username: 'anava', password: 'baton' },
      { username: 'root', password: 'root' },
    ];
    
    for (const ip of axisDevices) {
      let classified = false;
      
      for (const cred of credentials) {
        const result = await classifyDevice(ip, cred.username, cred.password);
        if (result) {
          classified = true;
          break;
        }
      }
      
      if (!classified) {
        console.log(`\n  Could not classify ${ip} - wrong credentials?`);
      }
    }
  }
  
  console.log('\n=== Test Complete ===');
}

main().catch(console.error);