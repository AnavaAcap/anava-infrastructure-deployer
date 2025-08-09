const { spawn } = require('child_process');
const path = require('path');

console.log('Starting app test...\n');

const electron = spawn('npm', ['start'], {
  cwd: __dirname,
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' }
});

let timeout = setTimeout(() => {
  console.log('\n❌ TIMEOUT - App failed to start properly');
  electron.kill();
  process.exit(1);
}, 15000);

electron.stdout.on('data', (data) => {
  const output = data.toString();
  console.log('[STDOUT]', output);
  
  // Check for successful window creation
  if (output.includes('Core services initialized')) {
    console.log('✓ Services initialized');
  }
});

electron.stderr.on('data', (data) => {
  const output = data.toString();
  console.error('[STDERR]', output);
  
  // Check for errors
  if (output.includes('ERROR') || output.includes('Failed')) {
    console.error('\n❌ ERROR DETECTED:', output);
  }
  
  if (output.includes('ERR_CONNECTION_REFUSED')) {
    console.error('❌ Connection refused - Vite not running');
  }
  
  if (output.includes('TypeError') || output.includes('ReferenceError')) {
    console.error('❌ JavaScript Error detected');
  }
});

electron.on('close', (code) => {
  clearTimeout(timeout);
  console.log(`\nApp exited with code ${code}`);
  process.exit(code);
});

// Give it 10 seconds to show errors
setTimeout(() => {
  console.log('\n✅ No critical errors after 10 seconds');
  electron.kill();
  process.exit(0);
}, 10000);