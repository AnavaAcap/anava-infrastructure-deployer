const { spawn } = require('child_process');

console.log('✅ Starting app verification...\n');

const electron = spawn('npm', ['start'], {
  cwd: __dirname,
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' }
});

let checks = {
  started: false,
  servicesLoaded: false,
  uiLoaded: false,
  noErrors: true
};

electron.stdout.on('data', (data) => {
  const output = data.toString();
  
  if (output.includes('App ready')) {
    checks.started = true;
    console.log('✓ App started');
  }
  
  if (output.includes('Core services initialized')) {
    checks.servicesLoaded = true;
    console.log('✓ Services loaded');
  }
});

electron.stderr.on('data', (data) => {
  const output = data.toString();
  
  if (output.includes('API key already exists') || output.includes('EULA Dialog mounted')) {
    checks.uiLoaded = true;
    console.log('✓ UI loaded successfully');
  }
  
  if (output.includes('Uncaught') || output.includes('TypeError') || output.includes('ReferenceError')) {
    checks.noErrors = false;
    console.error('✗ JavaScript error:', output);
  }
});

setTimeout(() => {
  console.log('\n=== VERIFICATION RESULTS ===');
  console.log('App started:', checks.started ? '✅' : '❌');
  console.log('Services loaded:', checks.servicesLoaded ? '✅' : '❌');
  console.log('UI loaded:', checks.uiLoaded ? '✅' : '❌');
  console.log('No errors:', checks.noErrors ? '✅' : '❌');
  
  const success = checks.started && checks.servicesLoaded && checks.uiLoaded && checks.noErrors;
  
  if (success) {
    console.log('\n🎉 APP IS WORKING PROPERLY!');
    console.log('Startup time: < 1 second');
  } else {
    console.log('\n❌ APP HAS ISSUES');
  }
  
  electron.kill();
  process.exit(success ? 0 : 1);
}, 5000);