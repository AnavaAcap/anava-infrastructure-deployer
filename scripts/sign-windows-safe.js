#!/usr/bin/env node

/**
 * Safe Windows code signing script
 * Signs the installer with proper certificate to avoid virus detection
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔐 Windows Code Signing Script\n');

// Check environment variables
const certPath = process.env.WIN_CSC_LINK;
const certPassword = process.env.WIN_CSC_KEY_PASSWORD;

if (!certPath || !certPassword) {
  console.error('❌ Code signing certificate not configured!\n');
  console.log('To sign your Windows installer and avoid virus detection:');
  console.log('1. Purchase an OV or EV code signing certificate from:');
  console.log('   - DigiCert: https://www.digicert.com/signing/code-signing-certificates');
  console.log('   - Sectigo: https://sectigo.com/ssl-certificates/code-signing');
  console.log('   - GlobalSign: https://www.globalsign.com/en/code-signing-certificate\n');
  console.log('2. Export the certificate as a .pfx file\n');
  console.log('3. Set environment variables:');
  console.log('   export WIN_CSC_LINK=/path/to/your-certificate.pfx');
  console.log('   export WIN_CSC_KEY_PASSWORD=your-certificate-password\n');
  console.log('4. Run: npm run dist:win\n');
  console.log('⚠️  Without code signing, Windows Defender will flag the installer!\n');
  process.exit(0);
}

// Find the installer
const releaseDir = path.join(__dirname, '..', 'release');
const installers = fs.readdirSync(releaseDir).filter(f => f.endsWith('.exe'));

if (installers.length === 0) {
  console.error('❌ No installer found in release directory');
  process.exit(1);
}

const installerPath = path.join(releaseDir, installers[0]);
console.log('📦 Found installer:', installerPath);

// Sign the installer
try {
  console.log('✍️  Signing installer...');
  
  const signCmd = `signtool sign /f "${certPath}" /p "${certPassword}" /tr http://timestamp.digicert.com /td sha256 /fd sha256 /v "${installerPath}"`;
  
  execSync(signCmd, { stdio: 'inherit' });
  
  console.log('\n✅ Successfully signed:', installerPath);
  console.log('\n📝 The installer should now pass Windows Defender checks!');
} catch (error) {
  console.error('\n❌ Signing failed:', error.message);
  console.log('\nTroubleshooting:');
  console.log('1. Ensure signtool.exe is in your PATH (install Windows SDK)');
  console.log('2. Verify certificate path and password are correct');
  console.log('3. Check certificate hasn\'t expired');
  process.exit(1);
}