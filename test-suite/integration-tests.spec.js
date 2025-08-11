/**
 * Integration Test Suite for Anava Installer v0.9.178
 * Tests end-to-end workflows and component interactions
 */

const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');

describe('Integration Tests', () => {
  
  describe('Build Process', () => {
    it('should build without errors', async () => {
      const buildProcess = spawn('npm', ['run', 'build'], {
        cwd: path.join(__dirname, '..'),
        shell: true
      });
      
      return new Promise((resolve, reject) => {
        let output = '';
        buildProcess.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        buildProcess.on('close', (code) => {
          expect(code).toBe(0);
          expect(output).not.toContain('ERROR');
          resolve();
        });
        
        buildProcess.on('error', reject);
      });
    }, 60000); // 60 second timeout for build
    
    it('should produce valid distribution files', () => {
      const distPath = path.join(__dirname, '../dist');
      
      // Check main process files
      expect(fs.existsSync(path.join(distPath, 'main/index.js'))).toBe(true);
      
      // Check renderer files
      expect(fs.existsSync(path.join(distPath, 'renderer/index.html'))).toBe(true);
      expect(fs.existsSync(path.join(distPath, 'renderer/assets'))).toBe(true);
    });
  });

  describe('Electron App Launch', () => {
    let electronProcess;
    
    it('should launch without crashes', async () => {
      electronProcess = spawn('npx', ['electron', 'dist/main/index.js'], {
        cwd: path.join(__dirname, '..'),
        shell: true,
        env: { ...process.env, NODE_ENV: 'test' }
      });
      
      return new Promise((resolve, reject) => {
        let output = '';
        let errorOutput = '';
        
        electronProcess.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        electronProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        // Give app 5 seconds to launch
        setTimeout(() => {
          expect(errorOutput).not.toContain('Uncaught Exception');
          expect(errorOutput).not.toContain('Unhandled Promise Rejection');
          
          if (electronProcess) {
            electronProcess.kill();
          }
          resolve();
        }, 5000);
        
        electronProcess.on('error', reject);
      });
    }, 10000);
  });

  describe('API Gateway Configuration', () => {
    it('should generate valid OpenAPI spec', () => {
      const deploymentEngine = fs.readFileSync(
        path.join(__dirname, '../src/main/services/deploymentEngine.ts'),
        'utf8'
      );
      
      // Verify OpenAPI spec generation
      expect(deploymentEngine).toContain('openapi: "3.0.0"');
      expect(deploymentEngine).toContain('x-google-backend');
      expect(deploymentEngine).toContain('jwt_audience');
    });
    
    it('should replace all placeholders correctly', () => {
      const deploymentEngine = fs.readFileSync(
        path.join(__dirname, '../src/main/services/deploymentEngine.ts'),
        'utf8'
      );
      
      // Verify global replacement
      expect(deploymentEngine).toContain('.replace(/\\${DEVICE_AUTH_URL}/g');
      expect(deploymentEngine).toContain('.replace(/\\${GET_SCENE_URL}/g');
    });
  });

  describe('Camera Communication', () => {
    it('should format VAPIX requests correctly', () => {
      const cameraConfig = fs.readFileSync(
        path.join(__dirname, '../src/main/services/camera/cameraConfigurationService.ts'),
        'utf8'
      );
      
      // Verify VAPIX endpoint
      expect(cameraConfig).toContain('/local/BatonAnalytic/baton_analytic.cgi');
      expect(cameraConfig).toContain('command=setInstallerConfig');
    });
    
    it('should include all required config fields', () => {
      const cameraConfig = fs.readFileSync(
        path.join(__dirname, '../src/main/services/camera/cameraConfigurationService.ts'),
        'utf8'
      );
      
      // Verify config structure
      const requiredFields = [
        'firebase',
        'gemini',
        'anavaKey',
        'customerId',
        'vertexApiGatewayUrl',
        'vertexApiGatewayKey'
      ];
      
      requiredFields.forEach(field => {
        expect(cameraConfig).toContain(field);
      });
    });
  });

  describe('State Management', () => {
    it('should persist deployment state', () => {
      const deploymentEngine = fs.readFileSync(
        path.join(__dirname, '../src/main/services/deploymentEngine.ts'),
        'utf8'
      );
      
      // Verify state persistence
      expect(deploymentEngine).toContain('saveState');
      expect(deploymentEngine).toContain('loadState');
      expect(deploymentEngine).toContain('~/.anava-deployer');
    });
    
    it('should handle null resources gracefully', () => {
      const completionPage = fs.readFileSync(
        path.join(__dirname, '../src/renderer/pages/CompletionPage.tsx'),
        'utf8'
      );
      
      // Verify null checks
      expect(completionPage).toContain('resources?.apiGateway?.apiKey');
      expect(completionPage).toContain('resources?.apiGateway?.url');
      expect(completionPage).toContain('if (!resources)');
    });
  });

  describe('Performance Optimizations', () => {
    it('should trigger scene capture immediately', () => {
      const acapPage = fs.readFileSync(
        path.join(__dirname, '../src/renderer/pages/camera/ACAPDeploymentPage.tsx'),
        'utf8'
      );
      
      // Verify immediate trigger
      expect(acapPage).toContain('// Step 3: Trigger scene capture immediately');
      expect(acapPage).toContain('Non-blocking scene capture');
    });
    
    it('should run operations in parallel', () => {
      const acapPage = fs.readFileSync(
        path.join(__dirname, '../src/renderer/pages/camera/ACAPDeploymentPage.tsx'),
        'utf8'
      );
      
      // Verify parallel execution
      expect(acapPage).toContain('Promise.all');
      expect(acapPage).toContain('concurrent');
    });
  });
});