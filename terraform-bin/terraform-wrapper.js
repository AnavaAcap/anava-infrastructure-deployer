#!/usr/bin/env node
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
  
  throw new Error(`Unsupported platform: ${platform} ${arch}`);
}

if (require.main === module) {
  const binary = getTerraformBinary();
  const binaryPath = path.join(__dirname, binary);
  console.log(`Using Terraform binary: ${binaryPath}`);
  
  const proc = spawn(binaryPath, process.argv.slice(2), { stdio: 'inherit' });
  proc.on('exit', (code) => process.exit(code));
}

module.exports = { getTerraformBinary };
