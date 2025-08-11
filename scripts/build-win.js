#!/usr/bin/env node

/**
 * Windows Build Script with Integrity Checks
 * Fixes: NSIS integrity issues, missing dependencies, build failures
 * Compatible with Electron v37.2.6
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

// Build configuration
const CONFIG = {
  appName: 'Anava Installer',
  appId: 'com.anava.installer',
  version: '0.9.178',
  electronVersion: '37.2.6',
  nodeVersion: process.version,
  platform: 'win32',
  arch: process.arch,
  outputDir: path.join(__dirname, '..', 'dist'),
  buildResourcesDir: path.join(__dirname, '..', 'build'),
  configFile: path.join(__dirname, '..', 'electron-builder-win.yml'),
  installerScriptDir: path.join(__dirname, '..', 'installer-scripts'),
  tempDir: path.join(os.tmpdir(), 'anava-build-' + Date.now())
};

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function logError(message) {
  console.error(`${colors.red}ERROR: ${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

// Pre-build checks
async function preBuildChecks() {
  logSection('Pre-Build Checks');
  
  // Check Node.js version
  const nodeVersion = process.version;
  if (!nodeVersion.startsWith('v20')) {
    logWarning(`Node.js version ${nodeVersion} detected. v20.x is recommended.`);
  } else {
    logSuccess(`Node.js version ${nodeVersion} is compatible`);
  }
  
  // Check for required files
  const requiredFiles = [
    'package.json',
    'package-lock.json',
    'vite.config.ts',
    'electron-builder-win.yml',
    'src/main/index.ts',
    'src/renderer/main.tsx'
  ];
  
  for (const file of requiredFiles) {
    const filePath = path.join(__dirname, '..', file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Required file missing: ${file}`);
    }
  }
  logSuccess('All required files present');
  
  // Check for build resources
  if (!fs.existsSync(CONFIG.buildResourcesDir)) {
    fs.mkdirSync(CONFIG.buildResourcesDir, { recursive: true });
    logWarning('Created build resources directory');
  }
  
  // Check for installer scripts
  if (!fs.existsSync(CONFIG.installerScriptDir)) {
    throw new Error('Installer scripts directory missing');
  }
  logSuccess('Installer scripts found');
  
  // Check for Windows-specific dependencies
  try {
    execSync('where makensis', { stdio: 'ignore' });
    logSuccess('NSIS compiler found');
  } catch {
    logWarning('NSIS compiler not found in PATH. electron-builder will download it.');
  }
  
  // Check for code signing certificate (optional)
  if (process.env.WIN_CSC_LINK || process.env.WIN_CSC_KEY_PASSWORD) {
    logSuccess('Code signing credentials detected');
  } else {
    logWarning('No code signing credentials found. Installer will not be signed.');
  }
  
  // Clean previous builds
  if (fs.existsSync(CONFIG.outputDir)) {
    log('Cleaning previous build artifacts...');
    const distPath = CONFIG.outputDir;
    if (process.platform === 'win32') {
      execSync(`rmdir /s /q "${distPath}"`, { shell: true });
    } else {
      execSync(`rm -rf "${distPath}"`);
    }
    logSuccess('Previous build artifacts cleaned');
  }
  
  // Create temp directory
  if (!fs.existsSync(CONFIG.tempDir)) {
    fs.mkdirSync(CONFIG.tempDir, { recursive: true });
  }
}

// Install dependencies
async function installDependencies() {
  logSection('Installing Dependencies');
  
  return new Promise((resolve, reject) => {
    const npmInstall = spawn('npm', ['ci'], {
      stdio: 'inherit',
      shell: true,
      cwd: path.join(__dirname, '..')
    });
    
    npmInstall.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`npm ci failed with code ${code}`));
      } else {
        logSuccess('Dependencies installed successfully');
        
        // Install Windows-specific rollup module if needed
        log('Installing Windows-specific modules...');
        try {
          execSync('npm install @rollup/rollup-win32-x64-msvc --no-save', {
            cwd: path.join(__dirname, '..'),
            stdio: 'inherit'
          });
          logSuccess('Windows-specific modules installed');
        } catch (error) {
          logWarning('Could not install Windows-specific modules: ' + error.message);
        }
        
        resolve();
      }
    });
  });
}

// Build the application
async function buildApplication() {
  logSection('Building Application');
  
  // Build renderer process with Vite
  log('Building renderer process...');
  return new Promise((resolve, reject) => {
    const viteBuild = spawn('npm', ['run', 'build'], {
      stdio: 'inherit',
      shell: true,
      cwd: path.join(__dirname, '..')
    });
    
    viteBuild.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Vite build failed with code ${code}`));
      } else {
        logSuccess('Renderer process built successfully');
        resolve();
      }
    });
  });
}

// Package with electron-builder
async function packageApplication() {
  logSection('Packaging with Electron Builder');
  
  // Set environment variables for build
  const env = {
    ...process.env,
    ELECTRON_BUILDER_CONFIG: CONFIG.configFile,
    CSC_IDENTITY_AUTO_DISCOVERY: 'false' // Prevent macOS signing on Windows
  };
  
  // Add architecture-specific flags
  const args = [
    'run',
    'electron-builder',
    '--win',
    '--config',
    CONFIG.configFile
  ];
  
  // Add architecture flag
  if (process.argv.includes('--ia32')) {
    args.push('--ia32');
    log('Building for 32-bit Windows');
  } else if (process.argv.includes('--x64')) {
    args.push('--x64');
    log('Building for 64-bit Windows');
  } else {
    // Build for both architectures by default
    log('Building for both 32-bit and 64-bit Windows');
  }
  
  return new Promise((resolve, reject) => {
    const electronBuilder = spawn('npm', args, {
      stdio: 'inherit',
      shell: true,
      cwd: path.join(__dirname, '..'),
      env
    });
    
    electronBuilder.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Electron Builder failed with code ${code}`));
      } else {
        logSuccess('Application packaged successfully');
        resolve();
      }
    });
  });
}

// Calculate file integrity
function calculateFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

// Verify installer integrity
async function verifyInstaller() {
  logSection('Verifying Installer Integrity');
  
  // Find generated installers
  const installers = [];
  const distDir = CONFIG.outputDir;
  
  if (fs.existsSync(distDir)) {
    const files = fs.readdirSync(distDir);
    for (const file of files) {
      if (file.endsWith('.exe') && file.includes('Setup')) {
        installers.push(path.join(distDir, file));
      }
    }
  }
  
  if (installers.length === 0) {
    throw new Error('No installer files found');
  }
  
  log(`Found ${installers.length} installer(s)`);
  
  // Verify each installer
  const hashes = {};
  for (const installer of installers) {
    const stats = fs.statSync(installer);
    const hash = calculateFileHash(installer);
    const filename = path.basename(installer);
    
    hashes[filename] = {
      size: stats.size,
      hash: hash,
      created: stats.mtime
    };
    
    log(`\nInstaller: ${filename}`);
    log(`  Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    log(`  SHA256: ${hash}`);
    log(`  Created: ${stats.mtime.toISOString()}`);
    
    // Basic integrity checks
    if (stats.size < 50 * 1024 * 1024) {
      logWarning('  Installer seems unusually small');
    } else {
      logSuccess('  Size check passed');
    }
    
    // Verify NSIS signature (basic check)
    const buffer = Buffer.alloc(4);
    const fd = fs.openSync(installer, 'r');
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);
    
    if (buffer.toString('hex') === '4d5a9000') {
      logSuccess('  Valid PE executable signature');
    } else {
      logError('  Invalid executable signature');
    }
  }
  
  // Write integrity manifest
  const manifestPath = path.join(distDir, 'integrity-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({
    version: CONFIG.version,
    buildTime: new Date().toISOString(),
    platform: CONFIG.platform,
    arch: CONFIG.arch,
    electronVersion: CONFIG.electronVersion,
    nodeVersion: CONFIG.nodeVersion,
    installers: hashes
  }, null, 2));
  
  logSuccess(`Integrity manifest written to ${manifestPath}`);
}

// Generate build report
async function generateBuildReport() {
  logSection('Generating Build Report');
  
  const report = {
    build: {
      version: CONFIG.version,
      date: new Date().toISOString(),
      platform: CONFIG.platform,
      arch: CONFIG.arch,
      electronVersion: CONFIG.electronVersion,
      nodeVersion: CONFIG.nodeVersion,
      user: os.userInfo().username,
      hostname: os.hostname()
    },
    environment: {
      os: `${os.type()} ${os.release()}`,
      cpus: os.cpus().length,
      memory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
      node: process.version,
      npm: execSync('npm --version').toString().trim()
    },
    files: []
  };
  
  // List all output files
  if (fs.existsSync(CONFIG.outputDir)) {
    const files = fs.readdirSync(CONFIG.outputDir);
    for (const file of files) {
      const filePath = path.join(CONFIG.outputDir, file);
      const stats = fs.statSync(filePath);
      if (stats.isFile()) {
        report.files.push({
          name: file,
          size: stats.size,
          created: stats.mtime.toISOString()
        });
      }
    }
  }
  
  const reportPath = path.join(CONFIG.outputDir, 'build-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  logSuccess(`Build report written to ${reportPath}`);
  
  // Display summary
  log('\nBuild Summary:');
  log(`  Version: ${report.build.version}`);
  log(`  Platform: ${report.build.platform} (${report.build.arch})`);
  log(`  Output files: ${report.files.length}`);
  log(`  Total size: ${(report.files.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(2)} MB`);
}

// Clean up temporary files
async function cleanup() {
  logSection('Cleanup');
  
  if (fs.existsSync(CONFIG.tempDir)) {
    try {
      if (process.platform === 'win32') {
        execSync(`rmdir /s /q "${CONFIG.tempDir}"`, { shell: true });
      } else {
        execSync(`rm -rf "${CONFIG.tempDir}"`);
      }
      logSuccess('Temporary files cleaned');
    } catch (error) {
      logWarning('Could not clean temporary files: ' + error.message);
    }
  }
}

// Main build process
async function main() {
  console.clear();
  log(`
╔════════════════════════════════════════════════════════════╗
║          Anava Installer - Windows Build Script           ║
║                     Version ${CONFIG.version}                      ║
╚════════════════════════════════════════════════════════════╝
`, 'bright');
  
  const startTime = Date.now();
  
  try {
    await preBuildChecks();
    await installDependencies();
    await buildApplication();
    await packageApplication();
    await verifyInstaller();
    await generateBuildReport();
    await cleanup();
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    logSection('Build Complete');
    logSuccess(`Build completed successfully in ${elapsed} seconds`);
    log(`\nOutput directory: ${CONFIG.outputDir}`, 'cyan');
    log('Run scripts/verify-win-installer.ps1 to verify the installer', 'yellow');
    
    process.exit(0);
  } catch (error) {
    logError(`Build failed: ${error.message}`);
    console.error(error.stack);
    await cleanup();
    process.exit(1);
  }
}

// Handle interrupts
process.on('SIGINT', async () => {
  log('\n\nBuild interrupted by user', 'yellow');
  await cleanup();
  process.exit(130);
});

process.on('uncaughtException', async (error) => {
  logError(`Uncaught exception: ${error.message}`);
  console.error(error.stack);
  await cleanup();
  process.exit(1);
});

// Run the build
if (require.main === module) {
  main();
}