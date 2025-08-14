const { app } = require('electron');
const path = require('path');
const fs = require('fs');

// Initialize app
app.whenReady().then(() => {
  const configPath = path.join(app.getPath('userData'), 'config.json');
  
  // Read existing config or create new
  let config = {};
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
  
  // Save the API key
  config.geminiApiKey = 'AIzaSyA0N9-IRDvQfkj6E8tS7IATtuSv1LjwFwc';
  
  // Write back
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log('✅ API key saved to config:', configPath);
  
  app.quit();
});
