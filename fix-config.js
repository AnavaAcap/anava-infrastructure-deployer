#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

// Determine the config file path based on platform
const appName = 'anava-installer';
let configPath;

if (process.platform === 'darwin') {
  configPath = path.join(os.homedir(), 'Library', 'Application Support', appName, 'config.json');
} else if (process.platform === 'win32') {
  configPath = path.join(process.env.APPDATA || '', appName, 'config.json');
} else {
  configPath = path.join(os.homedir(), '.config', appName, 'config.json');
}

console.log('Config file path:', configPath);

if (!fs.existsSync(configPath)) {
  console.log('Config file does not exist. The app will create a new one on next launch.');
  process.exit(0);
}

// Try to read and parse the config
try {
  const content = fs.readFileSync(configPath, 'utf8');
  console.log('Config file size:', content.length, 'bytes');
  
  // Try to parse it
  try {
    const config = JSON.parse(content);
    console.log('Config is valid JSON!');
    console.log('Number of keys:', Object.keys(config).length);
  } catch (parseError) {
    console.error('JSON parsing error:', parseError.message);
    console.log('\nShowing content around the error position...');
    
    // Extract position from error message
    const match = parseError.message.match(/position (\d+)/);
    if (match) {
      const position = parseInt(match[1]);
      const start = Math.max(0, position - 100);
      const end = Math.min(content.length, position + 100);
      console.log('Content from position', start, 'to', end, ':');
      console.log('---');
      console.log(content.substring(start, end));
      console.log('---');
      console.log('Error at position', position, ':', content[position]);
    }
    
    // Backup the corrupted file
    const backupPath = configPath + '.backup.' + Date.now();
    fs.copyFileSync(configPath, backupPath);
    console.log('\nBacked up corrupted config to:', backupPath);
    
    // Delete the corrupted config
    fs.unlinkSync(configPath);
    console.log('Deleted corrupted config file.');
    console.log('The app will create a fresh config on next launch.');
  }
} catch (readError) {
  console.error('Error reading config file:', readError.message);
}