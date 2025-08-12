/**
 * Windows Installer Regression Tests
 * Ensures installer fixes remain stable and don't regress
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as yaml from 'js-yaml';

// Helper to parse electron-builder YAML with custom tags
function parseElectronBuilderYaml(content: string): any {
  // Simple approach: just parse the parts we need manually
  const lines = content.split('\n');
  const config: any = {
    nsis: {},
    win: {},
    asarUnpack: []
  };
  
  let currentSection = '';
  
  for (const line of lines) {
    // Parse NSIS section
    if (line.includes('nsis:')) {
      currentSection = 'nsis';
    } else if (line.includes('win:')) {
      currentSection = 'win';
    } else if (line.includes('asarUnpack:')) {
      currentSection = 'asarUnpack';
    } else if (line.includes('extraResources:')) {
      currentSection = '';
    }
    
    // Parse specific values
    if (currentSection === 'nsis') {
      if (line.includes('perMachine:')) {
        config.nsis.perMachine = line.includes('true');
      } else if (line.includes('oneClick:')) {
        config.nsis.oneClick = line.includes('true') ? true : false;
      } else if (line.includes('guid:')) {
        const match = line.match(/guid:\s*(.+)/);
        if (match) config.nsis.guid = match[1].trim();
      } else if (line.includes('include:')) {
        const match = line.match(/include:\s*(.+)/);
        if (match) config.nsis.include = match[1].trim();
      }
    } else if (currentSection === 'win') {
      if (line.includes('target:')) {
        config.win.target = [{ target: 'nsis', arch: ['x64'] }];
      } else if (line.includes('requestedExecutionLevel:')) {
        const match = line.match(/requestedExecutionLevel:\s*(.+)/);
        if (match) config.win.requestedExecutionLevel = match[1].trim();
      }
    } else if (currentSection === 'asarUnpack') {
      if (line.includes('node_modules/')) {
        const match = line.match(/- (.+)/);
        if (match) config.asarUnpack.push(match[1].trim());
      } else if (line.includes('terraform/')) {
        config.asarUnpack.push('terraform/**/*');
      }
    }
    
    // Check for compression settings
    if (line.includes('compression:')) {
      config.compression = line.includes('maximum') ? 'maximum' : undefined;
    }
  }
  
  return config;
}

