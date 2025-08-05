const AxiosDigestAuth = require('@mhoc/axios-digest-auth').default;
const FormData = require('form-data');
const fs = require('fs');

async function testDigestAuth() {
  const ip = '192.168.50.156';
  const username = 'anava';
  const password = 'baton';
  const acapPath = '/var/folders/xc/v68gqzmj5n91qw21s8mc093r0000gn/T/anava-acaps/signed_Anava_-_Analyze_3_7_62_aarch64_os12.eap';
  
  const digestAuth = new AxiosDigestAuth({
    username,
    password,
  });
  
  console.log('Creating form data...');
  const form = new FormData();
  const fileStream = fs.createReadStream(acapPath);
  
  form.append('packfil', fileStream, {
    filename: 'signed_Anava_-_Analyze_3_7_62_aarch64_os12.eap',
    contentType: 'application/octet-stream'
  });
  
  try {
    console.log('Making request with digest auth...');
    const response = await digestAuth.request({
      method: 'POST',
      url: `http://${ip}/axis-cgi/applications/upload.cgi`,
      data: form,
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 60000
    });
    
    console.log('Response status:', response.status);
    console.log('Response data:', response.data);
  } catch (error) {
    console.error('Error:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
  }
}

testDigestAuth();
