const axios = require('axios');
const crypto = require('crypto');

const ip = '192.168.50.156';
const username = 'anava';
const password = 'baton';

async function checkLicenseStatus() {
  const url = `http://${ip}/axis-cgi/applications/list.cgi`;
  
  console.log('Checking current license status...');
  
  try {
    // First request to get digest challenge
    const response1 = await axios({
      method: 'GET',
      url,
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
        const uri = '/axis-cgi/applications/list.cgi';
        
        const ha1 = crypto.createHash('md5')
          .update(`${username}:${digestData.realm}:${password}`)
          .digest('hex');
        
        const ha2 = crypto.createHash('md5')
          .update(`GET:${uri}`)
          .digest('hex');
          
        const response = crypto.createHash('md5')
          .update(`${ha1}:${digestData.nonce}:${nc}:${cnonce}:${digestData.qop}:${ha2}`)
          .digest('hex');
        
        const authHeader = `Digest username="${username}", realm="${digestData.realm}", nonce="${digestData.nonce}", uri="${uri}", algorithm="${digestData.algorithm || 'MD5'}", response="${response}", qop=${digestData.qop}, nc=${nc}, cnonce="${cnonce}"`;
        
        // Second request with auth
        const response2 = await axios({
          method: 'GET',
          url,
          headers: {
            'Authorization': authHeader
          },
          timeout: 10000,
        });
        
        console.log('Application list:');
        console.log(response2.data);
        
        // Check for BatonAnalytic
        if (response2.data.includes('BatonAnalytic')) {
          const licenseMatch = response2.data.match(/Name="BatonAnalytic"[^>]*License="([^"]*)"[^>]*Status="([^"]*)"/) ||
                              response2.data.match(/Name="BatonAnalytic"[^>]*Status="([^"]*)"[^>]*License="([^"]*)"/);
          
          if (licenseMatch) {
            console.log('\n=== BatonAnalytic Application Status ===');
            console.log('License:', licenseMatch[1] || licenseMatch[2]);
            console.log('Status:', licenseMatch[2] || licenseMatch[1]);
          }
          
          // Also check for any license attribute
          const appMatch = response2.data.match(/<application[^>]*Name="BatonAnalytic"[^>]*>/);
          if (appMatch) {
            console.log('Full app tag:', appMatch[0]);
          }
        } else {
          console.log('BatonAnalytic not found in application list!');
        }
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkLicenseStatus();