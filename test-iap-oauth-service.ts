// Test script for IAPOAuthService
import { OAuth2Client } from 'google-auth-library';
import { IAPOAuthService } from './src/main/services/iapOAuthService';

async function testIAPOAuthService() {
  const projectId = 'test99-xahn';
  const adminEmail = 'ryan@anava.ai';
  
  console.log('=== Testing IAPOAuthService ===');
  console.log(`Project: ${projectId}`);
  console.log(`Admin: ${adminEmail}`);
  console.log('');
  
  // Create OAuth2Client with default credentials
  const auth = new OAuth2Client();
  
  // Get access token from gcloud
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  try {
    const { stdout: token } = await execAsync('gcloud auth print-access-token');
    auth.setCredentials({
      access_token: token.trim()
    });
  } catch (error) {
    console.error('Failed to get access token. Run: gcloud auth login');
    return;
  }
  
  // Create service instance
  const iapService = new IAPOAuthService(auth);
  
  try {
    // Test the complete setup flow
    console.log('Starting IAP OAuth setup...\n');
    
    const credentials = await iapService.setupIAPOAuth(
      projectId,
      adminEmail,
      'Test Internal App',
      (message) => console.log(`  ${message}`)
    );
    
    console.log('\n=== Test Results ===');
    console.log('✅ IAP OAuth setup completed successfully!');
    console.log('Credentials created:');
    console.log(`  Client ID: ${credentials.clientId}`);
    console.log(`  Client Secret: ${credentials.clientSecret}`);
    console.log(`  Brand: ${credentials.brandName}`);
    
    // Verify by checking the configuration
    console.log('\nVerifying configuration...');
    const axios = require('axios');
    const accessToken = await auth.getAccessToken();
    
    const verifyResponse = await axios.get(
      `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/defaultSupportedIdpConfigs`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
          'x-goog-user-project': projectId
        }
      }
    );
    
    const googleConfig = verifyResponse.data.defaultSupportedIdpConfigs?.find(
      (config: any) => config.name.includes('google.com')
    );
    
    if (googleConfig && googleConfig.clientId === credentials.clientId) {
      console.log('✅ Google Sign-In is properly configured!');
      console.log('✅ Firebase Auth will work with existing code!');
    } else {
      console.log('❌ Configuration verification failed');
    }
    
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response?.data) {
      console.error('API Error:', error.response.data);
    }
  }
}

// Run the test
testIAPOAuthService().catch(console.error);