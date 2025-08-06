const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const ip = '192.168.50.156';
const username = 'anava';
const password = 'baton';
const licenseKey = '2Z7YMSDTTF44N5JAX422';

async function testCameraProxy() {
  console.log('Testing if camera can proxy the license request...\n');
  
  // Maybe the camera itself can generate or fetch the XML
  const endpoints = [
    // Try different actions
    `/axis-cgi/applications/license.cgi?action=generate&key=${licenseKey}&package=BatonAnalytic`,
    `/axis-cgi/applications/license.cgi?action=prepare&key=${licenseKey}&package=BatonAnalytic`,
    `/axis-cgi/applications/license.cgi?action=validate&key=${licenseKey}&package=BatonAnalytic`,
    `/axis-cgi/applications/license.cgi?action=convert&key=${licenseKey}&package=BatonAnalytic`,
    
    // Try POST with key in body
    `/axis-cgi/applications/license.cgi?action=uploadlicensekey&package=BatonAnalytic`,
  ];
  
  for (const endpoint of endpoints) {
    console.log(`\nTrying: ${endpoint}`);
    
    if (endpoint.includes('action=uploadlicensekey')) {
      // Try POST with plain key
      const command = `curl -v --digest -u "${username}:${password}" \
        -d "key=${licenseKey}" \
        "http://${ip}${endpoint}"`;
      
      try {
        const { stdout, stderr } = await execPromise(command);
        console.log('Response:', stdout);
        if (stdout.includes('<LicenseKey>') || stdout.includes('<?xml')) {
          console.log('*** XML FOUND! ***');
        }
      } catch (err) {
        console.log('Error:', err.message);
      }
    } else {
      // Try GET
      const command = `curl -s --digest -u "${username}:${password}" "http://${ip}${endpoint}"`;
      
      try {
        const { stdout } = await execPromise(command);
        console.log('Response:', stdout);
        if (stdout.includes('<LicenseKey>') || stdout.includes('<?xml')) {
          console.log('*** XML FOUND! ***');
        }
      } catch (err) {
        console.log('Error:', err.message);
      }
    }
  }
  
  // Also check if camera has a built-in endpoint for Axis API
  console.log('\n\nChecking for Axis API proxy endpoints...');
  
  const proxyEndpoints = [
    '/axis-cgi/license/api',
    '/axis-cgi/proxy/license',
    '/local/license/api',
    '/axis-cgi/gateway/license',
  ];
  
  for (const endpoint of proxyEndpoints) {
    const command = `curl -s -o /dev/null -w "%{http_code}" --digest -u "${username}:${password}" "http://${ip}${endpoint}"`;
    
    try {
      const { stdout } = await execPromise(command);
      console.log(`${endpoint}: HTTP ${stdout}`);
      
      if (stdout !== '404' && stdout !== '403') {
        // Try to POST license key
        const postCmd = `curl -s --digest -u "${username}:${password}" \
          -H "Content-Type: application/json" \
          -d '{"deviceId":"B8A44F45D624","licenseCode":"${licenseKey}"}' \
          "http://${ip}${endpoint}"`;
        
        const { stdout: response } = await execPromise(postCmd);
        console.log('Response:', response.substring(0, 200));
      }
    } catch (err) {
      // Ignore
    }
  }
}

testCameraProxy();