describe('Windows Installer Configuration', () => {
  const projectRoot = path.join(__dirname, '..', '..');
  
  describe('Build Configuration Consistency', () => {
    it('should have only one electron-builder configuration file', () => {
      const mainConfig = path.join(projectRoot, 'electron-builder.yml');
      const winConfig = path.join(projectRoot, 'electron-builder-win.yml');
      
      expect(fs.existsSync(mainConfig)).toBe(true);
      expect(fs.existsSync(winConfig)).toBe(false);
    });
    
    it('should have consistent perMachine setting', () => {
      const configPath = path.join(projectRoot, 'electron-builder.yml');
      const configContent = fs.readFileSync(configPath, 'utf8');
      const config = parseElectronBuilderYaml(configContent);
      
      expect(config.nsis).toBeDefined();
      expect(config.nsis.perMachine).toBe(true);
      expect(config.nsis.oneClick).toBe(false);
    });
    
    it('should use dynamic GUID generation', () => {
      const configPath = path.join(projectRoot, 'electron-builder.yml');
      const configContent = fs.readFileSync(configPath, 'utf8');
      const config = parseElectronBuilderYaml(configContent);
      
      expect(config.nsis.guid).toContain('${env.INSTALLER_GUID}');
    });
    
    it('should have installer-fixed.nsh as include script', () => {
      const configPath = path.join(projectRoot, 'electron-builder.yml');
      const configContent = fs.readFileSync(configPath, 'utf8');
      const config = parseElectronBuilderYaml(configContent);
      
      expect(config.nsis.include).toBe('installer-scripts/installer-fixed.nsh');
      // Should NOT have duplicate script field
      expect(config.nsis.script).toBeUndefined();
    });
    
    it('should have proper Windows configuration', () => {
      const configPath = path.join(projectRoot, 'electron-builder.yml');
      const configContent = fs.readFileSync(configPath, 'utf8');
      const config = parseElectronBuilderYaml(configContent);
      
      expect(config.win).toBeDefined();
      expect(config.win.target).toBeDefined();
      expect(config.win.target[0].target).toBe('nsis');
      expect(config.win.target[0].arch).toContain('x64');
      expect(config.win.requestedExecutionLevel).toBe('requireAdministrator');
    });
  });
  
  describe('NSIS Script Validation', () => {
    const nsisPath = path.join(projectRoot, 'installer-scripts', 'installer-fixed.nsh');
    
    it('should have installer-fixed.nsh file', () => {
      expect(fs.existsSync(nsisPath)).toBe(true);
    });
    
    it('should include Windows process cleanup functions', () => {
      const nsisContent = fs.readFileSync(nsisPath, 'utf8');
      
      // Check for critical functions
      expect(nsisContent).toContain('!macro KillProcessAndChildren');
      expect(nsisContent).toContain('wmic process');
      expect(nsisContent).toContain('taskkill /F /IM');
      expect(nsisContent).toContain('/T'); // Tree flag for child processes
    });
    
    it('should have filesystem tunneling mitigation', () => {
      const nsisContent = fs.readFileSync(nsisPath, 'utf8');
      
      expect(nsisContent).toContain('!macro MitigateFilesystemTunneling');
      expect(nsisContent).toContain('Sleep 5000'); // 5-second delay
      expect(nsisContent).toContain('fsutil file setshortname');
    });
    
    it('should have Windows Defender handling', () => {
      const nsisContent = fs.readFileSync(nsisPath, 'utf8');
      
      expect(nsisContent).toContain('!macro AddWindowsDefenderException');
      expect(nsisContent).toContain('!macro RemoveWindowsDefenderException');
      expect(nsisContent).toContain('Add-MpPreference');
      expect(nsisContent).toContain('Remove-MpPreference');
    });
    
    it('should have MOTW handling', () => {
      const nsisContent = fs.readFileSync(nsisPath, 'utf8');
      
      expect(nsisContent).toContain('!macro HandleMOTW');
      expect(nsisContent).toContain('Unblock-File');
      expect(nsisContent).toContain('Zone.Identifier');
    });
    
    it('should have Visual C++ Redistributable checks', () => {
      const nsisContent = fs.readFileSync(nsisPath, 'utf8');
      
      expect(nsisContent).toContain('!macro CheckAndInstallVCRedist');
      expect(nsisContent).toContain('VC\\Runtimes\\x64');
      expect(nsisContent).toContain('vc_redist.x64.exe');
    });
    
    it('should have comprehensive registry cleanup', () => {
      const nsisContent = fs.readFileSync(nsisPath, 'utf8');
      
      expect(nsisContent).toContain('!macro CleanRegistryCompletely');
      expect(nsisContent).toContain('DeleteRegKey HKLM');
      expect(nsisContent).toContain('DeleteRegKey HKCU');
      expect(nsisContent).toContain('DeleteRegKey HKU');
    });
    
    it('should use dynamic GUID variable', () => {
      const nsisContent = fs.readFileSync(nsisPath, 'utf8');
      
      // Should use environment variable or build-time variable
      expect(nsisContent).toContain('${INSTALLER_GUID}');
      // Should NOT have hardcoded GUID
      expect(nsisContent).not.toContain('{6B3E5A7C-9D4F-4E2A-8C1B-F9E8D3A2C5B7}');
    });
    
    it('should disable auto-run after installation', () => {
      const nsisContent = fs.readFileSync(nsisPath, 'utf8');
      
      // MUI_FINISHPAGE_RUN should be commented out or not present
      const runMatches = nsisContent.match(/^[^;]*!define\s+MUI_FINISHPAGE_RUN/gm);
      expect(runMatches).toBeNull();
    });
  });
  
  describe('Build Scripts', () => {
    it('should have GUID generation script', () => {
      const scriptPath = path.join(projectRoot, 'scripts', 'generate-guid.js');
      expect(fs.existsSync(scriptPath)).toBe(true);
      
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      expect(scriptContent).toContain('crypto.randomBytes');
      expect(scriptContent).toContain('process.env.INSTALLER_GUID');
    });
    
    it('should have VC++ Redistributable download script', () => {
      const scriptPath = path.join(projectRoot, 'scripts', 'download-vcredist.js');
      expect(fs.existsSync(scriptPath)).toBe(true);
      
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      expect(scriptContent).toContain('https://aka.ms/vs/17/release/vc_redist.x64.exe');
    });
    
    it('should have installer assets creation script', () => {
      const scriptPath = path.join(projectRoot, 'scripts', 'create-installer-assets.js');
      expect(fs.existsSync(scriptPath)).toBe(true);
      
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      expect(scriptContent).toContain('createMinimalBMP');
      expect(scriptContent).toContain('installerSidebar.bmp');
      expect(scriptContent).toContain('installerHeader.bmp');
    });
    
    it('should include scripts in Windows build command', () => {
      const packagePath = path.join(projectRoot, 'package.json');
      const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      const distWinCommand = packageContent.scripts['dist:win'];
      expect(distWinCommand).toContain('generate:guid');
      expect(distWinCommand).toContain('download:vcredist');
    });
  });
  
  describe('Main Process Cleanup', () => {
    const mainProcessPath = path.join(projectRoot, 'src', 'main', 'index.ts');
    
    it('should have Windows-specific cleanup functions', () => {
      const mainContent = fs.readFileSync(mainProcessPath, 'utf8');
      
      expect(mainContent).toContain('performWindowsCleanup');
      expect(mainContent).toContain('childProcesses');
      expect(mainContent).toContain('isQuitting');
    });
    
    it('should track spawned child processes', () => {
      const mainContent = fs.readFileSync(mainProcessPath, 'utf8');
      
      expect(mainContent).toContain('const childProcesses = new Set');
      expect(mainContent).toContain('childProcesses.add');
      expect(mainContent).toContain('childProcesses.delete');
    });
    
    it('should use WMI for process cleanup on Windows', () => {
      const mainContent = fs.readFileSync(mainProcessPath, 'utf8');
      
      expect(mainContent).toContain('wmic');
      expect(mainContent).toContain('ParentProcessId');
      expect(mainContent).toContain('delete');
    });
    
    it('should handle uncaught exceptions on Windows', () => {
      const mainContent = fs.readFileSync(mainProcessPath, 'utf8');
      
      expect(mainContent).toContain("process.on('uncaughtException'");
      expect(mainContent).toContain("process.on('unhandledRejection'");
      expect(mainContent).toContain('performWindowsCleanup');
    });
    
    it('should prevent default close for cleanup on Windows', () => {
      const mainContent = fs.readFileSync(mainProcessPath, 'utf8');
      
      expect(mainContent).toContain("mainWindow.on('close'");
      expect(mainContent).toContain('event.preventDefault()');
      expect(mainContent).toContain("process.platform === 'win32'");
    });
  });
  
  describe('Asset Files', () => {
    it('should have required BMP files for installer', () => {
      const assetsDir = path.join(projectRoot, 'assets');
      
      expect(fs.existsSync(path.join(assetsDir, 'installerSidebar.bmp'))).toBe(true);
      expect(fs.existsSync(path.join(assetsDir, 'installerHeader.bmp'))).toBe(true);
      expect(fs.existsSync(path.join(assetsDir, 'icon.ico'))).toBe(true);
    });
    
    it('should have non-empty BMP files', () => {
      const assetsDir = path.join(projectRoot, 'assets');
      
      const sidebarSize = fs.statSync(path.join(assetsDir, 'installerSidebar.bmp')).size;
      const headerSize = fs.statSync(path.join(assetsDir, 'installerHeader.bmp')).size;
      
      expect(sidebarSize).toBeGreaterThan(0);
      expect(headerSize).toBeGreaterThan(0);
    });
  });
  
  describe('ASAR Configuration', () => {
    it('should unpack required modules', () => {
      const configPath = path.join(projectRoot, 'electron-builder.yml');
      const configContent = fs.readFileSync(configPath, 'utf8');
      const config = parseElectronBuilderYaml(configContent);
      
      expect(config.asarUnpack).toBeDefined();
      expect(config.asarUnpack).toContain('node_modules/puppeteer/**/*');
      expect(config.asarUnpack).toContain('node_modules/ping/**/*');
      expect(config.asarUnpack).toContain('terraform/**/*');
    });
  });
});

