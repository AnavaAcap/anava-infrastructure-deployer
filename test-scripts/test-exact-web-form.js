const axios = require('axios');
const crypto = require('crypto');
const FormData = require('form-data');

const ip = '192.168.50.156';
const username = 'anava';
const password = 'baton';
const licenseKey = '2Z7YMSDTTF44N5JAX422';

async function activateLicenseExactlyLikeWebUI() {
  console.log('Testing license activation with different approaches...\n');
  
  // First, let's see what the web UI might be sending differently
  // The key might need to be in a different format
  
  // Try 1: Plain license key
  console.log('=== Try 1: Plain license key ===');
  await testActivation(licenseKey);
  
  // Try 2: License key with dashes in different positions
  console.log('\n=== Try 2: License key with dashes ===');
  const keyWithDashes = licenseKey.match(/.{1,5}/g).join('-'); // 2Z7YM-SDTTF-44N5J-AX422
  await testActivation(keyWithDashes);
  
  // Try 3: Different parameter order
  console.log('\n=== Try 3: Different parameter order ===');
  await testActivationDifferentOrder(licenseKey);
  
  // Try 4: Using multipart form data
  console.log('\n=== Try 4: Using multipart form data ===');
  await testActivationMultipart(licenseKey);
}

async function testActivation(key) {
  const url = `http://${ip}/axis-cgi/applications/control.cgi`;
  const formData = `action=license&ApplicationName=BatonAnalytic&LicenseKey=${key}`;
  
  console.log('Testing with key:', key);
  console.log('Form data:', formData);
  
  try {
    // First request
    const response1 = await axios({
      method: 'POST',
      url,
      data: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(formData).toString()
      },
      validateStatus: () => true,
      timeout: 10000,
    });
    
    if (response1.status === 401) {
      const wwwAuth = response1.headers['www-authenticate'];
      
      if (wwwAuth && wwwAuth.includes('Digest')) {
        const digestData = {};
        const regex = /(\w+)=(?:"([^"]+)"|([^,]+))/g;
        let match;
        while ((match = regex.exec(wwwAuth)) !== null) {
          digestData[match[1]] = match[2] || match[3];
        }
        
        const nc = '00000001';
        const cnonce = crypto.randomBytes(8).toString('hex');
        const uri = '/axis-cgi/applications/control.cgi';
        
        const ha1 = crypto.createHash('md5')
          .update(`${username}:${digestData.realm}:${password}`)
          .digest('hex');
        
        const ha2 = crypto.createHash('md5')
          .update(`POST:${uri}`)
          .digest('hex');
          
        const response = crypto.createHash('md5')
          .update(`${ha1}:${digestData.nonce}:${nc}:${cnonce}:${digestData.qop}:${ha2}`)
          .digest('hex');
        
        const authHeader = `Digest username="${username}", realm="${digestData.realm}", nonce="${digestData.nonce}", uri="${uri}", algorithm="${digestData.algorithm || 'MD5'}", response="${response}", qop=${digestData.qop}, nc=${nc}, cnonce="${cnonce}"`;
        
        try {
          const response2 = await axios({
            method: 'POST',
            url,
            data: formData,
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': Buffer.byteLength(formData).toString()
            },
            timeout: 10000,
            maxRedirects: 0,
            validateStatus: () => true,
          });
          
          console.log('Response status:', response2.status);
          console.log('Response data:', response2.data);
        } catch (err) {
          if (err.code === 'ERR_BAD_RESPONSE' || err.message.includes('stream')) {
            console.log('Got stream error - response might be:', err.response?.data || 'No data');
          } else {
            console.error('Error:', err.message);
          }
        }
      }
    }
  } catch (error) {
    console.error('First request error:', error.message);
  }
}

async function testActivationDifferentOrder(key) {
  const url = `http://${ip}/axis-cgi/applications/control.cgi`;
  // Different parameter order
  const formData = `ApplicationName=BatonAnalytic&LicenseKey=${key}&action=license`;
  
  console.log('Form data (different order):', formData);
  
  // ... same auth logic as above but simplified for brevity
  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);
  
  try {
    const { stdout, stderr } = await execPromise(`curl -s --digest -u "${username}:${password}" -X POST -H "Content-Type: application/x-www-form-urlencoded" --data "${formData}" "${url}"`);
    console.log('Response:', stdout);
    if (stderr) console.error('Stderr:', stderr);
  } catch (err) {
    console.log('Curl error code:', err.code);
    console.log('Response:', err.stdout);
  }
}

async function testActivationMultipart(key) {
  const url = `http://${ip}/axis-cgi/applications/control.cgi`;
  
  console.log('Testing with multipart form data...');
  
  const form = new FormData();
  form.append('action', 'license');
  form.append('ApplicationName', 'BatonAnalytic');
  form.append('LicenseKey', key);
  
  // ... would need full auth implementation
  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);
  
  try {
    // Try with different curl options
    const { stdout, stderr } = await execPromise(`curl -s --digest -u "${username}:${password}" -X POST -F "action=license" -F "ApplicationName=BatonAnalytic" -F "LicenseKey=${key}" "${url}"`);
    console.log('Response:', stdout);
    if (stderr) console.error('Stderr:', stderr);
  } catch (err) {
    console.log('Curl error code:', err.code);
    console.log('Response:', err.stdout);
  }
}

activateLicenseExactlyLikeWebUI();