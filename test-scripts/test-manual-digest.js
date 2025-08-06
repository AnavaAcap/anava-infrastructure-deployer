#!/usr/bin/env node

const axios = require('axios');
const crypto = require('crypto');

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

function parseDigest(header) {
  const params = {};
  const regex = /(\w+)=(?:"([^"]*)"|([^,]*))/g;
  let match;
  while ((match = regex.exec(header)) !== null) {
    params[match[1]] = match[2] || match[3];
  }
  return params;
}

async function digestAuth(url, username, password) {
  try {
    // First request to get challenge
    const response1 = await axios.get(url, {
      validateStatus: () => true
    });
    
    if (response1.status !== 401) {
      return response1;
    }
    
    const wwwAuth = response1.headers['www-authenticate'];
    if (!wwwAuth || !wwwAuth.includes('Digest')) {
      throw new Error('No digest auth challenge');
    }
    
    const auth = parseDigest(wwwAuth);
    const nc = '00000001';
    const cnonce = crypto.randomBytes(8).toString('hex');
    const uri = new URL(url).pathname + new URL(url).search;
    
    // Calculate response
    const ha1 = md5(`${username}:${auth.realm}:${password}`);
    const ha2 = md5(`GET:${uri}`);
    const response = md5(`${ha1}:${auth.nonce}:${nc}:${cnonce}:${auth.qop}:${ha2}`);
    
    // Build authorization header
    const authHeader = `Digest username="${username}", realm="${auth.realm}", nonce="${auth.nonce}", uri="${uri}", algorithm="${auth.algorithm || 'MD5'}", response="${response}", qop=${auth.qop}, nc=${nc}, cnonce="${cnonce}"`;
    
    console.log('Authorization header:', authHeader);
    
    // Second request with auth
    const response2 = await axios.get(url, {
      headers: {
        'Authorization': authHeader
      }
    });
    
    return response2;
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}

async function test() {
  const url = 'http://192.168.50.156/axis-cgi/param.cgi?action=list&group=Brand';
  const username = 'anava';
  const password = 'baton';
  
  console.log(`Testing manual digest auth at ${url}...`);
  
  try {
    const response = await digestAuth(url, username, password);
    console.log('Success! Status:', response.status);
    console.log('Data preview:', response.data.substring(0, 200));
    
    if (response.data.includes('Brand=AXIS')) {
      console.log('✓ Confirmed Axis camera!');
    }
  } catch (error) {
    console.error('Failed:', error.message);
  }
}

test();