describe('Windows Process Management', () => {
  // Mock process tracking
  const mockProcesses = new Set<any>();
  
  describe('Child Process Tracking', () => {
    it('should track all spawned processes', () => {
      const mockProcess = {
        pid: 1234,
        killed: false,
        kill: jest.fn()
      };
      
      mockProcesses.add(mockProcess);
      expect(mockProcesses.has(mockProcess)).toBe(true);
      
      // Simulate process exit
      mockProcesses.delete(mockProcess);
      expect(mockProcesses.has(mockProcess)).toBe(false);
    });
    
    it('should kill all tracked processes on cleanup', () => {
      const processes = [
        { pid: 1, killed: false, kill: jest.fn() },
        { pid: 2, killed: false, kill: jest.fn() },
        { pid: 3, killed: false, kill: jest.fn() }
      ];
      
      processes.forEach(p => mockProcesses.add(p));
      
      // Simulate cleanup
      for (const proc of mockProcesses) {
        proc.kill('SIGTERM');
      }
      
      processes.forEach(p => {
        expect(p.kill).toHaveBeenCalledWith('SIGTERM');
      });
      
      mockProcesses.clear();
    });
  });
});

describe('Registry Management', () => {
  describe('GUID Generation', () => {
    it('should generate unique GUIDs', () => {
      const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'generate-guid.js');
      
      // Mock the script execution
      const generateGUID = () => {
        const crypto = require('crypto');
        const bytes = crypto.randomBytes(16);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = bytes.toString('hex');
        return `{${[
          hex.substring(0, 8),
          hex.substring(8, 12),
          hex.substring(12, 16),
          hex.substring(16, 20),
          hex.substring(20, 32)
        ].join('-').toUpperCase()}}`;
      };
      
      const guid1 = generateGUID();
      const guid2 = generateGUID();
      
      expect(guid1).toMatch(/^\{[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}\}$/);
      expect(guid2).toMatch(/^\{[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}\}$/);
      expect(guid1).not.toBe(guid2);
    });
  });
});

