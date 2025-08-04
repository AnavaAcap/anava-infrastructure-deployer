#!/usr/bin/env node

const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Camera credentials
const CAMERA_IP = '192.168.50.156';
const USERNAME = 'anava';
const PASSWORD = 'baton';

// Test download from GitHub
async function downloadLatestACAP() {
  console.log('\n=== DOWNLOADING LATEST ACAP ===');
  
  try {
    // Get latest release
    const releaseResponse = await axios.get(
      'https://api.github.com/repos/AnavaAcap/acap-releases/releases/latest',
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );
    
    const release = releaseResponse.data;
    console.log('Latest release:', release.tag_name);
    
    // Find armv7hf ACAP
    const armv7hfAsset = release.assets.find(asset => 
      asset.name.includes('armv7hf') && asset.name.endsWith('.eap')
    );
    
    if (!armv7hfAsset) {
      throw new Error('No armv7hf ACAP found in release');
    }
    
    console.log('Found ACAP:', armv7hfAsset.name);
    console.log('Download URL:', armv7hfAsset.browser_download_url);
    console.log('Size:', (armv7hfAsset.size / 1024 / 1024).toFixed(2), 'MB');
    
    // Download the file
    const downloadPath = path.join(__dirname, armv7hfAsset.name);
    
    if (fs.existsSync(downloadPath)) {
      console.log('ACAP already downloaded:', downloadPath);
      return downloadPath;
    }
    
    console.log('Downloading ACAP...');
    const downloadResponse = await axios.get(armv7hfAsset.browser_download_url, {
      responseType: 'stream',
      headers: {
        'Accept': 'application/octet-stream'
      }
    });
    
    const writer = fs.createWriteStream(downloadPath);
    downloadResponse.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log('Download complete:', downloadPath);
        resolve(downloadPath);
      });
      writer.on('error', reject);
    });
    
  } catch (error) {
    console.error('Failed to download ACAP:', error.message);
    throw error;
  }
}

// Digest auth implementation
async function digestAuth(url, username, password, method = 'GET', data = null, options = {}) {
  try {
    // First request to get challenge
    const config1 = {
      method,
      url,
      validateStatus: () => true,
      ...options
    };
    
    if (data) {
      config1.data = data;
    }
    
    const response1 = await axios(config1);
    
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
    const config2 = {
      ...config1,
      headers: {
        ...config1.headers,
        'Authorization': authHeader
      }
    };
    
    const response2 = await axios(config2);
    return response2;
  } catch (error) {
    throw error;
  }
}

// Test uploading ACAP
async function uploadACAP(acapPath) {
  console.log('\n=== UPLOADING ACAP TO CAMERA ===');
  
  try {
    const form = new FormData();
    const fileStream = fs.createReadStream(acapPath);
    const fileName = path.basename(acapPath);
    
    // VAPIX expects the file field to be named 'packfil'
    form.append('packfil', fileStream, {
      filename: fileName,
      contentType: 'application/octet-stream'
    });
    
    console.log('Uploading:', fileName);
    console.log('To camera:', CAMERA_IP);
    console.log('Field name: packfil');
    
    const url = `http://${CAMERA_IP}/axis-cgi/applications/upload.cgi`;
    
    const response = await digestAuth(
      url,
      USERNAME,
      PASSWORD,
      'POST',
      form,
      {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 120000
      }
    );
    
    console.log('Upload response status:', response.status);
    console.log('Upload response body:', response.data);
    
    if (response.status === 200) {
      console.log('✅ ACAP uploaded successfully!');
      
      // Wait for installation
      console.log('Waiting for ACAP to install...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      return true;
    } else {
      console.error('❌ Upload failed with status:', response.status);
      return false;
    }
    
  } catch (error) {
    console.error('Failed to upload ACAP:', error.message);
    throw error;
  }
}

// List installed ACAPs
async function listInstalledACAPs() {
  console.log('\n=== LISTING INSTALLED ACAPS ===');
  
  try {
    const url = `http://${CAMERA_IP}/axis-cgi/applications/list.cgi`;
    const response = await digestAuth(url, USERNAME, PASSWORD, 'GET');
    
    console.log('List response status:', response.status);
    
    const data = String(response.data);
    console.log('\nRaw response:');
    console.log(data);
    
    // Parse installed apps
    const apps = [];
    const appMap = new Map();
    const lines = data.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^(\w+)\.(\w+)="?([^"\n]+)"?/);
      if (match) {
        const [, appId, property, value] = match;
        if (!appMap.has(appId)) {
          appMap.set(appId, {});
        }
        const app = appMap.get(appId);
        app[property.toLowerCase()] = value;
      }
    }
    
    // Convert to array
    for (const [appId, app] of appMap) {
      if (app.name) {
        apps.push({
          id: appId,
          name: app.name,
          nicename: app.nicename,
          vendor: app.vendor,
          version: app.version,
          status: app.status
        });
      }
    }
    
    console.log('\nParsed applications:');
    apps.forEach(app => {
      console.log(`- ${app.name} v${app.version} by ${app.vendor} (${app.status})`);
    });
    
    // Check if BatonAnalytic is installed
    const batonApp = apps.find(app => app.name === 'BatonAnalytic');
    if (batonApp) {
      console.log(`\n✅ BatonAnalytic is installed: v${batonApp.version} (${batonApp.status})`);
      return true;
    } else {
      console.log('\n❌ BatonAnalytic is NOT installed');
      return false;
    }
    
  } catch (error) {
    console.error('Failed to list ACAPs:', error.message);
    throw error;
  }
}

// Test BatonAnalytic endpoint
async function testBatonAnalytic() {
  console.log('\n=== TESTING BATON ANALYTIC ENDPOINT ===');
  
  try {
    const url = `http://${CAMERA_IP}/local/BatonAnalytic/baton_analytic.cgi?command=getSceneDescription`;
    const requestData = { viewArea: 1 };
    
    console.log('Testing endpoint:', url);
    console.log('Request data:', JSON.stringify(requestData));
    
    const response = await digestAuth(
      url,
      USERNAME,
      PASSWORD,
      'POST',
      JSON.stringify(requestData),
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Response status:', response.status);
    
    if (response.status === 200) {
      console.log('✅ BatonAnalytic is working!');
      console.log('Scene description:', JSON.stringify(response.data, null, 2));
    } else {
      console.log('❌ BatonAnalytic returned status:', response.status);
    }
    
  } catch (error) {
    console.error('Failed to test BatonAnalytic:', error.message);
  }
}

// Main test flow
async function runFullTest() {
  console.log('=== FULL ACAP DEPLOYMENT TEST ===');
  console.log('Camera:', CAMERA_IP);
  console.log('User:', USERNAME);
  
  try {
    // 1. Check current state
    const isInstalled = await listInstalledACAPs();
    
    if (isInstalled) {
      console.log('\nBatonAnalytic is already installed. Testing it...');
      await testBatonAnalytic();
    } else {
      console.log('\nBatonAnalytic not installed. Installing...');
      
      // 2. Download latest ACAP
      const acapPath = await downloadLatestACAP();
      
      // 3. Upload to camera
      const uploaded = await uploadACAP(acapPath);
      
      if (uploaded) {
        // 4. Verify installation
        await listInstalledACAPs();
        
        // 5. Test the endpoint
        await testBatonAnalytic();
      }
    }
    
    console.log('\n=== TEST COMPLETE ===');
    
  } catch (error) {
    console.error('\n=== TEST FAILED ===');
    console.error(error);
  }
}

// Run the test
runFullTest();