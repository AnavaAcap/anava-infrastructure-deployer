#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('========================================');
console.log('Pre-build Check for Windows Build');
console.log('========================================\n');

const terraformBinDir = path.join(__dirname, '..', 'terraform-bin');
const terraformExe = path.join(terraformBinDir, 'terraform.exe');

// Check if terraform.exe exists
if (!fs.existsSync(terraformExe)) {
  console.error('❌ terraform.exe not found!');
  console.log('Attempting to download terraform.exe for Windows...\n');
  
  try {
    // Run the download script
    execSync('node scripts/download-all-terraform-binaries.js', { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    
    // Check again
    if (fs.existsSync(terraformExe)) {
      console.log('✅ terraform.exe downloaded successfully');
    } else {
      console.error('❌ Failed to download terraform.exe');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error downloading terraform binaries:', error.message);
    process.exit(1);
  }
} else {
  // Verify the file size
  const stats = fs.statSync(terraformExe);
  const sizeMB = Math.round(stats.size / 1024 / 1024);
  
  if (stats.size < 1000000) {
    console.error(`❌ terraform.exe appears corrupted (only ${sizeMB}MB)`);
    console.log('Re-downloading...\n');
    
    // Delete and re-download
    fs.unlinkSync(terraformExe);
    
    try {
      execSync('node scripts/download-all-terraform-binaries.js', { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
    } catch (error) {
      console.error('❌ Error downloading terraform binaries:', error.message);
      process.exit(1);
    }
  } else {
    console.log(`✅ terraform.exe exists (${sizeMB}MB)`);
  }
}

// List all terraform binaries
console.log('\nTerraform binaries in terraform-bin:');
if (fs.existsSync(terraformBinDir)) {
  const files = fs.readdirSync(terraformBinDir);
  files.forEach(file => {
    if (file.includes('terraform') || file.endsWith('.exe')) {
      const filePath = path.join(terraformBinDir, file);
      const stats = fs.statSync(filePath);
      const sizeMB = Math.round(stats.size / 1024 / 1024);
      console.log(`  - ${file} (${sizeMB}MB)`);
    }
  });
}

console.log('\n✅ Pre-build check complete');
console.log('========================================');