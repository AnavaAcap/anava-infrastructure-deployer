const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const ip = '192.168.50.156';
const username = 'anava';
const password = 'baton';
const licenseKey = '2Z7YMSDTTF44N5JAX422';

async function testLicenseCGI() {
  console.log('Testing /axis-cgi/applications/license.cgi endpoint...\n');
  
  // First, let's see what this endpoint returns with GET
  console.log('=== GET request to see what it returns ===');
  let command = `curl -v --digest -u "${username}:${password}" \
    "http://${ip}/axis-cgi/applications/license.cgi"`;
  
  try {
    const { stdout, stderr } = await execPromise(command);
    console.log('Response:', stdout);
    console.log('Headers:', stderr);
  } catch (err) {
    console.log('Error:', err.stdout);
  }
  
  console.log('\n=== POST with license data ===');
  // Try posting license data
  const formData = `ApplicationName=BatonAnalytic&LicenseKey=${licenseKey}`;
  command = `curl -v --digest -u "${username}:${password}" \
    -X POST \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data "${formData}" \
    "http://${ip}/axis-cgi/applications/license.cgi"`;
  
  try {
    const { stdout, stderr } = await execPromise(command);
    console.log('Response:', stdout);
    console.log('Headers:', stderr);
  } catch (err) {
    console.log('Error:', err.stdout);
    console.log('Stderr:', err.stderr);
  }
  
  // Try different parameter names
  console.log('\n=== Try different parameter formats ===');
  const variations = [
    'action=apply&ApplicationName=BatonAnalytic&LicenseKey=' + licenseKey,
    'action=set&ApplicationName=BatonAnalytic&LicenseKey=' + licenseKey,
    'app=BatonAnalytic&key=' + licenseKey,
    'application=BatonAnalytic&license=' + licenseKey,
    'name=BatonAnalytic&value=' + licenseKey,
  ];
  
  for (const data of variations) {
    console.log(`\nTrying: ${data}`);
    command = `curl -s --digest -u "${username}:${password}" \
      -X POST \
      -H "Content-Type: application/x-www-form-urlencoded" \
      --data "${data}" \
      "http://${ip}/axis-cgi/applications/license.cgi"`;
    
    try {
      const { stdout } = await execPromise(command);
      console.log('Response:', stdout);
    } catch (err) {
      console.log('Error:', err.stdout || err.message);
    }
  }
}

testLicenseCGI();