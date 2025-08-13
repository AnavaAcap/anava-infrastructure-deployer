// Quick script to decode and check OAuth token scopes
const fs = require('fs');
const path = require('path');
const os = require('os');

// Find config.json in user data
const appData = process.platform === 'win32' 
  ? process.env.APPDATA 
  : path.join(os.homedir(), 'Library', 'Application Support');

const configPath = path.join(appData, 'anava-installer', 'config.json');

try {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
  if (config.gcpAccessToken) {
    // Access tokens are JWT - we can decode the payload
    const parts = config.gcpAccessToken.split('.');
    if (parts.length === 3) {
      const payload = Buffer.from(parts[1], 'base64').toString();
      const tokenData = JSON.parse(payload);
      console.log('Token scopes:', tokenData.scope || 'No scopes found');
      console.log('Token issued at:', new Date(tokenData.iat * 1000).toISOString());
      console.log('Token expires at:', new Date(tokenData.exp * 1000).toISOString());
    } else {
      console.log('Access token is not a JWT - checking via API would be needed');
    }
  } else {
    console.log('No access token found in config');
  }
} catch (error) {
  console.log('Could not read config:', error.message);
}
