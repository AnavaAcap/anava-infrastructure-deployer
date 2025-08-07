#!/usr/bin/env node

/**
 * Test script to verify network scanning logic
 * Tests specific IPs: 192.168.50.156 (camera) and 192.168.50.121 (speaker)
 */

const axios = require('axios');
const https = require('https');

// Create axios instance that ignores SSL errors
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  }),
  timeout: 3000,
  validateStatus: () => true // Accept any status
});

async function testDevice(ip, port = 80, username = 'root', password = '') {
  const protocol = port === 443 ? 'https' : 'http';
  const url = `${protocol}://${ip}:${port}`;
  
  console.log(`Testing ${url}...`);
  
  try {
    // First try basic request
    const response = await axiosInstance.get(url, {
      headers: {
        'User-Agent': 'Anava-Scanner/1.0'
      }
    });
    
    const headers = response.headers;
    const status = response.status;
    
    console.log(`  Status: ${status}`);
    console.log(`  Server: ${headers.server || 'Unknown'}`);
    console.log(`  WWW-Authenticate: ${headers['www-authenticate'] || 'None'}`);
    
    // Try Axis-specific endpoint
    const axisUrl = `${protocol}://${ip}:${port}/axis-cgi/param.cgi?action=list&group=Brand`;
    console.log(`  Testing Axis endpoint: ${axisUrl}`);
    
    try {
      const axisResponse = await axiosInstance.get(axisUrl, {
        auth: password ? { username, password } : undefined,
        headers: {
          'User-Agent': 'Anava-Scanner/1.0'
        }
      });
      
      console.log(`    Axis endpoint status: ${axisResponse.status}`);
      if (axisResponse.data) {
        const data = axisResponse.data.toString();
        if (data.includes('Brand=AXIS')) {
          console.log(`    ✓ Confirmed Axis device!`);
          
          // Extract product type
          const typeMatch = data.match(/ProdType=([^\r\n]+)/);
          const modelMatch = data.match(/ProdNbr=([^\r\n]+)/);
          
          if (typeMatch) {
            console.log(`    Product Type: ${typeMatch[1]}`);
          }
          if (modelMatch) {
            console.log(`    Model: ${modelMatch[1]}`);
          }
          
          return { success: true, type: 'axis', productType: typeMatch?.[1], model: modelMatch?.[1] };
        }
      }
    } catch (axisError) {
      console.log(`    Axis endpoint error: ${axisError.message}`);
      if (axisError.response?.status === 401) {
        console.log(`    Device requires authentication - likely an Axis device`);
      }
    }
    
    return { success: true, type: 'unknown', headers };
  } catch (error) {
    console.log(`  Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function getIPRange(network) {
  const [baseIp, subnetStr] = network.split('/');
  const subnet = parseInt(subnetStr);
  const hostBits = 32 - subnet;
  const numHosts = Math.pow(2, hostBits);
  
  function ipToNumber(ip) {
    return ip.split('.').reduce((num, octet) => {
      return (num << 8) + parseInt(octet);
    }, 0) >>> 0;
  }
  
  function numberToIP(num) {
    return [
      (num >>> 24) & 255,
      (num >>> 16) & 255,
      (num >>> 8) & 255,
      num & 255
    ].join('.');
  }
  
  const startNum = ipToNumber(baseIp);
  const ips = [];
  
  // Skip network address and broadcast address
  for (let i = 1; i < numHosts - 1; i++) {
    ips.push(numberToIP(startNum + i));
  }
  
  return ips;
}

async function main() {
  console.log('=== Network Scan Test ===\n');
  
  // Test known devices
  console.log('Testing known devices:');
  console.log('------------------------');
  
  // Test camera at 192.168.50.156
  console.log('\n1. Camera at 192.168.50.156:');
  await testDevice('192.168.50.156', 80);
  await testDevice('192.168.50.156', 443);
  
  // Test speaker at 192.168.50.121  
  console.log('\n2. Speaker at 192.168.50.121:');
  await testDevice('192.168.50.121', 80);
  await testDevice('192.168.50.121', 443);
  
  // Test IP range generation
  console.log('\n\nTesting IP range generation:');
  console.log('-----------------------------');
  const ips = await getIPRange('192.168.50.0/24');
  console.log(`Generated ${ips.length} IPs from 192.168.50.0/24`);
  console.log(`First 5 IPs: ${ips.slice(0, 5).join(', ')}`);
  console.log(`Last 5 IPs: ${ips.slice(-5).join(', ')}`);
  
  // Check if our target IPs are in the range
  const hasCamera = ips.includes('192.168.50.156');
  const hasSpeaker = ips.includes('192.168.50.121');
  
  console.log(`\n192.168.50.156 in range: ${hasCamera ? '✓' : '✗'}`);
  console.log(`192.168.50.121 in range: ${hasSpeaker ? '✓' : '✗'}`);
  
  // Test the "common IPs" filter logic
  console.log('\n\nTesting common IP filter:');
  console.log('-------------------------');
  const commonCameraIPs = ips.filter(ip => {
    const lastOctet = parseInt(ip.split('.').pop() || '0');
    return (lastOctet >= 100 && lastOctet <= 200) || 
           lastOctet === 64 || lastOctet === 88 || lastOctet === 156;
  });
  
  console.log(`Common camera IPs: ${commonCameraIPs.length} total`);
  console.log(`156 included: ${commonCameraIPs.includes('192.168.50.156') ? '✓' : '✗'}`);
  console.log(`121 included: ${commonCameraIPs.includes('192.168.50.121') ? '✓' : '✗'}`);
}

main().catch(console.error);