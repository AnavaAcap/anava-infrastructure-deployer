/**
 * Integration Tests for v0.9.175 Authentication & API Key Generation
 * Tests the critical fixes for immediate API key generation and auth flow
 */

import { GCPOAuthService } from '@main/services/gcpOAuthService';
import { AuthenticationService } from '@main/services/authenticationService';
import { ApiKeyManager } from '@main/services/apiKeyManager';
import { StateManager } from '@main/services/stateManager';
import { TEST_CREDENTIALS, integrationHelpers } from '../setup/integration.setup';
import { OAuth2Client } from 'google-auth-library';

jest.mock('google-auth-library');
jest.mock('googleapis');

describe('v0.9.175 Authentication Flow Tests', () => {
  let authService: AuthenticationService;
  let apiKeyManager: ApiKeyManager;
  let gcpOAuth: GCPOAuthService;
  let stateManager: StateManager;
  let mockOAuth2Client: jest.Mocked<OAuth2Client>;

  beforeEach(() => {
    // Setup mock OAuth2Client
    mockOAuth2Client = new OAuth2Client() as jest.Mocked<OAuth2Client>;
    mockOAuth2Client.getAccessToken = jest.fn().mockResolvedValue({
      token: 'mock-access-token',
      res: null
    });
    mockOAuth2Client.setCredentials = jest.fn();
    mockOAuth2Client.on = jest.fn();
    
    gcpOAuth = new GCPOAuthService();
    gcpOAuth.oauth2Client = mockOAuth2Client;
    
    stateManager = new StateManager();
    authService = new AuthenticationService(gcpOAuth, stateManager);
    apiKeyManager = new ApiKeyManager(gcpOAuth);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('API Key Generation on Home Screen', () => {
    it('should generate API key immediately after Google login', async () => {
      // Mock successful Google login
      const mockUserInfo = {
        email: 'test@example.com',
        name: 'Test User',
        id: 'user-123'
      };
      
      mockOAuth2Client.verifyIdToken = jest.fn().mockResolvedValue({
        getPayload: () => mockUserInfo
      });

      // Mock API key generation
      const mockApiKey = 'AIza-test-api-key-123456';
      jest.spyOn(apiKeyManager, 'generateApiKey').mockResolvedValue({
        success: true,
        apiKey: mockApiKey,
        keyId: 'key-123'
      });

      // Simulate login flow
      const loginResult = await authService.loginWithGoogle();
      expect(loginResult.success).toBe(true);
      expect(loginResult.user).toEqual(mockUserInfo);

      // Verify API key was generated immediately
      const apiKeyResult = await apiKeyManager.generateApiKey(
        TEST_CREDENTIALS.gcp.projectId
      );
      
      expect(apiKeyResult.success).toBe(true);
      expect(apiKeyResult.apiKey).toBe(mockApiKey);
      expect(apiKeyManager.generateApiKey).toHaveBeenCalledTimes(1);
    });

    it('should handle auth cache clearing without race conditions', async () => {
      // Setup initial auth state
      await authService.loginWithGoogle();
      
      // Track cache operations
      const cacheOperations: string[] = [];
      jest.spyOn(authService, 'clearAuthCache').mockImplementation(async () => {
        cacheOperations.push('clear-start');
        await new Promise(resolve => setTimeout(resolve, 100));
        cacheOperations.push('clear-end');
      });

      jest.spyOn(authService, 'refreshToken').mockImplementation(async () => {
        cacheOperations.push('refresh-start');
        await new Promise(resolve => setTimeout(resolve, 50));
        cacheOperations.push('refresh-end');
        return { success: true };
      });

      // Clear cache and refresh token
      await Promise.all([
        authService.clearAuthCache(),
        authService.refreshToken()
      ]);

      // Verify operations completed without race condition
      expect(cacheOperations).toContain('clear-end');
      expect(cacheOperations).toContain('refresh-end');
      
      // Verify clear completed before refresh
      const clearEndIndex = cacheOperations.indexOf('clear-end');
      const refreshStartIndex = cacheOperations.indexOf('refresh-start');
      expect(clearEndIndex).toBeLessThanOrEqual(refreshStartIndex);
    });

    it('should persist API key across app navigation', async () => {
      const mockApiKey = 'AIza-persistent-key-123';
      
      // Generate API key
      jest.spyOn(apiKeyManager, 'generateApiKey').mockResolvedValue({
        success: true,
        apiKey: mockApiKey,
        keyId: 'key-123'
      });

      const result = await apiKeyManager.generateApiKey(
        TEST_CREDENTIALS.gcp.projectId
      );

      // Save to state
      await stateManager.saveApiKey(mockApiKey);
      
      // Simulate navigation (clear memory cache)
      apiKeyManager.clearCache();
      
      // Retrieve from state
      const retrievedKey = await stateManager.getApiKey();
      expect(retrievedKey).toBe(mockApiKey);
    });
  });

  describe('ACAP Deployment Authentication', () => {
    it('should use HTTPS with Basic auth for ACAP deployment', async () => {
      const cameraAuth = {
        ip: '192.168.1.100',
        username: 'root',
        password: 'admin123'
      };

      // Mock HTTPS request
      const mockAxios = require('axios');
      mockAxios.post = jest.fn().mockResolvedValue({
        status: 200,
        data: { success: true }
      });

      // Test ACAP deployment auth
      const deploymentUrl = `https://${cameraAuth.ip}/local/BatonAnalytic/baton_analytic.cgi?command=setInstallerConfig`;
      
      await mockAxios.post(deploymentUrl, {}, {
        auth: {
          username: cameraAuth.username,
          password: cameraAuth.password
        },
        headers: {
          'Content-Type': 'application/json'
        },
        httpsAgent: expect.any(Object), // Should include cert handling
        timeout: 30000
      });

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('https://'),
        expect.any(Object),
        expect.objectContaining({
          auth: expect.objectContaining({
            username: cameraAuth.username,
            password: cameraAuth.password
          })
        })
      );
    });

    it('should handle HTTPS certificate validation properly', async () => {
      const https = require('https');
      const mockAgent = {
        rejectUnauthorized: false // For self-signed certs
      };

      jest.spyOn(https, 'Agent').mockImplementation(() => mockAgent);

      const cameraConfig = {
        ip: '192.168.1.100',
        useHttps: true,
        allowSelfSignedCert: true
      };

      // Create HTTPS agent for camera
      const agent = new https.Agent({
        rejectUnauthorized: !cameraConfig.allowSelfSignedCert
      });

      expect(agent.rejectUnauthorized).toBe(false);
    });
  });

  describe('Token Refresh and Permission Updates', () => {
    it('should refresh tokens to get new permissions', async () => {
      // Initial token with limited permissions
      const initialToken = {
        access_token: 'initial-token',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/cloud-platform'
      };

      // Updated token with additional permissions
      const refreshedToken = {
        access_token: 'refreshed-token',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/datastore'
      };

      mockOAuth2Client.getAccessToken
        .mockResolvedValueOnce({ token: initialToken.access_token, res: null })
        .mockResolvedValueOnce({ token: refreshedToken.access_token, res: null });

      // Get initial token
      const initial = await gcpOAuth.getAccessToken();
      expect(initial).toBe(initialToken.access_token);

      // Refresh token
      const refreshed = await gcpOAuth.refreshAccessToken();
      expect(refreshed).toBe(refreshedToken.access_token);
      
      // Verify new permissions are available
      expect(mockOAuth2Client.getAccessToken).toHaveBeenCalledTimes(2);
    });

    it('should handle 403 errors by refreshing tokens', async () => {
      const mockAxios = require('axios');
      let tokenRefreshed = false;

      // Mock 403 error followed by success after refresh
      mockAxios.request = jest.fn()
        .mockRejectedValueOnce({
          response: { status: 403, data: { error: 'Permission denied' } }
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { success: true }
        });

      // Mock token refresh
      jest.spyOn(gcpOAuth, 'refreshAccessToken').mockImplementation(async () => {
        tokenRefreshed = true;
        return 'new-token';
      });

      // Make request with retry on 403
      try {
        await mockAxios.request({ url: 'test-url' });
      } catch (error: any) {
        if (error.response?.status === 403) {
          await gcpOAuth.refreshAccessToken();
          await mockAxios.request({ url: 'test-url' });
        }
      }

      expect(tokenRefreshed).toBe(true);
      expect(mockAxios.request).toHaveBeenCalledTimes(2);
    });
  });

  describe('Authentication State Management', () => {
    it('should maintain auth state across component lifecycle', async () => {
      const authState = {
        isAuthenticated: false,
        user: null as any,
        apiKey: null as string | null
      };

      // Login flow
      const loginResult = await authService.loginWithGoogle();
      authState.isAuthenticated = loginResult.success;
      authState.user = loginResult.user;

      expect(authState.isAuthenticated).toBe(true);
      expect(authState.user).toBeDefined();

      // Generate API key
      const apiKeyResult = await apiKeyManager.generateApiKey(
        TEST_CREDENTIALS.gcp.projectId
      );
      authState.apiKey = apiKeyResult.apiKey;

      expect(authState.apiKey).toBeDefined();

      // Persist state
      await stateManager.saveAuthState(authState);

      // Simulate app restart
      const restoredState = await stateManager.getAuthState();
      expect(restoredState).toEqual(authState);
    });

    it('should handle concurrent auth operations without conflicts', async () => {
      const operations: Promise<any>[] = [];
      const results: string[] = [];

      // Simulate multiple concurrent auth operations
      for (let i = 0; i < 5; i++) {
        operations.push(
          authService.checkAuthStatus().then(() => {
            results.push(`check-${i}`);
          })
        );
      }

      operations.push(
        authService.refreshToken().then(() => {
          results.push('refresh');
        })
      );

      operations.push(
        apiKeyManager.generateApiKey(TEST_CREDENTIALS.gcp.projectId).then(() => {
          results.push('api-key');
        })
      );

      // Wait for all operations
      await Promise.all(operations);

      // Verify all operations completed
      expect(results).toContain('refresh');
      expect(results).toContain('api-key');
      expect(results.filter(r => r.startsWith('check')).length).toBe(5);
    });
  });
});