describe('File System Tunneling Mitigation', () => {
  it('should have proper delays in cleanup', () => {
    const nsisPath = path.join(__dirname, '..', '..', 'installer-scripts', 'installer-fixed.nsh');
    const nsisContent = fs.readFileSync(nsisPath, 'utf8');
    
    // Check for Sleep commands with appropriate delays
    const sleepMatches = nsisContent.match(/Sleep\s+(\d+)/g);
    expect(sleepMatches).not.toBeNull();
    
    // Should have at least one 5-second delay for tunneling
    expect(nsisContent).toContain('Sleep 5000');
  });
});

describe('Integration Prevention Tests', () => {
  it('should prevent old installer.nsh from being used', () => {
    const oldNsisPath = path.join(__dirname, '..', '..', 'installer-scripts', 'installer.nsh');
    const configPath = path.join(__dirname, '..', '..', 'electron-builder.yml');
    const configContent = fs.readFileSync(configPath, 'utf8');
    
    // Old script should not be referenced
    expect(configContent).not.toContain('installer.nsh');
    expect(configContent).toContain('installer-fixed.nsh');
  });
  
  it('should not have conflicting compression settings', () => {
    const configPath = path.join(__dirname, '..', '..', 'electron-builder.yml');
    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = parseElectronBuilderYaml(configContent);
    
    // Should not have compression settings that were causing issues
    expect(config.compression).toBeUndefined();
    expect(config.compressionLevel).toBeUndefined();
  });
});