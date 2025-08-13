#!/usr/bin/env node
/**
 * Script to copy activator files to dist directory during build
 * These files are required for license activation but aren't handled by TypeScript compiler
 */

const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', 'src', 'main', 'activator');
const targetDir = path.join(__dirname, '..', 'dist', 'main', 'activator');

console.log('Copying activator files for production build...');
console.log('Source:', sourceDir);
console.log('Target:', targetDir);

// Create target directory if it doesn't exist
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
  console.log('Created directory:', targetDir);
}

// Files to copy
const files = ['activator.html', 'axis-sdk.js', 'preload.js'];

// Copy each file
files.forEach(file => {
  const sourcePath = path.join(sourceDir, file);
  const targetPath = path.join(targetDir, file);
  
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, targetPath);
    console.log(`Copied: ${file}`);
  } else {
    console.error(`WARNING: Source file not found: ${sourcePath}`);
  }
});

console.log('Activator files copied successfully!');

// Also copy firestore-rules directory
const firestoreRulesSource = path.join(__dirname, '..', 'firestore-rules');
const firestoreRulesTarget = path.join(__dirname, '..', 'dist', 'main', 'firestore-rules');

console.log('\nCopying firestore-rules for production build...');
console.log('Source:', firestoreRulesSource);
console.log('Target:', firestoreRulesTarget);

// Create target directory if it doesn't exist
if (!fs.existsSync(firestoreRulesTarget)) {
  fs.mkdirSync(firestoreRulesTarget, { recursive: true });
  console.log('Created directory:', firestoreRulesTarget);
}

// Copy firestore.rules file
const rulesSourcePath = path.join(firestoreRulesSource, 'firestore.rules');
const rulesTargetPath = path.join(firestoreRulesTarget, 'firestore.rules');

if (fs.existsSync(rulesSourcePath)) {
  fs.copyFileSync(rulesSourcePath, rulesTargetPath);
  console.log('Copied: firestore.rules');
} else {
  console.error('WARNING: firestore.rules not found at:', rulesSourcePath);
}

// Copy api-gateway-config.yaml
const apiGatewayConfigSource = path.join(__dirname, '..', 'api-gateway-config.yaml');
const apiGatewayConfigTarget = path.join(__dirname, '..', 'dist', 'main', 'api-gateway-config.yaml');

console.log('\nCopying api-gateway-config.yaml for production build...');
console.log('Source:', apiGatewayConfigSource);
console.log('Target:', apiGatewayConfigTarget);

if (fs.existsSync(apiGatewayConfigSource)) {
  fs.copyFileSync(apiGatewayConfigSource, apiGatewayConfigTarget);
  console.log('Copied: api-gateway-config.yaml');
} else {
  console.error('WARNING: api-gateway-config.yaml not found at:', apiGatewayConfigSource);
}

// Copy function-templates directory
const functionTemplatesSource = path.join(__dirname, '..', 'function-templates');
const functionTemplatesTarget = path.join(__dirname, '..', 'dist', 'main', 'function-templates');

console.log('\nCopying function-templates for production build...');
console.log('Source:', functionTemplatesSource);
console.log('Target:', functionTemplatesTarget);

// Function to recursively copy directory
function copyDirectoryRecursively(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  
  const files = fs.readdirSync(source);
  
  files.forEach(file => {
    const sourcePath = path.join(source, file);
    const targetPath = path.join(target, file);
    
    if (fs.lstatSync(sourcePath).isDirectory()) {
      copyDirectoryRecursively(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`  Copied: ${file}`);
    }
  });
}

if (fs.existsSync(functionTemplatesSource)) {
  copyDirectoryRecursively(functionTemplatesSource, functionTemplatesTarget);
  console.log('Function templates copied successfully!');
} else {
  console.error('WARNING: function-templates directory not found at:', functionTemplatesSource);
}

console.log('All build files copied successfully!');