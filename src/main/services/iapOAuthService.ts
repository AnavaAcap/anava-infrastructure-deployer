import { OAuth2Client } from 'google-auth-library';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';

const execAsync = promisify(exec);

export interface IAPOAuthCredentials {
  clientId: string;
  clientSecret: string;
  brandName: string;
}

export class IAPOAuthService {
  private auth: OAuth2Client;

  constructor(auth: OAuth2Client) {
    this.auth = auth;
  }

  /**
   * Creates IAP OAuth credentials for internal applications
   * This enables fully automated Google Sign-In setup
   */
  async createIAPOAuthCredentials(
    projectId: string,
    adminEmail: string,
    appName: string = 'Anava Vision Internal',
    logCallback?: (message: string) => void
  ): Promise<IAPOAuthCredentials> {
    const log = (message: string) => {
      console.log(`[IAPOAuth] ${message}`);
      logCallback?.(message);
    };

    try {
      log('=== Setting up IAP OAuth for Google Sign-In ===');
      log('This enables automated OAuth setup for internal applications');

      // Step 1: Check/Create IAP OAuth Brand
      log('');
      log('Step 1: Checking for existing IAP OAuth brand...');
      
      let brandName: string;
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
      } catch (error: any) {
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
        
      } catch (error: any) {
        // Check if it's because brand needs to be internal
        if (error.message.includes('Application type must be set to Internal')) {
          log('❌ Error: IAP OAuth requires Internal application type');
          log('   This means the app is only for users within your organization');
          log('   External users cannot authenticate');
          throw new Error('IAP OAuth requires Internal application type');
        }
        
        log(`❌ Error creating OAuth client: ${error.message}`);
        throw error;
      }
      
    } catch (error: any) {
      console.error('Failed to create IAP OAuth credentials:', error);
      throw error;
    }
  }

  /**
   * Configures Google Sign-In provider with IAP OAuth credentials
   */
  async configureGoogleSignIn(
    projectId: string,
    credentials: IAPOAuthCredentials,
    logCallback?: (message: string) => void
  ): Promise<void> {
    const log = (message: string) => {
      console.log(`[IAPOAuth] ${message}`);
      logCallback?.(message);
    };

    try {
      log('');
      log('Step 3: Configuring Google Sign-In provider...');
      
      const accessToken = await this.auth.getAccessToken();
      
      // First ensure Identity Platform is initialized
      const configUrl = `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/config`;
      
      try {
        await axios.patch(
          `${configUrl}?updateMask=signIn.email`,
          {
            signIn: {
              email: {
                enabled: true,
                passwordRequired: true
              }
            }
          },
          {
            headers: {
              'Authorization': `Bearer ${accessToken.token}`,
              'Content-Type': 'application/json',
              'x-goog-user-project': projectId
            }
          }
        );
      } catch (error) {
        // Identity Platform might already be configured
      }
      
      // Configure Google provider with IAP OAuth credentials
      const providerUrl = `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/defaultSupportedIdpConfigs`;
      
      try {
        // Try to create first
        await axios.post(
          `${providerUrl}?idpId=google.com`,
          {
            enabled: true,
            clientId: credentials.clientId,
            clientSecret: credentials.clientSecret
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
        
      } catch (error: any) {
        if (error.response?.status === 409) {
          // Provider already exists, update it
          log('Provider exists, updating configuration...');
          
          await axios.patch(
            `${providerUrl}/google.com?updateMask=enabled,clientId,clientSecret`,
            {
              enabled: true,
              clientId: credentials.clientId,
              clientSecret: credentials.clientSecret
            },
            {
              headers: {
                'Authorization': `Bearer ${accessToken.token}`,
                'Content-Type': 'application/json',
                'x-goog-user-project': projectId
              }
            }
          );
          
          log('✅ Google Sign-In provider updated successfully');
        } else {
          throw error;
        }
      }
      
      log('');
      log('=== IAP OAuth Configuration Complete ===');
      log('✅ Google Sign-In is now enabled for internal users');
      log('✅ No manual OAuth setup required!');
      log('✅ Firebase Auth will work with your existing code');
      
    } catch (error: any) {
      console.error('Failed to configure Google Sign-In:', error);
      throw error;
    }
  }

  /**
   * Complete setup flow for IAP OAuth
   */
  async setupIAPOAuth(
    projectId: string,
    adminEmail: string,
    appName: string = 'Anava Vision Internal',
    logCallback?: (message: string) => void
  ): Promise<IAPOAuthCredentials> {
    // Create credentials
    const credentials = await this.createIAPOAuthCredentials(
      projectId,
      adminEmail,
      appName,
      logCallback
    );
    
    // Configure Google Sign-In
    await this.configureGoogleSignIn(projectId, credentials, logCallback);
    
    return credentials;
  }
}