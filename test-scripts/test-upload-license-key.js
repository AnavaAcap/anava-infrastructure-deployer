const axios = require('axios');
const FormData = require('form-data');
const crypto = require('crypto');

const ip = '192.168.50.156';
const username = 'anava';
const password = 'baton';
const licenseKey = '2Z7YMSDTTF44N5JAX422';

async function uploadLicenseKey() {
  const url = `http://${ip}/axis-cgi/applications/license.cgi?action=uploadlicensekey&package=BatonAnalytic`;
  
  console.log('Uploading license key using the CORRECT endpoint...');
  console.log('URL:', url);
  
  // Create multipart form data
  const form = new FormData();
  form.append('licensekey', licenseKey);
  
  try {
    // First request to get digest challenge
    const response1 = await axios({
      method: 'POST',
      url,
      data: form,
      headers: {
        ...form.getHeaders()
      },
      validateStatus: () => true,
      timeout: 10000,
    });
    
    console.log('First response status:', response1.status);
    
    if (response1.status === 401) {
      const wwwAuth = response1.headers['www-authenticate'];
      console.log('WWW-Authenticate:', wwwAuth);
      
      if (wwwAuth && wwwAuth.includes('Digest')) {
        // Parse digest parameters
        const digestData = {};
        const regex = /(\w+)=(?:"([^"]+)"|([^,]+))/g;
        let match;
        while ((match = regex.exec(wwwAuth)) !== null) {
          digestData[match[1]] = match[2] || match[3];
        }
        
        console.log('Digest data:', digestData);
        
        // Build digest auth header
        const nc = '00000001';
        const cnonce = crypto.randomBytes(8).toString('hex');
        const uri = '/axis-cgi/applications/license.cgi?action=uploadlicensekey&package=BatonAnalytic';
        
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
        
        console.log('Sending authenticated request with multipart form...');
        
        // Create a new form for the second request
        const form2 = new FormData();
        form2.append('licensekey', licenseKey);
        
        // Second request with auth
        const response2 = await axios({
          method: 'POST',
          url,
          data: form2,
          headers: {
            ...form2.getHeaders(),
            'Authorization': authHeader
          },
          timeout: 10000,
          maxRedirects: 0,
          validateStatus: () => true,
        });
        
        console.log('Second response status:', response2.status);
        console.log('Second response data:', response2.data);
        
        // Check license status
        await checkLicenseStatus();
      }
    } else {
      console.log('Response data:', response1.data);
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

async function checkLicenseStatus() {
  console.log('\n=== Checking license status ===');
  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);
  
  const command = `curl -s --digest -u "${username}:${password}" "http://${ip}/axis-cgi/applications/list.cgi" | grep -A5 -B5 BatonAnalytic`;
  
  try {
    const { stdout } = await execPromise(command);
    console.log('Application status:');
    console.log(stdout);
  } catch (err) {
    console.log('Status check error:', err.message);
  }
}

uploadLicenseKey();