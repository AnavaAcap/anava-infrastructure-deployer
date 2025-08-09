#!/usr/bin/env node

/**
 * Development runner that starts both Vite dev server and Electron
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting development environment...\n');

// Start Vite dev server
console.log('📦 Starting Vite dev server...');
const viteProcess = spawn('npm', ['run', 'dev:renderer'], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  shell: true
});

// Wait a bit for Vite to start, then start Electron
setTimeout(() => {
  console.log('\n⚡ Starting Electron...');
  
  // Build main process first
  const buildProcess = spawn('npm', ['run', 'build:main'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    shell: true
  });
  
  buildProcess.on('close', (code) => {
    if (code === 0) {
      // Start Electron after build
      const electronProcess = spawn('npm', ['start'], {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, NODE_ENV: 'development' }
      });
      
      electronProcess.on('close', () => {
        console.log('Electron closed');
        viteProcess.kill();
        process.exit();
      });
    }
  });
}, 3000);

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down development environment...');
  viteProcess.kill();
  process.exit();
});