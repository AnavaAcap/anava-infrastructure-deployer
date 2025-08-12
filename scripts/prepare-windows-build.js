#!/usr/bin/env node

/**
 * Prepare Windows build to reduce virus detection false positives
 * This script should be run before building Windows executables locally
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

console.log('🔧 Preparing Windows build to reduce false positive detections...\n');

// 1. Check for code signing certificate
function checkCodeSigning() {
  console.log('1️⃣ Checking for code signing certificate...');
  
  const hasCSC = process.env.CSC_LINK || process.env.CSC_NAME;
  const hasWinCert = process.env.WIN_CSC_LINK || process.env.WIN_CSC_KEY_PASSWORD;
  
  if (hasCSC || hasWinCert) {
    console.log('   ✅ Code signing certificate found');
    return true;
  } else {
    console.log('   ⚠️  No code signing certificate found');
    console.log('   📝 To add code signing:');
    console.log('      - Purchase an OV or EV certificate from DigiCert, Sectigo, etc.');
    console.log('      - Set WIN_CSC_LINK to your .pfx file path');
    console.log('      - Set WIN_CSC_KEY_PASSWORD to your certificate password');
    return false;
  }
}

// 2. Add build metadata
function addBuildMetadata() {
  console.log('\n2️⃣ Adding build metadata...');
  
  const metadata = {
    buildDate: new Date().toISOString(),
    buildMachine: require('os').hostname(),
    buildUser: process.env.USER || process.env.USERNAME || 'unknown',
    buildPlatform: process.platform,
    buildArch: process.arch,
    nodeVersion: process.version,
    buildId: crypto.randomBytes(16).toString('hex')
  };
  
  const metadataPath = path.join(__dirname, '..', 'build-metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  
  console.log('   ✅ Build metadata created:', metadataPath);
  return metadata;
}

// 3. Create publisher info file
function createPublisherInfo() {
  console.log('\n3️⃣ Creating publisher information...');
  
  const publisherInfo = {
    name: 'Anava Inc.',
    website: 'https://anava.ai',
    support: 'support@anava.ai',
    copyright: `Copyright © ${new Date().getFullYear()} Anava Inc.`,
    description: 'Official Anava Vision Installer for deploying AI-powered camera analytics',
    verified: false // Will be true when code signed
  };
  
  const infoPath = path.join(__dirname, '..', 'publisher-info.json');
  fs.writeFileSync(infoPath, JSON.stringify(publisherInfo, null, 2));
  
  console.log('   ✅ Publisher info created:', infoPath);
  return publisherInfo;
}

// 4. Update package.json with Windows-specific build config
function updateWindowsBuildConfig() {
  console.log('\n4️⃣ Updating Windows build configuration...');
  
  const packagePath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  // Ensure Windows build config has all recommended settings
  if (!packageJson.build.win) {
    packageJson.build.win = {};
  }
  
  const winConfig = {
    ...packageJson.build.win,
    target: [
      {
        target: 'nsis',
        arch: ['x64']
      }
    ],
    icon: 'assets/icon.ico',
    publisherName: 'Anava Inc.',
    certificateSubjectName: 'Anava Inc.',
    rfc3161TimeStampServer: 'http://timestamp.sectigo.com',
    timeStampServer: 'http://timestamp.sectigo.com',
    signDlls: true,
    signingHashAlgorithms: ['sha256'],
    additionalCertificateFile: process.env.WIN_CERT_FILE || undefined,
    // NSIS specific settings for better compatibility
    nsis: {
      oneClick: false,
      perMachine: false,
      allowToChangeInstallationDirectory: true,
      deleteAppDataOnUninstall: false,
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      shortcutName: 'Anava Vision',
      guid: packageJson.build.win.guid || '{' + crypto.randomUUID().toUpperCase() + '}',
      installerIcon: 'assets/icon.ico',
      uninstallerIcon: 'assets/icon.ico',
      installerHeaderIcon: 'assets/icon.ico',
      artifactName: 'Anava.Installer.Setup.${version}.exe',
      unicode: true,
      warningsAsErrors: false
    },
    // Additional metadata for Windows
    legalTrademarks: 'Anava® is a registered trademark of Anava Inc.',
    fileAssociations: [],
    protocols: []
  };
  
  packageJson.build.win = winConfig;
  
  // Don't actually write the package.json as it might break existing config
  // Instead, create a separate config file
  const winConfigPath = path.join(__dirname, '..', 'electron-builder-win.json');
  const builderConfig = {
    ...packageJson.build,
    win: winConfig
  };
  
  fs.writeFileSync(winConfigPath, JSON.stringify(builderConfig, null, 2));
  console.log('   ✅ Windows build config created:', winConfigPath);
  
  return winConfig;
}

// 5. Create signing script for manual signing
function createSigningScript() {
  console.log('\n5️⃣ Creating manual signing script...');
  
  const signScript = `#!/usr/bin/env node

/**
 * Manual signing script for Windows executables
 * This can be used if automatic signing fails
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const exePath = process.argv[2];
if (!exePath) {
  console.error('Usage: node sign-windows.js <path-to-exe>');
  process.exit(1);
}

if (!fs.existsSync(exePath)) {
  console.error('File not found:', exePath);
  process.exit(1);
}

// Check for signtool
try {
  execSync('signtool /?', { stdio: 'ignore' });
} catch (error) {
  console.error('signtool not found. Please install Windows SDK.');
  process.exit(1);
}

const certPath = process.env.WIN_CSC_LINK || process.env.CSC_LINK;
const certPassword = process.env.WIN_CSC_KEY_PASSWORD || process.env.CSC_KEY_PASSWORD;

if (!certPath || !certPassword) {
  console.error('Certificate not configured. Set WIN_CSC_LINK and WIN_CSC_KEY_PASSWORD');
  process.exit(1);
}

try {
  console.log('Signing:', exePath);
  
  const signCmd = \`signtool sign /f "\${certPath}" /p "\${certPassword}" /tr http://timestamp.sectigo.com /td sha256 /fd sha256 /v "\${exePath}"\`;
  
  execSync(signCmd, { stdio: 'inherit' });
  
  console.log('✅ Successfully signed:', exePath);
} catch (error) {
  console.error('❌ Signing failed:', error.message);
  process.exit(1);
}
`;
  
  const scriptPath = path.join(__dirname, 'sign-windows.js');
  fs.writeFileSync(scriptPath, signScript);
  fs.chmodSync(scriptPath, '755');
  
  console.log('   ✅ Signing script created:', scriptPath);
  return scriptPath;
}

// 6. Create build verification script
function createVerificationScript() {
  console.log('\n6️⃣ Creating build verification script...');
  
  const verifyScript = `#!/usr/bin/env node

/**
 * Verify Windows build for potential issues
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const exePath = process.argv[2];
if (!exePath) {
  console.error('Usage: node verify-build.js <path-to-exe>');
  process.exit(1);
}

console.log('🔍 Verifying build:', exePath);

// Check file exists
if (!fs.existsSync(exePath)) {
  console.error('❌ File not found');
  process.exit(1);
}

// Check file size (should be reasonable)
const stats = fs.statSync(exePath);
const sizeMB = stats.size / (1024 * 1024);
console.log(\`   File size: \${sizeMB.toFixed(2)} MB\`);

if (sizeMB < 50) {
  console.warn('   ⚠️  File seems too small, might be corrupted');
} else if (sizeMB > 500) {
  console.warn('   ⚠️  File seems too large, might include unnecessary files');
} else {
  console.log('   ✅ File size looks reasonable');
}

// Calculate checksums
const fileBuffer = fs.readFileSync(exePath);
const md5 = crypto.createHash('md5').update(fileBuffer).digest('hex');
const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

console.log(\`   MD5:    \${md5}\`);
console.log(\`   SHA256: \${sha256}\`);

// Check if signed (Windows only)
if (process.platform === 'win32') {
  try {
    const { execSync } = require('child_process');
    execSync(\`signtool verify /pa "\${exePath}"\`, { stdio: 'pipe' });
    console.log('   ✅ File is signed');
  } catch (error) {
    console.log('   ⚠️  File is not signed (will trigger SmartScreen)');
  }
}

// Save verification info
const verifyInfo = {
  file: path.basename(exePath),
  size: stats.size,
  sizeMB: sizeMB,
  md5: md5,
  sha256: sha256,
  timestamp: new Date().toISOString(),
  platform: process.platform
};

const infoPath = exePath + '.verify.json';
fs.writeFileSync(infoPath, JSON.stringify(verifyInfo, null, 2));
console.log('\\n📄 Verification info saved to:', infoPath);

console.log('\\n✅ Build verification complete');
`;
  
  const scriptPath = path.join(__dirname, 'verify-build.js');
  fs.writeFileSync(scriptPath, verifyScript);
  fs.chmodSync(scriptPath, '755');
  
  console.log('   ✅ Verification script created:', scriptPath);
  return scriptPath;
}

// Main execution
console.log('═══════════════════════════════════════════════════════════════');
console.log('Windows Build Preparation for Anava Installer');
console.log('═══════════════════════════════════════════════════════════════\n');

const hasCert = checkCodeSigning();
const metadata = addBuildMetadata();
const publisherInfo = createPublisherInfo();
const winConfig = updateWindowsBuildConfig();
const signScript = createSigningScript();
const verifyScript = createVerificationScript();

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('✅ Build preparation complete!\n');

if (!hasCert) {
  console.log('⚠️  IMPORTANT: Your build will likely be flagged by Windows Defender');
  console.log('   because it is not code signed.\n');
  console.log('   To fix this permanently:');
  console.log('   1. Purchase a code signing certificate');
  console.log('   2. Set environment variables:');
  console.log('      export WIN_CSC_LINK=/path/to/certificate.pfx');
  console.log('      export WIN_CSC_KEY_PASSWORD=your_password\n');
}

console.log('📝 Next steps:');
console.log('   1. Run: npm run dist:win');
console.log('   2. After build, verify with: node scripts/verify-build.js release/Anava.Installer.Setup.*.exe');
if (!hasCert) {
  console.log('   3. If you have a certificate, sign with: node scripts/sign-windows.js release/Anava.Installer.Setup.*.exe');
}

console.log('\n💡 Tips to reduce false positives:');
console.log('   • Always build on the same machine (builds reputation)');
console.log('   • Submit your app to Microsoft for analysis: https://www.microsoft.com/wdsi/filesubmission');
console.log('   • Use GitHub Actions for production builds (better reputation)');
console.log('   • Consider using Docker for consistent builds');

console.log('\n═══════════════════════════════════════════════════════════════');