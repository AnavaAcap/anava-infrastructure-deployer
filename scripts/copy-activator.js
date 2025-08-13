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

console.log('All build files copied successfully!');