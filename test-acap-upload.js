const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const crypto = require('crypto');

async function testUpload() {
  const ip = '192.168.50.156';
  const username = 'anava';
  const password = 'baton';
  const acapPath = '/var/folders/xc/v68gqzmj5n91qw21s8mc093r0000gn/T/anava-acaps/signed_Anava_-_Analyze_3_7_62_aarch64_os12.eap';
  
  console.log('Creating form data...');
  const form = new FormData();
  const fileStream = fs.createReadStream(acapPath);
  
  form.append('packfil', fileStream, {
    filename: 'signed_Anava_-_Analyze_3_7_62_aarch64_os12.eap',
    contentType: 'application/octet-stream'
  });
  
  const url = `http://${ip}/axis-cgi/applications/upload.cgi`;
  
  try {
    // First request to get digest challenge
    console.log('Making first request...');
    const response1 = await axios.post(url, form, {
      headers: form.getHeaders(),
      validateStatus: () => true,
      maxRedirects: 0
    });
    
    console.log('First response status:', response1.status);
    
    if (response1.status === 401) {
      const wwwAuth = response1.headers['www-authenticate'];
      console.log('Got challenge:', wwwAuth);
      
      // Parse digest challenge
      const digestData = {};
      const regex = /(\w+)=(?:"([^"]+)"|([^,]+))/g;
      let match;
      while ((match = regex.exec(wwwAuth)) !== null) {
        digestData[match[1]] = match[2] || match[3];
      }
      
      // Build digest response
      const nc = '00000001';
      const cnonce = crypto.randomBytes(8).toString('hex');
      const ha1 = crypto.createHash('md5')
        .update(`${username}:${digestData.realm}:${password}`)
        .digest('hex');
      const ha2 = crypto.createHash('md5')
        .update(`POST:/axis-cgi/applications/upload.cgi`)
        .digest('hex');
      const response = crypto.createHash('md5')
        .update(`${ha1}:${digestData.nonce}:${nc}:${cnonce}:${digestData.qop}:${ha2}`)
        .digest('hex');
      
      const authHeader = `Digest username="${username}", realm="${digestData.realm}", nonce="${digestData.nonce}", uri="/axis-cgi/applications/upload.cgi", qop="${digestData.qop}", nc=${nc}, cnonce="${cnonce}", response="${response}"`;
      
      console.log('Making authenticated request...');
      
      // Create new form for second request
      const form2 = new FormData();
      const fileStream2 = fs.createReadStream(acapPath);
      form2.append('packfil', fileStream2, {
        filename: 'signed_Anava_-_Analyze_3_7_62_aarch64_os12.eap',
        contentType: 'application/octet-stream'
      });
      
      const response2 = await axios.post(url, form2, {
        headers: {
          ...form2.getHeaders(),
          'Authorization': authHeader
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 60000
      });
      
      console.log('Second response status:', response2.status);
      console.log('Response data:', response2.data);
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
  }
}

testUpload();