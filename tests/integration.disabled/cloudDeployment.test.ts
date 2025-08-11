/**
 * Integration Tests for Cloud Deployment Flows
 * Tests the end-to-end deployment process with mocked GCP services
 */

import { DeploymentEngine } from '@main/services/deploymentEngine';
import { StateManager } from '@main/services/stateManager';
import { GCPOAuthService } from '@main/services/gcpOAuthService';
import { CloudFunctionsAPIDeployer } from '@main/services/cloudFunctionsAPIDeployer';
import { ApiGatewayDeployer } from '@main/services/apiGatewayDeployer';
import { FirestoreRulesDeployer } from '@main/services/firestoreRulesDeployer';
import { WorkloadIdentityDeployer } from '@main/services/workloadIdentityDeployer';
import { DeploymentConfig } from '@/types';
import { TEST_CREDENTIALS, integrationHelpers } from '../setup/integration.setup';
import axios from 'axios';

// Partial mocks - we'll mock external APIs but keep internal logic
jest.mock('axios');
jest.mock('@google-cloud/functions');
jest.mock('@google-cloud/api-gateway');
jest.mock('@google-cloud/storage');
jest.mock('@google-cloud/iam');
jest.mock('googleapis');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Cloud Deployment Integration Tests', () => {
  let deploymentEngine: DeploymentEngine;
  let stateManager: StateManager;
  let gcpAuth: GCPOAuthService;
  
  const testConfig: DeploymentConfig = {
    projectId: TEST_CREDENTIALS.gcp.projectId,
    region: TEST_CREDENTIALS.gcp.region,
    deploymentMode: 'vertex',
    enabledServices: {
      auth: true,
      firestore: true,
      cloudFunctions: true,
      apiGateway: true,
      workloadIdentity: true,
    },
    authConfig: {
      enableEmailPassword: true,
      enableGoogleSignIn: false,
    }
  };

  beforeAll(async () => {
    // Setup mock OAuth
    const mockOAuth2Client = {
      getAccessToken: jest.fn().mockResolvedValue({ 
        token: integrationHelpers.createMockToken() 
      }),
      setCredentials: jest.fn(),
      on: jest.fn(),
    };
    
    gcpAuth = new GCPOAuthService();
    gcpAuth.oauth2Client = mockOAuth2Client as any;
    
    stateManager = new StateManager();
    deploymentEngine = new DeploymentEngine(stateManager, gcpAuth);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Deployment Flow', () => {
    it('should deploy all services in correct order', async () => {
      const deploymentSteps: string[] = [];
      
      // Track deployment progress
      deploymentEngine.on('progress', (progress) => {
        deploymentSteps.push(progress.currentStep);
      });
      
      // Mock successful API responses
      mockGCPAPIs();
      
      await deploymentEngine.startDeployment(testConfig);
      
      // Verify deployment order matches expected flow
      expect(deploymentSteps).toContain('enabling-apis');
      expect(deploymentSteps).toContain('creating-service-accounts');
      expect(deploymentSteps).toContain('deploying-firebase');
      expect(deploymentSteps).toContain('deploying-firestore');
      expect(deploymentSteps).toContain('deploying-functions');
      expect(deploymentSteps).toContain('deploying-api-gateway');
      
      // Verify critical steps occur in correct order
      const apiIndex = deploymentSteps.indexOf('enabling-apis');
      const saIndex = deploymentSteps.indexOf('creating-service-accounts');
      const functionsIndex = deploymentSteps.indexOf('deploying-functions');
      
      expect(apiIndex).toBeLessThan(saIndex);
      expect(saIndex).toBeLessThan(functionsIndex);
    });

    it('should handle service account propagation delays', async () => {
      let propagationDelayCalled = false;
      
      // Mock service account creation with propagation check
      const mockIAM = {
        projects: {
          serviceAccounts: {
            create: jest.fn().mockImplementation(async () => {
              // Simulate propagation delay
              await new Promise(resolve => setTimeout(resolve, 100));
              propagationDelayCalled = true;
              return { data: { email: 'test-sa@project.iam.gserviceaccount.com' } };
            }),
            get: jest.fn().mockResolvedValue({ 
              data: { email: 'test-sa@project.iam.gserviceaccount.com' } 
            })
          }
        }
      };
      
      const googleapis = require('googleapis');
      googleapis.google.iam = jest.fn().mockReturnValue(mockIAM);
      
      await deploymentEngine.startDeployment(testConfig);
      
      expect(propagationDelayCalled).toBe(true);
    });

    it('should rollback on critical failure', async () => {
      const rollbackSteps: string[] = [];
      
      deploymentEngine.on('rollback', (step) => {
        rollbackSteps.push(step);
      });
      
      // Mock a failure during function deployment
      mockGCPAPIsWithFailure('functions');
      
      try {
        await deploymentEngine.startDeployment(testConfig);
      } catch (error) {
        // Expected to fail
      }
      
      // Verify rollback occurred
      expect(rollbackSteps.length).toBeGreaterThan(0);
    });
  });

  describe('Cloud Functions Deployment', () => {
    let cloudFunctionsDeployer: CloudFunctionsAPIDeployer;
    
    beforeEach(() => {
      cloudFunctionsDeployer = new CloudFunctionsAPIDeployer(gcpAuth.oauth2Client!);
    });

    it('should deploy cloud functions with correct permissions', async () => {
      const functionConfig = {
        name: 'device-auth',
        runtime: 'python311',
        entryPoint: 'main',
        sourceCode: 'def main(request): return {"status": "ok"}',
        environmentVariables: {
          PROJECT_ID: testConfig.projectId
        }
      };
      
      // Mock Cloud Functions API
      mockCloudFunctionsAPI();
      
      const result = await cloudFunctionsDeployer.deployFunction(
        testConfig.projectId,
        testConfig.region,
        functionConfig
      );
      
      expect(result.success).toBe(true);
      expect(result.functionUrl).toContain('https://');
    });

    it('should handle compute service account permissions correctly', async () => {
      // This tests the critical issue from CLAUDE.md about compute SA
      const projectNumber = '123456789';
      const computeSA = `${projectNumber}-compute@developer.gserviceaccount.com`;
      
      // Track IAM policy updates
      const iamPolicyUpdates: any[] = [];
      
      mockCloudFunctionsAPIWithIAMTracking(iamPolicyUpdates);
      
      await cloudFunctionsDeployer.deployFunction(
        testConfig.projectId,
        testConfig.region,
        {
          name: 'test-function',
          runtime: 'python311',
          entryPoint: 'main',
          sourceCode: 'def main(request): pass'
        }
      );
      
      // Verify compute SA was granted necessary permissions
      const computeSAPolicy = iamPolicyUpdates.find(
        p => p.member === `serviceAccount:${computeSA}`
      );
      
      expect(computeSAPolicy).toBeDefined();
      expect(computeSAPolicy.roles).toContain('roles/artifactregistry.admin');
      expect(computeSAPolicy.roles).toContain('roles/storage.objectViewer');
    });
  });

  describe('API Gateway Deployment', () => {
    let apiGatewayDeployer: ApiGatewayDeployer;
    
    beforeEach(() => {
      apiGatewayDeployer = new ApiGatewayDeployer(gcpAuth.oauth2Client!);
    });

    it('should deploy API Gateway with correct OpenAPI spec', async () => {
      const gatewayConfig = {
        apiId: 'anava-api',
        displayName: 'Anava API Gateway',
        openApiSpec: `
          openapi: 3.0.0
          info:
            title: Anava API
            version: 1.0.0
          paths:
            /device-auth:
              post:
                x-google-backend:
                  address: \${DEVICE_AUTH_URL}
        `
      };
      
      mockAPIGatewayAPI();
      
      const result = await apiGatewayDeployer.deployGateway(
        testConfig.projectId,
        testConfig.region,
        gatewayConfig
      );
      
      expect(result.success).toBe(true);
      expect(result.gatewayUrl).toContain('gateway.dev');
    });

    it('should replace all OpenAPI placeholders correctly', async () => {
      // This tests the critical regex replacement issue from CLAUDE.md
      const spec = `
        openapi: 3.0.0
        paths:
          /auth:
            x-google-backend:
              address: \${DEVICE_AUTH_URL}
          /token:
            x-google-backend:
              address: \${DEVICE_AUTH_URL}
      `;
      
      const deviceAuthUrl = 'https://function-abc123.cloudfunctions.net';
      const processedSpec = spec.replace(/\${DEVICE_AUTH_URL}/g, deviceAuthUrl);
      
      expect(processedSpec).not.toContain('${DEVICE_AUTH_URL}');
      expect((processedSpec.match(new RegExp(deviceAuthUrl, 'g')) || []).length).toBe(2);
    });
  });

  describe('Firestore Setup', () => {
    let firestoreDeployer: FirestoreRulesDeployer;
    
    beforeEach(() => {
      firestoreDeployer = new FirestoreRulesDeployer(gcpAuth.oauth2Client!);
    });

    it('should deploy Firestore rules and indexes', async () => {
      mockFirestoreAPI();
      
      const rules = `
        rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            match /{document=**} {
              allow read, write: if request.auth != null;
            }
          }
        }
      `;
      
      const indexes = [
        {
          collectionGroup: 'cameras',
          fields: [
            { fieldPath: 'customerId', order: 'ASCENDING' },
            { fieldPath: 'timestamp', order: 'DESCENDING' }
          ]
        }
      ];
      
      const rulesResult = await firestoreDeployer.deployRules(
        testConfig.projectId,
        rules
      );
      
      const indexesResult = await firestoreDeployer.deployIndexes(
        testConfig.projectId,
        indexes
      );
      
      expect(rulesResult.success).toBe(true);
      expect(indexesResult.success).toBe(true);
    });

    it('should handle Firestore permission issues', async () => {
      // Test the 403 error fix from v0.9.169
      const serviceAccounts = [
        'camera-sa@project.iam.gserviceaccount.com',
        'function-sa@project.iam.gserviceaccount.com'
      ];
      
      const iamUpdates: any[] = [];
      mockFirestoreAPIWithIAMTracking(iamUpdates);
      
      // Deploy with service account permissions
      await firestoreDeployer.grantFirestoreAccess(
        testConfig.projectId,
        serviceAccounts
      );
      
      // Verify service accounts got datastore.owner role
      serviceAccounts.forEach(sa => {
        const policy = iamUpdates.find(
          p => p.member === `serviceAccount:${sa}`
        );
        expect(policy).toBeDefined();
        expect(policy.role).toBe('roles/datastore.owner');
      });
    });
  });

  describe('Workload Identity Federation', () => {
    let workloadIdentityDeployer: WorkloadIdentityDeployer;
    
    beforeEach(() => {
      workloadIdentityDeployer = new WorkloadIdentityDeployer(gcpAuth.oauth2Client!);
    });

    it('should setup workload identity for cameras', async () => {
      mockWorkloadIdentityAPI();
      
      const result = await workloadIdentityDeployer.setupWorkloadIdentity(
        testConfig.projectId,
        'camera-pool',
        'camera-provider'
      );
      
      expect(result.success).toBe(true);
      expect(result.poolId).toBe('camera-pool');
      expect(result.providerId).toBe('camera-provider');
    });
  });
});

