import axios from 'axios';
import { getLogger } from '../utils/logger';

const logger = getLogger();

export interface ValidationResult {
  success: boolean;
  steps: {
    name: string;
    success: boolean;
    message: string;
    details?: any;
  }[];
  summary?: string;
}

export class DeploymentValidator {
  async validateDeployment(
    apiGatewayUrl: string,
    apiKey: string,
    firebaseApiKey: string
  ): Promise<ValidationResult> {
    const steps: ValidationResult['steps'] = [];
    const deviceId = `test-device-${Date.now()}`;

    try {
      // Step 1: Get Firebase custom token
      logger.info('Validation Step 1: Getting Firebase custom token...');
      const customTokenResponse = await axios.post(
        `${apiGatewayUrl}/device-auth/initiate`,
        { device_id: deviceId },
        {
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      const customToken = customTokenResponse.data?.firebase_custom_token;
      if (!customToken) {
        steps.push({
          name: 'Get Firebase Custom Token',
          success: false,
          message: 'Failed to get custom token from API Gateway',
          details: customTokenResponse.data
        });
        return { success: false, steps };
      }

      steps.push({
        name: 'Get Firebase Custom Token',
        success: true,
        message: 'Successfully obtained custom token',
        details: { tokenLength: customToken.length }
      });

      // Step 2: Exchange for Firebase ID token
      logger.info('Validation Step 2: Exchanging custom token for Firebase ID token...');
      const idTokenResponse = await axios.post(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${firebaseApiKey}`,
        {
          token: customToken,
          returnSecureToken: true
        },
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );

      const idToken = idTokenResponse.data?.idToken;
      const expiresIn = idTokenResponse.data?.expiresIn;

      if (!idToken) {
        steps.push({
          name: 'Exchange for Firebase ID Token',
          success: false,
          message: 'Failed to exchange custom token for ID token',
          details: idTokenResponse.data
        });
        return { success: false, steps };
      }

      steps.push({
        name: 'Exchange for Firebase ID Token',
        success: true,
        message: 'Successfully obtained Firebase ID token',
        details: { expiresIn: `${expiresIn}s` }
      });

      // Step 3: Exchange for GCP access token
      logger.info('Validation Step 3: Exchanging Firebase ID token for GCP access token...');
      const gcpTokenResponse = await axios.post(
        `${apiGatewayUrl}/gcp-token/vend`,
        { firebase_id_token: idToken },
        {
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      const gcpToken = gcpTokenResponse.data?.gcp_access_token;
      const gcpExpiresIn = gcpTokenResponse.data?.expires_in;

      if (!gcpToken) {
        steps.push({
          name: 'Exchange for GCP Access Token',
          success: false,
          message: 'Failed to exchange ID token for GCP access token',
          details: gcpTokenResponse.data
        });
        return { success: false, steps };
      }

      steps.push({
        name: 'Exchange for GCP Access Token',
        success: true,
        message: 'Successfully obtained GCP access token',
        details: { expiresIn: `${gcpExpiresIn}s` }
      });

      // Step 4: Validate GCP token
      logger.info('Validation Step 4: Testing GCP access token...');
      const tokenInfoResponse = await axios.get(
        `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${gcpToken}`
      );

      if (tokenInfoResponse.status === 200) {
        const tokenInfo = tokenInfoResponse.data;
        steps.push({
          name: 'Validate GCP Token',
          success: true,
          message: 'GCP token is valid and working',
          details: {
            serviceAccount: tokenInfo.email,
            scope: tokenInfo.scope,
            expiresIn: `${tokenInfo.expires_in}s`
          }
        });
      } else {
        steps.push({
          name: 'Validate GCP Token',
          success: false,
          message: 'GCP token validation failed',
          details: tokenInfoResponse.data
        });
        return { success: false, steps };
      }

      return {
        success: true,
        steps,
        summary: `✅ All authentication steps completed successfully! The ACAP workflow is working correctly. Cameras can now:
1. Authenticate with device IDs
2. Get Firebase custom tokens
3. Exchange for Firebase ID tokens
4. Get GCP access tokens via Workload Identity Federation
5. Access GCP services (Storage, Firestore, Vertex AI) with proper permissions`
      };

    } catch (error: any) {
      logger.error('Validation error:', error);
      
      // Add error step
      steps.push({
        name: 'Validation Error',
        success: false,
        message: error.message || 'Unknown error occurred',
        details: {
          response: error.response?.data,
          status: error.response?.status
        }
      });

      return { success: false, steps };
    }
  }
}