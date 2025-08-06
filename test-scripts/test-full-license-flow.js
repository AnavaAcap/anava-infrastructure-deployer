const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const FormData = require('form-data');

const ip = '192.168.50.156';
const username = 'anava';
const password = 'baton';
const licenseKey = '2Z7YMSDTTF44N5JAX422';

async function getDeviceId() {
  // Get MAC address from camera
  const command = `curl -s --digest -u "${username}:${password}" "http://${ip}/axis-cgi/param.cgi?action=list&group=Network.eth0.MACAddress"`;
  
  try {
    const { stdout } = await execPromise(command);
    // Extract MAC address and remove colons
    const match = stdout.match(/MACAddress=([A-F0-9:]+)/i);
    if (match) {
      return match[1].replace(/:/g, '');
    }
  } catch (err) {
    console.error('Error getting device ID:', err.message);
  }
  
  // Fallback to the known device ID
  return 'B8A44F45D624';
}

async function getLicenseXMLFromAxis(deviceId, licenseCode) {
  console.log(`Getting license XML from Axis for device ${deviceId}...`);
  
  try {
    const response = await axios.post(
      'https://gateway.api.axis.com/info-ext/acap/aca/oldGw/v2/licensekey',
      {
        deviceId: deviceId,
        licenseCode: licenseCode
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );
    
    console.log('Axis API response received');
    
    if (response.data && response.data.xml) {
      console.log('XML found in response');
      return response.data.xml;
    } else {
      console.error('No XML in response:', response.data);
      return null;
    }
  } catch (err) {
    console.error('Error calling Axis API:', err.message);
    if (err.response) {
      console.error('Response status:', err.response.status);
      console.error('Response data:', err.response.data);
    }
    return null;
  }
}

async function uploadLicenseToCamera(ip, username, password, xmlContent) {
  console.log('\nUploading license XML to camera...');
  
  const url = `http://${ip}/axis-cgi/applications/license.cgi?action=uploadlicensekey&package=BatonAnalytic`;
  
  // Create form data with the XML file
  const form = new FormData();
  form.append('fileData', Buffer.from(xmlContent), {
    filename: 'license.xml',
    contentType: 'text/xml'
  });
  
  const command = `curl -v --digest -u "${username}:${password}" \
    -F "fileData=@-;filename=license.xml;type=text/xml" \
    "${url}" <<< '${xmlContent.replace(/'/g, "'\"'\"'")}'`;
  
  try {
    const { stdout, stderr } = await execPromise(command);
    console.log('Upload response:', stdout);
    console.log('Headers:', stderr);
    
    return stdout.includes('OK') || stdout.includes('Error: 0');
  } catch (err) {
    console.error('Upload error:', err.message);
    return false;
  }
}

async function checkLicenseStatus(ip, username, password) {
  console.log('\nChecking license status...');
  
  const command = `curl -s --digest -u "${username}:${password}" "http://${ip}/axis-cgi/applications/list.cgi" | grep -A5 -B5 BatonAnalytic`;
  
  try {
    const { stdout } = await execPromise(command);
    console.log('Application status:');
    console.log(stdout);
    
    return stdout.includes('License="Valid"');
  } catch (err) {
    console.error('Status check error:', err.message);
    return false;
  }
}

async function fullLicenseActivation() {
  console.log('=== Full License Activation Flow ===\n');
  
  // Step 1: Get device ID
  const deviceId = await getDeviceId();
  console.log('Device ID:', deviceId);
  
  // Step 2: Get license XML from Axis API
  const licenseXML = await getLicenseXMLFromAxis(deviceId, licenseKey);
  
  if (!licenseXML) {
    console.error('Failed to get license XML from Axis');
    return;
  }
  
  console.log('\nReceived license XML:');
  console.log(licenseXML);
  
  // Step 3: Upload license to camera
  const uploadSuccess = await uploadLicenseToCamera(ip, username, password, licenseXML);
  
  if (uploadSuccess) {
    console.log('\nLicense upload successful!');
    
    // Step 4: Verify activation
    await new Promise(resolve => setTimeout(resolve, 2000));
    const isActivated = await checkLicenseStatus(ip, username, password);
    
    if (isActivated) {
      console.log('\n✅ License activation SUCCESSFUL!');
    } else {
      console.log('\n⚠️ License uploaded but not showing as Valid yet');
    }
  } else {
    console.log('\n❌ License upload failed');
  }
}

fullLicenseActivation();