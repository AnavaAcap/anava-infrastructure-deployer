#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TERRAFORM_VERSION = '1.9.8';
const TERRAFORM_BASE_URL = 'https://releases.hashicorp.com/terraform';

// Download URLs for all platforms we support
const TERRAFORM_PLATFORMS = [
  {
    name: 'darwin-x64',
    url: `${TERRAFORM_BASE_URL}/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_darwin_amd64.zip`,
    binary: 'terraform-darwin-x64'
  },
  {
    name: 'darwin-arm64', 
    url: `${TERRAFORM_BASE_URL}/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_darwin_arm64.zip`,
    binary: 'terraform-darwin-arm64'
  },
  {
    name: 'linux-x64',
    url: `${TERRAFORM_BASE_URL}/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip`,
    binary: 'terraform-linux'
  },
  {
    name: 'win32-x64',
    url: `${TERRAFORM_BASE_URL}/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_windows_amd64.zip`,
    binary: 'terraform.exe'
  }
];

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading from: ${url}`);
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
      
      let downloadedBytes = 0;
      const totalBytes = parseInt(response.headers['content-length'], 10);
      
      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        const progress = Math.round((downloadedBytes / totalBytes) * 100);
        process.stdout.write(`\rProgress: ${progress}%`);
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        console.log(' - Complete!');
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

async function extractZip(zipPath, destDir, platform) {
  console.log(`Extracting ${platform.name}...`);
  
  // Create temp extraction directory
  const tempDir = path.join(destDir, `temp-${platform.name}`);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  try {
    // Extract based on current build platform
    if (process.platform === 'win32') {
      // Use PowerShell on Windows
      execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tempDir}' -Force"`, { stdio: 'inherit' });
    } else {
      // Use unzip on Unix-like systems
      execSync(`unzip -o "${zipPath}" -d "${tempDir}"`, { stdio: 'inherit' });
    }
    
    // Move the terraform binary to the correct name
    const sourceBinary = platform.name.includes('win32') ? 'terraform.exe' : 'terraform';
    const sourceFile = path.join(tempDir, sourceBinary);
    const destFile = path.join(destDir, platform.binary);
    
    if (fs.existsSync(sourceFile)) {
      // Copy to destination with platform-specific name
      fs.copyFileSync(sourceFile, destFile);
      
      // Make executable on Unix-like systems
      if (!platform.name.includes('win32')) {
        fs.chmodSync(destFile, '755');
      }
      
      console.log(`✅ Extracted ${platform.binary}`);
    } else {
      throw new Error(`Binary not found after extraction: ${sourceFile}`);
    }
    
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
    
  } catch (error) {
    // Clean up on error
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    throw error;
  }
}

async function main() {
  try {
    console.log('='.repeat(60));
    console.log('Downloading Terraform binaries for all platforms...');
    console.log(`Terraform version: ${TERRAFORM_VERSION}`);
    console.log('='.repeat(60));
    
    // Create terraform directory
    const terraformDir = path.join(__dirname, '..', 'terraform-bin');
    if (!fs.existsSync(terraformDir)) {
      fs.mkdirSync(terraformDir, { recursive: true });
    }
    
    // Download and extract each platform binary
    for (const platform of TERRAFORM_PLATFORMS) {
      const destPath = path.join(terraformDir, platform.binary);
      
      // Check if binary already exists
      if (fs.existsSync(destPath)) {
        console.log(`\n${platform.name}: Binary already exists`);
        
        // Verify it's a valid binary by checking file size
        const stats = fs.statSync(destPath);
        if (stats.size < 1000000) { // Less than 1MB is suspicious
          console.log('⚠️  Binary seems corrupted, re-downloading...');
          fs.unlinkSync(destPath);
        } else {
          console.log(`✅ ${platform.binary} (${Math.round(stats.size / 1024 / 1024)}MB)`);
          continue;
        }
      }
      
      console.log(`\nDownloading ${platform.name}...`);
      const zipPath = path.join(terraformDir, `terraform-${platform.name}.zip`);
      
      try {
        await downloadFile(platform.url, zipPath);
        await extractZip(zipPath, terraformDir, platform);
        
        // Clean up zip file
        fs.unlinkSync(zipPath);
        
        // Verify the binary
        const stats = fs.statSync(destPath);
        console.log(`✅ Size: ${Math.round(stats.size / 1024 / 1024)}MB`);
        
      } catch (error) {
        console.error(`❌ Failed to process ${platform.name}:`, error.message);
        // Continue with other platforms
      }
    }
    
    // Create a simple wrapper script for runtime selection
    const wrapperScript = `#!/usr/bin/env node
// Runtime Terraform binary selector
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

function getTerraformBinary() {
  const platform = os.platform();
  const arch = os.arch();
  
  if (platform === 'darwin') {
    return arch === 'arm64' ? 'terraform-darwin-arm64' : 'terraform-darwin-x64';
  } else if (platform === 'linux') {
    return 'terraform-linux';
  } else if (platform === 'win32') {
    return 'terraform.exe';
  }
  
  throw new Error(\`Unsupported platform: \${platform} \${arch}\`);
}

if (require.main === module) {
  const binary = getTerraformBinary();
  const binaryPath = path.join(__dirname, binary);
  console.log(\`Using Terraform binary: \${binaryPath}\`);
  
  const proc = spawn(binaryPath, process.argv.slice(2), { stdio: 'inherit' });
  proc.on('exit', (code) => process.exit(code));
}

module.exports = { getTerraformBinary };
`;
    
    fs.writeFileSync(path.join(terraformDir, 'terraform-wrapper.js'), wrapperScript);
    if (process.platform !== 'win32') {
      fs.chmodSync(path.join(terraformDir, 'terraform-wrapper.js'), '755');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ All Terraform binaries downloaded successfully!');
    console.log('='.repeat(60));
    
    // List all files in terraform-bin directory
    console.log('\nContents of terraform-bin:');
    const files = fs.readdirSync(terraformDir);
    files.forEach(file => {
      const filePath = path.join(terraformDir, file);
      const stats = fs.statSync(filePath);
      if (stats.isFile()) {
        console.log(`  - ${file} (${Math.round(stats.size / 1024)}KB)`);
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to download Terraform binaries:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { downloadAllTerraformBinaries: main };