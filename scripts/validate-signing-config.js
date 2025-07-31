#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ERRORS = [];
const WARNINGS = [];

// Colors for terminal output
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

function error(message) {
  ERRORS.push(message);
  console.error(`${RED}✗ ${message}${RESET}`);
}

function warning(message) {
  WARNINGS.push(message);
  console.warn(`${YELLOW}⚠ ${message}${RESET}`);
}

function success(message) {
  console.log(`${GREEN}✓ ${message}${RESET}`);
}

function info(message) {
  console.log(`  ${message}`);
}

// Check package.json configuration
function checkPackageJson() {
  console.log('\nChecking package.json configuration...');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const buildConfig = packageJson.build;
    
    if (!buildConfig) {
      error('No build configuration found in package.json');
      return;
    }
    
    // Check afterSign hook
    if (!buildConfig.afterSign) {
      error('Missing afterSign hook for notarization');
    } else if (buildConfig.afterSign !== 'scripts/notarize.js') {
      warning(`afterSign points to ${buildConfig.afterSign}, expected scripts/notarize.js`);
    } else {
      success('afterSign hook configured correctly');
    }
    
    // Check mac configuration
    const macConfig = buildConfig.mac;
    if (!macConfig) {
      error('No mac configuration found in build config');
      return;
    }
    
    // Check for disabled signing
    if (macConfig.identity === null) {
      error('Code signing is explicitly disabled (identity: null)');
    } else if (macConfig.identity !== undefined) {
      warning('identity field should not be set - let electron-builder auto-discover');
    } else {
      success('Code signing not disabled');
    }
    
    // Check hardened runtime
    if (!macConfig.hardenedRuntime) {
      error('Hardened Runtime is not enabled (required for notarization)');
    } else {
      success('Hardened Runtime enabled');
    }
    
    // Check entitlements
    if (!macConfig.entitlements) {
      error('Missing entitlements file configuration');
    } else if (!fs.existsSync(macConfig.entitlements)) {
      error(`Entitlements file not found: ${macConfig.entitlements}`);
    } else {
      success(`Entitlements file found: ${macConfig.entitlements}`);
    }
    
    // Check app ID
    if (!buildConfig.appId) {
      error('Missing appId in build configuration');
    } else {
      success(`App ID: ${buildConfig.appId}`);
    }
    
  } catch (err) {
    error(`Failed to read/parse package.json: ${err.message}`);
  }
}

// Check electron-builder.yml if it exists
function checkElectronBuilderYml() {
  const ymlPath = 'electron-builder.yml';
  if (fs.existsSync(ymlPath)) {
    warning('Both package.json and electron-builder.yml contain build config - package.json takes precedence');
  }
}

// Check entitlements file
function checkEntitlements() {
  console.log('\nChecking entitlements...');
  
  const entitlementsPath = 'assets/entitlements.mac.plist';
  if (!fs.existsSync(entitlementsPath)) {
    error(`Entitlements file not found: ${entitlementsPath}`);
    return;
  }
  
  const content = fs.readFileSync(entitlementsPath, 'utf8');
  const requiredEntitlements = [
    'com.apple.security.cs.allow-jit',
    'com.apple.security.cs.allow-unsigned-executable-memory'
  ];
  
  for (const entitlement of requiredEntitlements) {
    if (!content.includes(entitlement)) {
      warning(`Missing recommended entitlement: ${entitlement}`);
    }
  }
  
  success('Entitlements file exists');
}

// Check notarize script
function checkNotarizeScript() {
  console.log('\nChecking notarize script...');
  
  const notarizePath = 'scripts/notarize.js';
  if (!fs.existsSync(notarizePath)) {
    error(`Notarize script not found: ${notarizePath}`);
    return;
  }
  
  const content = fs.readFileSync(notarizePath, 'utf8');
  
  // Check for environment variable usage
  const requiredEnvVars = ['APPLE_ID', 'APPLE_ID_PASSWORD', 'APPLE_TEAM_ID'];
  for (const envVar of requiredEnvVars) {
    if (!content.includes(`process.env.${envVar}`)) {
      warning(`Notarize script doesn't check for ${envVar}`);
    }
  }
  
  // Check app bundle ID matches package.json
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const appId = packageJson.build?.appId;
    if (appId && !content.includes(appId)) {
      error(`Notarize script uses different app ID than package.json (${appId})`);
    }
  } catch (err) {
    // Ignore
  }
  
  success('Notarize script exists');
}

// Check for local certificate
function checkCertificate() {
  console.log('\nChecking code signing certificate...');
  
  if (process.platform !== 'darwin') {
    info('Skipping certificate check (not on macOS)');
    return;
  }
  
  try {
    const output = execSync('security find-identity -v -p codesigning', { encoding: 'utf8' });
    const devIdCerts = output.split('\n').filter(line => line.includes('Developer ID Application'));
    
    if (devIdCerts.length === 0) {
      error('No Developer ID Application certificate found in Keychain');
    } else {
      success(`Found ${devIdCerts.length} Developer ID certificate(s)`);
      devIdCerts.forEach(cert => {
        const match = cert.match(/"([^"]+)"/);
        if (match) {
          info(match[1]);
        }
      });
    }
  } catch (err) {
    warning('Could not check certificates (security command failed)');
  }
}

// Check environment variables
function checkEnvironment() {
  console.log('\nChecking environment variables...');
  
  const requiredForNotarization = [
    'APPLE_ID',
    'APPLE_ID_PASSWORD',
    'APPLE_TEAM_ID'
  ];
  
  const missing = requiredForNotarization.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    info('Missing environment variables for notarization:');
    missing.forEach(v => info(`  - ${v}`));
    info('(These are only needed during build time)');
  } else {
    success('All notarization environment variables present');
  }
}

// Main validation
function validate() {
  console.log('🔍 Validating macOS code signing configuration...\n');
  
  checkPackageJson();
  checkElectronBuilderYml();
  checkEntitlements();
  checkNotarizeScript();
  checkCertificate();
  checkEnvironment();
  
  console.log('\n' + '='.repeat(50));
  
  if (ERRORS.length > 0) {
    console.log(`\n${RED}❌ Found ${ERRORS.length} error(s) that will prevent signing:${RESET}`);
    ERRORS.forEach((err, i) => console.log(`   ${i + 1}. ${err}`));
  }
  
  if (WARNINGS.length > 0) {
    console.log(`\n${YELLOW}⚠️  Found ${WARNINGS.length} warning(s):${RESET}`);
    WARNINGS.forEach((warn, i) => console.log(`   ${i + 1}. ${warn}`));
  }
  
  if (ERRORS.length === 0 && WARNINGS.length === 0) {
    console.log(`\n${GREEN}✅ All signing checks passed!${RESET}`);
  }
  
  // Exit with error code if errors found
  process.exit(ERRORS.length > 0 ? 1 : 0);
}

// Run validation
validate();