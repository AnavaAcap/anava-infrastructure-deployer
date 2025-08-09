const { spawn } = require('child_process');

console.log('🚀 Testing new features...\n');
console.log('Features to verify:');
console.log('1. "Setup Private Cloud" button in Camera Setup completion');
console.log('2. Auto-push configuration after Private Cloud setup\n');

const electron = spawn('npm', ['start'], {
  cwd: __dirname,
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' }
});

let features = {
  appStarted: false,
  uiLoaded: false,
  noErrors: true
};

electron.stdout.on('data', (data) => {
  const output = data.toString();
  
  if (output.includes('App ready')) {
    features.appStarted = true;
    console.log('✓ App started successfully');
  }
});

electron.stderr.on('data', (data) => {
  const output = data.toString();
  
  if (output.includes('EULA Dialog mounted') || output.includes('UI rendered')) {
    features.uiLoaded = true;
    console.log('✓ UI loaded');
  }
  
  if (output.includes('Setup Private Cloud')) {
    console.log('✓ "Setup Private Cloud" button detected');
  }
  
  if (output.includes('Automatically pushing configuration')) {
    console.log('✓ Auto-push configuration feature detected');
  }
  
  if (output.includes('Uncaught') || output.includes('TypeError')) {
    features.noErrors = false;
    console.error('✗ JavaScript error detected');
  }
});

setTimeout(() => {
  console.log('\n=== TEST RESULTS ===');
  console.log('App functional:', features.appStarted && features.uiLoaded && features.noErrors ? '✅' : '❌');
  console.log('\nManual verification needed:');
  console.log('1. Complete Camera Setup flow');
  console.log('2. Check for "Setup Private Cloud" button on completion');
  console.log('3. Complete Private Cloud setup');
  console.log('4. Verify auto-push to last camera');
  
  electron.kill();
  process.exit(0);
}, 8000);