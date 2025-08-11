#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('Testing production build...\n');

// First, build the app
console.log('Step 1: Building main and renderer...');
const build = spawn('npm', ['run', 'build'], { stdio: 'inherit' });

build.on('close', (code) => {
  if (code !== 0) {
    console.error('Build failed with code:', code);
    process.exit(1);
  }
  
  console.log('\nStep 2: Running Electron with built files...');
  
  // Run electron with the built main file
  const electron = spawn('npx', ['electron', 'dist/main/index.js'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production'
    }
  });
  
  electron.on('close', (code) => {
    console.log('Electron closed with code:', code);
  });
});