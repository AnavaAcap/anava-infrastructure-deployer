#!/usr/bin/env node

/**
 * Helper script to submit installer to Microsoft for analysis
 * This helps build reputation and reduce false positives
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('📊 Microsoft Defender Submission Helper\n');

// Find the installer
const releaseDir = path.join(__dirname, '..', 'release');
const installers = fs.readdirSync(releaseDir).filter(f => f.endsWith('.exe'));

if (installers.length === 0) {
  console.error('❌ No installer found in release directory');
  console.log('Run: npm run dist:win first');
  process.exit(1);
}

const installerPath = path.join(releaseDir, installers[0]);
const stats = fs.statSync(installerPath);

// Calculate hashes
const fileBuffer = fs.readFileSync(installerPath);
const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
const md5 = crypto.createHash('md5').update(fileBuffer).digest('hex');

console.log('📦 Installer Information:');
console.log('   File:', installers[0]);
console.log('   Size:', (stats.size / (1024 * 1024)).toFixed(2), 'MB');
console.log('   SHA256:', sha256);
console.log('   MD5:', md5);
console.log('\n');

console.log('📝 Steps to Submit to Microsoft:\n');
console.log('1. Go to: https://www.microsoft.com/en-us/wdsi/filesubmission\n');
console.log('2. Sign in with a Microsoft account\n');
console.log('3. Select "Software developer" as submission type\n');
console.log('4. Upload the file:', installerPath);
console.log('\n5. Fill in the form:');
console.log('   - Company: Anava Inc.');
console.log('   - Product: Anava Installer');
console.log('   - Version:', require('../package.json').version);
console.log('   - Website: https://anava.ai');
console.log('   - Description: Official installer for Anava Vision AI camera analytics platform');
console.log('\n6. Submit and wait for analysis (usually 24-72 hours)\n');

console.log('💡 Additional Steps to Build Reputation:\n');
console.log('1. SmartScreen Application Reputation:');
console.log('   - Get an EV (Extended Validation) code signing certificate');
console.log('   - This immediately establishes SmartScreen reputation\n');

console.log('2. Windows Hardware Certification:');
console.log('   - Join Windows Hardware Dev Center');
console.log('   - Submit signed packages for certification');
console.log('   - URL: https://partner.microsoft.com/dashboard/hardware\n');

console.log('3. Microsoft Defender for Business:');
console.log('   - Register as a software vendor');
console.log('   - Get your certificate whitelisted');
console.log('   - URL: https://www.microsoft.com/security/business\n');

// Create submission info file
const submissionInfo = {
  file: installers[0],
  size: stats.size,
  sha256: sha256,
  md5: md5,
  date: new Date().toISOString(),
  version: require('../package.json').version
};

const infoPath = path.join(releaseDir, 'submission-info.json');
fs.writeFileSync(infoPath, JSON.stringify(submissionInfo, null, 2));

console.log('📄 Submission info saved to:', infoPath);