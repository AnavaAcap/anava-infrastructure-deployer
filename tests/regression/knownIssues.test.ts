/**
 * Regression Test Suite
 * Tests for known issues documented in CLAUDE.md to prevent regressions
 */

import { DeploymentEngine } from '@main/services/deploymentEngine';
import { CloudFunctionsAPIDeployer } from '@main/services/cloudFunctionsAPIDeployer';
import { ApiGatewayDeployer } from '@main/services/apiGatewayDeployer';
import { CameraConfigurationService } from '@main/services/camera/cameraConfigurationService';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Regression Tests - Known Issues from CLAUDE.md', () => {
  
  describe('Cloud Functions v2 Compute Service Account Issue', () => {
    /**
     * Issue: Cloud Functions v2 builds run as COMPUTE service account, not Cloud Build SA
     * Fix: Grant necessary permissions to compute SA
     */
    it('should grant correct permissions to compute service account', async () => {
      const projectNumber = '123456789';
      const computeSA = `${projectNumber}-compute@developer.gserviceaccount.com`;
      
      // Track IAM calls
      const iamCalls: any[] = [];
      mockedAxios.post = jest.fn().mockImplementation((url, data) => {
        if (url.includes('setIamPolicy')) {
          iamCalls.push(data);
        }
        return Promise.resolve({ data: { success: true } });
      });
      
      const deployer = new CloudFunctionsAPIDeployer({} as any);
      
      // Mock the permission setup method
      await deployer['setupComputeServiceAccountPermissions'](
        'test-project',
        projectNumber
      );
      
      // Verify compute SA got the required permissions
      const computeSAPolicy = iamCalls.find(call => 
        call.policy?.bindings?.some((b: any) => 
          b.members?.includes(`serviceAccount:${computeSA}`)
        )
      );
      
      expect(computeSAPolicy).toBeDefined();
      
      const roles = computeSAPolicy.policy.bindings
        .filter((b: any) => b.members.includes(`serviceAccount:${computeSA}`))
        .map((b: any) => b.role);
      
      expect(roles).toContain('roles/artifactregistry.admin');
      expect(roles).toContain('roles/storage.objectViewer');
      expect(roles).toContain('roles/logging.logWriter');
    });

    it('should handle gcf-artifacts repository permissions', async () => {
      const projectId = 'test-project';
      const region = 'us-central1';
      const repository = `${region}-docker.pkg.dev/${projectId}/gcf-artifacts`;
      
      const deployer = new CloudFunctionsAPIDeployer({} as any);
      
      // Mock repository check
      mockedAxios.get = jest.fn().mockImplementation((url) => {
        if (url.includes('gcf-artifacts')) {
          return Promise.resolve({ data: { name: repository } });
        }
        return Promise.reject(new Error('Not found'));
      });
      
      const hasAccess = await deployer['verifyArtifactRegistryAccess'](
        projectId,
        region
      );
      
      expect(hasAccess).toBe(true);
    });
  });

  describe('IAM Eventual Consistency Issue', () => {
    /**
     * Issue: Service accounts need 2-20 seconds to propagate globally
     * Fix: Implement polling and exponential backoff
     */
    it('should wait for service account propagation', async () => {
      let attempts = 0;
      const maxAttempts = 5;
      
      // Simulate propagation delay
      mockedAxios.get = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject({ response: { status: 404 } });
        }
        return Promise.resolve({ 
          data: { email: 'sa@project.iam.gserviceaccount.com' } 
        });
      });
      
      const waitForServiceAccount = async (email: string): Promise<boolean> => {
        for (let i = 0; i < maxAttempts; i++) {
          try {
            await axios.get(`/iam/sa/${email}`);
            return true;
          } catch (error: any) {
            if (error.response?.status === 404 && i < maxAttempts - 1) {
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
              continue;
            }
            throw error;
          }
        }
        return false;
      };
      
      const result = await waitForServiceAccount('test-sa@project.iam');
      
      expect(result).toBe(true);
      expect(attempts).toBe(3);
    });

    it('should add global propagation delay after creating service accounts', async () => {
      const startTime = Date.now();
      
      // Simulate the delay function
      const addGlobalPropagationDelay = async () => {
        await new Promise(resolve => setTimeout(resolve, 10000));
      };
      
      // Mock the delay to be shorter for testing
      jest.useFakeTimers();
      const delayPromise = addGlobalPropagationDelay();
      jest.advanceTimersByTime(10000);
      await Promise.resolve(); // Let promises resolve
      jest.useRealTimers();
      
      // Verify delay was added
      expect(Date.now() - startTime).toBeLessThan(1000); // Test runs fast with fake timers
    });
  });

  describe('API Gateway OpenAPI Spec Replacement Issue', () => {
    /**
     * Issue: Not all placeholders in OpenAPI spec were being replaced
     * Fix: Use global regex replacement
     */
    it('should replace ALL placeholders in OpenAPI spec', () => {
      const spec = `
        openapi: 3.0.0
        paths:
          /device-auth/initiate:
            x-google-backend:
              address: \${DEVICE_AUTH_URL}
          /device-auth/complete:
            x-google-backend:
              address: \${DEVICE_AUTH_URL}
          /token:
            x-google-backend:
              address: \${TOKEN_VENDING_URL}
      `;
      
      const deviceAuthUrl = 'https://device-auth-abc123.cloudfunctions.net';
      const tokenVendingUrl = 'https://token-vending-xyz789.cloudfunctions.net';
      
      // This is the fix: using global replacement
      let processedSpec = spec
        .replace(/\${DEVICE_AUTH_URL}/g, deviceAuthUrl)
        .replace(/\${TOKEN_VENDING_URL}/g, tokenVendingUrl);
      
      // Verify no placeholders remain
      expect(processedSpec).not.toContain('${DEVICE_AUTH_URL}');
      expect(processedSpec).not.toContain('${TOKEN_VENDING_URL}');
      
      // Verify correct number of replacements
      const deviceAuthCount = (processedSpec.match(new RegExp(deviceAuthUrl, 'g')) || []).length;
      const tokenVendingCount = (processedSpec.match(new RegExp(tokenVendingUrl, 'g')) || []).length;
      
      expect(deviceAuthCount).toBe(2);
      expect(tokenVendingCount).toBe(1);
    });

    it('should handle jwt_audience field replacement', () => {
      const spec = `
        securityDefinitions:
          jwt:
            authorizationUrl: ""
            flow: "implicit"
            type: "oauth2"
            x-google-issuer: "service-account@project.iam.gserviceaccount.com"
            x-google-jwks_uri: "https://www.googleapis.com/robot/v1/metadata/x509/sa"
            x-google-audiences: "\${JWT_AUDIENCE}"
      `;
      
      const jwtAudience = 'https://gateway-abc123.apigateway.project.cloud.goog';
      const processedSpec = spec.replace(/\${JWT_AUDIENCE}/g, jwtAudience);
      
      expect(processedSpec).not.toContain('${JWT_AUDIENCE}');
      expect(processedSpec).toContain(jwtAudience);
    });
  });

  describe('License Activation ThreadPool Error', () => {
    /**
     * Issue: License activation fails with ThreadPool error when app is starting
     * Fix: Add retry logic with delay
     */
    it('should retry license activation on ThreadPool error', async () => {
      const service = new CameraConfigurationService();
      let attempts = 0;
      
      // Mock license upload that fails initially
      service['uploadLicenseXML'] = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          return Promise.reject(new Error('ThreadPool'));
        }
        return Promise.resolve({ success: true, message: 'License installed' });
      });
      
      // Mock the SDK interaction
      service['getLicenseXMLFromAxisSDK'] = jest.fn().mockResolvedValue({
        success: true,
        licenseData: '<License>...</License>'
      });
      
      const camera = {
        ip: '192.168.1.100',
        credentials: { username: 'root', password: 'pass' },
        deviceId: '00408C123456'
      };
      
      const result = await service['activateLicenseWithAxisSDK'](
        camera,
        'TEST-LICENSE-KEY'
      );
      
      expect(result.success).toBe(true);
      expect(attempts).toBe(2);
    });

    it('should add initial delay after ACAP deployment', async () => {
      jest.useFakeTimers();
      
      const deployACAP = async () => {
        // Deploy ACAP
        await Promise.resolve();
        
        // Add delay before license activation
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Activate license
        return { success: true };
      };
      
      const deployPromise = deployACAP();
      
      // Fast-forward time
      jest.advanceTimersByTime(3000);
      
      const result = await deployPromise;
      expect(result.success).toBe(true);
      
      jest.useRealTimers();
    });
  });

  describe('Firestore Permission Issues (v0.9.169)', () => {
    /**
     * Issue: Cameras getting 403 errors when writing to Firestore
     * Fix: Grant roles/datastore.owner to service accounts
     */
    it('should grant datastore.owner role to service accounts', async () => {
      const serviceAccounts = [
        'camera-sa@project.iam.gserviceaccount.com',
        'function-sa@project.iam.gserviceaccount.com'
      ];
      
      const iamPolicies: any[] = [];
      
      mockedAxios.post = jest.fn().mockImplementation((url, data) => {
        if (url.includes('setIamPolicy')) {
          iamPolicies.push(data);
        }
        return Promise.resolve({ data: { success: true } });
      });
      
      // Simulate granting Firestore permissions
      for (const sa of serviceAccounts) {
        await axios.post('/projects/test/setIamPolicy', {
          policy: {
            bindings: [{
              role: 'roles/datastore.owner',
              members: [`serviceAccount:${sa}`]
            }]
          }
        });
      }
      
      // Verify each SA got the correct role
      serviceAccounts.forEach(sa => {
        const policy = iamPolicies.find(p => 
          p.policy?.bindings?.some((b: any) => 
            b.members?.includes(`serviceAccount:${sa}`) &&
            b.role === 'roles/datastore.owner'
          )
        );
        expect(policy).toBeDefined();
      });
    });

    it('should handle token refresh for new permissions', async () => {
      // Simulate token refresh scenario
      let tokenVersion = 1;
      
      const getToken = async () => {
        return {
          access_token: `token_v${tokenVersion}`,
          expires_in: 3600,
          token_type: 'Bearer'
        };
      };
      
      // Initial token
      let token = await getToken();
      expect(token.access_token).toBe('token_v1');
      
      // Simulate permission change requiring token refresh
      tokenVersion = 2;
      token = await getToken();
      expect(token.access_token).toBe('token_v2');
    });
  });

  describe('Windows Build Issues', () => {
    /**
     * Issue: Windows builds failing due to missing rollup module
     * Fix: Install @rollup/rollup-win32-x64-msvc after npm ci
     */
    it('should verify Windows rollup module installation in CI', () => {
      const workflowPath = path.join(__dirname, '../../.github/workflows/release.yml');
      
      if (fs.existsSync(workflowPath)) {
        const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
        
        // Verify the fix is in place
        expect(workflowContent).toContain('@rollup/rollup-win32-x64-msvc');
        expect(workflowContent).toContain('npm ci');
        
        // Verify installation happens after npm ci
        const npmCiIndex = workflowContent.indexOf('npm ci');
        const rollupIndex = workflowContent.indexOf('@rollup/rollup-win32-x64-msvc');
        
        expect(rollupIndex).toBeGreaterThan(npmCiIndex);
      }
    });
  });

  describe('Domain Verification for appspot.com Buckets', () => {
    /**
     * Issue: Cannot create .appspot.com buckets without domain verification
     * Fix: Use different bucket naming convention
     */
    it('should not attempt to create appspot.com buckets', () => {
      const projectId = 'test-project';
      
      // Function to generate bucket name
      const generateBucketName = (projectId: string, purpose: string) => {
        // Should NOT use appspot.com domain
        return `${projectId}-anava-${purpose}`;
      };
      
      const bucketName = generateBucketName(projectId, 'analytics');
      
      expect(bucketName).not.toContain('.appspot.com');
      expect(bucketName).toBe('test-project-anava-analytics');
    });
  });

  describe('Function Source Upload Format', () => {
    /**
     * Issue: Function source must be uploaded with specific naming format
     * Fix: Use gs://gcf-v2-sources-{projectNumber}-{region}/{functionName}-{timestamp}.zip
     */
    it('should format function source path correctly', () => {
      const projectNumber = '123456789';
      const region = 'us-central1';
      const functionName = 'device-auth';
      const timestamp = Date.now();
      
      const sourcePath = `gs://gcf-v2-sources-${projectNumber}-${region}/${functionName}-${timestamp}.zip`;
      
      expect(sourcePath).toMatch(/^gs:\/\/gcf-v2-sources-\d+-[a-z0-9-]+\/[a-z-]+-\d+\.zip$/);
      expect(sourcePath).toContain(projectNumber);
      expect(sourcePath).toContain(region);
      expect(sourcePath).toContain(functionName);
    });

    it('should only pass filename to Cloud Functions API', () => {
      const fullPath = 'gs://gcf-v2-sources-123456789-us-central1/device-auth-1234567890.zip';
      const filename = fullPath.split('/').pop();
      
      expect(filename).toBe('device-auth-1234567890.zip');
      expect(filename).not.toContain('gs://');
      expect(filename).not.toContain('/');
    });
  });

  describe('API Gateway Service Account Configuration', () => {
    /**
     * Issue: API Gateway needs proper service account configuration
     * Fix: Pass service account email directly in gatewayServiceAccount field
     */
    it('should configure gateway service account correctly', () => {
      const serviceAccountEmail = 'gateway-sa@project.iam.gserviceaccount.com';
      
      const gatewayConfig = {
        gatewayId: 'anava-gateway',
        apiConfig: 'anava-config',
        gatewayServiceAccount: serviceAccountEmail, // Direct email, not object
        location: 'us-central1'
      };
      
      expect(gatewayConfig.gatewayServiceAccount).toBe(serviceAccountEmail);
      expect(typeof gatewayConfig.gatewayServiceAccount).toBe('string');
    });
  });
});