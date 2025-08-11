/**
 * Windows Installer Regression Tests
 * Tests to prevent the three critical issues:
 * 1. Missing shortcut/executable errors
 * 2. Failed uninstallation
 * 3. NSIS integrity check failures
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

describe('Windows Installer Tests', () => {
  const isWindows = process.platform === 'win32';
  const projectRoot = path.join(__dirname, '..');
  
  // Skip tests if not on Windows or in CI without Windows
  const describeOnWindows = isWindows ? describe : describe.skip;
  
  describeOnWindows('Build Configuration', () => {
    test('electron-builder-win.yml exists and is valid', () => {
      const configPath = path.join(projectRoot, 'electron-builder-win.yml');
      expect(fs.existsSync(configPath)).toBe(true);
      
      const config = fs.readFileSync(configPath, 'utf8');
      
      // Check for critical NSIS settings
      expect(config).toContain('nsis:');
      expect(config).toContain('oneClick: false');
      expect(config).toContain('allowToChangeInstallationDirectory: true');
      expect(config).toContain('createDesktopShortcut: true');
      expect(config).toContain('createStartMenuShortcut: true');
      expect(config).toContain('perMachine: true');
      expect(config).toContain('unicode: true');
      expect(config).toContain('deleteAppDataOnUninstall: true');
      
      // Check for installer customization script
      expect(config).toContain('include: installer-scripts/installer.nsh');
    });
    
    test('Custom NSIS script exists and contains fixes', () => {
      const scriptPath = path.join(projectRoot, 'installer-scripts', 'installer.nsh');
      expect(fs.existsSync(scriptPath)).toBe(true);
      
      const script = fs.readFileSync(scriptPath, 'utf8');
      
      // Check for uninstaller fixes
      expect(script).toContain('!macro customUnInstall');
      expect(script).toContain('RMDir /r /REBOOTOK');
      expect(script).toContain('taskkill /F /IM "Anava Installer.exe"');
      
      // Check for shortcut creation fixes
      expect(script).toContain('CreateShortcut');
      expect(script).toContain('$DESKTOP\\Anava Installer.lnk');
      expect(script).toContain('$SMPROGRAMS\\Anava\\Anava Installer.lnk');
      
      // Check for force cleanup function
      expect(script).toContain('Function ForceCleanup');
      expect(script).toContain('DeleteRegKey');
    });
    
    test('Required icon files exist', () => {
      const iconFiles = [
        'assets/icon.ico',
        'assets/icon.png',
        'assets/icon.icns'
      ];
      
      iconFiles.forEach(iconFile => {
        const iconPath = path.join(projectRoot, iconFile);
        expect(fs.existsSync(iconPath)).toBe(true);
        
        // Verify icon file is not empty
        const stats = fs.statSync(iconPath);
        expect(stats.size).toBeGreaterThan(0);
      });
    });
    
    test('LICENSE.md file exists', () => {
      const licensePath = path.join(projectRoot, 'LICENSE.md');
      expect(fs.existsSync(licensePath)).toBe(true);
      
      const license = fs.readFileSync(licensePath, 'utf8');
      expect(license).toContain('Anava Inc.');
      expect(license).toContain('End User License Agreement');
    });
    
    test('All extraResources exist', () => {
      const resources = [
        'oauth-config.json',
        'functions',
        'api-gateway-config.yaml',
        'function-templates',
        'firestore-rules',
        'terraform-bin',
        'firestore-indexes.json'
      ];
      
      resources.forEach(resource => {
        const resourcePath = path.join(projectRoot, resource);
        expect(fs.existsSync(resourcePath)).toBe(true);
      });
    });
  });
  
  describeOnWindows('Build Output Verification', () => {
    let installerPath = null;
    
    beforeAll(() => {
      // Find the most recent installer
      const releaseDir = path.join(projectRoot, 'release');
      if (fs.existsSync(releaseDir)) {
        const files = fs.readdirSync(releaseDir)
          .filter(f => f.includes('Setup') && f.endsWith('.exe'))
          .map(f => ({
            name: f,
            path: path.join(releaseDir, f),
            mtime: fs.statSync(path.join(releaseDir, f)).mtime
          }))
          .sort((a, b) => b.mtime - a.mtime);
        
        if (files.length > 0) {
          installerPath = files[0].path;
        }
      }
    });
    
    test('Installer file exists and has valid size', () => {
      if (!installerPath) {
        console.warn('No installer found - skipping test');
        return;
      }
      
      expect(fs.existsSync(installerPath)).toBe(true);
      
      const stats = fs.statSync(installerPath);
      // Electron app with dependencies should be at least 50MB
      expect(stats.size).toBeGreaterThan(50 * 1024 * 1024);
      // But not unreasonably large (< 500MB)
      expect(stats.size).toBeLessThan(500 * 1024 * 1024);
    });
    
    test('Installer has valid PE header (not corrupted)', () => {
      if (!installerPath) {
        console.warn('No installer found - skipping test');
        return;
      }
      
      // Read first 2 bytes to check for MZ header
      const fd = fs.openSync(installerPath, 'r');
      const buffer = Buffer.alloc(2);
      fs.readSync(fd, buffer, 0, 2, 0);
      fs.closeSync(fd);
      
      // Check for MZ (DOS header)
      expect(buffer[0]).toBe(0x4D); // 'M'
      expect(buffer[1]).toBe(0x5A); // 'Z'
    });
    
    test('Installer checksum is consistent', () => {
      if (!installerPath) {
        console.warn('No installer found - skipping test');
        return;
      }
      
      // Calculate SHA256 hash
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(installerPath);
      
      return new Promise((resolve, reject) => {
        stream.on('data', data => hash.update(data));
        stream.on('end', () => {
          const checksum = hash.digest('hex');
          
          // Save checksum for comparison
          const checksumFile = `${installerPath}.sha256`;
          
          if (fs.existsSync(checksumFile)) {
            // Compare with existing checksum
            const existingChecksum = fs.readFileSync(checksumFile, 'utf8').trim().split(' ')[0];
            expect(checksum).toBe(existingChecksum);
          } else {
            // Save new checksum
            fs.writeFileSync(checksumFile, `${checksum} *${path.basename(installerPath)}`);
          }
          
          resolve();
        });
        stream.on('error', reject);
      });
    });
  });
  
  describeOnWindows('Registry and Shortcut Simulation', () => {
    test('Installer registry keys are properly defined', () => {
      const nshPath = path.join(projectRoot, 'installer-scripts', 'installer.nsh');
      const nshContent = fs.readFileSync(nshPath, 'utf8');
      
      // Check for proper registry key definitions
      const requiredKeys = [
        'Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${UNINSTALL_APP_KEY}',
        'Software\\Anava\\Anava Installer',
        'DisplayName',
        'UninstallString',
        'InstallLocation',
        'DisplayIcon',
        'Publisher',
        'DisplayVersion'
      ];
      
      requiredKeys.forEach(key => {
        expect(nshContent).toContain(key);
      });
    });
    
    test('Shortcut paths are correctly formatted', () => {
      const nshPath = path.join(projectRoot, 'installer-scripts', 'installer.nsh');
      const nshContent = fs.readFileSync(nshPath, 'utf8');
      
      // Check shortcut creation commands
      expect(nshContent).toMatch(/CreateShortcut\s+"\$DESKTOP\\Anava Installer\.lnk"\s+"\$INSTDIR\\Anava Installer\.exe"/);
      expect(nshContent).toMatch(/CreateShortcut\s+"\$SMPROGRAMS\\Anava\\Anava Installer\.lnk"\s+"\$INSTDIR\\Anava Installer\.exe"/);
      
      // Check that shortcuts reference the actual executable
      expect(nshContent).toContain('"$INSTDIR\\Anava Installer.exe"');
      
      // Verify executable existence check
      expect(nshContent).toContain('${If} ${FileExists} "$INSTDIR\\Anava Installer.exe"');
    });
  });
  
  describeOnWindows('Uninstaller Tests', () => {
    test('Uninstaller includes force cleanup logic', () => {
      const nshPath = path.join(projectRoot, 'installer-scripts', 'installer.nsh');
      const nshContent = fs.readFileSync(nshPath, 'utf8');
      
      // Check for process termination
      expect(nshContent).toContain('taskkill /F /IM "Anava Installer.exe"');
      
      // Check for directory removal with reboot flag
      expect(nshContent).toContain('RMDir /r /REBOOTOK "$INSTDIR"');
      
      // Check for app data cleanup
      expect(nshContent).toContain('RMDir /r "$APPDATA\\anava-installer"');
      expect(nshContent).toContain('RMDir /r "$LOCALAPPDATA\\anava-installer"');
      
      // Check for registry cleanup
      expect(nshContent).toContain('DeleteRegKey HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall');
      expect(nshContent).toContain('DeleteRegKey HKLM "Software\\Anava"');
    });
    
    test('Uninstaller handles locked files', () => {
      const nshPath = path.join(projectRoot, 'installer-scripts', 'installer.nsh');
      const nshContent = fs.readFileSync(nshPath, 'utf8');
      
      // Check for reboot-based removal
      expect(nshContent).toContain('/REBOOTOK');
      
      // Check for force removal via cmd
      expect(nshContent).toContain('cmd /c rd /s /q');
    });
  });
  
  describe('Error Prevention Tests', () => {
    test('Package name matches product name in configs', () => {
      const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
      const winConfig = fs.readFileSync(path.join(projectRoot, 'electron-builder-win.yml'), 'utf8');
      
      expect(winConfig).toContain(`productName: ${packageJson.build.productName}`);
      expect(winConfig).toContain('Anava Installer');
    });
    
    test('Artifact name pattern is consistent', () => {
      const winConfig = fs.readFileSync(path.join(projectRoot, 'electron-builder-win.yml'), 'utf8');
      
      // Check for proper artifact naming
      expect(winConfig).toContain('artifactName: "${productName}-Setup-${version}-${arch}.${ext}"');
    });
    
    test('NSIS compression settings prevent corruption', () => {
      const winConfig = fs.readFileSync(path.join(projectRoot, 'electron-builder-win.yml'), 'utf8');
      
      // Check for compression settings
      expect(winConfig).toContain('compression: maximum');
      expect(winConfig).toContain('packElevateHelper: true');
      
      const nshContent = fs.readFileSync(path.join(projectRoot, 'installer-scripts', 'installer.nsh'), 'utf8');
      expect(nshContent).toContain('SetCompressor /SOLID lzma');
      expect(nshContent).toContain('CRCCheck force');
    });
  });
  
  describe('Build Script Tests', () => {
    test('Windows build script exists and is valid', () => {
      const scriptPath = path.join(projectRoot, 'scripts', 'build-win.js');
      expect(fs.existsSync(scriptPath)).toBe(true);
      
      const script = fs.readFileSync(scriptPath, 'utf8');
      
      // Check for critical build steps
      expect(script).toContain('npm ci');
      expect(script).toContain('npm run build:main');
      expect(script).toContain('npm run build:renderer');
      expect(script).toContain('electron-builder --win --config electron-builder-win.yml');
      
      // Check for Windows-specific fixes
      expect(script).toContain('@rollup/rollup-win32-x64-msvc');
      
      // Check for verification steps
      expect(script).toContain('Verifying build output');
      expect(script).toContain('Verifying installer creation');
    });
    
    test('Verification script exists', () => {
      const scriptPath = path.join(projectRoot, 'scripts', 'verify-win-installer.ps1');
      expect(fs.existsSync(scriptPath)).toBe(true);
      
      const script = fs.readFileSync(scriptPath, 'utf8');
      
      // Check for verification steps
      expect(script).toContain('Get-FileHash');
      expect(script).toContain('Test-DigitalSignature');
      expect(script).toContain('Test-NSISStructure');
      expect(script).toContain('Unblock-File');
    });
  });
});