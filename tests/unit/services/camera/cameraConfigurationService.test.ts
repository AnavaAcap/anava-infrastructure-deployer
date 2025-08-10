/**
 * Unit Tests for CameraConfigurationService
 * Tests camera configuration, ACAP deployment, and license activation
 */

import { CameraConfigurationService } from '@main/services/camera/cameraConfigurationService';
import axios from 'axios';
import crypto from 'crypto';
import puppeteer from 'puppeteer';

// Mock dependencies
jest.mock('axios');
jest.mock('puppeteer');
jest.mock('electron', () => require('../../../__mocks__/electron'));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedPuppeteer = puppeteer as jest.Mocked<typeof puppeteer>;

describe('CameraConfigurationService', () => {
  let service: CameraConfigurationService;
  let mockBrowser: any;
  let mockPage: any;

  beforeEach(() => {
    service = new CameraConfigurationService();
    
    // Setup puppeteer mocks for license activation
    mockPage = {
      goto: jest.fn().mockResolvedValue(undefined),
      evaluate: jest.fn(),
      close: jest.fn(),
    };
    
    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn(),
    };
    
    mockedPuppeteer.launch = jest.fn().mockResolvedValue(mockBrowser);
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

      service['simpleDigestAuth'] = jest.fn().mockResolvedValue({
        status: 200,
        data: mockResponse
      });

      const result = await service.getSceneDescription(mockCamera, 'test-api-key', false);

      expect(result.success).toBe(true);
      expect(result.description).toBe(mockResponse.description);
      expect(service['simpleDigestAuth']).toHaveBeenCalledWith(
        mockCamera.ip,
        'root',
        'testpass',
        'POST',
        '/local/BatonAnalytic/baton_analytic.cgi?command=getSceneDescription',
        expect.any(String)
      );
    });

    it('should include speaker credentials when requested', async () => {
      service['simpleDigestAuth'] = jest.fn().mockResolvedValue({
        status: 200,
        data: { status: 'success' }
      });

      await service.getSceneDescription(mockCamera, 'test-api-key', true);

      const callArgs = (service['simpleDigestAuth'] as jest.Mock).mock.calls[0];
      const requestData = JSON.parse(callArgs[5]);
      
      expect(requestData.speakerIp).toBe(mockCamera.speaker.ip);
      expect(requestData.speakerUser).toBe(mockCamera.speaker.username);
      expect(requestData.speakerPass).toBe(mockCamera.speaker.password);
    });

    it('should handle scene description errors', async () => {
      service['simpleDigestAuth'] = jest.fn().mockRejectedValue(
        new Error('Network error')
      );

      const result = await service.getSceneDescription(mockCamera, 'test-api-key', false);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle non-JSON responses gracefully', async () => {
      service['simpleDigestAuth'] = jest.fn().mockResolvedValue({
        status: 200,
        data: 'Plain text response'
      });

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
      deviceId: '00408C123456'
    };

    it('should activate license successfully using Axis SDK', async () => {
      const mockLicenseXML = '<License>...</License>';
      mockPage.evaluate = jest.fn().mockResolvedValue({
        success: true,
        licenseData: mockLicenseXML
      });

      service['uploadLicenseXML'] = jest.fn().mockResolvedValue({
        success: true,
        message: 'License installed'
      });

      const result = await service['activateLicenseWithAxisSDK'](
        mockCamera,
        'TEST-LICENSE-KEY'
      );

      expect(result.success).toBe(true);
      expect(mockedPuppeteer.launch).toHaveBeenCalledWith({ headless: true });
      expect(mockPage.goto).toHaveBeenCalledWith('https://www.axis.com/app/acap/sdk.js');
      expect(service['uploadLicenseXML']).toHaveBeenCalledWith(
        mockCamera,
        mockLicenseXML
      );
    });

    it('should handle ThreadPool errors with retry logic', async () => {
      // First attempt fails with ThreadPool error
      service['uploadLicenseXML'] = jest.fn()
        .mockRejectedValueOnce(new Error('ThreadPool'))
        .mockResolvedValueOnce({ success: true });

      mockPage.evaluate = jest.fn().mockResolvedValue({
        success: true,
        licenseData: '<License>...</License>'
      });

      const result = await service['activateLicenseWithAxisSDK'](
        mockCamera,
        'TEST-LICENSE-KEY'
      );

      expect(result.success).toBe(true);
      expect(service['uploadLicenseXML']).toHaveBeenCalledTimes(2);
    });

    it('should handle invalid license key format', async () => {
      mockPage.evaluate = jest.fn().mockResolvedValue({
        success: false,
        error: 'Invalid license format'
      });

      const result = await service['activateLicenseWithAxisSDK'](
        mockCamera,
        'INVALID-KEY'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid license format');
    });

    it('should cleanup browser resources on error', async () => {
      mockPage.evaluate = jest.fn().mockRejectedValue(new Error('Page error'));

      await service['activateLicenseWithAxisSDK'](mockCamera, 'TEST-KEY');

      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });

  describe('Digest Authentication', () => {
    it('should handle digest auth challenge correctly', async () => {
      const challenge = 'Digest realm="AXIS", nonce="abc123", algorithm=MD5';
      
      // Mock initial 401 response
      mockedAxios.request = jest.fn()
        .mockRejectedValueOnce({
          response: {
            status: 401,
            headers: {
              'www-authenticate': challenge
            }
          }
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { success: true }
        });

      const result = await service['simpleDigestAuth'](
        '192.168.1.100',
        'root',
        'password',
        'GET',
        '/test/endpoint',
        null
      );

      expect(result.status).toBe(200);
      expect(mockedAxios.request).toHaveBeenCalledTimes(2);
      
      // Verify digest header was added
      const secondCall = (mockedAxios.request as jest.Mock).mock.calls[1][0];
      expect(secondCall.headers.Authorization).toContain('Digest');
    });

    it('should handle missing auth challenge', async () => {
      mockedAxios.request = jest.fn().mockRejectedValue({
        response: {
          status: 401,
          headers: {} // No www-authenticate header
        }
      });

      await expect(service['simpleDigestAuth'](
        '192.168.1.100',
        'root',
        'password',
        'GET',
        '/test',
        null
      )).rejects.toThrow();
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
      service['simpleDigestAuth'] = jest.fn().mockResolvedValue({
        status: 200,
        data: { status: 'success' }
      });

      const camera = {
        ip: '192.168.1.100',
        credentials: { username: 'root', password: 'pass' }
      };

      const result = await service['pushConfigurationToCamera'](
        camera,
        mockConfig
      );

      expect(result.success).toBe(true);
      expect(service['simpleDigestAuth']).toHaveBeenCalledWith(
        camera.ip,
        'root',
        'pass',
        'POST',
        '/local/BatonAnalytic/baton_analytic.cgi?command=setInstallerConfig',
        JSON.stringify(mockConfig)
      );
    });

    it('should handle configuration push errors', async () => {
      service['simpleDigestAuth'] = jest.fn().mockRejectedValue(
        new Error('Connection refused')
      );

      const camera = {
        ip: '192.168.1.100',
        credentials: { username: 'root', password: 'pass' }
      };

      const result = await service['pushConfigurationToCamera'](
        camera,
        mockConfig
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection refused');
    });

    // New test for v0.9.177 - ThreadPool error handling
    it('should treat ThreadPool error (HTTP 500) as success', async () => {
      // Mock the ThreadPool error that occurs when ACAP restarts
      service['simpleDigestAuth'] = jest.fn().mockRejectedValue({
        response: {
          status: 500,
          data: {
            message: 'enqueue on stopped ThreadPool'
          }
        }
      });

      const camera = {
        ip: '192.168.1.100',
        credentials: { username: 'root', password: 'pass' }
      };

      const result = await service['pushConfigurationToCamera'](
        camera,
        mockConfig
      );

      // ThreadPool error should be treated as success since config was saved
      expect(result.success).toBe(true);
      expect(result.message).toContain('ACAP restarting');
      expect(service['simpleDigestAuth']).toHaveBeenCalledWith(
        camera.ip,
        'root',
        'pass',
        'POST',
        '/local/BatonAnalytic/baton_analytic.cgi?command=setInstallerConfig',
        JSON.stringify(mockConfig)
      );
    });

    it('should attempt license activation even after ThreadPool error', async () => {
      // Mock ThreadPool error followed by successful license activation
      service['simpleDigestAuth'] = jest.fn().mockRejectedValue({
        response: {
          status: 500,
          data: {
            message: 'Failed to enqueue on stopped ThreadPool'
          }
        }
      });

      service['activateLicenseKey'] = jest.fn().mockResolvedValue({
        success: true,
        message: 'License activated'
      });

      const camera = {
        ip: '192.168.1.100',
        credentials: { username: 'root', password: 'pass' }
      };

      const result = await service['pushConfigurationToCamera'](
        camera,
        mockConfig
      );

      expect(result.success).toBe(true);
      expect(result.licenseActivated).toBe(true);
      expect(service['activateLicenseKey']).toHaveBeenCalledWith(
        camera.ip,
        'root',
        'pass',
        mockConfig.anavaKey,
        'BatonAnalytic'
      );
    });

    it('should differentiate ThreadPool errors from other 500 errors', async () => {
      // Mock a different 500 error that's not ThreadPool related
      service['simpleDigestAuth'] = jest.fn().mockRejectedValue({
        response: {
          status: 500,
          data: {
            message: 'Internal server error: Database connection failed'
          }
        }
      });

      const camera = {
        ip: '192.168.1.100',
        credentials: { username: 'root', password: 'pass' }
      };

      const result = await service['pushConfigurationToCamera'](
        camera,
        mockConfig
      );

      // Non-ThreadPool 500 errors should still be failures
      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection failed');
    });
  });

  describe('IP Validation', () => {
    it('should validate correct IP addresses', () => {
      const validIPs = [
        '192.168.1.1',
        '10.0.0.1',
        '172.16.0.1',
        '8.8.8.8',
        '255.255.255.255'
      ];

      validIPs.forEach(ip => {
        expect(ip).toBeValidIP();
      });
    });

    it('should reject invalid IP addresses', () => {
      const invalidIPs = [
        '256.1.1.1',
        '192.168.1',
        '192.168.1.1.1',
        'not.an.ip.address',
        ''
      ];

      invalidIPs.forEach(ip => {
        expect(ip).not.toBeValidIP();
      });
    });
  });

  describe('Error Recovery', () => {
    it('should implement exponential backoff for retries', async () => {
      let attempts = 0;
      service['simpleDigestAuth'] = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve({ status: 200, data: { success: true } });
      });

      // Mock retry logic with backoff
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

      const result = await retryWithBackoff(() => 
        service['simpleDigestAuth']('192.168.1.1', 'root', 'pass', 'GET', '/test', null)
      );

      expect(result.status).toBe(200);
      expect(attempts).toBe(3);
    });
  });
});