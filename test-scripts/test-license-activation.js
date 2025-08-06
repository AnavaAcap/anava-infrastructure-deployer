const axios = require('axios');
const crypto = require('crypto');

const ip = '192.168.50.156';
const username = 'anava';
const password = 'baton';
const licenseKey = '2Z7YMSDTTF44N5JAX422';
const applicationName = 'BatonAnalytic';

async function testLicenseActivation() {
  const url = `http://${ip}/axis-cgi/applications/control.cgi`;
  const formData = `action=license&ApplicationName=${applicationName}&LicenseKey=${licenseKey}`;
  
  console.log('Testing license activation...');
  console.log('URL:', url);
  console.log('Data:', formData);
  
  try {
    // First request to get digest challenge
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
        
        console.log('Auth header:', authHeader);
        
        // Second request with auth
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
        });
        
        console.log('Second response status:', response2.status);
        console.log('Second response data:', response2.data);
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

testLicenseActivation();