const { app, BrowserWindow } = require('electron');
const path = require('path');

// Import our network permission service
const { macOSNetworkPermission } = require('./dist/main/services/macOSNetworkPermission');

app.whenReady().then(async () => {
  console.log('App ready, testing network permission...');
  
  // Initialize the network permission service
  await macOSNetworkPermission.initialize();
  
  // Check if we're on macOS 15+
  if (process.platform === 'darwin') {
    const version = process.getSystemVersion?.() || '0.0.0';
    const majorVersion = parseInt(version.split('.')[0]);
    console.log(`macOS version: ${version}, major: ${majorVersion}`);
    
    if (majorVersion >= 15) {
      console.log('macOS 15+ detected, showing permission dialog...');
      
      // Show the permission dialog
      await macOSNetworkPermission.showManualInstructions();
      
      console.log('Dialog closed');
    } else {
      console.log('Not macOS 15+, no permission needed');
    }
  } else {
    console.log('Not macOS, skipping');
  }
  
  // Exit after test
  setTimeout(() => {
    app.quit();
  }, 1000);
});