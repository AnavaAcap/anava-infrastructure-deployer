#!/usr/bin/env node

const axios = require('axios');
const crypto = require('crypto');

async function digestAuth(url, username, password, data) {
  try {
    // First request to get challenge
    const response1 = await axios.post(url, data, {
      validateStatus: () => true,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response1.status !== 401) {
      return response1;
    }
    
    const wwwAuth = response1.headers['www-authenticate'];
    if (!wwwAuth || !wwwAuth.includes('Digest')) {
      throw new Error('No digest auth challenge');
    }
    
    // Parse digest parameters
    const authParams = {};
    const regex = /(\w+)=(?:"([^"]*)"|([^,]*))/g;
    let match;
    while ((match = regex.exec(wwwAuth)) !== null) {
      authParams[match[1]] = match[2] || match[3];
    }
    
    const nc = '00000001';
    const cnonce = crypto.randomBytes(8).toString('hex');
    const uri = new URL(url).pathname + new URL(url).search;
    
    // Calculate response for POST
    const md5 = (str) => crypto.createHash('md5').update(str).digest('hex');
    const ha1 = md5(`${username}:${authParams.realm}:${password}`);
    const ha2 = md5(`POST:${uri}`);
    const response = md5(`${ha1}:${authParams.nonce}:${nc}:${cnonce}:${authParams.qop}:${ha2}`);
    
    // Build authorization header
    const authHeader = `Digest username="${username}", realm="${authParams.realm}", nonce="${authParams.nonce}", uri="${uri}", algorithm="${authParams.algorithm || 'MD5'}", response="${response}", qop=${authParams.qop}, nc=${nc}, cnonce="${cnonce}"`;
    
    console.log('Authorization header:', authHeader);
    
    // Second request with auth
    const response2 = await axios.post(url, data, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    });
    
    return response2;
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

async function testSceneDescription() {
  const ip = '192.168.50.156';
  const username = 'anava';
  const password = 'baton';
  const url = `http://${ip}/local/BatonAnalytic/baton_analytic.cgi?command=getSceneDescription`;
  
  const requestData = {
    viewArea: 1
  };
  
  console.log(`Testing scene description at ${url}...`);
  console.log('Request data:', JSON.stringify(requestData, null, 2));
  
  try {
    const response = await digestAuth(url, username, password, requestData);
    console.log('\nSuccess! Status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    if (response.data.status === 'success') {
      console.log('\n✓ Scene Description:');
      console.log(response.data.description);
    }
  } catch (error) {
    console.error('\nFailed:', error.message);
  }
}

// Also test with empty payload
async function testEmptyPayload() {
  const ip = '192.168.50.156';
  const username = 'anava';
  const password = 'baton';
  const url = `http://${ip}/local/BatonAnalytic/baton_analytic.cgi?command=getSceneDescription`;
  
  console.log('\n\nTesting with empty payload...');
  
  try {
    const response = await digestAuth(url, username, password, {});
    console.log('\nSuccess! Status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('\nFailed:', error.message);
  }
}

async function run() {
  await testSceneDescription();
  await testEmptyPayload();
}

run();