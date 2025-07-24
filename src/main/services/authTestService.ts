import { ipcMain } from 'electron';
import axios from 'axios';

export class AuthTestService {
  constructor() {
    this.setupIPC();
  }

  private setupIPC() {
    ipcMain.handle('test-auth-step', async (_event, params) => {
      return this.testAuthStep(params);
    });
  }

  async testAuthStep(params: any): Promise<any> {
    try {
      switch (params.step) {
        case 'custom-token':
          return await this.getCustomToken(
            params.apiGatewayUrl,
            params.apiKey,
            params.deviceId
          );
        
        case 'id-token':
          return await this.getIdToken(
            params.customToken,
            params.firebaseApiKey
          );
        
        case 'gcp-token':
          return await this.getGcpToken(
            params.apiGatewayUrl,
            params.apiKey,
            params.idToken
          );
        
        case 'verify':
          return await this.verifyGcpToken(
            params.gcpToken,
            params.projectId
          );
        
        default:
          throw new Error(`Unknown test step: ${params.step}`);
      }
    } catch (error: any) {
      console.error(`Auth test error at step ${params.step}:`, error);
      return {
        success: false,
        error: error.message || 'Test failed'
      };
    }
  }

  private async getCustomToken(apiGatewayUrl: string, apiKey: string, deviceId: string) {
    console.log('[AuthTest] Step 1: Getting Firebase custom token...');
    
    const response = await axios.post(
      `${apiGatewayUrl}/device-auth/initiate`,
      { device_id: deviceId },
      {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data?.firebase_custom_token) {
      console.log('[AuthTest] ✅ Got custom token');
      return {
        success: true,
        customToken: response.data.firebase_custom_token
      };
    } else {
      throw new Error('No custom token in response');
    }
  }

  private async getIdToken(customToken: string, firebaseApiKey: string) {
    console.log('[AuthTest] Step 2: Exchanging for Firebase ID token...');
    
    const response = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${firebaseApiKey}`,
      {
        token: customToken,
        returnSecureToken: true
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data?.idToken) {
      console.log('[AuthTest] ✅ Got Firebase ID token');
      return {
        success: true,
        idToken: response.data.idToken,
        expiresIn: response.data.expiresIn
      };
    } else {
      throw new Error('No ID token in response');
    }
  }

  private async getGcpToken(apiGatewayUrl: string, apiKey: string, idToken: string) {
    console.log('[AuthTest] Step 3: Exchanging for GCP access token...');
    
    const response = await axios.post(
      `${apiGatewayUrl}/gcp-token/vend`,
      { firebase_id_token: idToken },
      {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data?.gcp_access_token) {
      console.log('[AuthTest] ✅ Got GCP access token');
      return {
        success: true,
        gcpToken: response.data.gcp_access_token,
        expiresIn: response.data.expires_in
      };
    } else {
      throw new Error('No GCP token in response');
    }
  }

  private async verifyGcpToken(gcpToken: string, _projectId: string) {
    console.log('[AuthTest] Step 4: Verifying GCP token...');
    
    // Test the token by getting token info
    const response = await axios.get(
      'https://www.googleapis.com/oauth2/v1/tokeninfo',
      {
        params: {
          access_token: gcpToken
        }
      }
    );

    if (response.data?.email) {
      console.log('[AuthTest] ✅ GCP token is valid!');
      console.log(`[AuthTest] Service Account: ${response.data.email}`);
      
      // Extract service account name for display (hide full email for security)
      const serviceAccountName = response.data.email.split('@')[0];
      
      return {
        success: true,
        serviceAccount: `${serviceAccountName}@...`,
        scope: response.data.scope,
        expiresIn: response.data.expires_in
      };
    } else {
      throw new Error('Invalid token response');
    }
  }
}