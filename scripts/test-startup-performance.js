#!/usr/bin/env node

/**
 * Startup Performance Test Script
 * Measures the time it takes for the Electron app to fully load
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Testing startup performance...\n');

const startTime = Date.now();
const appPath = path.join(__dirname, '..');

// Start the Electron app
const electronProcess = spawn('npm', ['start'], {
  cwd: appPath,
  stdio: 'pipe',
  env: { ...process.env, NODE_ENV: 'production' }
});

let firstLogTime = null;
let windowReadyTime = null;
let servicesInitTime = null;

// Monitor stdout for key events
electronProcess.stdout.on('data', (data) => {
  const output = data.toString();
  const currentTime = Date.now();
  
  if (!firstLogTime && output.length > 0) {
    firstLogTime = currentTime;
    console.log(`⏱️  First log output: ${firstLogTime - startTime}ms`);
  }
  
  if (output.includes('App ready') && !windowReadyTime) {
    windowReadyTime = currentTime;
    console.log(`⏱️  App ready: ${windowReadyTime - startTime}ms`);
  }
  
  if (output.includes('Core services initialized') && !servicesInitTime) {
    servicesInitTime = currentTime;
    console.log(`⏱️  Core services initialized: ${servicesInitTime - startTime}ms`);
    console.log(`\n✅ Total startup time: ${servicesInitTime - startTime}ms`);
    
    // Kill the process after measuring
    setTimeout(() => {
      electronProcess.kill();
      process.exit(0);
    }, 2000);
  }
});

// Monitor stderr for errors
electronProcess.stderr.on('data', (data) => {
  console.error('Error:', data.toString());
});

// Handle process exit
electronProcess.on('close', (code) => {
  if (code !== 0 && code !== null) {
    console.log(`\n❌ Process exited with code ${code}`);
  }
});

// Timeout after 30 seconds
setTimeout(() => {
  console.log('\n⏱️ Timeout reached (30s) - killing process');
  electronProcess.kill();
  process.exit(1);
}, 30000);