const axios = require('axios');
const crypto = require('crypto');
const https = require('https');

// Camera details
const CAMERA_IP = '192.168.50.156';
const USERNAME = 'anava';
const PASSWORD = 'baton';
const TEST_LICENSE_KEY = 'TEST';

// Create axios instance that accepts self-signed certificates
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  })
});

// Function to parse digest auth header
function parseDigestAuth(authHeader) {
  const data = {};
  const regex = /(\w+)=(?:"([^"]+)"|([^,]+))/g;
  let match;
  
  while ((match = regex.exec(authHeader)) !== null) {
    data[match[1]] = match[2] || match[3];
  }
  
  return data;
}

// Function to build digest auth header
function buildDigestHeader(username, password, method, uri, digestData) {
  const nc = '00000001';
  const cnonce = crypto.randomBytes(8).toString('hex');
  
  const ha1 = crypto.createHash('md5').update(`${username}:${digestData.realm}:${password}`).digest('hex');
  const ha2 = crypto.createHash('md5').update(`${method}:${uri}`).digest('hex');
  const response = crypto.createHash('md5').update(`${ha1}:${digestData.nonce}:${nc}:${cnonce}:${digestData.qop}:${ha2}`).digest('hex');
  
  return `Digest username="${username}", realm="${digestData.realm}", nonce="${digestData.nonce}", uri="${uri}", qop=${digestData.qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"`;
}

async function testBatonLicense() {
  try {
    console.log('=== Testing BatonAnalytic License Endpoints ===');
    console.log(`Camera: ${CAMERA_IP}`);
    console.log(`Credentials: ${USERNAME}:${PASSWORD}`);
    console.log('');

    // First, let's try the BatonAnalytic's own endpoint for license activation
    console.log('1. Testing BatonAnalytic license endpoint...');
    const batonLicenseUrl = `http://${CAMERA_IP}/local/BatonAnalytic/baton_analytic.cgi?command=activateLicense`;
    
    const licenseData = {
      licenseKey: TEST_LICENSE_KEY
    };
    
    console.log('Trying BatonAnalytic license endpoint:', batonLicenseUrl);
    console.log('Request data:', JSON.stringify(licenseData));
    
    try {
      // First request to get digest challenge
      const response1 = await axiosInstance.post(batonLicenseUrl, licenseData, {
        headers: {
          'Content-Type': 'application/json'
        },
        validateStatus: () => true,
        timeout: 10000
      });
      
      console.log(`First request status: ${response1.status}`);
      
      if (response1.status === 401) {
        const wwwAuth = response1.headers['www-authenticate'];
        const digestData = parseDigestAuth(wwwAuth);
        const authHeader = buildDigestHeader(USERNAME, PASSWORD, 'POST', '/local/BatonAnalytic/baton_analytic.cgi?command=activateLicense', digestData);
        
        const response2 = await axiosInstance.post(batonLicenseUrl, licenseData, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          timeout: 10000
        });
        
        console.log(`Second request status: ${response2.status}`);
        console.log('Response:', response2.data);
      } else {
        console.log('Response:', response1.data);
      }
    } catch (error) {
      console.log('BatonAnalytic endpoint error:', error.message);
    }

    // Let's also test if there's a getLicenseStatus endpoint
    console.log('\n2. Checking license status via BatonAnalytic...');
    const statusUrl = `http://${CAMERA_IP}/local/BatonAnalytic/baton_analytic.cgi?command=getLicenseStatus`;
    
    try {
      const statusResponse1 = await axiosInstance.get(statusUrl, {
        validateStatus: () => true,
        timeout: 5000
      });
      
      if (statusResponse1.status === 401) {
        const wwwAuth = statusResponse1.headers['www-authenticate'];
        const digestData = parseDigestAuth(wwwAuth);
        const authHeader = buildDigestHeader(USERNAME, PASSWORD, 'GET', '/local/BatonAnalytic/baton_analytic.cgi?command=getLicenseStatus', digestData);
        
        const statusResponse2 = await axiosInstance.get(statusUrl, {
          headers: { 'Authorization': authHeader },
          timeout: 5000
        });
        
        console.log('License status:', statusResponse2.data);
      } else {
        console.log('License status:', statusResponse1.data);
      }
    } catch (error) {
      console.log('License status error:', error.message);
    }

    // Let's also try with AXIS Object Analytics which has no license
    console.log('\n3. Testing license on unlicensed app (objectanalytics)...');
    const controlUrl = `http://${CAMERA_IP}/axis-cgi/applications/control.cgi`;
    
    const formData = new URLSearchParams();
    formData.append('action', 'license');
    formData.append('ApplicationName', 'objectanalytics');
    formData.append('LicenseKey', TEST_LICENSE_KEY);
    
    console.log('Request to control.cgi:', formData.toString());
    
    const response1 = await axiosInstance.post(controlUrl, formData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      validateStatus: () => true,
      timeout: 5000
    });
    
    if (response1.status === 401) {
      const wwwAuth = response1.headers['www-authenticate'];
      const digestData = parseDigestAuth(wwwAuth);
      const authHeader = buildDigestHeader(USERNAME, PASSWORD, 'POST', '/axis-cgi/applications/control.cgi', digestData);
      
      const response2 = await axiosInstance.post(controlUrl, formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': authHeader
        },
        timeout: 5000
      });
      
      console.log(`Response status: ${response2.status}`);
      console.log('Response body:', response2.data);
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testBatonLicense();