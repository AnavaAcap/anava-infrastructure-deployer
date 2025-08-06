const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const ip = '192.168.50.156';
const username = 'anava';
const password = 'baton';
const licenseKey = '2Z7YMSDTTF44N5JAX422';

async function testAllControlActions() {
  console.log('Testing all possible control.cgi actions...\n');
  
  const actions = [
    // Try different action names
    { action: 'setlicense', params: 'ApplicationName=BatonAnalytic&LicenseKey=' + licenseKey },
    { action: 'applylicense', params: 'ApplicationName=BatonAnalytic&LicenseKey=' + licenseKey },
    { action: 'activatelicense', params: 'ApplicationName=BatonAnalytic&LicenseKey=' + licenseKey },
    { action: 'license', params: 'package=BatonAnalytic&LicenseKey=' + licenseKey },
    { action: 'license', params: 'name=BatonAnalytic&key=' + licenseKey },
    { action: 'license', params: 'app=BatonAnalytic&license=' + licenseKey },
    // Try with just the key
    { action: 'license', params: 'LicenseKey=' + licenseKey },
    // Try different formats
    { action: 'setparam', params: 'BatonAnalytic.License=' + licenseKey },
    { action: 'set', params: 'BatonAnalytic.LicenseKey=' + licenseKey },
  ];
  
  for (const test of actions) {
    const formData = `action=${test.action}&${test.params}`;
    console.log(`Testing: ${formData}`);
    
    const command = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/x-www-form-urlencoded" \
      --data "${formData}" \
      "http://${ip}/axis-cgi/applications/control.cgi"`;
    
    try {
      const { stdout } = await execPromise(command);
      console.log(`Response: ${stdout}`);
    } catch (err) {
      console.log(`Error ${err.code}: ${err.stdout}`);
    }
    console.log('---');
  }
  
  // Also check if there's a different endpoint
  console.log('\n=== Checking other possible endpoints ===');
  
  const endpoints = [
    '/axis-cgi/applications/license.cgi',
    '/axis-cgi/license.cgi',
    '/axis-cgi/admin/license.cgi',
    '/local/BatonAnalytic/axis-cgi/license.cgi',
    '/axis-cgi/applications/config.cgi',
  ];
  
  for (const endpoint of endpoints) {
    console.log(`Testing endpoint: ${endpoint}`);
    const command = `curl -s -o /dev/null -w "%{http_code}" --digest -u "${username}:${password}" "${ip}${endpoint}"`;
    
    try {
      const { stdout } = await execPromise(command);
      console.log(`HTTP Status: ${stdout}`);
    } catch (err) {
      console.log(`Error: ${err.message}`);
    }
  }
}

testAllControlActions();