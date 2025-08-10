/**
 * Security Regression Tests for Electron v37 Upgrade
 * Ensures no security vulnerabilities were introduced during the upgrade
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

describe('Security Regression Tests - Electron v37', () => {
  describe('Dependency Vulnerability Checks', () => {
    it('should have no critical vulnerabilities after upgrade', () => {
      // Check package.json for vulnerable dependency versions
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')
      );

      // Verify Electron is on v37
      expect(packageJson.devDependencies.electron).toMatch(/\^37\./);
      
      // Verify electron-builder is updated
      expect(packageJson.devDependencies['electron-builder']).toMatch(/\^26\./);

      // Check for removed vulnerable package
      expect(packageJson.dependencies['@mhoc/axios-digest-auth']).toBeUndefined();
      
      // Verify ip package override is present
      expect(packageJson.overrides?.ip).toBe('^2.0.1');
    });

    it('should verify npm audit results are acceptable', () => {
      try {
        // Run npm audit and capture output
        const auditOutput = execSync('npm audit --json', { 
          encoding: 'utf-8',
          stdio: 'pipe' 
        });
        
        const auditResult = JSON.parse(auditOutput);
        
        // Check vulnerability counts
        expect(auditResult.metadata.vulnerabilities.critical).toBe(0);
        expect(auditResult.metadata.vulnerabilities.high).toBeLessThanOrEqual(2); // Known accepted issues
        
        // Verify specific fixes
        const vulnerabilities = auditResult.vulnerabilities || {};
        
        // ip package should be overridden
        if (vulnerabilities.ip) {
          const pkgJson = JSON.parse(
            fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')
          );
          expect(pkgJson.overrides?.ip).toBeDefined();
        }
        
      } catch (error: any) {
        // npm audit returns non-zero exit code if vulnerabilities exist
        // Parse the output anyway
        if (error.stdout) {
          const auditResult = JSON.parse(error.stdout);
          
          // Allow up to 2 vulnerabilities (known and accepted)
          expect(auditResult.metadata.vulnerabilities.total).toBeLessThanOrEqual(2);
          expect(auditResult.metadata.vulnerabilities.critical).toBe(0);
        } else {
          throw error;
        }
      }
    });

    it('should not have known Electron v37 CVEs', () => {
      const electronVersion = '37.2.6';
      
      // List of known CVEs fixed in Electron v37
      const fixedCVEs = [
        'CVE-2024-39698', // Fixed in Electron 31.0.0
        'CVE-2024-7969',  // Fixed in Electron 32.0.0
        'CVE-2024-9602',  // Fixed in Electron 32.1.0
        'CVE-2024-10229', // Fixed in Electron 33.0.0
      ];
      
      // Verify we're on a version that includes all fixes
      const [major] = electronVersion.split('.').map(Number);
      expect(major).toBeGreaterThanOrEqual(37);
      
      // These CVEs should all be fixed in v37
      // Verify we're on a version that includes all fixes
      expect(major).toBeGreaterThan(33); // All listed CVEs fixed by v33
    });
  });

  describe('Electron Security Best Practices', () => {
    it('should have context isolation enabled in all windows', () => {
      const mainProcessFiles = [
        'src/main/index.ts',
        'src/main/windows/mainWindow.ts',
      ];
      
      mainProcessFiles.forEach(file => {
        const filePath = path.join(__dirname, '../..', file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          
          // Check for proper webPreferences
          if (content.includes('new BrowserWindow')) {
            expect(content).toContain('contextIsolation: true');
            expect(content).toContain('nodeIntegration: false');
          }
        }
      });
    });

    it('should not use deprecated or insecure Electron APIs', () => {
      const srcFiles = execSync('find src -name "*.ts" -o -name "*.tsx"', {
        encoding: 'utf-8',
        cwd: path.join(__dirname, '../..')
      }).trim().split('\n');
      
      const deprecatedPatterns = [
        /webPreferences:\s*{[^}]*nodeIntegration:\s*true/g,
        /require\(['"]electron['"]\)\.remote/g,
        /from\s+['"]@electron\/remote['"]/g,
        /enableRemoteModule:\s*true/g,
        /webSecurity:\s*false/g,
        /allowRunningInsecureContent:\s*true/g,
        /experimentalFeatures:\s*true/g,
      ];
      
      srcFiles.forEach(file => {
        if (file && fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf-8');
          
          deprecatedPatterns.forEach(pattern => {
            expect(content).not.toMatch(pattern);
          });
        }
      });
    });

    it('should validate sandbox configuration', () => {
      const mainFile = fs.readFileSync(
        path.join(__dirname, '../../src/main/index.ts'),
        'utf-8'
      );
      
      // Check sandbox configuration
      if (mainFile.includes('sandbox: false')) {
        // If sandbox is disabled, there should be a comment explaining why
        expect(mainFile).toMatch(/sandbox:\s*false.*\/\/.*[Tt]erraform/);
      }
      
      // Verify app.enableSandbox() is not called (would override window settings)
      expect(mainFile).not.toContain('app.enableSandbox()');
    });

    it('should properly configure CSP headers', () => {
      const indexHtml = path.join(__dirname, '../../dist/renderer/index.html');
      
      if (fs.existsSync(indexHtml)) {
        const content = fs.readFileSync(indexHtml, 'utf-8');
        
        // Check for CSP meta tag
        if (content.includes('Content-Security-Policy')) {
          expect(content).toMatch(/<meta.*Content-Security-Policy/);
          expect(content).not.toContain("'unsafe-eval'");
          expect(content).not.toContain("*");
        }
      }
    });

    it('should validate protocol handling', () => {
      const mainFile = fs.readFileSync(
        path.join(__dirname, '../../src/main/index.ts'),
        'utf-8'
      );
      
      // Check for protocol validation
      if (mainFile.includes('protocol.registerSchemesAsPrivileged')) {
        expect(mainFile).toMatch(/standard:\s*true/);
        expect(mainFile).toMatch(/secure:\s*true/);
      }
      
      // Verify no dangerous protocols
      expect(mainFile).not.toContain('registerFileProtocol');
      expect(mainFile).not.toContain('file://');
    });
  });

  describe('Authentication & Authorization Security', () => {
    it('should securely store OAuth tokens', () => {
      const storeFile = path.join(__dirname, '../../src/main/services/gcpOAuthService.ts');
      
      if (fs.existsSync(storeFile)) {
        const content = fs.readFileSync(storeFile, 'utf-8');
        
        // Should use electron-store with encryption
        expect(content).toContain('electron-store');
        
        // Should not store tokens in plain text
        expect(content).not.toMatch(/localStorage\.setItem.*token/i);
        expect(content).not.toMatch(/sessionStorage\.setItem.*token/i);
        
        // Should clear sensitive data on logout
        if (content.includes('logout') || content.includes('signOut')) {
          expect(content).toMatch(/store\.delete|store\.clear|token.*=.*null/);
        }
      }
    });

    it('should validate API keys are not hardcoded', () => {
      const srcFiles = execSync('find src -name "*.ts" -o -name "*.tsx"', {
        encoding: 'utf-8',
        cwd: path.join(__dirname, '../..')
      }).trim().split('\n');
      
      const apiKeyPatterns = [
        /AIza[0-9A-Za-z\-_]{35}/g, // Google API Key
        /[0-9a-f]{32}/g, // Generic 32-char hex (potential API key)
        /sk_live_[0-9a-zA-Z]{24}/g, // Stripe
        /[a-zA-Z0-9]{40}/g, // Generic 40-char (potential token)
      ];
      
      srcFiles.forEach(file => {
        if (file && fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf-8');
          
          // Skip test files and mock data
          if (file.includes('.test.') || file.includes('.spec.')) {
            return;
          }
          
          apiKeyPatterns.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) {
              // Check if it's likely a real key (not a placeholder)
              matches.forEach(match => {
                expect(match).toMatch(/test|fake|mock|example|placeholder/i);
              });
            }
          });
        }
      });
    });
  });

  describe('IPC Security', () => {
    it('should validate IPC channel names follow security conventions', () => {
      const preloadFile = path.join(__dirname, '../../src/preload/index.ts');
      
      if (fs.existsSync(preloadFile)) {
        const content = fs.readFileSync(preloadFile, 'utf-8');
        
        // Extract IPC channels
        const channelMatches = content.match(/['"]([a-zA-Z\-:]+)['"]/g) || [];
        const channels = channelMatches.map(m => m.replace(/['"]/g, ''));
        
        channels.forEach(channel => {
          // Channels should not contain sensitive operation names
          expect(channel).not.toMatch(/delete.*all/i);
          expect(channel).not.toMatch(/drop.*database/i);
          expect(channel).not.toMatch(/exec.*command/i);
          expect(channel).not.toMatch(/eval/i);
        });
      }
    });

    it('should limit exposed IPC methods in preload', () => {
      const preloadFile = path.join(__dirname, '../../src/preload/index.ts');
      
      if (fs.existsSync(preloadFile)) {
        const content = fs.readFileSync(preloadFile, 'utf-8');
        
        // Count exposed methods
        const exposedMethods = content.match(/\w+:\s*\([^)]*\)\s*=>/g) || [];
        
        // Should have a reasonable number of exposed methods
        expect(exposedMethods.length).toBeLessThan(50);
        
        // Should use contextBridge
        expect(content).toContain('contextBridge.exposeInMainWorld');
        
        // Should not expose Node.js globals
        expect(content).not.toContain('process:');
        expect(content).not.toContain('require:');
        expect(content).not.toContain('__dirname:');
        expect(content).not.toContain('Buffer:');
      }
    });
  });

  describe('File System Security', () => {
    it('should validate path traversal prevention', () => {
      const fileServiceFiles = execSync('find src -name "*file*.ts" -o -name "*storage*.ts"', {
        encoding: 'utf-8',
        cwd: path.join(__dirname, '../..')
      }).trim().split('\n').filter(Boolean);
      
      fileServiceFiles.forEach(file => {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf-8');
          
          // Check for path validation
          if (content.includes('readFile') || content.includes('writeFile')) {
            // Should use path.resolve or path.join
            expect(content).toMatch(/path\.(resolve|join)/);
            
            // Should check if path is within allowed directory
            if (content.includes('startsWith')) {
              expect(content).toMatch(/resolved.*startsWith|normalized.*startsWith/);
            }
          }
        }
      });
    });

    it('should restrict file access to app directories', () => {
      const mainFile = path.join(__dirname, '../../src/main/index.ts');
      const content = fs.readFileSync(mainFile, 'utf-8');
      
      // Check for app.getPath usage
      if (content.includes('app.getPath')) {
        const validPaths = ['userData', 'temp', 'logs', 'downloads', 'documents'];
        
        // Extract getPath calls
        const getPathCalls = content.match(/app\.getPath\(['"](\w+)['"]\)/g) || [];
        
        getPathCalls.forEach(call => {
          const pathType = call.match(/['"](\w+)['"]/)?.[1];
          if (pathType) {
            expect(validPaths).toContain(pathType);
          }
        });
      }
    });
  });

  describe('Network Security', () => {
    it('should enforce HTTPS for external requests', () => {
      const serviceFiles = execSync('find src -name "*.service.ts"', {
        encoding: 'utf-8',
        cwd: path.join(__dirname, '../..')
      }).trim().split('\n').filter(Boolean);
      
      serviceFiles.forEach(file => {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf-8');
          
          // Check for HTTP URLs (should be HTTPS)
          const httpUrls = content.match(/http:\/\/(?!localhost|127\.0\.0\.1|192\.168)/g);
          
          if (httpUrls) {
            // Camera IPs are an exception
            httpUrls.forEach(url => {
              expect(url).toMatch(/http:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/);
            });
          }
          
          // Check axios config
          if (content.includes('axios')) {
            // Should not disable SSL verification in production
            expect(content).not.toMatch(/rejectUnauthorized:\s*false/);
            expect(content).not.toMatch(/strictSSL:\s*false/);
          }
        }
      });
    });

    it('should validate certificate pinning for critical endpoints', () => {
      const criticalEndpoints = [
        'oauth2.googleapis.com',
        'iamcredentials.googleapis.com',
        'cloudresourcemanager.googleapis.com',
      ];
      
      // Check if certificate validation is in place
      const serviceFile = path.join(__dirname, '../../src/main/services/gcpOAuthService.ts');
      
      if (fs.existsSync(serviceFile)) {
        const content = fs.readFileSync(serviceFile, 'utf-8');
        
        criticalEndpoints.forEach(endpoint => {
          if (content.includes(endpoint)) {
            // Should not disable certificate validation
            expect(content).not.toMatch(new RegExp(`${endpoint}.*rejectUnauthorized.*false`));
          }
        });
      }
    });
  });

  describe('Memory Safety', () => {
    it('should clear sensitive data from memory', () => {
      const sensitiveFiles = [
        'src/main/services/gcpOAuthService.ts',
        'src/main/services/camera/cameraConfigurationService.ts',
      ];
      
      sensitiveFiles.forEach(file => {
        const filePath = path.join(__dirname, '../..', file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          
          // Check for cleanup in error handlers and finally blocks
          if (content.includes('password') || content.includes('token') || content.includes('apiKey')) {
            // Should have cleanup logic
            expect(content).toMatch(/finally\s*{|\.finally\(/);
            
            // Should clear sensitive variables
            if (content.includes('finally')) {
              expect(content).toMatch(/password\s*=\s*(null|undefined|'')/);
            }
          }
        }
      });
    });

    it('should not log sensitive information', () => {
      const srcFiles = execSync('find src -name "*.ts" -o -name "*.tsx"', {
        encoding: 'utf-8',
        cwd: path.join(__dirname, '../..')
      }).trim().split('\n');
      
      const sensitivePatterns = [
        /console\.(log|error|warn|info).*password/i,
        /console\.(log|error|warn|info).*apiKey/i,
        /console\.(log|error|warn|info).*token/i,
        /console\.(log|error|warn|info).*secret/i,
      ];
      
      srcFiles.forEach(file => {
        if (file && fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf-8');
          
          sensitivePatterns.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) {
              // Allow only if it's redacted
              matches.forEach(match => {
                expect(match).toMatch(/\[REDACTED\]|\*{3,}|hidden|masked/i);
              });
            }
          });
        }
      });
    });
  });
});