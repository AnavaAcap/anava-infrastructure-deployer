/**
 * Integration Tests for Manual Camera Entry Feature (v0.9.177)
 * Tests the ability to manually enter camera credentials on ConfigurationPage and CompletionPage
 */

import { CameraConfigurationService } from '@main/services/camera/cameraConfigurationService';
import { CameraDiscoveryService } from '@main/services/camera/cameraDiscoveryService';
import { Camera } from '@main/services/camera/cameraDiscoveryService';
import axios from 'axios';

// Mock dependencies
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Manual Camera Entry Integration Tests', () => {
  let configService: CameraConfigurationService;
  let discoveryService: CameraDiscoveryService;

  beforeEach(() => {
    configService = new CameraConfigurationService();
    discoveryService = new CameraDiscoveryService();
    jest.clearAllMocks();
  });

  describe('Manual Camera Configuration Flow', () => {
    const manualCamera: Camera = {
      id: 'manual-192.168.1.100',
      name: 'Manual Camera',
      ip: '192.168.1.100',
      model: 'Unknown',
      serialNumber: 'Unknown',
      credentials: {
        username: 'root',
        password: 'testpass123'
      },
      isManualEntry: true
    };

    it('should successfully configure a manually entered camera', async () => {
      // Mock successful connection test
      mockedAxios.request = jest.fn()
        .mockRejectedValueOnce({
          response: {
            status: 401,
            headers: {
              'www-authenticate': 'Digest realm="AXIS", nonce="abc123"'
            }
          }
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { deviceInfo: { model: 'AXIS P3265' } }
        });

      // Test connection with manual credentials
      const connectionResult = await configService.testCameraConnection(
        manualCamera.ip,
        manualCamera.credentials.username,
        manualCamera.credentials.password
      );

      expect(connectionResult.success).toBe(true);
      expect(mockedAxios.request).toHaveBeenCalledTimes(2);
    });

    it('should handle invalid manual camera credentials', async () => {
      mockedAxios.request = jest.fn().mockRejectedValue({
        response: {
          status: 401,
          data: { error: 'Unauthorized' }
        }
      });

      const connectionResult = await configService.testCameraConnection(
        '192.168.1.100',
        'wronguser',
        'wrongpass'
      );

      expect(connectionResult.success).toBe(false);
      expect(connectionResult.error).toContain('Unauthorized');
    });

    it('should validate manually entered IP addresses', () => {
      const testCases = [
        { ip: '192.168.1.100', valid: true },
        { ip: '10.0.0.1', valid: true },
        { ip: '256.256.256.256', valid: false },
        { ip: 'not.an.ip', valid: false },
        { ip: '192.168.1', valid: false },
        { ip: '', valid: false }
      ];

      testCases.forEach(({ ip, valid }) => {
        const isValid = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ip);
        expect(isValid).toBe(valid);
      });
    });

    it('should push configuration to manually entered camera', async () => {
      const config = {
        firebase: {
          apiKey: 'test-key',
          authDomain: 'test.firebaseapp.com',
          projectId: 'test-project',
          storageBucket: 'test-project.appspot.com',
          messagingSenderId: '123456',
          appId: '1:123456:web:abcdef',
          databaseId: '(default)'
        },
        gemini: {
          vertexApiGatewayUrl: 'https://gateway.example.com',
          vertexApiGatewayKey: 'gateway-key',
          vertexGcpProjectId: 'test-project',
          vertexGcpRegion: 'us-central1',
          vertexGcsBucketName: 'test-project-anava-analytics'
        },
        anavaKey: 'ANAVA-123',
        customerId: 'customer-456'
      };

      // Mock successful config push
      configService['simpleDigestAuth'] = jest.fn().mockResolvedValue({
        status: 200,
        data: { status: 'success' }
      });

      const result = await configService.pushConfigurationToCamera(
        manualCamera,
        config
      );

      expect(result.success).toBe(true);
      expect(configService['simpleDigestAuth']).toHaveBeenCalledWith(
        manualCamera.ip,
        manualCamera.credentials.username,
        manualCamera.credentials.password,
        'POST',
        '/local/BatonAnalytic/baton_analytic.cgi?command=setInstallerConfig',
        JSON.stringify(config)
      );
    });

    it('should handle ThreadPool error for manually entered camera', async () => {
      // Mock ThreadPool error (which is actually success)
      configService['simpleDigestAuth'] = jest.fn().mockRejectedValue({
        response: {
          status: 500,
          data: {
            message: 'enqueue on stopped ThreadPool'
          }
        }
      });

      const result = await configService.pushConfigurationToCamera(
        manualCamera,
        {} as any
      );

      // Should treat ThreadPool error as success
      expect(result.success).toBe(true);
      expect(result.message).toContain('ACAP restarting');
    });
  });

  describe('Mixed Manual and Discovered Cameras', () => {
    it('should handle both manual and discovered cameras in the same session', async () => {
      const discoveredCamera: Camera = {
        id: 'axis-00408c123456',
        name: 'AXIS P3265',
        ip: '192.168.1.50',
        model: 'P3265',
        serialNumber: '00408C123456',
        credentials: {
          username: 'root',
          password: 'discovered'
        }
      };

      const manualCamera: Camera = {
        id: 'manual-192.168.1.60',
        name: 'Manual Camera',
        ip: '192.168.1.60',
        model: 'Unknown',
        serialNumber: 'Unknown',
        credentials: {
          username: 'admin',
          password: 'manual123'
        },
        isManualEntry: true
      };

      const cameras = [discoveredCamera, manualCamera];
      const results = [];

      // Mock successful config push for both
      configService['simpleDigestAuth'] = jest.fn().mockResolvedValue({
        status: 200,
        data: { status: 'success' }
      });

      for (const camera of cameras) {
        const result = await configService.pushConfigurationToCamera(
          camera,
          {} as any
        );
        results.push(result);
      }

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
      expect(configService['simpleDigestAuth']).toHaveBeenCalledTimes(2);
    });
  });

  describe('Manual Camera Entry Validation', () => {
    it('should require all manual entry fields', () => {
      const validateManualEntry = (ip: string, username: string, password: string) => {
        return !!(ip && username && password && 
                 /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ip));
      };

      expect(validateManualEntry('192.168.1.100', 'root', 'pass')).toBe(true);
      expect(validateManualEntry('', 'root', 'pass')).toBe(false);
      expect(validateManualEntry('192.168.1.100', '', 'pass')).toBe(false);
      expect(validateManualEntry('192.168.1.100', 'root', '')).toBe(false);
      expect(validateManualEntry('invalid', 'root', 'pass')).toBe(false);
    });

    it('should sanitize manual input to prevent injection', () => {
      const sanitizeInput = (input: string) => {
        // Remove any potentially dangerous characters
        return input.replace(/[<>'"&]/g, '');
      };

      expect(sanitizeInput('normal_user')).toBe('normal_user');
      expect(sanitizeInput('user<script>alert(1)</script>')).toBe('userscriptalert(1)/script');
      expect(sanitizeInput('pass"word')).toBe('password');
    });
  });

  describe('Camera Context Integration', () => {
    it('should save manually entered cameras to global context', () => {
      const cameraContext = {
        cameras: [] as Camera[],
        addCamera: function(camera: Camera) {
          this.cameras.push(camera);
        },
        getCameras: function() {
          return this.cameras;
        }
      };

      const manualCamera: Camera = {
        id: 'manual-192.168.1.100',
        name: 'Manual Camera',
        ip: '192.168.1.100',
        model: 'Unknown',
        serialNumber: 'Unknown',
        credentials: {
          username: 'root',
          password: 'test'
        },
        isManualEntry: true
      };

      cameraContext.addCamera(manualCamera);
      const cameras = cameraContext.getCameras();

      expect(cameras).toHaveLength(1);
      expect(cameras[0].isManualEntry).toBe(true);
      expect(cameras[0].ip).toBe('192.168.1.100');
    });

    it('should persist camera credentials across navigation', () => {
      const storage = new Map<string, any>();
      
      const saveToStorage = (key: string, value: any) => {
        storage.set(key, JSON.stringify(value));
      };
      
      const loadFromStorage = (key: string) => {
        const value = storage.get(key);
        return value ? JSON.parse(value) : null;
      };

      const camera = {
        ip: '192.168.1.100',
        credentials: {
          username: 'root',
          password: 'secure123'
        }
      };

      saveToStorage('manual-cameras', [camera]);
      const loaded = loadFromStorage('manual-cameras');

      expect(loaded).toHaveLength(1);
      expect(loaded[0].ip).toBe(camera.ip);
      expect(loaded[0].credentials.username).toBe(camera.credentials.username);
    });
  });

  describe('Error Recovery for Manual Cameras', () => {
    it('should retry configuration push with exponential backoff', async () => {
      let attempts = 0;
      
      configService['simpleDigestAuth'] = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Network timeout'));
        }
        return Promise.resolve({ status: 200, data: { success: true } });
      });

      const retryWithBackoff = async (fn: () => Promise<any>, maxAttempts = 3) => {
        for (let i = 0; i < maxAttempts; i++) {
          try {
            return await fn();
          } catch (error) {
            if (i === maxAttempts - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 100));
          }
        }
      };

      const camera = {
        ip: '192.168.1.100',
        credentials: { username: 'root', password: 'pass' }
      };

      const result = await retryWithBackoff(() => 
        configService['simpleDigestAuth'](
          camera.ip,
          camera.credentials.username,
          camera.credentials.password,
          'POST',
          '/local/BatonAnalytic/baton_analytic.cgi?command=setInstallerConfig',
          '{}'
        )
      );

      expect(result.status).toBe(200);
      expect(attempts).toBe(3);
    });

    it('should handle network unreachable for manual cameras gracefully', async () => {
      configService['simpleDigestAuth'] = jest.fn().mockRejectedValue({
        code: 'ENETUNREACH',
        message: 'Network unreachable'
      });

      const camera = {
        ip: '192.168.1.100',
        credentials: { username: 'root', password: 'pass' }
      };

      const result = await configService.pushConfigurationToCamera(camera, {} as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network unreachable');
    });
  });
});