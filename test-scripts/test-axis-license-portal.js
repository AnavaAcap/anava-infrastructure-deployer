const puppeteer = require('puppeteer');
const axios = require('axios');

// Test if we can access the Axis license portal programmatically
async function testAxisPortal() {
  console.log('Testing Axis license portal access...\n');
  
  const licenseCode = '2Z7YMSDTTF44N5JAX422';
  const serialNumber = 'B8A44F45D624';
  
  // Test 1: Try the license portal API directly
  console.log('Test 1: Direct API access to license portal...');
  try {
    // Try various endpoints
    const endpoints = [
      'https://www.axis.com/applications/api/license',
      'https://license-portal.lp.axis.com/api/license',
      'https://www.axis.com/applications/license/convert',
      'https://api.axis.com/license/convert',
    ];
    
    for (const endpoint of endpoints) {
      console.log(`\nTrying: ${endpoint}`);
      try {
        const response = await axios.post(endpoint, {
          licenseCode: licenseCode,
          serialNumber: serialNumber,
          deviceId: serialNumber
        }, {
          timeout: 5000,
          validateStatus: () => true
        });
        
        console.log(`Status: ${response.status}`);
        if (response.status !== 404) {
          console.log('Headers:', response.headers);
          console.log('Data:', response.data);
        }
      } catch (err) {
        console.log('Error:', err.code || err.message);
      }
    }
  } catch (err) {
    console.log('Error:', err.message);
  }
  
  // Test 2: Check if the camera itself can proxy the request
  console.log('\n\nTest 2: Checking if camera can handle license conversion...');
  
  // Test 3: Try to simulate what ADM might do
  console.log('\n\nTest 3: Simulating Axis Device Manager approach...');
  console.log('ADM might be:');
  console.log('1. Using Windows credentials/certificates for authentication');
  console.log('2. Using a pre-shared API key distributed with ADM software');
  console.log('3. Having users log in with their Axis account');
  console.log('4. Using the camera\'s own credentials to authenticate');
  
  // Test 4: Check for alternate endpoints on the camera
  console.log('\n\nTest 4: Looking for other license endpoints on camera...');
  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);
  
  const cameraEndpoints = [
    '/axis-cgi/applications/license.cgi?action=convert',
    '/axis-cgi/applications/license.cgi?action=getxml',
    '/axis-cgi/license/convert.cgi',
    '/axis-cgi/admin/license.cgi',
  ];
  
  for (const endpoint of cameraEndpoints) {
    const url = `http://192.168.50.156${endpoint}&key=${licenseCode}`;
    const command = `curl -s -o /dev/null -w "%{http_code}" --digest -u "anava:baton" "${url}"`;
    
    try {
      const { stdout } = await execPromise(command);
      console.log(`${endpoint}: HTTP ${stdout}`);
      
      if (stdout !== '404' && stdout !== '405') {
        // Try to get actual response
        const getCommand = `curl -s --digest -u "anava:baton" "${url}"`;
        const { stdout: content } = await execPromise(getCommand);
        console.log('Response:', content.substring(0, 200));
      }
    } catch (err) {
      console.log(`${endpoint}: Error`);
    }
  }
}

testAxisPortal();