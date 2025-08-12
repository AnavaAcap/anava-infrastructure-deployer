#!/usr/bin/env node

const axios = require('axios');
const https = require('https');
const crypto = require('crypto');

// Camera settings - update these with your actual values
const CAMERA_IP = '192.168.50.156'; // Update with your camera IP
const USERNAME = 'root';
const PASSWORD = 'pass'; // Update with your password
const API_KEY = 'YOUR_GEMINI_API_KEY'; // Update with your API key

async function testSceneDescription() {
  try {
    console.log('Testing getSceneDescription endpoint...');
    console.log('Camera IP:', CAMERA_IP);
    console.log('Username:', USERNAME);
    
    const requestData = {
      viewArea: 1,
      GeminiApiKey: API_KEY,
      replyMP3: true
    };
    
    console.log('\nRequest payload:', JSON.stringify(requestData, null, 2));
    
    const url = `https://${CAMERA_IP}/local/BatonAnalytic/baton_analytic.cgi?command=getSceneDescription`;
    
    // First request to get auth challenge
    console.log('\nMaking initial request to:', url);
    const response1 = await axios.post(url, JSON.stringify(requestData), {
      headers: {
        'Content-Type': 'application/json'
      },
      validateStatus: () => true,
      timeout: 20000,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    });
    
    console.log('Initial response status:', response1.status);
    
    if (response1.status === 401) {
      const wwwAuth = response1.headers['www-authenticate'];
      console.log('WWW-Authenticate header:', wwwAuth);
      
      if (wwwAuth && wwwAuth.includes('Digest')) {
        // Parse digest parameters
        const digestData = {};
        const regex = /(\w+)=(?:"([^"]+)"|([^,]+))/g;
        let match;
        while ((match = regex.exec(wwwAuth)) !== null) {
          digestData[match[1]] = match[2] || match[3];
        }
        
        // Build digest auth
        const nc = '00000001';
        const cnonce = crypto.randomBytes(8).toString('hex');
        const qop = digestData.qop;
        const uri = '/local/BatonAnalytic/baton_analytic.cgi?command=getSceneDescription';
        
        const ha1 = crypto.createHash('md5')
          .update(`${USERNAME}:${digestData.realm}:${PASSWORD}`)
          .digest('hex');
        
        const ha2 = crypto.createHash('md5')
          .update(`POST:${uri}`)
          .digest('hex');
        
        const response = crypto.createHash('md5')
          .update(`${ha1}:${digestData.nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
          .digest('hex');
        
        const authHeader = `Digest username="${USERNAME}", realm="${digestData.realm}", nonce="${digestData.nonce}", uri="${uri}", algorithm="${digestData.algorithm || 'MD5'}", response="${response}", qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
        
        console.log('\nMaking authenticated request...');
        const response2 = await axios.post(url, JSON.stringify(requestData), {
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          },
          timeout: 20000,
          validateStatus: () => true,
          httpsAgent: new https.Agent({
            rejectUnauthorized: false
          })
        });
        
        console.log('\n=== AUTHENTICATED RESPONSE ===');
        console.log('Status:', response2.status);
        console.log('Headers:', response2.headers);
        console.log('\n--- Response Data ---');
        console.log('Type:', typeof response2.data);
        
        if (typeof response2.data === 'string') {
          console.log('Raw string response:');
          console.log(response2.data);
          
          // Try to parse as JSON
          try {
            const parsed = JSON.parse(response2.data);
            console.log('\nParsed JSON:');
            console.log(JSON.stringify(parsed, null, 2));
          } catch (e) {
            console.log('Could not parse as JSON');
          }
        } else {
          console.log('Response data (object):');
          console.log(JSON.stringify(response2.data, null, 2));
        }
        
        // Check what fields are present
        const data = response2.data;
        console.log('\n--- Field Analysis ---');
        console.log('Has status field?', data.hasOwnProperty('status'), '-> value:', data.status);
        console.log('Has description field?', data.hasOwnProperty('description'), '-> value:', data.description ? data.description.substring(0, 100) + '...' : 'none');
        console.log('Has imageBase64 field?', data.hasOwnProperty('imageBase64'), '-> length:', data.imageBase64?.length);
        console.log('Has audioMP3Base64 field?', data.hasOwnProperty('audioMP3Base64'), '-> length:', data.audioMP3Base64?.length);
        console.log('Has audioBase64 field?', data.hasOwnProperty('audioBase64'), '-> length:', data.audioBase64?.length);
        console.log('Has audioFormat field?', data.hasOwnProperty('audioFormat'), '-> value:', data.audioFormat);
        console.log('Has error field?', data.hasOwnProperty('error'), '-> value:', data.error);
        console.log('Has message field?', data.hasOwnProperty('message'), '-> value:', data.message);
        
        console.log('\n--- All Fields ---');
        console.log('Object keys:', Object.keys(data));
        
      } else if (wwwAuth && wwwAuth.toLowerCase().includes('basic')) {
        // Basic auth
        const auth = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');
        
        console.log('\nMaking Basic auth request...');
        const response2 = await axios.post(url, JSON.stringify(requestData), {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
          },
          timeout: 20000,
          validateStatus: () => true,
          httpsAgent: new https.Agent({
            rejectUnauthorized: false
          })
        });
        
        console.log('\n=== BASIC AUTH RESPONSE ===');
        console.log('Status:', response2.status);
        console.log('Data:', response2.data);
      }
    } else if (response1.status === 200) {
      console.log('\n=== NO AUTH REQUIRED RESPONSE ===');
      console.log('Data:', response1.data);
    } else {
      console.log('\n=== UNEXPECTED RESPONSE ===');
      console.log('Status:', response1.status);
      console.log('Data:', response1.data);
    }
    
  } catch (error) {
    console.error('\n=== ERROR ===');
    console.error('Message:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    console.error('Stack:', error.stack);
  }
}

// Run the test
console.log('='.repeat(60));
console.log('SCENE DESCRIPTION ENDPOINT TEST');
console.log('='.repeat(60));
console.log('\nNOTE: Update the camera IP, credentials, and API key in the script!');
console.log('Current settings:');
console.log('  CAMERA_IP:', CAMERA_IP);
console.log('  USERNAME:', USERNAME);
console.log('  API_KEY:', API_KEY.substring(0, 10) + '...');
console.log('\nStarting test in 3 seconds...\n');

setTimeout(testSceneDescription, 3000);