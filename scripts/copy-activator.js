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