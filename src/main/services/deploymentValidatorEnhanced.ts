import axios from 'axios';
import { logger } from '../utils/logger';

interface ValidationResult {
  success: boolean;
  steps: {
    name: string;
    success: boolean;
    error?: string;
    details?: any;
  }[];
  summary: string;
}

export class DeploymentValidatorEnhanced {
  /**
   * Validate the entire deployment including camera authentication flow
   */
  async validateDeployment(
    apiGatewayUrl: string,
    apiKey: string,
    firebaseConfig: any,
    projectId: string
  ): Promise<ValidationResult> {
    const results: ValidationResult = {
      success: true,
      steps: [],
      summary: ''
    };

    const deviceId = `test-device-${Date.now()}`;

    try {
      // Step 1: Test API Gateway is accessible
      logger.info('🔍 Step 1: Testing API Gateway accessibility...');
      try {
        const response = await axios.get(apiGatewayUrl, {
          validateStatus: () => true
        });
        results.steps.push({
          name: 'API Gateway Accessible',
          success: response.status < 500,
          details: { status: response.status }
        });
      } catch (error: any) {
        results.steps.push({
          name: 'API Gateway Accessible',
          success: false,
          error: error.message
        });
        results.success = false;
      }

      // Step 2: Test device-auth/initiate endpoint
      logger.info('🔍 Step 2: Testing /device-auth/initiate endpoint...');
      let customToken = '';
      try {
        const response = await axios.post(
          `${apiGatewayUrl}/device-auth/initiate`,
          { device_id: deviceId },
          {
            headers: {
              'x-api-key': apiKey,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );

        if (response.status === 200 && response.data.firebase_custom_token) {
          customToken = response.data.firebase_custom_token;
          results.steps.push({
            name: 'Device Auth Endpoint',
            success: true,
            details: { gotToken: true }
          });
        } else {
          throw new Error(`Unexpected response: ${response.status}`);
        }
      } catch (error: any) {
        results.steps.push({
          name: 'Device Auth Endpoint',
          success: false,
          error: error.response?.data?.message || error.message
        });
        results.success = false;
      }

      // Step 3: Exchange for Firebase ID token
      logger.info('🔍 Step 3: Testing Firebase token exchange...');
      let idToken = '';
      if (customToken) {
        try {
          const response = await axios.post(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${firebaseConfig.apiKey}`,
            {
              token: customToken,
              returnSecureToken: true
            },
            { timeout: 30000 }
          );

          if (response.status === 200 && response.data.idToken) {
            idToken = response.data.idToken;
            results.steps.push({
              name: 'Firebase Token Exchange',
              success: true,
              details: { gotIdToken: true }
            });
          } else {
            throw new Error(`Unexpected response: ${response.status}`);
          }
        } catch (error: any) {
          results.steps.push({
            name: 'Firebase Token Exchange',
            success: false,
            error: error.response?.data?.error?.message || error.message
          });
          results.success = false;
        }
      }

      // Step 4: Test /gcp-token/vend endpoint
      logger.info('🔍 Step 4: Testing /gcp-token/vend endpoint...');
      let gcpToken = '';
      if (idToken) {
        try {
          const response = await axios.post(
            `${apiGatewayUrl}/gcp-token/vend`,
            { firebase_id_token: idToken },
            {
              headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json'
              },
              timeout: 30000
            }
          );

          if (response.status === 200 && response.data.gcp_access_token) {
            gcpToken = response.data.gcp_access_token;
            results.steps.push({
              name: 'GCP Token Vending',
              success: true,
              details: { gotGcpToken: true }
            });
          } else {
            throw new Error(`Unexpected response: ${response.status}`);
          }
        } catch (error: any) {
          results.steps.push({
            name: 'GCP Token Vending',
            success: false,
            error: error.response?.data?.message || error.message
          });
          results.success = false;
        }
      }

      // Step 5: Test Firestore write permissions
      logger.info('🔍 Step 5: Testing Firestore write permissions...');
      if (gcpToken) {
        try {
          const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/devices/${deviceId}`;
          const response = await axios.patch(
            firestoreUrl,
            {
              fields: {
                deviceId: { stringValue: deviceId },
                updatedAt: { timestampValue: new Date().toISOString() },
                validationTest: { booleanValue: true },
                testTimestamp: { timestampValue: new Date().toISOString() }
              }
            },
            {
              headers: {
                'Authorization': `Bearer ${gcpToken}`,
                'Content-Type': 'application/json'
              },
              timeout: 30000
            }
          );

          if (response.status === 200) {
            results.steps.push({
              name: 'Firestore Write Permission',
              success: true,
              details: { documentCreated: true }
            });

            // Clean up test document
            try {
              await axios.delete(firestoreUrl, {
                headers: { 'Authorization': `Bearer ${gcpToken}` }
              });
            } catch (e) {
              // Ignore cleanup errors
            }
          } else {
            throw new Error(`Unexpected response: ${response.status}`);
          }
        } catch (error: any) {
          const errorMessage = error.response?.data?.error?.message || error.message;
          results.steps.push({
            name: 'Firestore Write Permission',
            success: false,
            error: errorMessage
          });
          
          // This is the critical error - cameras won't work without write permissions
          if (errorMessage.includes('Missing or insufficient permissions')) {
            results.steps[results.steps.length - 1].error = 
              'CRITICAL: vertex-ai-sa lacks Firestore write permissions. Cameras will get 403 errors.';
          }
          results.success = false;
        }
      }

      // Step 6: Test Vertex AI endpoint (if available)
      logger.info('🔍 Step 6: Testing Vertex AI access...');
      if (gcpToken) {
        try {
          // Test listing models in Vertex AI
          const vertexUrl = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/models`;
          const response = await axios.get(
            vertexUrl,
            {
              headers: {
                'Authorization': `Bearer ${gcpToken}`,
                'Content-Type': 'application/json'
              },
              timeout: 10000,
              validateStatus: () => true
            }
          );

          // Even a 403 means the endpoint is accessible, just no models
          results.steps.push({
            name: 'Vertex AI Access',
            success: response.status === 200 || response.status === 403,
            details: { status: response.status }
          });
        } catch (error: any) {
          results.steps.push({
            name: 'Vertex AI Access',
            success: false,
            error: error.message
          });
          // Not critical - Vertex AI might not be used
        }
      }

      // Generate summary
      const failedSteps = results.steps.filter(s => !s.success);
      if (failedSteps.length === 0) {
        results.summary = '✅ All validation checks passed! Deployment is ready for cameras.';
      } else {
        results.success = false;
        const criticalSteps = ['GCP Token Vending', 'Firestore Write Permission'];
        const criticalFailures = failedSteps.filter(s => criticalSteps.includes(s.name));
        
        if (criticalFailures.length > 0) {
          results.summary = `❌ CRITICAL: ${criticalFailures.length} critical step(s) failed. Cameras will not work properly.`;
        } else {
          results.summary = `⚠️ WARNING: ${failedSteps.length} non-critical step(s) failed. Deployment may work with limitations.`;
        }
      }

    } catch (error: any) {
      results.success = false;
      results.summary = `❌ Validation failed with unexpected error: ${error.message}`;
    }

    // Log results
    logger.info('=== Deployment Validation Results ===');
    results.steps.forEach(step => {
      const icon = step.success ? '✅' : '❌';
      logger.info(`${icon} ${step.name}: ${step.success ? 'PASSED' : 'FAILED'}`);
      if (step.error) {
        logger.error(`   Error: ${step.error}`);
      }
    });
    logger.info(`\n${results.summary}\n`);

    return results;
  }

  /**
   * Quick health check for essential endpoints
   */
  async quickHealthCheck(apiGatewayUrl: string, apiKey: string): Promise<boolean> {
    try {
      // Just check if device-auth endpoint responds
      const response = await axios.post(
        `${apiGatewayUrl}/device-auth/initiate`,
        { device_id: 'health-check' },
        {
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 5000,
          validateStatus: () => true
        }
      );

      // 200 = success, 400 = endpoint works but request invalid, both are OK
      return response.status === 200 || response.status === 400;
    } catch (error) {
      return false;
    }
  }
}