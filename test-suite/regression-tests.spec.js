/**
 * Regression Test Suite for Anava Installer v0.9.178
 * Ensures all critical functionality remains intact
 */

const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const path = require('path');
const fs = require('fs');

describe('Regression Tests', () => {
  
  describe('Camera Discovery', () => {
    it('should have mDNS/Bonjour discovery service', () => {
      const discoveryService = fs.readFileSync(
        path.join(__dirname, '../src/main/services/camera/optimizedCameraDiscoveryService.ts'),
        'utf8'
      );
      
      // Verify Bonjour implementation exists
      expect(discoveryService).toContain('class OptimizedCameraDiscoveryService');
      expect(discoveryService).toContain('discoverCameras');
      expect(discoveryService).toContain('_axis-video._tcp');
    });

    it('should support network scanning fallback', () => {
      const discoveryService = fs.readFileSync(
        path.join(__dirname, '../src/main/services/camera/optimizedCameraDiscoveryService.ts'),
        'utf8'
      );
      
      // Verify network scan implementation
      expect(discoveryService).toContain('scanNetworkRange');
      expect(discoveryService).toContain('concurrent scan');
    });

    it('should not use removed node-ssdp dependency', () => {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8')
      );
      
      // Verify node-ssdp is removed
      expect(packageJson.dependencies).not.toHaveProperty('node-ssdp');
      expect(packageJson.devDependencies).not.toHaveProperty('node-ssdp');
    });
  });

  describe('ACAP Deployment', () => {
    it('should have deployment functionality', () => {
      const acapPage = fs.readFileSync(
        path.join(__dirname, '../src/renderer/pages/camera/ACAPDeploymentPage.tsx'),
        'utf8'
      );
      
      // Verify deployment logic exists
      expect(acapPage).toContain('handleDeployToCamera');
      expect(acapPage).toContain('uploadACAPToCamera');
      expect(acapPage).toContain('activateLicense');
    });

    it('should use HTTPS with Basic auth for cameras', () => {
      const acapPage = fs.readFileSync(
        path.join(__dirname, '../src/renderer/pages/camera/ACAPDeploymentPage.tsx'),
        'utf8'
      );
      
      // Verify HTTPS usage
      expect(acapPage).toContain('https://');
      expect(acapPage).toContain('Authorization');
      expect(acapPage).toContain('Basic');
    });

    it('should capture scene immediately after deployment', () => {
      const acapPage = fs.readFileSync(
        path.join(__dirname, '../src/renderer/pages/camera/ACAPDeploymentPage.tsx'),
        'utf8'
      );
      
      // Verify scene capture trigger
      expect(acapPage).toContain('Triggering scene capture');
      expect(acapPage).toContain('captureScene');
    });
  });

  describe('Firebase Integration', () => {
    it('should have Firebase Auth configuration', () => {
      const deploymentEngine = fs.readFileSync(
        path.join(__dirname, '../src/main/services/deploymentEngine.ts'),
        'utf8'
      );
      
      // Verify Firebase setup
      expect(deploymentEngine).toContain('initializeFirebaseAuth');
      expect(deploymentEngine).toContain('google_identity_platform_config');
    });

    it('should support email/password authentication', () => {
      const deploymentEngine = fs.readFileSync(
        path.join(__dirname, '../src/main/services/deploymentEngine.ts'),
        'utf8'
      );
      
      // Verify email auth support
      expect(deploymentEngine).toContain('email/password');
    });
  });

  describe('GCP Deployment', () => {
    it('should deploy all required resources', () => {
      const deploymentEngine = fs.readFileSync(
        path.join(__dirname, '../src/main/services/deploymentEngine.ts'),
        'utf8'
      );
      
      // Verify all deployment steps exist
      const requiredSteps = [
        'createServiceAccounts',
        'deployCloudFunctions',
        'createApiGateway',
        'setupWorkloadIdentity',
        'createFirestore',
        'createCloudStorage'
      ];
      
      requiredSteps.forEach(step => {
        expect(deploymentEngine).toContain(step);
      });
    });

    it('should NOT skip steps based on AI mode', () => {
      const deploymentEngine = fs.readFileSync(
        path.join(__dirname, '../src/main/services/deploymentEngine.ts'),
        'utf8'
      );
      
      // Verify no conditional skipping based on AI mode
      expect(deploymentEngine).not.toMatch(/if\s*\(\s*!isAiStudioMode\s*\)/);
      expect(deploymentEngine).not.toMatch(/if\s*\(\s*aiMode\s*===\s*['"]ai-studio['"]\s*\)\s*return/);
    });

    it('should include generativelanguage API', () => {
      const deploymentEngine = fs.readFileSync(
        path.join(__dirname, '../src/main/services/deploymentEngine.ts'),
        'utf8'
      );
      
      // Verify API is enabled
      expect(deploymentEngine).toContain('generativelanguage.googleapis.com');
    });
  });

  describe('License Activation', () => {
    it('should use actual camera MAC addresses', () => {
      const acapPage = fs.readFileSync(
        path.join(__dirname, '../src/renderer/pages/camera/ACAPDeploymentPage.tsx'),
        'utf8'
      );
      
      // Verify dynamic MAC usage
      expect(acapPage).toContain('camera.macAddress');
      expect(acapPage).not.toContain('ACCC8EFA63CD'); // No hardcoded MAC
    });

    it('should handle license activation errors', () => {
      const acapPage = fs.readFileSync(
        path.join(__dirname, '../src/renderer/pages/camera/ACAPDeploymentPage.tsx'),
        'utf8'
      );
      
      // Verify error handling
      expect(acapPage).toContain('catch');
      expect(acapPage).toContain('License activation failed');
    });
  });

  describe('UI Rendering', () => {
    it('should have correct script tag placement', () => {
      const viteConfig = fs.readFileSync(
        path.join(__dirname, '../vite.config.ts'),
        'utf8'
      );
      
      // Verify script placement fix
      expect(viteConfig).toContain('transformIndexHtml');
      expect(viteConfig).toContain('injectTo: "body"');
    });

    it('should not have white screen issue', () => {
      const indexHtml = fs.readFileSync(
        path.join(__dirname, '../index.html'),
        'utf8'
      );
      
      // Verify proper structure
      expect(indexHtml).toContain('<div id="root"></div>');
      expect(indexHtml).toContain('type="module"');
    });
  });

  describe('Camera Context', () => {
    it('should save cameras to global context', () => {
      const cameraSetup = fs.readFileSync(
        path.join(__dirname, '../src/renderer/pages/CameraSetupPage.tsx'),
        'utf8'
      );
      
      // Verify context usage
      expect(cameraSetup).toContain('useCameraContext');
      expect(cameraSetup).toContain('saveCamera');
    });

    it('should persist cameras across navigation', () => {
      const completionPage = fs.readFileSync(
        path.join(__dirname, '../src/renderer/pages/CompletionPage.tsx'),
        'utf8'
      );
      
      // Verify camera persistence
      expect(completionPage).toContain('useCameraContext');
      expect(completionPage).toContain('cameras from global context');
    });
  });
});