#!/usr/bin/env node

/**
 * Windows Build Script with Hardened Configuration
 * Fixes critical installer issues including:
 * - Missing shortcuts
 * - Failed uninstallation
 * - NSIS integrity errors
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('Anava Installer - Windows Build Script');
console.log('========================================\n');

// Check Node version
const nodeVersion = process.version;
console.log(`Node.js version: ${nodeVersion}`);
if (!nodeVersion.startsWith('v20')) {
  console.warn('Warning: This build is optimized for Node.js v20.x');
}

// Step 1: Clean previous builds
console.log('\n[1/8] Cleaning previous builds...');
const releaseDir = path.join(__dirname, '..', 'release');
if (fs.existsSync(releaseDir)) {
  if (process.platform === 'win32') {
    execSync(`rmdir /s /q "${releaseDir}"`, { stdio: 'inherit' });
  } else {
    execSync(`rm -rf "${releaseDir}"`, { stdio: 'inherit' });
  }
}

// Step 2: Verify required files
console.log('\n[2/8] Verifying required files...');
const requiredFiles = [
  'assets/icon.ico',
  'assets/installerSidebar.bmp',
  'installer-scripts/installer.nsh',
  'electron-builder-win.yml',
  'LICENSE.md'
];

let missingFiles = [];
for (const file of requiredFiles) {
  const filePath = path.join(__dirname, '..', file);
  if (!fs.existsSync(filePath)) {
    missingFiles.push(file);
  }
}

if (missingFiles.length > 0) {
  console.error('ERROR: Missing required files:');
  missingFiles.forEach(file => console.error(`  - ${file}`));
  
  // Try to create missing installer sidebar image
  if (missingFiles.includes('assets/installerSidebar.bmp')) {
    console.log('\nCreating placeholder installerSidebar.bmp...');
    const sidebarPath = path.join(__dirname, '..', 'assets', 'installerSidebar.bmp');
    // Create a minimal valid BMP file (1x1 pixel white image)
    const bmpHeader = Buffer.from([
      0x42, 0x4D, // BM
      0x3A, 0x00, 0x00, 0x00, // File size
      0x00, 0x00, 0x00, 0x00, // Reserved
      0x36, 0x00, 0x00, 0x00, // Offset to pixel data
      0x28, 0x00, 0x00, 0x00, // Header size
      0x01, 0x00, 0x00, 0x00, // Width
      0x01, 0x00, 0x00, 0x00, // Height
      0x01, 0x00, // Planes
      0x18, 0x00, // Bits per pixel
      0x00, 0x00, 0x00, 0x00, // Compression
      0x04, 0x00, 0x00, 0x00, // Image size
      0x00, 0x00, 0x00, 0x00, // X pixels per meter
      0x00, 0x00, 0x00, 0x00, // Y pixels per meter
      0x00, 0x00, 0x00, 0x00, // Colors used
      0x00, 0x00, 0x00, 0x00, // Important colors
      0xFF, 0xFF, 0xFF, 0x00  // White pixel
    ]);
    fs.writeFileSync(sidebarPath, bmpHeader);
    console.log('Created placeholder BMP file');
    missingFiles = missingFiles.filter(f => f !== 'assets/installerSidebar.bmp');
  }
  
  if (missingFiles.length > 0) {
    process.exit(1);
  }
}

// Step 3: Install dependencies
console.log('\n[3/8] Installing dependencies...');
execSync('npm ci', { stdio: 'inherit' });

// Windows-specific: Install missing Rollup module
if (process.platform === 'win32') {
  console.log('\n[3.5/8] Installing Windows-specific Rollup module...');
  try {
    execSync('npm install @rollup/rollup-win32-x64-msvc --no-save', { stdio: 'inherit' });
  } catch (error) {
    console.warn('Warning: Could not install Rollup Windows module, build may continue');
  }
}

// Step 4: Build main process
console.log('\n[4/8] Building main process...');
execSync('npm run build:main', { stdio: 'inherit' });

// Step 5: Build renderer process
console.log('\n[5/8] Building renderer process...');
execSync('npm run build:renderer', { stdio: 'inherit' });

// Step 6: Verify build output
console.log('\n[6/8] Verifying build output...');
const distMain = path.join(__dirname, '..', 'dist', 'main', 'index.js');
const distRenderer = path.join(__dirname, '..', 'dist', 'renderer', 'index.html');

if (!fs.existsSync(distMain)) {
  console.error('ERROR: Main process build failed - dist/main/index.js not found');
  process.exit(1);
}

if (!fs.existsSync(distRenderer)) {
  console.error('ERROR: Renderer process build failed - dist/renderer/index.html not found');
  process.exit(1);
}

console.log('Build output verified successfully');

// Step 7: Run electron-builder with Windows configuration
console.log('\n[7/8] Building Windows installer...');
console.log('Using configuration: electron-builder-win.yml');

const buildCommand = process.platform === 'win32'
  ? 'npx electron-builder --win --config electron-builder-win.yml'
  : 'npx electron-builder --win --config electron-builder-win.yml';

try {
  // Set environment variables for build
  const env = { ...process.env };
  
  // If code signing certificate is available
  if (process.env.WIN_CSC_LINK && process.env.WIN_CSC_KEY_PASSWORD) {
    console.log('Code signing certificate detected');
    env.WIN_CSC_LINK = process.env.WIN_CSC_LINK;
    env.WIN_CSC_KEY_PASSWORD = process.env.WIN_CSC_KEY_PASSWORD;
  } else {
    console.log('No code signing certificate found - building unsigned installer');
    console.log('Note: Users may see security warnings when installing');
  }
  
  execSync(buildCommand, { stdio: 'inherit', env });
} catch (error) {
  console.error('\nERROR: Electron Builder failed');
  console.error('Common causes:');
  console.error('1. Missing dependencies - run: npm ci');
  console.error('2. Invalid configuration - check electron-builder-win.yml');
  console.error('3. Insufficient permissions - run as Administrator on Windows');
  console.error('4. Antivirus interference - temporarily disable and retry');
  process.exit(1);
}

// Step 8: Verify installer creation
console.log('\n[8/8] Verifying installer creation...');
const installerPatterns = [
  'Anava Installer-Setup-*.exe',
  'Anava-Installer-Setup-*.exe'
];

let installerFound = false;
let installerPath = '';

for (const pattern of installerPatterns) {
  const files = fs.readdirSync(releaseDir).filter(file => {
    return file.includes('Setup') && file.endsWith('.exe');
  });
  
  if (files.length > 0) {
    installerFound = true;
    installerPath = path.join(releaseDir, files[0]);
    break;
  }
}

if (!installerFound) {
  console.error('\nERROR: Installer was not created');
  console.error('Check the build output above for errors');
  process.exit(1);
}

// Calculate file size and checksum
const stats = fs.statSync(installerPath);
const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

console.log('\n========================================');
console.log('Build completed successfully!');
console.log('========================================');
console.log(`Installer: ${path.basename(installerPath)}`);
console.log(`Size: ${fileSizeMB} MB`);
console.log(`Location: ${installerPath}`);

// Create build report
const reportPath = path.join(releaseDir, 'build-report.json');
const report = {
  timestamp: new Date().toISOString(),
  version: require('../package.json').version,
  platform: 'win32',
  architecture: ['x64', 'ia32'],
  installer: path.basename(installerPath),
  size: stats.size,
  signed: !!(process.env.WIN_CSC_LINK && process.env.WIN_CSC_KEY_PASSWORD)
};

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\nBuild report saved to: ${reportPath}`);

// Provide next steps
console.log('\n========================================');
console.log('Next Steps:');
console.log('========================================');
console.log('1. Test the installer on a clean Windows machine');
console.log('2. Verify shortcuts are created correctly');
console.log('3. Test uninstallation process');
console.log('4. Check for any antivirus warnings');
console.log('5. If signed, verify certificate is valid');
console.log('\nTo test: Copy the installer to a Windows machine and run it');

process.exit(0);