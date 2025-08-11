#!/usr/bin/env node

/**
 * Download Visual C++ Redistributables for Windows builds
 * Required for native modules like puppeteer
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const VCREDIST_URL = 'https://aka.ms/vs/17/release/vc_redist.x64.exe';
const RESOURCES_DIR = path.join(__dirname, '..', 'resources');
const VCREDIST_PATH = path.join(RESOURCES_DIR, 'vc_redist.x64.exe');

// Create resources directory if it doesn't exist
if (!fs.existsSync(RESOURCES_DIR)) {
  fs.mkdirSync(RESOURCES_DIR, { recursive: true });
}

// Check if already downloaded
if (fs.existsSync(VCREDIST_PATH)) {
  console.log('Visual C++ Redistributables already downloaded');
  process.exit(0);
}

console.log('Downloading Visual C++ Redistributables...');

const file = fs.createWriteStream(VCREDIST_PATH);

https.get(VCREDIST_URL, (response) => {
  if (response.statusCode === 302 || response.statusCode === 301) {
    // Handle redirect
    https.get(response.headers.location, (redirectResponse) => {
      redirectResponse.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log('Visual C++ Redistributables downloaded successfully');
      });
    }).on('error', (err) => {
      fs.unlink(VCREDIST_PATH, () => {});
      console.error('Error downloading VC++ Redistributables:', err.message);
      process.exit(1);
    });
  } else {
    response.pipe(file);
    
    file.on('finish', () => {
      file.close();
      console.log('Visual C++ Redistributables downloaded successfully');
    });
  }
}).on('error', (err) => {
  fs.unlink(VCREDIST_PATH, () => {});
  console.error('Error downloading VC++ Redistributables:', err.message);
  process.exit(1);
});