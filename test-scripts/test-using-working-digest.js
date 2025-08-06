const axios = require('axios');
const crypto = require('crypto');
const https = require('https');

const ip = '192.168.50.156';
const username = 'anava';
const password = 'baton';
const licenseKey = '2Z7YMSDTTF44N5JAX422';
const applicationName = 'BatonAnalytic';

// Copy of the WORKING digestAuth from ACAPDeploymentService
async function digestAuth(ip, username, password, method, uri, data, options = {}) {
  try {
    const url = `http://${ip}${uri}`;
    const httpsAgent = new https.Agent({ rejectUnauthorized: false });
    
    // First request to get the digest challenge
    const config1 = {
      method,
      url,
      httpsAgent,
      timeout: options.timeout || 300000,
      validateStatus: () => true,
      ...options
    };
    if (data) {
      config1.data = data;
    }
    console.log(`[digestAuth] ${method} ${url}`);
    console.log('[digestAuth] Making first request for digest challenge...');
    const response1 = await axios(config1);
    
    if (response1.status === 401) {
      const wwwAuth = response1.headers['www-authenticate'];
      console.log('[digestAuth] Got 401 challenge:', wwwAuth);
      
      if (wwwAuth && wwwAuth.includes('Digest')) {
        // Parse digest parameters
        const digestData = {};
        const regex = /(\w+)=(?:"([^"]+)"|([^,]+))/g;
        let match;
        while ((match = regex.exec(wwwAuth)) !== null) {
          digestData[match[1]] = match[2] || match[3];
        }
        console.log('[digestAuth] Digest realm:', digestData.realm);
        console.log('[digestAuth] Digest qop:', digestData.qop);
        
        // Build digest header
        const nc = '00000001';
        const cnonce = crypto.randomBytes(8).toString('hex');
        const ha1 = crypto.createHash('md5')
          .update(`${username}:${digestData.realm}:${password}`)
          .digest('hex');
        const ha2 = crypto.createHash('md5')
          .update(`${method}:${uri}`)
          .digest('hex');
        const response = crypto.createHash('md5')
          .update(`${ha1}:${digestData.nonce}:${nc}:${cnonce}:${digestData.qop}:${ha2}`)
          .digest('hex');
        
        const authHeader = `Digest username="${username}", realm="${digestData.realm}", nonce="${digestData.nonce}", uri="${uri}", algorithm="${digestData.algorithm || 'MD5'}", response="${response}", qop=${digestData.qop}, nc=${nc}, cnonce="${cnonce}"`;
        console.log('[digestAuth] Sending authenticated request...');
        
        // Second request with auth
        const config2 = {
          ...config1,
          headers: {
            ...config1.headers,
            'Authorization': authHeader
          }
        };
        const response2 = await axios(config2);
        console.log('[digestAuth] Authenticated response status:', response2.status);
        return response2;
      }
    }
    
    console.log('[digestAuth] Response status (no auth needed):', response1.status);
    return response1;
  } catch (error) {
    console.error('[digestAuth] Error during digest auth:', error.message);
    throw error;
  }
}

async function testLicenseActivation() {
  const formData = `action=license&ApplicationName=${applicationName}&LicenseKey=${licenseKey}`;
  
  console.log('Testing license activation with WORKING digest auth...');
  console.log('Data:', formData);
  
  try {
    const response = await digestAuth(
      ip,
      username,
      password,
      'POST',
      '/axis-cgi/applications/control.cgi',
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(formData).toString()
        }
      }
    );
    
    console.log('Final response data:', response.data);
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testLicenseActivation();