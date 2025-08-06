const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const ip = '192.168.50.156';
const username = 'anava';
const password = 'baton';
const licenseKey = '2Z7YMSDTTF44N5JAX422';

async function findLicenseConversion() {
  console.log('Looking for API endpoints that might convert license key to XML...\n');
  
  // Check if there's a "prepare" or "generate" action
  const actions = [
    'preparelicense',
    'generatelicense', 
    'getlicensexml',
    'convertlicense',
    'validatelicense',
    'checklicense'
  ];
  
  for (const action of actions) {
    console.log(`\nTrying action=${action}...`);
    
    // Try with GET
    let command = `curl -s --digest -u "${username}:${password}" "http://${ip}/axis-cgi/applications/license.cgi?action=${action}&package=BatonAnalytic&key=${licenseKey}"`;
    
    try {
      const { stdout } = await execPromise(command);
      if (!stdout.includes('Error') && stdout.length > 50) {
        console.log('GET Response:', stdout.substring(0, 200) + '...');
      } else {
        console.log('GET Response:', stdout);
      }
    } catch (err) {
      console.log('GET Error:', err.code);
    }
    
    // Try with POST
    command = `curl -s --digest -u "${username}:${password}" -X POST -d "action=${action}&package=BatonAnalytic&key=${licenseKey}" "http://${ip}/axis-cgi/applications/license.cgi"`;
    
    try {
      const { stdout } = await execPromise(command);
      if (!stdout.includes('Error') && stdout.length > 50) {
        console.log('POST Response:', stdout.substring(0, 200) + '...');
      } else {
        console.log('POST Response:', stdout);
      }
    } catch (err) {
      console.log('POST Error:', err.code);
    }
  }
  
  // Also check if the camera generates the XML when we provide the plain key
  console.log('\n\n=== Checking if BatonAnalytic app has its own license endpoint ===');
  
  const appEndpoints = [
    '/local/BatonAnalytic/license',
    '/local/BatonAnalytic/api/license',
    '/local/BatonAnalytic/cgi-bin/license.cgi',
    '/local/BatonAnalytic/axis-cgi/license.cgi'
  ];
  
  for (const endpoint of appEndpoints) {
    console.log(`\nChecking ${endpoint}...`);
    const command = `curl -s -o /dev/null -w "%{http_code}" --digest -u "${username}:${password}" "http://${ip}${endpoint}"`;
    
    try {
      const { stdout } = await execPromise(command);
      console.log(`HTTP Status: ${stdout}`);
      
      if (stdout === '200') {
        // Try to get the content
        const contentCmd = `curl -s --digest -u "${username}:${password}" "http://${ip}${endpoint}"`;
        const { stdout: content } = await execPromise(contentCmd);
        console.log('Content:', content.substring(0, 200));
      }
    } catch (err) {
      console.log('Error:', err.message);
    }
  }
}

findLicenseConversion();