const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs').promises;

const ip = '192.168.50.156';
const username = 'anava';
const password = 'baton';

// The XML we captured from Puppeteer
const licenseXML = `<LicenseKey>
    <Info></Info>
    <FormatVersion>1</FormatVersion>
    <ApplicationID>415129</ApplicationID>
    <MinimumMajorVersion>-1</MinimumMajorVersion>
    <MinimumMinorVersion>-1</MinimumMinorVersion>
    <MaximumMajorVersion>-1</MaximumMajorVersion>
    <MaximumMinorVersion>-1</MaximumMinorVersion>
    <ExpirationDate>2025-09-04</ExpirationDate>
    <DeviceID>B8A44F45D624</DeviceID>
    <SignatureKeyID>1</SignatureKeyID>
    <Signature>CUGfNg4Rq6gd+/IJK/KIIPvbv2ElovWG9XE+Tys1K6tG7J1sP8IsUDmBO5wI3F3hq2esWJIL7KLIrSTuwExAf2bLDy6Z4rnLavsQPauLsuQhVNQkF7cRBQDdbfgK9dgo0ZYecHzIHmRdh/2XrFO28JRn5s6VXhO7L4FaWL1IHNs=</Signature>
</LicenseKey>`;

async function uploadLicenseXML() {
  console.log('Testing direct XML upload...\n');
  
  // Save XML to temp file
  const tempFile = '/tmp/license.xml';
  await fs.writeFile(tempFile, licenseXML);
  
  const url = `http://${ip}/axis-cgi/applications/license.cgi?action=uploadlicensekey&package=BatonAnalytic`;
  
  // Try with multipart form data
  const command = `curl -v --digest -u "${username}:${password}" \
    -F "fileData=@${tempFile};type=text/xml" \
    "${url}"`;
  
  console.log('Uploading XML to camera...');
  
  try {
    const { stdout, stderr } = await execPromise(command);
    console.log('\nResponse:', stdout);
    console.log('\nHeaders:', stderr);
    
    // Check license status
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\n\nChecking license status...');
    const statusCommand = `curl -s --digest -u "${username}:${password}" "http://${ip}/axis-cgi/applications/list.cgi" | grep -A5 -B5 BatonAnalytic`;
    
    const { stdout: status } = await execPromise(statusCommand);
    console.log('\nApplication status:');
    console.log(status);
    
    // Clean up
    await fs.unlink(tempFile);
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

uploadLicenseXML();