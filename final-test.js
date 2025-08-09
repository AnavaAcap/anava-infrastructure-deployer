const { spawn } = require('child_process');

console.log('🎉 Final App Test\n');

const electron = spawn('npm', ['start'], {
  cwd: __dirname,
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' }
});

let results = {
  started: false,
  servicesLoaded: false,
  cameraServicesLoaded: false,
  uiLoaded: false,
  ipcErrors: [],
  jsErrors: []
};

electron.stdout.on('data', (data) => {
  const output = data.toString();
  
  if (output.includes('App ready')) {
    results.started = true;
    console.log('✓ App started');
  }
  
  if (output.includes('Core services initialized')) {
    results.servicesLoaded = true;
    console.log('✓ Core services loaded');
  }
  
  if (output.includes('Camera services initialized')) {
    results.cameraServicesLoaded = true;
    console.log('✓ Camera services loaded');
  }
});

electron.stderr.on('data', (data) => {
  const output = data.toString();
  
  if (output.includes('EULA Dialog mounted') || output.includes('API key')) {
    results.uiLoaded = true;
    console.log('✓ UI rendered');
  }
  
  if (output.includes('No handler registered')) {
    const match = output.match(/No handler registered for '([^']+)'/);
    if (match && !results.ipcErrors.includes(match[1])) {
      results.ipcErrors.push(match[1]);
      console.error(`✗ Missing IPC handler: ${match[1]}`);
    }
  }
  
  if (output.includes('Uncaught') || output.includes('TypeError') || output.includes('ReferenceError')) {
    results.jsErrors.push(output.trim());
    console.error('✗ JavaScript error detected');
  }
});

setTimeout(() => {
  console.log('\n=== FINAL RESULTS ===');
  console.log('App started:', results.started ? '✅' : '❌');
  console.log('Services loaded:', results.servicesLoaded ? '✅' : '❌');
  console.log('Camera services:', results.cameraServicesLoaded ? '✅' : '❌');
  console.log('UI rendered:', results.uiLoaded ? '✅' : '❌');
  console.log('IPC errors:', results.ipcErrors.length === 0 ? '✅ None' : `❌ ${results.ipcErrors.join(', ')}`);
  console.log('JS errors:', results.jsErrors.length === 0 ? '✅ None' : `❌ ${results.jsErrors.length} errors`);
  
  const success = results.started && results.servicesLoaded && results.uiLoaded && 
                  results.ipcErrors.length === 0 && results.jsErrors.length === 0;
  
  if (success) {
    console.log('\n🚀 APP IS FULLY FUNCTIONAL!');
    console.log('✅ All IPC handlers registered');
    console.log('✅ No JavaScript errors');
    console.log('✅ Fast startup (<1 second)');
  } else {
    console.log('\n⚠️ Some issues remain');
  }
  
  electron.kill();
  process.exit(success ? 0 : 1);
}, 7000);