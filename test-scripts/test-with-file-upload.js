const axios = require('axios');
const FormData = require('form-data');
const crypto = require('crypto');
const fs = require('fs');

const ip = '192.168.50.156';
const username = 'anava';
const password = 'baton';
const licenseKey = '2Z7YMSDTTF44N5JAX422';

async function uploadLicenseAsFile() {
  const url = `http://${ip}/axis-cgi/applications/license.cgi?action=uploadlicensekey&package=BatonAnalytic`;
  
  console.log('Testing license upload as a file...');
  
  // Create a temporary file with the license key
  const tempFile = '/tmp/BatonAnalytic.lic';
  fs.writeFileSync(tempFile, licenseKey);
  
  // Create multipart form data with file
  const form = new FormData();
  form.append('file', fs.createReadStream(tempFile), {
    filename: 'BatonAnalytic.lic',
    contentType: 'application/octet-stream'
  });
  
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
      
      if (wwwAuth && wwwAuth.includes('Digest')) {
        // Parse digest parameters
        const digestData = {};
        const regex = /(\w+)=(?:"([^"]+)"|([^,]+))/g;
        let match;
        while ((match = regex.exec(wwwAuth)) !== null) {
          digestData[match[1]] = match[2] || match[3];
        }
        
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
        
        // Create a new form for the second request
        const form2 = new FormData();
        form2.append('file', fs.createReadStream(tempFile), {
          filename: 'BatonAnalytic.lic',
          contentType: 'application/octet-stream'
        });
        
        console.log('Sending authenticated request with file upload...');
        
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
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    // Clean up
    fs.unlinkSync(tempFile);
  }
  
  // Check status
  await checkStatus();
}

async function checkStatus() {
  console.log('\n=== Checking license status ===');
  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);
  
  const command = `curl -s --digest -u "${username}:${password}" "http://${ip}/axis-cgi/applications/list.cgi" | grep -A2 -B2 'Name="BatonAnalytic"'`;
  
  try {
    const { stdout } = await execPromise(command);
    console.log(stdout);
  } catch (err) {
    console.log('Status check error:', err.message);
  }
}

uploadLicenseAsFile();