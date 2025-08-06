const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const ip = '192.168.50.156';
const username = 'anava';
const password = 'baton';
const licenseKey = '2Z7YMSDTTF44N5JAX422';

async function startApplicationFirst() {
  console.log('Maybe we need to start the application first before applying license...\n');
  
  // First, try to start the application
  console.log('=== Starting BatonAnalytic application ===');
  const startCommand = `curl -s --digest -u "${username}:${password}" \
    -X POST \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data "action=start&package=BatonAnalytic" \
    "http://${ip}/axis-cgi/applications/control.cgi"`;
  
  try {
    const { stdout: startOut } = await execPromise(startCommand);
    console.log('Start response:', startOut);
  } catch (err) {
    console.log('Start error code:', err.code);
    console.log('Start response:', err.stdout);
  }
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Now try to apply license
  console.log('\n=== Applying license after start ===');
  const licenseCommand = `curl -s --digest -u "${username}:${password}" \
    -X POST \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data "action=license&ApplicationName=BatonAnalytic&LicenseKey=${licenseKey}" \
    "http://${ip}/axis-cgi/applications/control.cgi"`;
  
  try {
    const { stdout: licenseOut } = await execPromise(licenseCommand);
    console.log('License response:', licenseOut);
  } catch (err) {
    console.log('License error code:', err.code);
    console.log('License response:', err.stdout);
  }
  
  // Check status
  console.log('\n=== Checking application status ===');
  const checkCommand = `curl -s --digest -u "${username}:${password}" \
    "http://${ip}/axis-cgi/applications/list.cgi" | grep -A5 -B5 BatonAnalytic`;
  
  try {
    const { stdout: checkOut } = await execPromise(checkCommand);
    console.log('Status:', checkOut);
  } catch (err) {
    console.log('Check response:', err.stdout || err.stderr);
  }
}

// Also let's try the license.cgi endpoint instead
async function tryLicenseCGI() {
  console.log('\n\n=== Trying license.cgi endpoint ===');
  
  const licenseCommand = `curl -v --digest -u "${username}:${password}" \
    -X POST \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data "AppName=BatonAnalytic&LicenseKey=${licenseKey}" \
    "http://${ip}/local/BatonAnalytic/license.cgi"`;
  
  try {
    const { stdout, stderr } = await execPromise(licenseCommand);
    console.log('Response:', stdout);
    console.log('Stderr:', stderr);
  } catch (err) {
    console.log('Error code:', err.code);
    console.log('Response:', err.stdout);
    console.log('Stderr:', err.stderr);
  }
}

async function main() {
  await startApplicationFirst();
  await tryLicenseCGI();
}

main();