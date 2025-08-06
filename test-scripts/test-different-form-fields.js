const axios = require('axios');
const FormData = require('form-data');
const crypto = require('crypto');
const fs = require('fs');

const ip = '192.168.50.156';
const username = 'anava';
const password = 'baton';
const licenseKey = '2Z7YMSDTTF44N5JAX422';

async function testWithDigestAuth(url, formFieldName) {
  console.log(`\nTesting with form field: ${formFieldName}`);
  
  // Create multipart form data
  const form = new FormData();
  form.append(formFieldName, licenseKey);
  
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
        const uri = url.replace(`http://${ip}`, '');
        
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
        form2.append(formFieldName, licenseKey);
        
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
        
        console.log(`Response status: ${response2.status}`);
        console.log(`Response data: ${response2.data}`);
        return response2;
      }
    } else {
      console.log(`Direct response (no auth): ${response1.status} - ${response1.data}`);
      return response1;
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

async function testAllVariations() {
  const baseUrl = `http://${ip}/axis-cgi/applications/license.cgi?action=uploadlicensekey&package=BatonAnalytic`;
  
  // Try different form field names
  const fieldNames = [
    'licensekey',
    'license',
    'key',
    'LicenseKey',
    'file',
    'uploadfile',
    'licensefile'
  ];
  
  console.log('Testing different form field names...');
  
  for (const fieldName of fieldNames) {
    await testWithDigestAuth(baseUrl, fieldName);
    // Wait a bit between attempts
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Also try with the license key as a file
  console.log('\n=== Testing with license key as a file ===');
  const tempFile = '/tmp/license.key';
  fs.writeFileSync(tempFile, licenseKey);
  
  const form = new FormData();
  form.append('file', fs.createReadStream(tempFile), {
    filename: 'license.key',
    contentType: 'text/plain'
  });
  
  // Clean up
  fs.unlinkSync(tempFile);
}

testAllVariations();