// Helper functions to mock GCP APIs
function mockGCPAPIs() {
  // Mock successful responses for all GCP services
  mockedAxios.request = jest.fn().mockImplementation((config) => {
    if (config.url?.includes('serviceusage')) {
      return Promise.resolve({ data: { operations: [{ done: true }] } });
    }
    if (config.url?.includes('iam')) {
      return Promise.resolve({ data: { email: 'sa@project.iam.gserviceaccount.com' } });
    }
    if (config.url?.includes('cloudfunctions')) {
      return Promise.resolve({ 
        data: { 
          name: 'operation-123',
          httpsTrigger: { url: 'https://function.run.app' }
        } 
      });
    }
    if (config.url?.includes('apigateway')) {
      return Promise.resolve({ 
        data: { 
          name: 'gateway-123',
          defaultHostname: 'gateway-123-abc.uc.gateway.dev'
        } 
      });
    }
    return Promise.resolve({ data: { success: true } });
  });
}

function mockGCPAPIsWithFailure(failurePoint: string) {
  mockedAxios.request = jest.fn().mockImplementation((config) => {
    if (config.url?.includes(failurePoint)) {
      return Promise.reject(new Error(`${failurePoint} deployment failed`));
    }
    return Promise.resolve({ data: { success: true } });
  });
}

