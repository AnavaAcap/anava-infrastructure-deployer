const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const ip = '192.168.50.156';
const username = 'anava';
const password = 'baton';
const licenseKey = '2Z7YMSDTTF44N5JAX422';
const serialNumber = 'B8A44F45D624';

async function testConvertEndpoint() {
  console.log('Testing the convert endpoint that returned 400...\n');
  
  // Test 1: Try POST with different parameter combinations
  console.log('Test 1: POST requests with different parameters...');
  
  const paramCombos = [
    `key=${licenseKey}`,
    `licensekey=${licenseKey}`,
    `licenseCode=${licenseKey}`,
    `license=${licenseKey}`,
    `key=${licenseKey}&serial=${serialNumber}`,
    `key=${licenseKey}&deviceId=${serialNumber}`,
    `licenseCode=${licenseKey}&serialNumber=${serialNumber}`,
    `licenseCode=${licenseKey}&deviceId=${serialNumber}`,
  ];
  
  for (const params of paramCombos) {
    console.log(`\nTrying POST with: ${params}`);
    
    const command = `curl -v --digest -u "${username}:${password}" \
      -X POST \
      -d "${params}" \
      "http://${ip}/axis-cgi/applications/license.cgi?action=convert" 2>&1`;
    
    try {
      const { stdout } = await execPromise(command);
      
      // Extract status code
      const statusMatch = stdout.match(/< HTTP\/\d\.\d (\d+)/);
      if (statusMatch) {
        console.log(`Status: ${statusMatch[1]}`);
      }
      
      // Look for response body
      const bodyStart = stdout.lastIndexOf('\n\n');
      if (bodyStart > -1) {
        const body = stdout.substring(bodyStart).trim();
        if (body && body !== '0') {
          console.log('Response:', body);
        }
      }
    } catch (err) {
      console.log('Error:', err.message);
    }
  }
  
  // Test 2: Try with JSON payload
  console.log('\n\nTest 2: POST with JSON payload...');
  
  const jsonPayloads = [
    { key: licenseKey },
    { licenseKey: licenseKey },
    { licenseCode: licenseKey },
    { licenseCode: licenseKey, serialNumber: serialNumber },
    { licenseCode: licenseKey, deviceId: serialNumber },
    { license: { code: licenseKey, serial: serialNumber } },
  ];
  
  for (const payload of jsonPayloads) {
    console.log(`\nTrying JSON: ${JSON.stringify(payload)}`);
    
    const jsonData = JSON.stringify(payload);
    const command = `curl -v --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/json" \
      -d '${jsonData}' \
      "http://${ip}/axis-cgi/applications/license.cgi?action=convert" 2>&1`;
    
    try {
      const { stdout } = await execPromise(command);
      
      const statusMatch = stdout.match(/< HTTP\/\d\.\d (\d+)/);
      if (statusMatch) {
        console.log(`Status: ${statusMatch[1]}`);
      }
      
      const bodyStart = stdout.lastIndexOf('\n\n');
      if (bodyStart > -1) {
        const body = stdout.substring(bodyStart).trim();
        if (body && body !== '0') {
          console.log('Response:', body);
        }
      }
    } catch (err) {
      console.log('Error:', err.message);
    }
  }
  
  // Test 3: Try without action parameter
  console.log('\n\nTest 3: Try other action values...');
  
  const actions = [
    'convertkey',
    'convertlicense', 
    'generate',
    'getlicense',
    'prepare',
  ];
  
  for (const action of actions) {
    console.log(`\nTrying action=${action}`);
    
    const command = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -d "key=${licenseKey}" \
      "http://${ip}/axis-cgi/applications/license.cgi?action=${action}"`;
    
    try {
      const { stdout } = await execPromise(command);
      console.log('Response:', stdout || '(empty)');
    } catch (err) {
      console.log('Error:', err.message);
    }
  }
}

testConvertEndpoint();