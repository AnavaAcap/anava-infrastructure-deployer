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
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds
const DOWNLOAD_TIMEOUT = 60000; // 60 seconds

// Create resources directory if it doesn't exist
if (!fs.existsSync(RESOURCES_DIR)) {
  fs.mkdirSync(RESOURCES_DIR, { recursive: true });
}

// Check if already downloaded
if (fs.existsSync(VCREDIST_PATH)) {
  console.log('Visual C++ Redistributables already downloaded');
  process.exit(0);
}

async function downloadWithRetry(url, destPath, attempt = 1) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading Visual C++ Redistributables... (Attempt ${attempt}/${MAX_RETRIES})`);
    
    const file = fs.createWriteStream(destPath);
    let timedOut = false;
    
    const timeout = setTimeout(() => {
      timedOut = true;
      file.destroy();
      reject(new Error('Download timeout'));
    }, DOWNLOAD_TIMEOUT);
    
    const handleResponse = (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        file.destroy();
        clearTimeout(timeout);
        https.get(response.headers.location, handleResponse).on('error', handleError);
      } else if (response.statusCode === 200) {
        response.pipe(file);
        
        file.on('finish', () => {
          clearTimeout(timeout);
          file.close();
          if (!timedOut) {
            console.log('Visual C++ Redistributables downloaded successfully');
            resolve();
          }
        });
        
        file.on('error', handleError);
      } else {
        clearTimeout(timeout);
        file.destroy();
        reject(new Error(`HTTP ${response.statusCode}`));
      }
    };
    
    const handleError = (err) => {
      clearTimeout(timeout);
      file.destroy();
      fs.unlink(destPath, () => {});
      
      if (attempt < MAX_RETRIES) {
        console.error(`Download failed: ${err.message}. Retrying in ${RETRY_DELAY/1000} seconds...`);
        setTimeout(() => {
          downloadWithRetry(url, destPath, attempt + 1)
            .then(resolve)
            .catch(reject);
        }, RETRY_DELAY);
      } else {
        reject(err);
      }
    };
    
    https.get(url, { timeout: DOWNLOAD_TIMEOUT }, handleResponse).on('error', handleError);
  });
}

downloadWithRetry(VCREDIST_URL, VCREDIST_PATH)
  .catch((err) => {
    console.error('Failed to download VC++ Redistributables after all retries:', err.message);
    process.exit(1);
  });