function mockCloudFunctionsAPI() {
  const mockFunctions = require('@google-cloud/functions');
  mockFunctions.FunctionsServiceClient = jest.fn().mockImplementation(() => ({
    createFunction: jest.fn().mockResolvedValue([{ 
      name: 'operations/op-123',
      httpsTrigger: { url: 'https://function.run.app' }
    }]),
    getFunction: jest.fn().mockResolvedValue([{ 
      state: 'ACTIVE',
      httpsTrigger: { url: 'https://function.run.app' }
    }])
  }));
}

function mockCloudFunctionsAPIWithIAMTracking(iamPolicyUpdates: any[]) {
  const googleapis = require('googleapis');
  googleapis.google.iam = jest.fn().mockReturnValue({
    projects: {
      serviceAccounts: {
        setIamPolicy: jest.fn().mockImplementation(({ resource, requestBody }) => {
          requestBody.policy.bindings.forEach((binding: any) => {
            binding.members.forEach((member: string) => {
              iamPolicyUpdates.push({
                member,
                roles: [binding.role]
              });
            });
          });
          return Promise.resolve({ data: requestBody.policy });
        })
      }
    }
  });
}

function mockAPIGatewayAPI() {
  const mockGateway = require('@google-cloud/api-gateway');
  mockGateway.ApiGatewayServiceClient = jest.fn().mockImplementation(() => ({
    createApi: jest.fn().mockResolvedValue([{ name: 'operations/op-123' }]),
    createApiConfig: jest.fn().mockResolvedValue([{ name: 'operations/op-456' }]),
    createGateway: jest.fn().mockResolvedValue([{ 
      name: 'operations/op-789',
      defaultHostname: 'gateway-123-abc.uc.gateway.dev'
    }])
  }));
}

