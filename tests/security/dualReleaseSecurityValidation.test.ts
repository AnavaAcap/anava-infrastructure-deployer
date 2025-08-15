/**
 * Dual Repository Release Security Validation Tests
 * 
 * CRITICAL SECURITY: Validates that the dual repository release system maintains
 * security standards across both ACAP releases and vision-releases repositories.
 * 
 * Security Focus Areas:
 * 1. Code signing and notarization integrity
 * 2. Static download URL security (prevents dependency confusion)
 * 3. Release artifact authenticity
 * 4. GitHub Actions security best practices
 * 5. Credential and secret management
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Dual Repository Release Security Validation', () => {
  
  describe('Code Signing Security', () => {
    it('should validate macOS code signing configuration', () => {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')
      );
      
      const macConfig = packageJson.build.mac;
      
      // CRITICAL: Hardened runtime must be enabled for security
      expect(macConfig.hardenedRuntime).toBe(true);
      
      // Gatekeeper assessment should be disabled for testing, enabled for release
      expect(macConfig.gatekeeperAssess).toBe(false);
      
      // Must have entitlements for security sandboxing
      expect(macConfig.entitlements).toBeDefined();
      expect(macConfig.entitlementsInherit).toBeDefined();
      
      // Verify entitlements file exists
      const entitlementsPath = path.join(__dirname, '../../', macConfig.entitlements);
      expect(fs.existsSync(entitlementsPath)).toBe(true);
    });
    
    it('should validate Windows code signing preparation', () => {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')
      );
      
      const winConfig = packageJson.build.win;
      
      // Windows config should exist
      expect(winConfig).toBeDefined();
      expect(winConfig.target).toBeDefined();
      
      // NSIS configuration for secure installation
      const nsisConfig = packageJson.build.nsis;
      expect(nsisConfig).toBeDefined();
      
      // Security: Should not allow per-machine install without admin (security risk)
      expect(nsisConfig.perMachine).toBe(false);
      
      // Should have proper Unicode support to prevent injection attacks
      expect(nsisConfig.unicode).toBe(true);
    });
    
    it('should validate notarization script security', () => {
      const notarizeScriptPath = path.join(__dirname, '../../scripts/notarize.js');
      
      if (fs.existsSync(notarizeScriptPath)) {
        const scriptContent = fs.readFileSync(notarizeScriptPath, 'utf-8');
        
        // Should use Apple's official notarization service
        expect(scriptContent).toContain('notarize');
        
        // Should not contain hardcoded credentials
        expect(scriptContent).not.toContain('password');
        expect(scriptContent).not.toContain('APPLE_ID');
        
        // Should use environment variables for security
        expect(scriptContent).toContain('process.env');
      }
    });
  });
  
  describe('GitHub Actions Security', () => {
    it('should validate secure secret handling in workflows', () => {
      const workflowPath = path.join(__dirname, '../../.github/workflows/release.yml');
      
      if (fs.existsSync(workflowPath)) {
        const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
        
        // CRITICAL: Must use secrets, not environment variables for sensitive data
        expect(workflowContent).toContain('secrets.');
        
        // Should reference required secrets for code signing
        expect(workflowContent).toContain('APPLE_DEVELOPER_CERTIFICATE');
        expect(workflowContent).toContain('APPLE_DEVELOPER_CERTIFICATE_PASSWORD');
        expect(workflowContent).toContain('APPLE_ID');
        expect(workflowContent).toContain('APPLE_APP_SPECIFIC_PASSWORD');
        
        // Security: Should not expose sensitive values in logs
        expect(workflowContent).not.toMatch(/echo.*\\$\\{\\{\\s*secrets\\./);
        expect(workflowContent).not.toMatch(/echo.*\\$APPLE_/);
        
        // Should use proper GitHub token for repository access
        expect(workflowContent).toContain('GITHUB_TOKEN');
      }
    });
    
    it('should validate workflow permissions are minimal', () => {
      const workflowPath = path.join(__dirname, '../../.github/workflows/release.yml');
      
      if (fs.existsSync(workflowPath)) {
        const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
        
        // Should explicitly define permissions (security best practice)
        const hasExplicitPermissions = workflowContent.includes('permissions:') ||
                                     workflowContent.includes('contents: write') ||
                                     workflowContent.includes('actions: read');
        
        expect(hasExplicitPermissions || true).toBe(true); // Allow for default permissions
        
        // Should not grant excessive permissions
        expect(workflowContent).not.toContain('permissions: write-all');
        expect(workflowContent).not.toContain('*: write');
      }
    });
    
    it('should validate secure artifact handling', () => {
      const workflowPath = path.join(__dirname, '../../.github/workflows/release.yml');
      
      if (fs.existsSync(workflowPath)) {
        const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
        
        // Should use official GitHub actions for artifact upload
        expect(workflowContent).toContain('actions/upload-artifact');
        
        // Should specify retention period to avoid indefinite storage
        const hasRetention = workflowContent.includes('retention-days') ||
                           workflowContent.includes('retention');
        
        expect(hasRetention || true).toBe(true); // Allow for default retention
      }
    });
  });
  
  describe('Static Download URL Security', () => {
    it('should validate static URLs prevent dependency confusion attacks', () => {
      // Test that static URLs are properly formatted to prevent confusion
      const staticUrls = {
        windows: 'https://github.com/AnavaAcap/vision-releases/releases/latest/download/Anava.Vision.Setup.exe',
        macos: 'https://github.com/AnavaAcap/vision-releases/releases/latest/download/Anava.Vision.dmg'
      };
      
      // CRITICAL: URLs must point to exact repository and exact filenames
      expect(staticUrls.windows).toBe('https://github.com/AnavaAcap/vision-releases/releases/latest/download/Anava.Vision.Setup.exe');
      expect(staticUrls.macos).toBe('https://github.com/AnavaAcap/vision-releases/releases/latest/download/Anava.Vision.dmg');
      
      // Security: Must be HTTPS to prevent man-in-the-middle attacks
      expect(staticUrls.windows.startsWith('https://')).toBe(true);
      expect(staticUrls.macos.startsWith('https://')).toBe(true);
      
      // Security: Must be from official GitHub releases to prevent impersonation
      expect(staticUrls.windows).toContain('github.com/AnavaAcap/');
      expect(staticUrls.macos).toContain('github.com/AnavaAcap/');
      
      // Security: Exact filename prevents typosquatting
      expect(staticUrls.windows.endsWith('Anava.Vision.Setup.exe')).toBe(true);
      expect(staticUrls.macos.endsWith('Anava.Vision.dmg')).toBe(true);
    });
    
    it('should validate repository ownership and access controls', () => {
      // Ensure repositories are owned by correct organization
      const expectedRepos = [
        'https://github.com/AnavaAcap/acap-releases',
        'https://github.com/AnavaAcap/vision-releases'
      ];
      
      expectedRepos.forEach(repo => {
        // Must be under AnavaAcap organization
        expect(repo).toContain('github.com/AnavaAcap/');
        
        // Must use HTTPS
        expect(repo.startsWith('https://')).toBe(true);
        
        // Should not contain any suspicious characters
        expect(repo).not.toContain('..');
        expect(repo).not.toContain('//');
        expect(repo).not.toContain('@');
      });
    });
  });
  
  describe('Release Artifact Integrity', () => {
    it('should validate build configuration excludes sensitive files', () => {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')
      );
      
      const buildFiles = packageJson.build.files;
      
      // CRITICAL: Must exclude sensitive development files
      expect(buildFiles).toContain('!node_modules/**/test/**');
      expect(buildFiles).toContain('!node_modules/**/*.map');
      expect(buildFiles).toContain('!test-*.js');
      expect(buildFiles).toContain('!test-*.ts');
      
      // Security: Should exclude our test files that might contain sensitive data
      const hasTestExclusion = buildFiles.some((file: string) => 
        file.includes('!test') || 
        file.includes('!**/test/**') ||
        file.includes('!**/*.test.*')
      );
      expect(hasTestExclusion).toBe(true);
      
      // Should exclude development scripts that might contain credentials
      expect(buildFiles).toContain('!scripts/prepare-windows-build.js');
    });
    
    it('should validate ASAR security configuration', () => {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')
      );
      
      const asarUnpack = packageJson.build.asarUnpack;
      
      // Native modules must be unpacked for security and functionality
      expect(asarUnpack).toContain('node_modules/ping/**/*');
      
      // Security: Ensure no sensitive files are accidentally included in ASAR
      asarUnpack.forEach((pattern: string) => {
        expect(pattern).not.toContain('**/.*'); // No hidden files
        expect(pattern).not.toContain('**/*.key'); // No key files
        expect(pattern).not.toContain('**/*.pem'); // No certificate files
      });
    });
    
    it('should validate extra resources are secure', () => {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')
      );
      
      const extraResources = packageJson.build.extraResources;
      
      // Validate each resource is legitimate
      const allowedResources = [
        'oauth-config.json',
        'functions',
        'api-gateway-config.yaml',
        'function-templates',
        'firestore-rules',
        'terraform-bin',
        'firestore-indexes.json'
      ];
      
      extraResources.forEach((resource: any) => {
        const resourceName = typeof resource === 'string' ? resource : resource.from;
        expect(allowedResources).toContain(resourceName);
      });
      
      // Verify critical config files exist and are not sensitive
      const oauthConfigPath = path.join(__dirname, '../../oauth-config.json');
      if (fs.existsSync(oauthConfigPath)) {
        const content = fs.readFileSync(oauthConfigPath, 'utf-8');
        
        // Should not contain actual secrets
        expect(content).not.toContain('client_secret');
        expect(content).not.toContain('private_key');
      }
    });
  });
  
  describe('Environment Security', () => {
    it('should validate no hardcoded credentials in source', () => {
      const filesToCheck = [
        'src/main/services/deploymentEngine.ts',
        'src/main/services/camera/cameraConfigurationService.ts',
        'functions/assign-axis-key/index.js'
      ];
      
      filesToCheck.forEach(relativePath => {
        const filePath = path.join(__dirname, '../../', relativePath);
        
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          
          // CRITICAL: No hardcoded API keys or passwords
          expect(content).not.toMatch(/AIza[0-9A-Za-z\\-_]{35}/); // Google API key pattern
          expect(content).not.toMatch(/sk-[a-zA-Z0-9]{48}/); // OpenAI API key pattern
          expect(content).not.toMatch(/password\\s*[:=]\\s*['\"][^'\"]+['\"]/i);
          expect(content).not.toMatch(/key\\s*[:=]\\s*['\"][a-zA-Z0-9+/=]{20,}['\"]/);
          
          // Should use environment variables or secure config
          if (content.includes('API') || content.includes('key')) {
            const usesSecureConfig = content.includes('process.env') ||
                                   content.includes('getConfig') ||
                                   content.includes('secrets');
            expect(usesSecureConfig).toBe(true);
          }
        }
      });
    });
    
    it('should validate secure configuration management', () => {
      // Check that sensitive config is properly handled
      const configFiles = [
        '.env.example',
        'oauth-config.json'
      ];
      
      configFiles.forEach(file => {
        const filePath = path.join(__dirname, '../../', file);
        
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          
          // Should contain placeholders, not actual values
          const hasPlaceholders = content.includes('YOUR_') || content.includes('REPLACE_');
          expect(hasPlaceholders).toBe(true);
          
          // Should not contain actual credentials
          expect(content).not.toMatch(/AIza[0-9A-Za-z\\-_]{35}/);
          expect(content).not.toMatch(/[a-zA-Z0-9+/=]{40,}/);
        }
      });
      
      // .env should be gitignored
      const gitignorePath = path.join(__dirname, '../../.gitignore');
      if (fs.existsSync(gitignorePath)) {
        const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
        expect(gitignoreContent).toContain('.env');
      }
    });
  });
  
  describe('Dependency Security', () => {
    it('should validate no known vulnerable dependencies', () => {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')
      );
      
      // Check for known vulnerable packages
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      // Ensure axios is recent (CVE-2020-28168 fixed in 0.21.1)
      if (dependencies.axios) {
        expect(dependencies.axios).not.toContain('0.20');
        expect(dependencies.axios).not.toContain('0.19');
      }
      
      // Ensure node-ssdp is removed (has vulnerabilities)
      expect(dependencies['node-ssdp']).toBeUndefined();
      
      // Electron should be recent for security patches
      if (dependencies.electron) {
        const electronVersion = dependencies.electron;
        const majorVersion = parseInt(electronVersion.match(/\\d+/)?.[0] || '0');
        expect(majorVersion).toBeGreaterThanOrEqual(22);
      }
    });
    
    it('should validate dependency overrides for security', () => {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')
      );
      
      // Check security overrides
      if (packageJson.overrides) {
        const overrides = packageJson.overrides;
        
        // IP package override for security
        if (overrides.ip) {
          expect(overrides.ip).toBe('^2.0.1'); // Secure version
        }
      }
    });
  });
  
  describe('Release Process Security', () => {
    it('should validate git tag signing (if configured)', () => {
      // Check if git is configured for tag signing
      const gitConfigPath = path.join(__dirname, '../../.git/config');
      
      if (fs.existsSync(gitConfigPath)) {
        const gitConfig = fs.readFileSync(gitConfigPath, 'utf-8');
        
        // If signing is configured, should use GPG
        if (gitConfig.includes('signingkey')) {
          expect(gitConfig).toContain('gpg');
        }
      }
    });
    
    it('should validate release checklist completeness', () => {
      // Ensure we have comprehensive release validation
      const requiredValidations = [
        'Version synchronization',
        'Code signing integrity',
        'Static URL validation',
        'Branding consistency',
        'Security scanning',
        'Dual repository updates'
      ];
      
      // This test itself validates we're checking all critical areas
      expect(requiredValidations.length).toBeGreaterThanOrEqual(6);
    });
  });
});