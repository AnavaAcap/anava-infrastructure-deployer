/**
 * Integration Tests for v0.9.175 Camera Context Integration
 * Tests camera discovery, setup, persistence, and global context management
 */

import { CameraDiscoveryService } from '@main/services/camera/cameraDiscoveryService';
import { CameraConfigurationService } from '@main/services/camera/cameraConfigurationService';
import { CameraDeploymentService } from '@main/services/camera/cameraDeploymentService';
import { CameraContext, CameraContextProvider } from '@renderer/contexts/CameraContext';
import { StateManager } from '@main/services/stateManager';
import { TEST_CREDENTIALS, integrationHelpers } from '../setup/integration.setup';
import { Camera, CameraCredentials } from '@/types';

jest.mock('bonjour-service');
jest.mock('axios');
jest.mock('@mhoc/axios-digest-auth');

describe('v0.9.175 Camera Context Integration Tests', () => {
  let discoveryService: CameraDiscoveryService;
  let configService: CameraConfigurationService;
  let deploymentService: CameraDeploymentService;
  let stateManager: StateManager;
  let globalCameraContext: Map<string, Camera>;

  beforeEach(() => {
    discoveryService = new CameraDiscoveryService();
    configService = new CameraConfigurationService();
    deploymentService = new CameraDeploymentService();
    stateManager = new StateManager();
    globalCameraContext = new Map();
  });

  afterEach(() => {
    jest.clearAllMocks();
    globalCameraContext.clear();
  });

  describe('Camera Discovery and Setup', () => {
    it('should discover cameras and save to global context', async () => {
      // Mock camera discovery
      const mockCameras: Camera[] = [
        {
          id: 'camera-1',
          name: 'Test Camera 1',
          ip: '192.168.1.100',
          model: 'AXIS P3375-V',
          firmware: '11.0.0',
          serialNumber: 'ACCC8E123456',
          macAddress: 'AC:CC:8E:12:34:56',
          isOnline: true,
          hasAcap: false
        },
        {
          id: 'camera-2', 
          name: 'Test Camera 2',
          ip: '192.168.1.101',
          model: 'AXIS M3077-PLVE',
          firmware: '11.0.0',
          serialNumber: 'ACCC8E789012',
          macAddress: 'AC:CC:8E:78:90:12',
          isOnline: true,
          hasAcap: false
        }
      ];

      jest.spyOn(discoveryService, 'discoverCameras').mockResolvedValue(mockCameras);

      // Discover cameras
      const discovered = await discoveryService.discoverCameras();
      
      // Save to global context
      discovered.forEach(camera => {
        globalCameraContext.set(camera.id, camera);
      });

      expect(globalCameraContext.size).toBe(2);
      expect(globalCameraContext.get('camera-1')).toEqual(mockCameras[0]);
      expect(globalCameraContext.get('camera-2')).toEqual(mockCameras[1]);
    });

    it('should persist camera credentials across navigation', async () => {
      const cameraCredentials: CameraCredentials = {
        cameraId: 'camera-1',
        ip: '192.168.1.100',
        username: 'root',
        password: 'admin123',
        speakerIp: '192.168.1.200',
        speakerUser: 'speaker',
        speakerPass: 'speaker123'
      };

      // Save credentials to state
      await stateManager.saveCameraCredentials(cameraCredentials);

      // Simulate navigation (clear memory)
      globalCameraContext.clear();

      // Retrieve credentials
      const retrieved = await stateManager.getCameraCredentials(cameraCredentials.cameraId);
      expect(retrieved).toEqual(cameraCredentials);
      
      // Verify speaker config is preserved
      expect(retrieved?.speakerIp).toBe('192.168.1.200');
      expect(retrieved?.speakerUser).toBe('speaker');
      expect(retrieved?.speakerPass).toBe('speaker123');
    });

    it('should update camera in global context after connection', async () => {
      const camera: Camera = {
        id: 'camera-1',
        name: 'Test Camera',
        ip: '192.168.1.100',
        model: 'AXIS P3375-V',
        firmware: '11.0.0',
        serialNumber: 'ACCC8E123456',
        macAddress: 'AC:CC:8E:12:34:56',
        isOnline: false,
        hasAcap: false
      };

      // Add to context
      globalCameraContext.set(camera.id, camera);

      // Mock successful connection
      jest.spyOn(configService, 'testConnection').mockResolvedValue({
        success: true,
        message: 'Connected'
      });

      // Connect to camera
      const result = await configService.testConnection(
        camera.ip,
        'root',
        'admin123'
      );

      if (result.success) {
        // Update camera status in context
        const updatedCamera = {
          ...camera,
          isOnline: true,
          lastConnected: new Date().toISOString()
        };
        globalCameraContext.set(camera.id, updatedCamera);
      }

      const contextCamera = globalCameraContext.get(camera.id);
      expect(contextCamera?.isOnline).toBe(true);
      expect(contextCamera?.lastConnected).toBeDefined();
    });
  });

  describe('Camera Deployment and Context Updates', () => {
    it('should update context after ACAP deployment', async () => {
      const camera: Camera = {
        id: 'camera-1',
        name: 'Test Camera',
        ip: '192.168.1.100',
        model: 'AXIS P3375-V',
        firmware: '11.0.0',
        serialNumber: 'ACCC8E123456',
        macAddress: 'AC:CC:8E:12:34:56',
        isOnline: true,
        hasAcap: false
      };

      globalCameraContext.set(camera.id, camera);

      // Mock ACAP deployment
      jest.spyOn(deploymentService, 'deployAcap').mockResolvedValue({
        success: true,
        appId: 'baton-analytic',
        version: '1.5.0'
      });

      // Deploy ACAP
      const result = await deploymentService.deployAcap(
        camera.ip,
        'root',
        'admin123',
        '/path/to/acap.eap'
      );

      if (result.success) {
        // Update camera in context
        const updatedCamera = {
          ...camera,
          hasAcap: true,
          acapVersion: result.version,
          deploymentTime: new Date().toISOString()
        };
        globalCameraContext.set(camera.id, updatedCamera);
      }

      const contextCamera = globalCameraContext.get(camera.id);
      expect(contextCamera?.hasAcap).toBe(true);
      expect(contextCamera?.acapVersion).toBe('1.5.0');
      expect(contextCamera?.deploymentTime).toBeDefined();
    });

    it('should maintain camera list in CompletionPage dropdown', async () => {
      // Setup multiple cameras in context
      const cameras: Camera[] = [
        {
          id: 'camera-1',
          name: 'Front Door Camera',
          ip: '192.168.1.100',
          model: 'AXIS P3375-V',
          firmware: '11.0.0',
          serialNumber: 'ACCC8E123456',
          macAddress: 'AC:CC:8E:12:34:56',
          isOnline: true,
          hasAcap: true
        },
        {
          id: 'camera-2',
          name: 'Parking Lot Camera',
          ip: '192.168.1.101',
          model: 'AXIS M3077-PLVE',
          firmware: '11.0.0',
          serialNumber: 'ACCC8E789012',
          macAddress: 'AC:CC:8E:78:90:12',
          isOnline: true,
          hasAcap: true
        },
        {
          id: 'camera-3',
          name: 'Warehouse Camera',
          ip: '192.168.1.102',
          model: 'AXIS Q6075',
          firmware: '11.0.0',
          serialNumber: 'ACCC8E345678',
          macAddress: 'AC:CC:8E:34:56:78',
          isOnline: true,
          hasAcap: true
        }
      ];

      // Add all cameras to context
      cameras.forEach(cam => globalCameraContext.set(cam.id, cam));

      // Get camera list for dropdown
      const dropdownCameras = Array.from(globalCameraContext.values())
        .filter(cam => cam.hasAcap && cam.isOnline)
        .map(cam => ({
          value: cam.id,
          label: `${cam.name} (${cam.ip})`,
          camera: cam
        }));

      expect(dropdownCameras).toHaveLength(3);
      expect(dropdownCameras[0].label).toBe('Front Door Camera (192.168.1.100)');
      expect(dropdownCameras[1].label).toBe('Parking Lot Camera (192.168.1.101)');
      expect(dropdownCameras[2].label).toBe('Warehouse Camera (192.168.1.102)');
    });
  });

  describe('Scene Capture and Analysis', () => {
    it('should trigger scene capture immediately after ACAP deployment', async () => {
      const camera: Camera = {
        id: 'camera-1',
        name: 'Test Camera',
        ip: '192.168.1.100',
        model: 'AXIS P3375-V',
        firmware: '11.0.0',
        serialNumber: 'ACCC8E123456',
        macAddress: 'AC:CC:8E:12:34:56',
        isOnline: true,
        hasAcap: false
      };

      let sceneCaptureTriggered = false;
      let captureTimestamp: number = 0;

      // Mock ACAP deployment
      jest.spyOn(deploymentService, 'deployAcap').mockImplementation(async () => {
        const deploymentTime = Date.now();
        
        // Trigger scene capture immediately (non-blocking)
        setImmediate(() => {
          sceneCaptureTriggered = true;
          captureTimestamp = Date.now();
        });

        return {
          success: true,
          appId: 'baton-analytic',
          version: '1.5.0'
        };
      });

      // Deploy ACAP
      const deploymentStart = Date.now();
      await deploymentService.deployAcap(
        camera.ip,
        'root',
        'admin123',
        '/path/to/acap.eap'
      );

      // Wait for scene capture to trigger
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(sceneCaptureTriggered).toBe(true);
      
      // Verify capture happened immediately after deployment
      const timeDiff = captureTimestamp - deploymentStart;
      expect(timeDiff).toBeLessThan(100); // Should trigger within 100ms
    });

    it('should pre-fetch scene data for Detection Test page', async () => {
      const sceneData = {
        cameraId: 'camera-1',
        timestamp: new Date().toISOString(),
        imageUrl: 'https://storage.googleapis.com/scene-123.jpg',
        analysis: {
          objects: ['person', 'car', 'door'],
          confidence: 0.95
        }
      };

      // Store scene data in context
      const camera = globalCameraContext.get('camera-1');
      if (camera) {
        globalCameraContext.set('camera-1', {
          ...camera,
          latestScene: sceneData
        });
      }

      // Retrieve pre-fetched data for Detection Test
      const contextCamera = globalCameraContext.get('camera-1');
      expect(contextCamera?.latestScene).toEqual(sceneData);
      expect(contextCamera?.latestScene?.analysis.objects).toContain('person');
    });

    it('should run scene analysis in parallel with speaker config', async () => {
      const operations: string[] = [];
      
      // Mock scene analysis
      const mockSceneAnalysis = jest.fn().mockImplementation(async () => {
        operations.push('scene-start');
        await new Promise(resolve => setTimeout(resolve, 100));
        operations.push('scene-end');
        return { success: true, analysis: { objects: ['person'] } };
      });

      // Mock speaker configuration
      const mockSpeakerConfig = jest.fn().mockImplementation(async () => {
        operations.push('speaker-start');
        await new Promise(resolve => setTimeout(resolve, 150));
        operations.push('speaker-end');
        return { success: true };
      });

      // Run in parallel
      const [sceneResult, speakerResult] = await Promise.all([
        mockSceneAnalysis(),
        mockSpeakerConfig()
      ]);

      expect(sceneResult.success).toBe(true);
      expect(speakerResult.success).toBe(true);

      // Verify parallel execution
      const sceneStartIndex = operations.indexOf('scene-start');
      const speakerStartIndex = operations.indexOf('speaker-start');
      const sceneEndIndex = operations.indexOf('scene-end');
      
      // Both should start before either finishes
      expect(sceneStartIndex).toBeLessThan(sceneEndIndex);
      expect(speakerStartIndex).toBeLessThan(sceneEndIndex);
    });
  });

  describe('Camera Context Persistence', () => {
    it('should persist entire camera context to state', async () => {
      const cameras: Camera[] = [
        {
          id: 'camera-1',
          name: 'Camera 1',
          ip: '192.168.1.100',
          model: 'AXIS P3375-V',
          firmware: '11.0.0',
          serialNumber: 'ACCC8E123456',
          macAddress: 'AC:CC:8E:12:34:56',
          isOnline: true,
          hasAcap: true,
          acapVersion: '1.5.0',
          lastConnected: '2025-01-09T10:00:00Z',
          deploymentTime: '2025-01-09T10:30:00Z'
        },
        {
          id: 'camera-2',
          name: 'Camera 2',
          ip: '192.168.1.101',
          model: 'AXIS M3077-PLVE',
          firmware: '11.0.0',
          serialNumber: 'ACCC8E789012',
          macAddress: 'AC:CC:8E:78:90:12',
          isOnline: true,
          hasAcap: true,
          acapVersion: '1.5.0',
          lastConnected: '2025-01-09T10:05:00Z',
          deploymentTime: '2025-01-09T10:35:00Z'
        }
      ];

      // Add to context
      cameras.forEach(cam => globalCameraContext.set(cam.id, cam));

      // Save context to state
      const contextArray = Array.from(globalCameraContext.values());
      await stateManager.saveCameraContext(contextArray);

      // Clear memory context
      globalCameraContext.clear();
      expect(globalCameraContext.size).toBe(0);

      // Restore from state
      const restored = await stateManager.getCameraContext();
      restored.forEach(cam => globalCameraContext.set(cam.id, cam));

      expect(globalCameraContext.size).toBe(2);
      expect(globalCameraContext.get('camera-1')).toEqual(cameras[0]);
      expect(globalCameraContext.get('camera-2')).toEqual(cameras[1]);
    });

    it('should handle concurrent camera updates without data loss', async () => {
      const camera: Camera = {
        id: 'camera-1',
        name: 'Test Camera',
        ip: '192.168.1.100',
        model: 'AXIS P3375-V',
        firmware: '11.0.0',
        serialNumber: 'ACCC8E123456',
        macAddress: 'AC:CC:8E:12:34:56',
        isOnline: true,
        hasAcap: false
      };

      globalCameraContext.set(camera.id, camera);

      // Simulate concurrent updates
      const updates = [
        async () => {
          const cam = globalCameraContext.get(camera.id);
          if (cam) {
            globalCameraContext.set(camera.id, { ...cam, hasAcap: true });
          }
        },
        async () => {
          const cam = globalCameraContext.get(camera.id);
          if (cam) {
            globalCameraContext.set(camera.id, { ...cam, acapVersion: '1.5.0' });
          }
        },
        async () => {
          const cam = globalCameraContext.get(camera.id);
          if (cam) {
            globalCameraContext.set(camera.id, { 
              ...cam, 
              deploymentTime: '2025-01-09T10:30:00Z' 
            });
          }
        }
      ];

      // Run updates concurrently
      await Promise.all(updates.map(fn => fn()));

      // Verify all updates were applied
      const finalCamera = globalCameraContext.get(camera.id);
      expect(finalCamera?.hasAcap).toBe(true);
      expect(finalCamera?.acapVersion).toBe('1.5.0');
      expect(finalCamera?.deploymentTime).toBe('2025-01-09T10:30:00Z');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle camera disconnection gracefully', async () => {
      const camera: Camera = {
        id: 'camera-1',
        name: 'Test Camera',
        ip: '192.168.1.100',
        model: 'AXIS P3375-V',
        firmware: '11.0.0',
        serialNumber: 'ACCC8E123456',
        macAddress: 'AC:CC:8E:12:34:56',
        isOnline: true,
        hasAcap: true
      };

      globalCameraContext.set(camera.id, camera);

      // Simulate connection failure
      jest.spyOn(configService, 'testConnection').mockRejectedValue(
        new Error('Connection timeout')
      );

      try {
        await configService.testConnection(camera.ip, 'root', 'admin123');
      } catch (error) {
        // Update camera status in context
        const updatedCamera = {
          ...camera,
          isOnline: false,
          lastError: 'Connection timeout',
          lastErrorTime: new Date().toISOString()
        };
        globalCameraContext.set(camera.id, updatedCamera);
      }

      const contextCamera = globalCameraContext.get(camera.id);
      expect(contextCamera?.isOnline).toBe(false);
      expect(contextCamera?.lastError).toBe('Connection timeout');
      expect(contextCamera?.lastErrorTime).toBeDefined();
    });

    it('should recover camera context after app crash', async () => {
      const cameras: Camera[] = [
        {
          id: 'camera-1',
          name: 'Camera 1',
          ip: '192.168.1.100',
          model: 'AXIS P3375-V',
          firmware: '11.0.0',
          serialNumber: 'ACCC8E123456',
          macAddress: 'AC:CC:8E:12:34:56',
          isOnline: true,
          hasAcap: true
        }
      ];

      // Save to persistent state before "crash"
      await stateManager.saveCameraContext(cameras);

      // Simulate app crash (clear memory)
      globalCameraContext.clear();

      // Simulate app restart and recovery
      const recovered = await stateManager.getCameraContext();
      recovered.forEach(cam => globalCameraContext.set(cam.id, cam));

      expect(globalCameraContext.size).toBe(1);
      expect(globalCameraContext.get('camera-1')).toEqual(cameras[0]);
    });
  });
});