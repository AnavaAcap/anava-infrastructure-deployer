const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const TERRAFORM_VERSION = '1.7.0';
const TERRAFORM_URL = `https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_windows_amd64.zip`;

async function downloadTerraform() {
  const terraformDir = path.join(__dirname, '..', 'terraform-bin');
  const terraformPath = path.join(terraformDir, 'terraform.exe');
  
  // Check if Terraform already exists
  if (fs.existsSync(terraformPath)) {
    console.log('Terraform binary already exists, skipping download');
    return;
  }
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(terraformDir)) {
    fs.mkdirSync(terraformDir, { recursive: true });
  }
  
  console.log(`Downloading Terraform ${TERRAFORM_VERSION} for Windows...`);
  
  const zipPath = path.join(terraformDir, 'terraform.zip');
  
  // Download the zip file
  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream(zipPath);
    https.get(TERRAFORM_URL, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(zipPath, () => {});
      reject(err);
    });
  });
  
  console.log('Extracting Terraform...');
  
  // Extract using PowerShell on Windows
  await execAsync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${terraformDir}' -Force"`);
  
  // Clean up zip file
  fs.unlinkSync(zipPath);
  
  console.log('Terraform download complete!');
}

downloadTerraform().catch((err) => {
  console.error('Failed to download Terraform:', err);
  process.exit(1);
});