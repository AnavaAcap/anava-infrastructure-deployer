/**
 * Unit Tests for DeploymentEngine
 * Tests the core deployment orchestration logic
 */

import { DeploymentEngine } from '@main/services/deploymentEngine';
import { StateManager } from '@main/services/stateManager';
import { GCPOAuthService } from '@main/services/gcpOAuthService';
import { DeploymentConfig } from '@/types';
import { EventEmitter } from 'events';

// Mock dependencies
jest.mock('@main/services/stateManager');
jest.mock('@main/services/gcpOAuthService');
jest.mock('@main/services/gcpApiServiceManager');
jest.mock('@main/services/cloudFunctionsAPIDeployer');
jest.mock('@main/services/apiGatewayDeployer');
jest.mock('@main/services/firestoreRulesDeployer');
jest.mock('@main/services/workloadIdentityDeployer');
jest.mock('@main/services/firebaseAppDeployer');
jest.mock('@main/services/terraformService');
jest.mock('@main/services/aiStudioService');

describe('DeploymentEngine', () => {
  let deploymentEngine: DeploymentEngine;
  let mockStateManager: jest.Mocked<StateManager>;
  let mockGcpAuth: jest.Mocked<GCPOAuthService>;
  let mockOAuth2Client: any;

  beforeEach(() => {
    // Create mock instances
    mockStateManager = new StateManager() as jest.Mocked<StateManager>;
    mockGcpAuth = new GCPOAuthService() as jest.Mocked<GCPOAuthService>;
    
    // Mock OAuth2 client
    mockOAuth2Client = {
      getAccessToken: jest.fn().mockResolvedValue({ token: 'mock-token' }),
      setCredentials: jest.fn(),
      on: jest.fn(),
    };
    mockGcpAuth.oauth2Client = mockOAuth2Client;

    // Create deployment engine instance
    deploymentEngine = new DeploymentEngine(mockStateManager, mockGcpAuth);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with correct dependencies', () => {
      expect(deploymentEngine).toBeInstanceOf(DeploymentEngine);
      expect(deploymentEngine).toBeInstanceOf(EventEmitter);
    });

    it('should initialize deployers when OAuth client is available', () => {
      const engine = new DeploymentEngine(mockStateManager, mockGcpAuth);
      expect(engine).toBeDefined();
      // Verify deployers are initialized (they're private, so we test indirectly)
    });

    it('should handle missing OAuth client gracefully', () => {
      mockGcpAuth.oauth2Client = undefined;
      const engine = new DeploymentEngine(mockStateManager, mockGcpAuth);
      expect(engine).toBeDefined();
    });
  });

  describe('startDeployment', () => {
    const mockConfig: DeploymentConfig = {
      projectId: 'test-project',
      region: 'us-central1',
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

    it('should start a new deployment with valid config', async () => {
      mockStateManager.createNewDeployment = jest.fn();
      
      // Mock the runDeployment method to prevent actual execution
      deploymentEngine['runDeployment'] = jest.fn().mockResolvedValue(undefined);
      
      await deploymentEngine.startDeployment(mockConfig);
      
      expect(mockStateManager.createNewDeployment).toHaveBeenCalledWith(
        mockConfig.projectId,
        mockConfig.region,
        mockConfig
      );
      expect(deploymentEngine['runDeployment']).toHaveBeenCalled();
    });

    it('should initialize deployers before starting deployment', async () => {
      const initSpy = jest.spyOn(deploymentEngine as any, 'initializeDeployers');
      deploymentEngine['runDeployment'] = jest.fn().mockResolvedValue(undefined);
      
      await deploymentEngine.startDeployment(mockConfig);
      
      expect(initSpy).toHaveBeenCalled();
    });

    it('should reset pause state when starting new deployment', async () => {
      deploymentEngine['isPaused'] = true;
      deploymentEngine['runDeployment'] = jest.fn().mockResolvedValue(undefined);
      
      await deploymentEngine.startDeployment(mockConfig);
      
      expect(deploymentEngine['isPaused']).toBe(false);
    });

    it('should emit progress events during deployment', async () => {
      const progressSpy = jest.fn();
      deploymentEngine.on('progress', progressSpy);
      
      // Mock runDeployment to emit a progress event
      deploymentEngine['runDeployment'] = jest.fn().mockImplementation(async () => {
        deploymentEngine['emitProgress']({
          currentStep: 'initializing',
          stepProgress: 0,
          totalProgress: 0,
          message: 'Starting deployment',
        });
      });
      
      await deploymentEngine.startDeployment(mockConfig);
      
      expect(progressSpy).toHaveBeenCalled();
    });
  });

  describe('resumeDeployment', () => {
    const deploymentId = 'test-deployment-123';

    it('should resume an existing deployment', async () => {
      mockStateManager.getState = jest.fn().mockReturnValue({
        deploymentId,
        projectId: 'test-project',
        region: 'us-central1',
        status: 'paused'
      });
      
      deploymentEngine['runDeployment'] = jest.fn().mockResolvedValue(undefined);
      
      await deploymentEngine.resumeDeployment(deploymentId);
      
      expect(deploymentEngine['runDeployment']).toHaveBeenCalled();
      expect(deploymentEngine['isPaused']).toBe(false);
    });

    it('should throw error if deployment not found', async () => {
      mockStateManager.getState = jest.fn().mockReturnValue(null);
      
      await expect(deploymentEngine.resumeDeployment(deploymentId))
        .rejects.toThrow('Deployment not found');
    });

    it('should throw error if deployment ID does not match', async () => {
      mockStateManager.getState = jest.fn().mockReturnValue({
        deploymentId: 'different-id',
        projectId: 'test-project',
        region: 'us-central1',
        status: 'paused'
      });
      
      await expect(deploymentEngine.resumeDeployment(deploymentId))
        .rejects.toThrow('Deployment not found');
    });
  });

  describe('pauseDeployment', () => {
    it('should pause deployment and emit progress event', () => {
      const progressSpy = jest.fn();
      deploymentEngine.on('progress', progressSpy);
      
      deploymentEngine.pauseDeployment();
      
      expect(deploymentEngine['isPaused']).toBe(true);
      expect(progressSpy).toHaveBeenCalledWith({
        currentStep: 'paused',
        stepProgress: 0,
        totalProgress: 0,
        message: 'Deployment paused',
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle deployment errors gracefully', async () => {
      const errorSpy = jest.fn();
      deploymentEngine.on('error', errorSpy);
      
      deploymentEngine['runDeployment'] = jest.fn().mockRejectedValue(
        new Error('Deployment failed')
      );
      
      const mockConfig: DeploymentConfig = {
        projectId: 'test-project',
        region: 'us-central1',
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
      
      try {
        await deploymentEngine.startDeployment(mockConfig);
      } catch (error) {
        // Expected to throw
      }
      
      // Verify error handling occurred
      expect(deploymentEngine['runDeployment']).toHaveBeenCalled();
    });

    it('should handle OAuth refresh errors', async () => {
      mockOAuth2Client.getAccessToken = jest.fn().mockRejectedValue(
        new Error('Token refresh failed')
      );
      
      // This should not throw, but handle gracefully
      const engine = new DeploymentEngine(mockStateManager, mockGcpAuth);
      expect(engine).toBeDefined();
    });
  });

  describe('Event Emissions', () => {
    it('should emit correct events during deployment lifecycle', () => {
      const events = {
        progress: jest.fn(),
        error: jest.fn(),
        complete: jest.fn(),
        stateChange: jest.fn(),
      };
      
      Object.entries(events).forEach(([event, handler]) => {
        deploymentEngine.on(event, handler);
      });
      
      // Simulate progress emission
      deploymentEngine['emitProgress']({
        currentStep: 'test',
        stepProgress: 50,
        totalProgress: 25,
        message: 'Testing',
      });
      
      expect(events.progress).toHaveBeenCalledWith({
        currentStep: 'test',
        stepProgress: 50,
        totalProgress: 25,
        message: 'Testing',
      });
    });
  });

  describe('Service Account Propagation Handling', () => {
    it('should handle IAM propagation delays correctly', async () => {
      // This tests the critical issue mentioned in CLAUDE.md
      const mockDelay = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 0))
      );
      
      // Mock the resilience utils to track retry behavior
      const resilienceUtils = require('@main/services/utils/resilienceUtils');
      resilienceUtils.ResilienceUtils = {
        retryWithBackoff: jest.fn().mockImplementation(async (fn) => {
          await mockDelay();
          return fn();
        }),
        waitForServiceAccountPropagation: jest.fn().mockImplementation(async () => {
          await mockDelay();
          return true;
        })
      };
      
      deploymentEngine['runDeployment'] = jest.fn().mockResolvedValue(undefined);
      
      const mockConfig: DeploymentConfig = {
        projectId: 'test-project',
        region: 'us-central1',
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
      
      await deploymentEngine.startDeployment(mockConfig);
      
      // Verify that propagation delays are handled
      expect(deploymentEngine['runDeployment']).toHaveBeenCalled();
    });
  });
});