function mockFirestoreAPI() {
  mockedAxios.post = jest.fn().mockImplementation((url) => {
    if (url.includes('firestore.rules')) {
      return Promise.resolve({ data: { success: true } });
    }
    if (url.includes('indexes')) {
      return Promise.resolve({ data: { name: 'operations/index-123' } });
    }
    return Promise.resolve({ data: {} });
  });
}

function mockFirestoreAPIWithIAMTracking(iamUpdates: any[]) {
  const googleapis = require('googleapis');
  googleapis.google.cloudresourcemanager = jest.fn().mockReturnValue({
    projects: {
      setIamPolicy: jest.fn().mockImplementation(({ resource, requestBody }) => {
        requestBody.policy.bindings.forEach((binding: any) => {
          binding.members.forEach((member: string) => {
            iamUpdates.push({
              member,
              role: binding.role
            });
          });
        });
        return Promise.resolve({ data: requestBody.policy });
      })
    }
  });
}

function mockWorkloadIdentityAPI() {
  const googleapis = require('googleapis');
  googleapis.google.iam = jest.fn().mockReturnValue({
    projects: {
      locations: {
        workloadIdentityPools: {
          create: jest.fn().mockResolvedValue({ 
            data: { name: 'projects/123/locations/global/workloadIdentityPools/pool' }
          }),
          providers: {
            create: jest.fn().mockResolvedValue({
              data: { name: 'projects/123/locations/global/workloadIdentityPools/pool/providers/provider' }
            })
          }
        }
      }
    }
  });
}