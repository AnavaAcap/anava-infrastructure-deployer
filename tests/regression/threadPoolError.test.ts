/**
 * Regression Tests for ThreadPool Error Handling (v0.9.177)
 * Ensures ThreadPool errors are correctly treated as success
 * Prevents regression of false negative when ACAP restarts
 */

import { CameraConfigurationService } from '@main/services/camera/cameraConfigurationService';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ThreadPool Error Regression Tests', () => {
  let configService: CameraConfigurationService;

  beforeEach(() => {
    configService = new CameraConfigurationService();
    jest.clearAllMocks();
  });

  describe('ThreadPool Error Scenarios', () => {
    const testConfig = {
      firebase: {
        apiKey: 'test-key',
        authDomain: 'test.firebaseapp.com',
        projectId: 'test-project',
        storageBucket: 'test-bucket',
        messagingSenderId: '123456',
        appId: '1:123456:web:abc',
        databaseId: '(default)'
      },
      gemini: {
        vertexApiGatewayUrl: 'https://gateway.example.com',
        vertexApiGatewayKey: 'key-123',
        vertexGcpProjectId: 'test-project',
        vertexGcpRegion: 'us-central1',
        vertexGcsBucketName: 'test-bucket'
      },
      anavaKey: 'ANAVA-TEST-KEY',
      customerId: 'customer-123'
    };

    const camera = {
      ip: '192.168.1.100',
      credentials: {
        username: 'root',
        password: 'testpass'
      }
    };

    /**
     * CRITICAL REGRESSION TEST
     * This test ensures that the ThreadPool error is treated as success
     * Previously, this error was incorrectly treated as a failure
     */
    it('MUST treat "enqueue on stopped ThreadPool" as success', async () => {
      configService['simpleDigestAuth'] = jest.fn().mockRejectedValue({
        response: {
          status: 500,
          data: {
            message: 'enqueue on stopped ThreadPool'
          }
        }
      });

      const result = await configService.pushConfigurationToCamera(camera, testConfig);

      // CRITICAL ASSERTION: Must be true
      expect(result.success).toBe(true);
      expect(result.message).toContain('ACAP restarting');
      
      // Verify we called the endpoint
      expect(configService['simpleDigestAuth']).toHaveBeenCalledWith(
        camera.ip,
        camera.credentials.username,
        camera.credentials.password,
        'POST',
        '/local/BatonAnalytic/baton_analytic.cgi?command=setInstallerConfig',
        JSON.stringify(testConfig)
      );
    });

    /**
     * Test various ThreadPool error message formats
     * The error message might vary slightly
     */
    it('should handle different ThreadPool error message variations', async () => {
      const threadPoolVariations = [
        'enqueue on stopped ThreadPool',
        'Failed to enqueue on stopped ThreadPool',
        'Cannot enqueue on stopped ThreadPool',
        'Error: enqueue on stopped ThreadPool',
        'ThreadPool has been stopped'
      ];

      for (const errorMessage of threadPoolVariations) {
        configService['simpleDigestAuth'] = jest.fn().mockRejectedValue({
          response: {
            status: 500,
            data: {
              message: errorMessage
            }
          }
        });

        const result = await configService.pushConfigurationToCamera(camera, testConfig);

        if (errorMessage.includes('ThreadPool')) {
          expect(result.success).toBe(true);
          expect(result.message).toContain('ACAP restarting');
        }
      }
    });

    /**
     * Ensure we don't treat all 500 errors as success
     * Only ThreadPool errors should be treated as success
     */
    it('should NOT treat non-ThreadPool 500 errors as success', async () => {
      const nonThreadPoolErrors = [
        'Internal server error',
        'Database connection failed',
        'Memory allocation error',
        'Segmentation fault',
        'Unknown error occurred'
      ];

      for (const errorMessage of nonThreadPoolErrors) {
        configService['simpleDigestAuth'] = jest.fn().mockRejectedValue({
          response: {
            status: 500,
            data: {
              message: errorMessage
            }
          }
        });

        const result = await configService.pushConfigurationToCamera(camera, testConfig);

        // These should remain as failures
        expect(result.success).toBe(false);
        expect(result.error).toContain(errorMessage);
      }
    });

    /**
     * Test that license activation is attempted even after ThreadPool error
     */
    it('should still attempt license activation after ThreadPool error', async () => {
      configService['simpleDigestAuth'] = jest.fn().mockRejectedValue({
        response: {
          status: 500,
          data: {
            message: 'enqueue on stopped ThreadPool'
          }
        }
      });

      configService['activateLicenseKey'] = jest.fn().mockResolvedValue({
        success: true,
        message: 'License activated successfully'
      });

      const result = await configService.pushConfigurationToCamera(camera, testConfig);

      expect(result.success).toBe(true);
      expect(result.licenseActivated).toBe(true);
      expect(configService['activateLicenseKey']).toHaveBeenCalledWith(
        camera.ip,
        camera.credentials.username,
        camera.credentials.password,
        testConfig.anavaKey,
        'BatonAnalytic'
      );
    });

    /**
     * Test that ThreadPool error is logged correctly for debugging
     */
    it('should log ThreadPool error correctly for debugging', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      configService['simpleDigestAuth'] = jest.fn().mockRejectedValue({
        response: {
          status: 500,
          data: {
            message: 'enqueue on stopped ThreadPool'
          }
        }
      });

      await configService.pushConfigurationToCamera(camera, testConfig);

      // Verify logging for debugging purposes
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('ThreadPool error')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Treating as success')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('ThreadPool Error Edge Cases', () => {
    /**
     * Test ThreadPool error with missing response data
     */
    it('should handle ThreadPool error with missing response data', async () => {
      configService['simpleDigestAuth'] = jest.fn().mockRejectedValue({
        response: {
          status: 500,
          // No data field
        }
      });

      const result = await configService.pushConfigurationToCamera(
        { ip: '192.168.1.100', credentials: { username: 'root', password: 'pass' } },
        {} as any
      );

      // Should handle gracefully, treat as regular error
      expect(result.success).toBe(false);
    });

    /**
     * Test ThreadPool error with null message
     */
    it('should handle ThreadPool error with null message', async () => {
      configService['simpleDigestAuth'] = jest.fn().mockRejectedValue({
        response: {
          status: 500,
          data: {
            message: null
          }
        }
      });

      const result = await configService.pushConfigurationToCamera(
        { ip: '192.168.1.100', credentials: { username: 'root', password: 'pass' } },
        {} as any
      );

      // Should handle gracefully
      expect(result.success).toBe(false);
    });

    /**
     * Test ThreadPool error case sensitivity
     */
    it('should handle ThreadPool error case-insensitively', async () => {
      const caseVariations = [
        'enqueue on stopped threadpool',
        'ENQUEUE ON STOPPED THREADPOOL',
        'Enqueue On Stopped ThreadPool',
        'enqueue on stopped THREADPOOL'
      ];

      for (const errorMessage of caseVariations) {
        configService['simpleDigestAuth'] = jest.fn().mockRejectedValue({
          response: {
            status: 500,
            data: {
              message: errorMessage
            }
          }
        });

        const result = await configService.pushConfigurationToCamera(
          { ip: '192.168.1.100', credentials: { username: 'root', password: 'pass' } },
          {} as any
        );

        // Should recognize ThreadPool error regardless of case
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Performance Impact of ThreadPool Error Handling', () => {
    /**
     * Ensure ThreadPool error handling doesn't introduce delays
     */
    it('should handle ThreadPool error without unnecessary delays', async () => {
      configService['simpleDigestAuth'] = jest.fn().mockRejectedValue({
        response: {
          status: 500,
          data: {
            message: 'enqueue on stopped ThreadPool'
          }
        }
      });

      const startTime = Date.now();
      await configService.pushConfigurationToCamera(
        { ip: '192.168.1.100', credentials: { username: 'root', password: 'pass' } },
        {} as any
      );
      const endTime = Date.now();

      // Should complete quickly (< 100ms for error handling)
      expect(endTime - startTime).toBeLessThan(100);
    });

    /**
     * Test that multiple ThreadPool errors are handled efficiently
     */
    it('should handle multiple concurrent ThreadPool errors efficiently', async () => {
      configService['simpleDigestAuth'] = jest.fn().mockRejectedValue({
        response: {
          status: 500,
          data: {
            message: 'enqueue on stopped ThreadPool'
          }
        }
      });

      const cameras = Array.from({ length: 10 }, (_, i) => ({
        ip: `192.168.1.${100 + i}`,
        credentials: { username: 'root', password: 'pass' }
      }));

      const startTime = Date.now();
      const results = await Promise.all(
        cameras.map(camera => 
          configService.pushConfigurationToCamera(camera, {} as any)
        )
      );
      const endTime = Date.now();

      // All should succeed
      expect(results.every(r => r.success)).toBe(true);
      
      // Should complete all 10 in reasonable time (< 500ms)
      expect(endTime - startTime).toBeLessThan(500);
    });
  });

  describe('Backward Compatibility', () => {
    /**
     * Ensure old behavior is preserved for non-ThreadPool errors
     */
    it('should maintain backward compatibility for other error types', async () => {
      const errorTypes = [
        { status: 401, message: 'Unauthorized' },
        { status: 403, message: 'Forbidden' },
        { status: 404, message: 'Not found' },
        { status: 408, message: 'Request timeout' },
        { status: 503, message: 'Service unavailable' }
      ];

      for (const error of errorTypes) {
        configService['simpleDigestAuth'] = jest.fn().mockRejectedValue({
          response: {
            status: error.status,
            data: {
              message: error.message
            }
          }
        });

        const result = await configService.pushConfigurationToCamera(
          { ip: '192.168.1.100', credentials: { username: 'root', password: 'pass' } },
          {} as any
        );

        // All non-ThreadPool errors should fail
        expect(result.success).toBe(false);
        expect(result.error).toContain(error.message);
      }
    });
  });
});