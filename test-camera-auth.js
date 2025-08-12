const axios = require('axios');
const crypto = require('crypto');

async function testBasicAuth(ip, username, password) {
  console.log('\n=== Testing Basic Auth ===');
  try {
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    const response = await axios.get(
      `http://${ip}/axis-cgi/param.cgi?action=list&group=Properties.Firmware.Version`,
      {
        headers: {
          'Authorization': `Basic ${auth}`
        },
        timeout: 5000
      }
    );
    console.log('✅ Basic Auth SUCCESS');
    console.log('Response:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Basic Auth failed:', error.message);
    return false;
  }
}

async function testDigestAuth(ip, username, password) {
  console.log('\n=== Testing Digest Auth ===');
  try {
    // First request to get challenge
    const response1 = await axios.get(
      `http://${ip}/axis-cgi/param.cgi?action=list&group=Properties.Firmware.Version`,
      {
        timeout: 5000,
        validateStatus: () => true
      }
    );
    
    if (response1.status === 200) {
      console.log('✅ No auth required - got response directly');
      console.log('Response:', response1.data);
      return true;
    }
    
    if (response1.status === 401) {
      const authHeader = response1.headers['www-authenticate'];
      console.log('Got 401 with auth header:', authHeader);
      
      if (authHeader && authHeader.includes('Digest')) {
        console.log('Camera requires Digest auth');
        
        // Parse digest challenge
        const realm = authHeader.match(/realm="([^"]+)"/)?.[1];
        const nonce = authHeader.match(/nonce="([^"]+)"/)?.[1];
        const qop = authHeader.match(/qop="([^"]+)"/)?.[1];
        
        // Build digest response
        const uri = '/axis-cgi/param.cgi?action=list&group=Properties.Firmware.Version';
        const nc = '00000001';
        const cnonce = crypto.randomBytes(8).toString('hex');
        
        const ha1 = crypto.createHash('md5')
          .update(`${username}:${realm}:${password}`)
          .digest('hex');
        
        const ha2 = crypto.createHash('md5')
          .update(`GET:${uri}`)
          .digest('hex');
        
        const response = crypto.createHash('md5')
          .update(`${ha1}:${nonce}:${nc}:${cnonce}:auth:${ha2}`)
          .digest('hex');
        
        const digestAuth = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", qop=auth, nc=${nc}, cnonce="${cnonce}", response="${response}"`;
        
        // Second request with auth
        const response2 = await axios.get(
          `http://${ip}${uri}`,
          {
            headers: {
              'Authorization': digestAuth
            },
            timeout: 5000
          }
        );
        
        console.log('✅ Digest Auth SUCCESS');
        console.log('Response:', response2.data);
        return true;
      }
    }
  } catch (error) {
    console.log('❌ Digest Auth failed:', error.message);
    return false;
  }
}

async function testNoAuth(ip) {
  console.log('\n=== Testing No Auth ===');
  try {
    const response = await axios.get(
      `http://${ip}/axis-cgi/param.cgi?action=list&group=Properties.Firmware.Version`,
      { timeout: 5000 }
    );
    console.log('✅ No auth SUCCESS - camera allows anonymous access');
    console.log('Response:', response.data);
    return true;
  } catch (error) {
    console.log('❌ No auth failed:', error.response?.status || error.message);
    return false;
  }
}

async function testHTTPS(ip, username, password) {
  console.log('\n=== Testing HTTPS ===');
  const https = require('https');
  const agent = new https.Agent({ rejectUnauthorized: false });
  
  try {
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    const response = await axios.get(
      `https://${ip}/axis-cgi/param.cgi?action=list&group=Properties.Firmware.Version`,
      {
        headers: {
          'Authorization': `Basic ${auth}`
        },
        httpsAgent: agent,
        timeout: 5000
      }
    );
    console.log('✅ HTTPS SUCCESS');
    console.log('Response:', response.data);
    return true;
  } catch (error) {
    console.log('❌ HTTPS failed:', error.message);
    return false;
  }
}

// Test with your camera
const CAMERA_IP = '192.168.50.156';
const USERNAME = 'anava';
const PASSWORD = 'baton';

async function runTests() {
  console.log(`Testing camera at ${CAMERA_IP}`);
  console.log('================================');
  
  await testNoAuth(CAMERA_IP);
  await testBasicAuth(CAMERA_IP, USERNAME, PASSWORD);
  await testDigestAuth(CAMERA_IP, USERNAME, PASSWORD);
  await testHTTPS(CAMERA_IP, USERNAME, PASSWORD);
  
  console.log('\n================================');
  console.log('Tests complete!');
}

runTests();