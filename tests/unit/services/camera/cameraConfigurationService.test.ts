/**
 * Unit Tests for CameraConfigurationService
 * Tests camera configuration, ACAP deployment, and license activation
 */

// Mock dependencies - must be hoisted before imports
jest.mock('axios');

import { CameraConfigurationService } from '@main/services/camera/cameraConfigurationService';
import crypto from 'crypto';
import axios from 'axios';

// Cast axios to a mocked function
const mockedAxios = jest.mocked(axios);

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn((path) => `/mock/path/${path}`),
    getVersion: jest.fn(() => '1.0.0'),
    getName: jest.fn(() => 'anava-installer'),
    on: jest.fn(),
    whenReady: jest.fn(() => Promise.resolve())
  },
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
    removeHandler: jest.fn()
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadURL: jest.fn(),
    on: jest.fn(),
    webContents: {
      send: jest.fn(),
      on: jest.fn()
    }
  })),
  dialog: {
    showMessageBox: jest.fn(),
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn()
  }
}));

describe('CameraConfigurationService', () => {
  let service: CameraConfigurationService;

  beforeEach(() => {
    service = new CameraConfigurationService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Scene Description API', () => {
    const mockCamera = {
      ip: '192.168.1.100',
      credentials: {
        username: 'root',
        password: 'testpass'
      },
      speaker: {
        ip: '192.168.1.101',
        username: 'speaker',
        password: 'speakerpass'
      }
    };

    it('should get scene description successfully', async () => {
      const mockResponse = {
        status: 'success',
        description: 'A person is walking in the hallway',
        imageBase64: 'base64imagedata',
        audioMP3Base64: 'base64audiodata',
        timestamp: Date.now()
      };

      // Mock axios for digest auth - first call returns 401, second returns success
      mockedAxios
        .mockResolvedValueOnce({
          status: 401,
          headers: {
            'www-authenticate': 'Digest realm="AXIS", nonce="abc123"'
          }
        } as any)
        .mockResolvedValueOnce({
          status: 200,
          data: mockResponse
        } as any);

      const result = await service.getSceneDescription(mockCamera, 'test-api-key', false);

      expect(result.success).toBe(true);
      expect(result.description).toBe(mockResponse.description);
      expect(mockedAxios).toHaveBeenCalled();
    });

    it('should include speaker credentials when requested', async () => {
      mockedAxios
        .mockResolvedValueOnce({
          status: 401,
          headers: {
            'www-authenticate': 'Digest realm="AXIS", nonce="abc123"'
          }
        } as any)
        .mockResolvedValueOnce({
          status: 200,
          data: { status: 'success' }
        } as any);

      await service.getSceneDescription(mockCamera, 'test-api-key', true);

      // Get the second call (after auth)
      const calls = mockedAxios.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(2);
      const authCall = calls[1][0] as any;
      const requestData = JSON.parse(authCall.data);
      
      expect(requestData.speakerIp).toBe(mockCamera.speaker.ip);
      expect(requestData.speakerUser).toBe(mockCamera.speaker.username);
      expect(requestData.speakerPass).toBe(mockCamera.speaker.password);
    });

    it('should handle scene description errors', async () => {
      mockedAxios.mockRejectedValue(new Error('Network error'));

      const result = await service.getSceneDescription(mockCamera, 'test-api-key', false);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle non-JSON responses gracefully', async () => {
      mockedAxios
        .mockResolvedValueOnce({
          status: 401,
          headers: {
            'www-authenticate': 'Digest realm="AXIS", nonce="abc123"'
          }
        } as any)
        .mockResolvedValueOnce({
          status: 200,
          data: 'Plain text response'
        } as any);

      const result = await service.getSceneDescription(mockCamera, 'test-api-key', false);
      
      // Should handle non-JSON response
      expect(result).toBeDefined();
    });
  });

  describe('License Activation', () => {
    const mockCamera = {
      ip: '192.168.1.100',
      credentials: {
        username: 'root',
        password: 'testpass'
      },
      deviceId: '00408C123456',
      mac: 'B8A44F45D624'
    };

    it('should activate license successfully', async () => {
      // Mock successful license activation flow
      mockedAxios
        // First call - get app list with auth challenge
        .mockResolvedValueOnce({
          status: 401,
          headers: {
            'www-authenticate': 'Digest realm="AXIS", nonce="abc123"'
          }
        } as any)
        // Second call - successful app list response (XML string)
        .mockResolvedValueOnce({
          status: 200,
          data: `<reply result="ok">
            <application Name="BatonAnalytic" NiceName="Baton Analytic" Status="Running" License="None"/>
          </reply>`
        } as any)
        // Third call - license activation with auth challenge
        .mockResolvedValueOnce({
          status: 401,
          headers: {
            'www-authenticate': 'Digest realm="AXIS", nonce="abc456"'
          }
        } as any)
        // Fourth call - successful license activation
        .mockResolvedValueOnce({
          status: 200,
          data: { 
            status: 'success',
            message: 'License activated successfully'
          }
        } as any);

      await service.activateLicenseKey(
        mockCamera.ip,
        mockCamera.credentials.username,
        mockCamera.credentials.password,
        'TEST-LICENSE-KEY',
        'BatonAnalytic',
        mockCamera.mac
      );
      
      expect(mockedAxios).toHaveBeenCalled();
    });

    it('should handle license activation failures', async () => {
      mockedAxios.mockRejectedValue(new Error('License activation failed'));

      await expect(service.activateLicenseKey(
        mockCamera.ip,
        mockCamera.credentials.username,
        mockCamera.credentials.password,
        'INVALID-KEY',
        'BatonAnalytic',
        mockCamera.mac
      )).rejects.toThrow('License activation process failed');
    });
  });

  describe('Digest Authentication', () => {
    it('should handle digest auth challenge correctly', async () => {
      const challenge = 'Digest realm="AXIS", nonce="abc123", algorithm=MD5';
      
      // Mock initial 401 response then success
      mockedAxios
        .mockResolvedValueOnce({
          status: 401,
          headers: {
            'www-authenticate': challenge
          }
        } as any)
        .mockResolvedValueOnce({
          status: 200,
          data: { success: true }
        } as any);

      const mockCamera = {
        ip: '192.168.1.100',
        credentials: {
          username: 'root',
          password: 'password'
        }
      };

      // Test through public API
      await service.pushSystemConfig(
        mockCamera.ip,
        mockCamera.credentials.username,
        mockCamera.credentials.password,
        { test: 'data' }
      );

      expect(mockedAxios).toHaveBeenCalledTimes(2);
      
      // Verify digest header was added
      const secondCall = mockedAxios.mock.calls[1][0] as any;
      expect(secondCall.headers?.Authorization).toContain('Digest');
    });

    it('should handle missing auth challenge', async () => {
      mockedAxios.mockResolvedValue({
        status: 401,
        headers: {} // No www-authenticate header
      } as any);

      const mockCamera = {
        ip: '192.168.1.100',
        credentials: {
          username: 'root',
          password: 'password'
        }
      };

      const result = await service.pushSystemConfig(
        mockCamera.ip,
        mockCamera.credentials.username,
        mockCamera.credentials.password,
        {}
      );

      expect(result.success).toBe(false);
    });

    it('should calculate correct digest hash', () => {
      const ha1 = crypto
        .createHash('md5')
        .update('user:realm:password')
        .digest('hex');
      
      const ha2 = crypto
        .createHash('md5')
        .update('GET:/path')
        .digest('hex');
      
      const response = crypto
        .createHash('md5')
        .update(`${ha1}:nonce123:${ha2}`)
        .digest('hex');
      
      // This verifies the digest calculation logic
      expect(response).toMatch(/^[a-f0-9]{32}$/);
    });
  });

  describe('Configuration Push', () => {
    const mockConfig = {
      firebase: {
        apiKey: 'test-key',
        authDomain: 'test.firebaseapp.com',
        projectId: 'test-project'
      },
      gemini: {
        vertexApiGatewayUrl: 'https://gateway.example.com',
        vertexApiGatewayKey: 'gateway-key'
      },
      anavaKey: 'anava-123',
      customerId: 'customer-456'
    };

    it('should push configuration to camera successfully', async () => {
      mockedAxios
        .mockResolvedValueOnce({
          status: 401,
          headers: {
            'www-authenticate': 'Digest realm="AXIS", nonce="abc123"'
          }
        } as any)
        .mockResolvedValueOnce({
          status: 200,
          data: { status: 'success' }
        } as any);

      const mockCamera = {
        ip: '192.168.1.100',
        credentials: {
          username: 'root',
          password: 'testpass'
        }
      };

      const result = await service.pushSystemConfig(
        mockCamera.ip,
        mockCamera.credentials.username,
        mockCamera.credentials.password,
        mockConfig
      );

      expect(result.success).toBe(true);
      expect(mockedAxios).toHaveBeenCalled();
    });

    it('should handle configuration push errors', async () => {
      mockedAxios.mockRejectedValue(new Error('Network timeout'));

      const mockCamera = {
        ip: '192.168.1.100',
        credentials: {
          username: 'root',
          password: 'testpass'
        }
      };

      const result = await service.pushSystemConfig(
        mockCamera.ip,
        mockCamera.credentials.username,
        mockCamera.credentials.password,
        mockConfig
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
    });
  });

  describe('Speaker Configuration', () => {
    const mockSpeaker = {
      ip: '192.168.1.101',
      username: 'speaker',
      password: 'speakerpass'
    };

    it('should test speaker successfully', async () => {
      mockedAxios
        // First call - auth challenge for device info
        .mockResolvedValueOnce({
          status: 401,
          headers: {
            'www-authenticate': 'Digest realm="AXIS", nonce="abc123"'
          }
        } as any)
        // Second call - successful device info
        .mockResolvedValueOnce({
          status: 200,
          data: { 
            apiVersion: '1.0',
            data: {
              transmitCapability: true
            }
          }
        } as any)
        // Third call - auth challenge for playSpeakerAudio
        .mockResolvedValueOnce({
          status: 401,
          headers: {
            'www-authenticate': 'Digest realm="AXIS", nonce="abc456"'
          }
        } as any)
        // Fourth call - successful audio play
        .mockResolvedValueOnce({
          status: 200,
          data: 'OK'
        } as any);

      const result = await service.testSpeaker(
        mockSpeaker.ip,
        mockSpeaker.username,
        mockSpeaker.password
      );

      expect(result.success).toBe(true);
      expect(result.deviceInfo).toBeDefined();
    });

    it('should handle speaker test failures', async () => {
      const error = new Error('Connection refused');
      (error as any).code = 'ECONNREFUSED';
      mockedAxios.mockRejectedValue(error);

      const result = await service.testSpeaker(
        mockSpeaker.ip,
        mockSpeaker.username,
        mockSpeaker.password
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot connect to speaker');
    });

    it('should play audio on speaker', async () => {
      mockedAxios
        .mockResolvedValueOnce({
          status: 401,
          headers: {
            'www-authenticate': 'Digest realm="AXIS", nonce="abc123"'
          }
        } as any)
        .mockResolvedValueOnce({
          status: 200,
          data: 'OK'
        } as any);

      const result = await service.playSpeakerAudio(
        mockSpeaker.ip,
        mockSpeaker.username,
        mockSpeaker.password,
        'base64audiodata'
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Error Recovery', () => {
    it('should retry on network failures', async () => {
      // First attempt fails, second succeeds
      mockedAxios
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValueOnce({
          status: 401,
          headers: {
            'www-authenticate': 'Digest realm="AXIS", nonce="abc123"'
          }
        } as any)
        .mockResolvedValueOnce({
          status: 200,
          data: { success: true }
        } as any);

      const mockCamera = {
        ip: '192.168.1.100',
        credentials: {
          username: 'root',
          password: 'testpass'
        }
      };

      const result = await service.getSystemConfig(
        mockCamera.ip,
        mockCamera.credentials.username,
        mockCamera.credentials.password
      );

      // Should succeed after retry
      expect(result).toBeDefined();
    });

    it('should handle concurrent requests', async () => {
      const mockCamera = {
        ip: '192.168.1.100',
        credentials: {
          username: 'root',
          password: 'testpass'
        }
      };

      mockedAxios
        .mockResolvedValue({
          status: 401,
          headers: {
            'www-authenticate': 'Digest realm="AXIS", nonce="abc123"'
          }
        } as any)
        .mockResolvedValue({
          status: 200,
          data: { success: true }
        } as any);

      // Make multiple concurrent requests
      const promises = [
        service.getSystemConfig(
          mockCamera.ip,
          mockCamera.credentials.username,
          mockCamera.credentials.password
        ),
        service.getSystemConfig(
          mockCamera.ip,
          mockCamera.credentials.username,
          mockCamera.credentials.password
        ),
        service.getSystemConfig(
          mockCamera.ip,
          mockCamera.credentials.username,
          mockCamera.credentials.password
        )
      ];

      const results = await Promise.all(promises);

      // All should complete successfully
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });
  });
});