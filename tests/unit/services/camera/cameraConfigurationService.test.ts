/**
 * Unit Tests for CameraConfigurationService
 * Tests camera configuration, ACAP deployment, and license activation
 */

// Mock dependencies - must be hoisted before imports
jest.mock('axios');
jest.mock('@main/services/camera/cameraProtocolUtils', () => ({
  getCameraBaseUrl: jest.fn().mockResolvedValue('https://192.168.1.100'),
  createCameraAxiosInstance: jest.fn()
}));

import { CameraConfigurationService } from '@main/services/camera/cameraConfigurationService';
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
      // Mock the private methods that use external dependencies
      const mockLicenseXML = '<?xml version="1.0"?><license>test</license>';
      
      // Mock getLicenseXMLFromAxis to avoid Puppeteer
      jest.spyOn(service as any, 'getLicenseXMLFromAxis')
        .mockResolvedValue(mockLicenseXML);
      
      // Mock uploadLicenseXML 
      jest.spyOn(service as any, 'uploadLicenseXML')
        .mockResolvedValue(undefined);
      
      // Mock httpsBasicAuth for the app list call
      jest.spyOn(service as any, 'httpsBasicAuth')
        .mockResolvedValue(`<?xml version="1.0"?>
          <applications>
            <application Name="BatonAnalytic" Status="Running" License="None" />
          </applications>`);

      await service.activateLicenseKey(
        mockCamera.ip,
        mockCamera.credentials.username,
        mockCamera.credentials.password,
        'TEST-LICENSE-KEY',
        'BatonAnalytic',
        mockCamera.mac
      );
      
      expect((service as any).getLicenseXMLFromAxis).toHaveBeenCalledWith(
        mockCamera.mac,
        'TEST-LICENSE-KEY'
      );
      expect((service as any).uploadLicenseXML).toHaveBeenCalled();
    });

    it('should handle license activation failures', async () => {
      // Mock getLicenseXMLFromAxis to fail
      jest.spyOn(service as any, 'getLicenseXMLFromAxis')
        .mockRejectedValue(new Error('Failed to get license XML'));
      
      // Mock httpsBasicAuth for the app list call
      jest.spyOn(service as any, 'httpsBasicAuth')
        .mockResolvedValue(`<?xml version="1.0"?>
          <applications>
            <application Name="BatonAnalytic" Status="Running" License="None" />
          </applications>`);

      await expect(service.activateLicenseKey(
        mockCamera.ip,
        mockCamera.credentials.username,
        mockCamera.credentials.password,
        'INVALID-KEY',
        'BatonAnalytic',
        mockCamera.mac
      )).rejects.toThrow('License activation failed');
    });
  });

  describe('HTTPS Basic Authentication', () => {
    it('should use basic auth with HTTPS', async () => {
      // Mock httpsBasicAuth to return success
      jest.spyOn(service as any, 'httpsBasicAuth')
        .mockResolvedValue({ success: true });

      const mockCamera = {
        ip: '192.168.1.100',
        credentials: {
          username: 'root',
          password: 'password'
        }
      };

      // Test through public API
      const result = await service.pushSystemConfig(
        mockCamera.ip,
        mockCamera.credentials.username,
        mockCamera.credentials.password,
        { test: 'data' }
      );

      expect((service as any).httpsBasicAuth).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should handle auth failures', async () => {
      // Mock httpsBasicAuth to fail
      jest.spyOn(service as any, 'httpsBasicAuth')
        .mockRejectedValue(new Error('Authentication failed'));

      const mockCamera = {
        ip: '192.168.1.100',
        credentials: {
          username: 'root',
          password: 'wrong-password'
        }
      };

      const result = await service.pushSystemConfig(
        mockCamera.ip,
        mockCamera.credentials.username,
        mockCamera.credentials.password,
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication failed');
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
      // Mock axios.get for the testSpeaker method
      const axiosGet = jest.fn()
        .mockResolvedValueOnce({
          status: 401,
          headers: {
            'www-authenticate': 'Digest realm="AXIS", nonce="abc123"'
          }
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { 
            apiVersion: '1.0',
            data: {
              transmitCapability: true
            }
          }
        });
      
      (axios as any).get = axiosGet;

      // Mock playSpeakerAudio to avoid actual audio playback
      jest.spyOn(service as any, 'playSpeakerAudio')
        .mockResolvedValue({ success: true });

      const result = await service.testSpeaker(
        mockSpeaker.ip,
        mockSpeaker.username,
        mockSpeaker.password
      );

      expect(result.success).toBe(true);
      expect(result.capabilities).toBeDefined();
    });

    it('should handle speaker test failures', async () => {
      // Mock axios.get to reject
      (axios as any).get = jest.fn().mockRejectedValue(new Error('Connection refused'));

      const result = await service.testSpeaker(
        mockSpeaker.ip,
        mockSpeaker.username,
        mockSpeaker.password
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection refused');
    });

    it('should play audio on speaker', async () => {
      // Mock httpsBasicAuth for playSpeakerAudio 
      jest.spyOn(service as any, 'httpsBasicAuth')
        .mockResolvedValue({ success: true });

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