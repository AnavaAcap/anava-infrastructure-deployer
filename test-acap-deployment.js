#!/usr/bin/env node

const axios = require('axios');
const crypto = require('crypto');

// Test listing installed ACAPs
async function listInstalledACAPs() {
  const ip = '192.168.50.156';
  const username = 'anava';
  const password = 'baton';
  const url = `http://${ip}/axis-cgi/applications/list.cgi`;
  
  console.log('Testing list installed ACAPs...');
  
  try {
    const response = await digestAuth(url, username, password, 'GET');
    console.log('Success! Installed ACAPs:');
    console.log(response.data);
    
    // Parse the response to check for BatonAnalytic
    const xmlMatch = response.data.match(/<application[^>]*name="([^"]+)"[^>]*>/g);
    if (xmlMatch) {
      xmlMatch.forEach(match => {
        const nameMatch = match.match(/name="([^"]+)"/);
        if (nameMatch) {
          console.log(`- ${nameMatch[1]}`);
        }
      });
    }
  } catch (error) {
    console.error('Failed to list ACAPs:', error.message);
  }
}

// Test ACAP upload endpoint
async function testUploadEndpoint() {
  const ip = '192.168.50.156';
  const username = 'anava';
  const password = 'baton';
  const url = `http://${ip}/axis-cgi/applications/upload.cgi`;
  
  console.log('\nTesting upload endpoint (without file)...');
  
  try {
    // Just test if endpoint exists with GET
    const response = await digestAuth(url, username, password, 'GET', null);
    console.log('Endpoint response:', response.status);
  } catch (error) {
    console.log('Expected error (no file):', error.response?.status || error.message);
  }
}

// Digest auth implementation
async function digestAuth(url, username, password, method = 'GET', data = null) {
  try {
    // First request to get challenge
    const response1 = await axios({
      method,
      url,
      data,
      validateStatus: () => true
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
    
    // Calculate response
    const md5 = (str) => crypto.createHash('md5').update(str).digest('hex');
    const ha1 = md5(`${username}:${authParams.realm}:${password}`);
    const ha2 = md5(`${method}:${uri}`);
    const response = md5(`${ha1}:${authParams.nonce}:${nc}:${cnonce}:${authParams.qop}:${ha2}`);
    
    // Build authorization header
    const authHeader = `Digest username="${username}", realm="${authParams.realm}", nonce="${authParams.nonce}", uri="${uri}", algorithm="${authParams.algorithm || 'MD5'}", response="${response}", qop=${authParams.qop}, nc=${nc}, cnonce="${cnonce}"`;
    
    // Second request with auth
    const response2 = await axios({
      method,
      url,
      data,
      headers: {
        'Authorization': authHeader
      }
    });
    
    return response2;
  } catch (error) {
    throw error;
  }
}

// Test GitHub releases API
async function testGitHubReleases() {
  console.log('\nTesting GitHub releases API...');
  
  try {
    const response = await axios.get('https://api.github.com/repos/anava-ai/axis-acap/releases/latest');
    console.log('Latest release:', response.data.tag_name);
    console.log('Assets:');
    response.data.assets.forEach(asset => {
      console.log(`- ${asset.name} (${asset.size} bytes)`);
      console.log(`  URL: ${asset.browser_download_url}`);
    });
    
    // Find BatonAnalytic ACAP
    const batonAsset = response.data.assets.find(a => 
      a.name.includes('BatonAnalytic') && a.name.includes('armv7hf')
    );
    
    if (batonAsset) {
      console.log(`\nFound BatonAnalytic ACAP: ${batonAsset.name}`);
      return batonAsset.browser_download_url;
    }
  } catch (error) {
    console.error('Failed to get GitHub releases:', error.message);
  }
}

async function run() {
  await listInstalledACAPs();
  await testUploadEndpoint();
  await testGitHubReleases();
}

run();