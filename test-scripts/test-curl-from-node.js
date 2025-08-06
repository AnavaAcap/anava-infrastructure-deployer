const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const ip = '192.168.50.156';
const username = 'anava';
const password = 'baton';
const licenseKey = '2Z7YMSDTTF44N5JAX422';
const applicationName = 'BatonAnalytic';

async function activateLicenseWithCurl() {
  const formData = `action=license&ApplicationName=${applicationName}&LicenseKey=${licenseKey}`;
  
  const curlCommand = `curl -s --digest -u "${username}:${password}" \
    -X POST \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data "${formData}" \
    "http://${ip}/axis-cgi/applications/control.cgi"`;
  
  console.log('Activating license using curl...');
  
  try {
    const { stdout, stderr } = await execPromise(curlCommand);
    
    if (stderr) {
      console.error('Curl stderr:', stderr);
    }
    
    console.log('Curl response:', stdout);
    
    // Check the response
    if (stdout.includes('OK')) {
      console.log('License activated successfully!');
      return true;
    } else if (stdout.includes('Error: 1')) {
      console.log('License activation returned Error: 1 - license may still be applied');
      return true;
    } else {
      console.error('Unexpected response:', stdout);
      return false;
    }
  } catch (error) {
    console.error('Error executing curl:', error);
    return false;
  }
}

activateLicenseWithCurl();