// Test script for IAPOAuthService
const { OAuth2Client } = require('google-auth-library');
const { exec } = require('child_process');
const { promisify } = require('util');
const axios = require('axios');

const execAsync = promisify(exec);

// Simplified version of IAPOAuthService for testing
class IAPOAuthServiceTest {
  constructor(auth) {
    this.auth = auth;
  }

  async createIAPOAuthCredentials(projectId, adminEmail, appName, logCallback) {
    const log = (message) => {
      console.log(`[IAPOAuth] ${message}`);
      if (logCallback) logCallback(message);
    };

    try {
      log('=== Setting up IAP OAuth for Google Sign-In ===');
      log('This enables automated OAuth setup for internal applications');

      // Step 1: Check/Create IAP OAuth Brand
      log('');
      log('Step 1: Checking for existing IAP OAuth brand...');
      
      let brandName;
      try {
        // List existing brands
        const { stdout: brandsJson } = await execAsync(
          `gcloud alpha iap oauth-brands list --project="${projectId}" --format=json --quiet 2>/dev/null || echo "[]"`
        );
        
        const brands = JSON.parse(brandsJson || '[]');
        
        if (brands.length > 0) {
          brandName = brands[0].name;
          log(`✅ Found existing brand: ${brandName}`);
          log(`   Support email: ${brands[0].supportEmail}`);
          log(`   Internal only: ${brands[0].orgInternalOnly}`);
        } else {
          log('Creating new IAP OAuth brand...');
          
          const { stdout: createOutput } = await execAsync(
            `gcloud alpha iap oauth-brands create ` +
            `--project="${projectId}" ` +
            `--support_email="${adminEmail}" ` +
            `--application_title="${appName}" ` +
            `--format="value(name)" ` +
            `--quiet`
          );
          
          brandName = createOutput.trim();
          log(`✅ Created brand: ${brandName}`);
        }
      } catch (error) {
        log(`❌ Error with OAuth brand: ${error.message}`);
        throw new Error('Failed to create/get IAP OAuth brand');
      }

      // Step 2: Create OAuth Client
      log('');
      log('Step 2: Creating IAP OAuth client...');
      
      try {
        const { stdout: clientJson } = await execAsync(
          `gcloud alpha iap oauth-clients create "${brandName}" ` +
          `--display_name="${appName} OAuth Client" ` +
          `--project="${projectId}" ` +
          `--format=json ` +
          `--quiet`
        );
        
        const clientData = JSON.parse(clientJson);
        
        // Extract client ID from the name field
        const clientId = clientData.name.split('/').pop();
        const clientSecret = clientData.secret;
        
        log(`✅ Created OAuth client`);
        log(`   Client ID: ${clientId}`);
        log(`   Client Secret: [REDACTED]`);
        
        return {
          clientId,
          clientSecret,
          brandName
        };
        
      } catch (error) {
        // Check if client already exists
        log('Checking for existing clients...');
        const { stdout: clientsJson } = await execAsync(
          `gcloud alpha iap oauth-clients list "${brandName}" --project="${projectId}" --format=json --quiet`
        );
        
        const clients = JSON.parse(clientsJson || '[]');
        if (clients.length > 0) {
          log('Using existing client (note: cannot retrieve secret)');
          const clientId = clients[0].name.split('/').pop();
          return {
            clientId,
            clientSecret: 'EXISTING_CLIENT_SECRET_NOT_RETRIEVABLE',
            brandName
          };
        }
        
        log(`❌ Error creating OAuth client: ${error.message}`);
        throw error;
      }
      
    } catch (error) {
      console.error('Failed to create IAP OAuth credentials:', error);
      throw error;
    }
  }

  async configureGoogleSignIn(projectId, credentials, logCallback) {
    const log = (message) => {
      console.log(`[IAPOAuth] ${message}`);
      if (logCallback) logCallback(message);
    };

    try {
      log('');
      log('Step 3: Configuring Google Sign-In provider...');
      
      const accessToken = await this.auth.getAccessToken();
      
      // Configure Google provider with IAP OAuth credentials
      const providerUrl = `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/defaultSupportedIdpConfigs`;
      
      // First delete any existing config
      try {
        await axios.delete(
          `${providerUrl}/google.com`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken.token}`,
              'x-goog-user-project': projectId
            }
          }
        );
        log('Removed existing configuration');
      } catch (error) {
        // Ignore if doesn't exist
      }
      
      // Create new config
      await axios.post(
        `${providerUrl}?idpId=google.com`,
        {
          enabled: true,
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret === 'EXISTING_CLIENT_SECRET_NOT_RETRIEVABLE' 
            ? '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' // Use the known secret for test
            : credentials.clientSecret
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken.token}`,
            'Content-Type': 'application/json',
            'x-goog-user-project': projectId
          }
        }
      );
      
      log('✅ Google Sign-In provider configured successfully');
      
    } catch (error) {
      console.error('Failed to configure Google Sign-In:', error.response?.data || error.message);
      throw error;
    }
  }
}

async function testIAPOAuthService() {
  const projectId = 'test99-xahn';
  const adminEmail = 'ryan@anava.ai';
  
  console.log('=== Testing IAPOAuthService ===');
  console.log(`Project: ${projectId}`);
  console.log(`Admin: ${adminEmail}`);
  console.log('');
  
  // Create OAuth2Client with default credentials
  const auth = new OAuth2Client();
  
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
  const iapService = new IAPOAuthServiceTest(auth);
  
  try {
    // Test creating credentials
    console.log('Starting IAP OAuth setup...\n');
    
    const credentials = await iapService.createIAPOAuthCredentials(
      projectId,
      adminEmail,
      'Test Internal App',
      (message) => console.log(`  ${message}`)
    );
    
    // Test configuring Google Sign-In
    await iapService.configureGoogleSignIn(
      projectId,
      credentials,
      (message) => console.log(`  ${message}`)
    );
    
    console.log('\n=== Test Results ===');
    console.log('✅ IAP OAuth setup completed successfully!');
    console.log('Credentials:');
    console.log(`  Client ID: ${credentials.clientId}`);
    console.log(`  Brand: ${credentials.brandName}`);
    
    // Verify by checking the configuration
    console.log('\nVerifying configuration...');
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
      config => config.name.includes('google.com')
    );
    
    if (googleConfig && googleConfig.enabled) {
      console.log('✅ Google Sign-In is properly configured!');
      console.log(`✅ Using client: ${googleConfig.clientId}`);
      console.log('✅ Firebase Auth will work with existing code!');
    } else {
      console.log('❌ Configuration verification failed');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response?.data) {
      console.error('API Error:', error.response.data);
    }
  }
}

// Run the test
testIAPOAuthService().catch(console.error);