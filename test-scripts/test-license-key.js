const axios = require('axios');
const crypto = require('crypto');

// Camera details
const CAMERA_IP = '192.168.50.156';
const USERNAME = 'anava';
const PASSWORD = 'baton';
const APPLICATION_NAME = 'BatonAnalytic';
const TEST_LICENSE_KEY = 'TEST';

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

async function testLicenseKey() {
  try {
    console.log('=== Testing VAPIX License Key Application ===');
    console.log(`Camera: ${CAMERA_IP}`);
    console.log(`Credentials: ${USERNAME}:${PASSWORD}`);
    console.log(`Application: ${APPLICATION_NAME}`);
    console.log(`License Key: ${TEST_LICENSE_KEY}`);
    console.log('');

    // First, let's list installed applications
    console.log('1. Listing installed applications...');
    const listUrl = `http://${CAMERA_IP}/axis-cgi/applications/list.cgi?action=list`;
    
    const listResponse1 = await axios.get(listUrl, {
      validateStatus: () => true,
      timeout: 5000
    });
    
    if (listResponse1.status === 401) {
      const wwwAuth = listResponse1.headers['www-authenticate'];
      const digestData = parseDigestAuth(wwwAuth);
      const authHeader = buildDigestHeader(USERNAME, PASSWORD, 'GET', '/axis-cgi/applications/list.cgi?action=list', digestData);
      
      const listResponse2 = await axios.get(listUrl, {
        headers: { 'Authorization': authHeader },
        timeout: 5000
      });
      
      console.log('Installed applications:', listResponse2.data);
      
      // Check if BatonAnalytic is installed
      if (!listResponse2.data.includes(APPLICATION_NAME)) {
        console.log(`\n❌ ${APPLICATION_NAME} is not installed on this camera!`);
        return;
      }
      
      console.log(`\n✓ ${APPLICATION_NAME} is installed`);
    }

    // Now try to apply the license key using the correct endpoint
    console.log('\n2. Applying license key using control.cgi...');
    const controlUrl = `http://${CAMERA_IP}/axis-cgi/applications/control.cgi`;
    
    // Prepare form data
    const formData = new URLSearchParams();
    formData.append('action', 'license');
    formData.append('ApplicationName', APPLICATION_NAME);
    formData.append('LicenseKey', TEST_LICENSE_KEY);
    
    console.log('Request body:', formData.toString());
    
    // First request to get digest challenge
    const response1 = await axios.post(controlUrl, formData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      validateStatus: () => true,
      timeout: 10000
    });
    
    console.log(`\nFirst request status: ${response1.status}`);
    
    if (response1.status === 401) {
      console.log('Got 401, trying with digest auth...');
      const wwwAuth = response1.headers['www-authenticate'];
      const digestData = parseDigestAuth(wwwAuth);
      const authHeader = buildDigestHeader(USERNAME, PASSWORD, 'POST', '/axis-cgi/applications/control.cgi', digestData);
      
      // Second request with auth
      const response2 = await axios.post(controlUrl, formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': authHeader
        },
        timeout: 30000, // Increased timeout
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });
      
      console.log(`\nSecond request status: ${response2.status}`);
      console.log('Response body:', response2.data);
      
      // Check response
      if (response2.status === 200) {
        const responseBody = response2.data.toString().trim();
        if (responseBody === 'OK') {
          console.log('\n✅ License key applied successfully!');
        } else if (responseBody.includes('Error')) {
          console.log('\n❌ License application failed:', responseBody);
          if (responseBody.includes('Invalid license key')) {
            console.log('✓ This is expected for TEST key - the endpoint is working correctly!');
          }
        } else {
          console.log('\n❓ Unexpected response:', responseBody);
        }
      }
    } else if (response1.status === 200) {
      // No auth required (unlikely)
      console.log('Response body:', response1.data);
    } else {
      console.log('Unexpected status:', response1.status);
      console.log('Response:', response1.data);
    }
    
    // Let's also verify the license status
    console.log('\n3. Checking license status...');
    const statusUrl = `http://${CAMERA_IP}/axis-cgi/applications/list.cgi?action=list&applicationname=${APPLICATION_NAME}`;
    
    const statusResponse1 = await axios.get(statusUrl, {
      validateStatus: () => true,
      timeout: 5000
    });
    
    if (statusResponse1.status === 401) {
      const wwwAuth = statusResponse1.headers['www-authenticate'];
      const digestData = parseDigestAuth(wwwAuth);
      const authHeader = buildDigestHeader(USERNAME, PASSWORD, 'GET', `/axis-cgi/applications/list.cgi?action=list&applicationname=${APPLICATION_NAME}`, digestData);
      
      const statusResponse2 = await axios.get(statusUrl, {
        headers: { 'Authorization': authHeader },
        timeout: 5000
      });
      
      console.log('Application status:', statusResponse2.data);
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
testLicenseKey();