#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

const TERRAFORM_VERSION = '1.9.8';
const TERRAFORM_BASE_URL = 'https://releases.hashicorp.com/terraform';

// Platform-specific download URLs
const TERRAFORM_URLS = {
  'darwin-x64': `${TERRAFORM_BASE_URL}/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_darwin_amd64.zip`,
  'darwin-arm64': `${TERRAFORM_BASE_URL}/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_darwin_arm64.zip`,
  'linux-x64': `${TERRAFORM_BASE_URL}/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip`,
  'win32-x64': `${TERRAFORM_BASE_URL}/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_windows_amd64.zip`
};

function getPlatformKey() {
  const platform = process.platform;
  const arch = process.arch;
  
  if (platform === 'darwin') {
    return arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
  } else if (platform === 'linux') {
    return 'linux-x64';
  } else if (platform === 'win32') {
    return 'win32-x64';
  }
  
  throw new Error(`Unsupported platform: ${platform} ${arch}`);
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        file.close();
        fs.unlinkSync(destPath);
        return downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

async function main() {
  try {
    const platformKey = getPlatformKey();
    const terraformUrl = TERRAFORM_URLS[platformKey];
    
    if (!terraformUrl) {
      throw new Error(`No Terraform URL for platform: ${platformKey}`);
    }
    
    // Create terraform directory in resources
    const terraformDir = path.join(__dirname, '..', 'terraform-bin');
    if (!fs.existsSync(terraformDir)) {
      fs.mkdirSync(terraformDir, { recursive: true });
    }
    
    const zipPath = path.join(terraformDir, 'terraform.zip');
    const binPath = path.join(terraformDir, process.platform === 'win32' ? 'terraform.exe' : 'terraform');
    
    // Check if terraform already exists
    if (fs.existsSync(binPath)) {
      console.log('Terraform binary already exists, checking version...');
      try {
        const version = execSync(`"${binPath}" version -json`, { encoding: 'utf8' });
        const versionData = JSON.parse(version);
        if (versionData.terraform_version === TERRAFORM_VERSION) {
          console.log(`✅ Terraform ${TERRAFORM_VERSION} already installed`);
          return;
        }
      } catch (e) {
        console.log('Failed to check existing terraform version, re-downloading...');
      }
    }
    
    console.log(`Downloading Terraform ${TERRAFORM_VERSION} for ${platformKey}...`);
    console.log(`URL: ${terraformUrl}`);
    
    // Download the zip file
    await downloadFile(terraformUrl, zipPath);
    console.log('Download complete, extracting...');
    
    // Extract based on platform
    if (process.platform === 'win32') {
      // Use PowerShell on Windows
      execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${terraformDir}' -Force"`, { stdio: 'inherit' });
    } else {
      // Use unzip on Unix-like systems
      execSync(`unzip -o "${zipPath}" -d "${terraformDir}"`, { stdio: 'inherit' });
    }
    
    // Make executable on Unix-like systems
    if (process.platform !== 'win32') {
      fs.chmodSync(binPath, '755');
    }
    
    // Clean up zip file
    fs.unlinkSync(zipPath);
    
    // Verify installation
    const version = execSync(`"${binPath}" version`, { encoding: 'utf8' });
    console.log(`✅ Terraform installed successfully:`);
    console.log(version);
    
  } catch (error) {
    console.error('❌ Failed to download Terraform:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { downloadTerraform: main };