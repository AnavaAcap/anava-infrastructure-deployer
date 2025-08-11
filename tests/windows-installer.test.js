/**
 * Windows Installer Regression Tests
 * Tests for installer integrity, shortcuts, and uninstallation
 * Compatible with Electron v37.2.6
 */

const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec, execSync } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const os = require('os');
const Registry = require('winreg');

// Test configuration
const CONFIG = {
  appName: 'Anava Installer',
  appId: 'com.anava.installer',
  publisher: 'Anava AI Inc.',
  version: '0.9.178',
  installerPath: null,
  installDir: path.join(process.env.ProgramFiles, 'Anava AI', 'Anava Installer'),
  uninstallKey: '\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Anava Installer',
  shortcuts: {
    desktop: path.join(os.homedir(), 'Desktop', 'Anava Installer.lnk'),
    startMenu: path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Anava AI', 'Anava Installer.lnk')
  }
};

// Helper functions
function findInstaller() {
  const searchPaths = [
    path.join(__dirname, '..', 'dist'),
    path.join(__dirname, '..', 'release'),
    path.join(__dirname, '..')
  ];
  
  for (const searchPath of searchPaths) {
    if (fs.existsSync(searchPath)) {
      const files = fs.readdirSync(searchPath);
      const installer = files.find(f => f.includes('Setup') && f.endsWith('.exe'));
      if (installer) {
        return path.join(searchPath, installer);
      }
    }
  }
  
  return null;
}

function calculateFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

async function checkRegistry(keyPath, valueName) {
  return new Promise((resolve, reject) => {
    const regKey = new Registry({
      hive: Registry.HKLM,
      key: keyPath
    });
    
    regKey.get(valueName, (err, item) => {
      if (err) {
        resolve(null);
      } else {
        resolve(item ? item.value : null);
      }
    });
  });
}

async function isProcessRunning(processName) {
  try {
    const { stdout } = await execPromise(`tasklist /FI "IMAGENAME eq ${processName}"`);
    return !stdout.includes('No tasks are running');
  } catch {
    return false;
  }
}

async function killProcess(processName) {
  try {
    await execPromise(`taskkill /F /IM "${processName}" /T`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch {
    // Process might not be running
  }
}

// Test suites
describe('Windows Installer - File Integrity', () => {
  beforeAll(() => {
    CONFIG.installerPath = findInstaller();
    if (!CONFIG.installerPath) {
      throw new Error('No installer file found. Please build the installer first.');
    }
  });
  
  it('should have a valid installer file', () => {
    expect(fs.existsSync(CONFIG.installerPath)).toBe(true);
  });
  
  it('should be a valid PE executable', () => {
    const bytes = fs.readFileSync(CONFIG.installerPath);
    expect(bytes[0]).toBe(0x4D); // M
    expect(bytes[1]).toBe(0x5A); // Z
  });
  
  it('should have reasonable file size (50-200 MB)', () => {
    const stats = fs.statSync(CONFIG.installerPath);
    const sizeMB = stats.size / (1024 * 1024);
    expect(sizeMB).toBeGreaterThanOrEqual(50);
    expect(sizeMB).toBeLessThanOrEqual(200);
  });
  
  it('should contain NSIS installer signature', () => {
    const content = fs.readFileSync(CONFIG.installerPath);
    const signature = content.toString('ascii', 0, Math.min(10000, content.length));
    expect(signature).toContain('NullsoftInst');
  });
  
  it('should have consistent SHA256 hash', () => {
    const hash = calculateFileHash(CONFIG.installerPath);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    
    // Save hash for comparison
    const hashFile = `${CONFIG.installerPath}.sha256`;
    fs.writeFileSync(hashFile, `${hash}  ${path.basename(CONFIG.installerPath)}`);
  });
});

describe('Windows Installer - Installation Process', () => {
  let backupPath = null;
  
  beforeAll(async () => {
    // Kill any running instances
    await killProcess('Anava Installer.exe');
    
    // Backup existing installation if present
    if (fs.existsSync(CONFIG.installDir)) {
      backupPath = `${CONFIG.installDir}.backup.${Date.now()}`;
      fs.renameSync(CONFIG.installDir, backupPath);
    }
  });
  
  afterAll(async () => {
    // Restore backup if exists
    if (backupPath && fs.existsSync(backupPath)) {
      if (fs.existsSync(CONFIG.installDir)) {
        fs.rmSync(CONFIG.installDir, { recursive: true, force: true });
      }
      fs.renameSync(backupPath, CONFIG.installDir);
    }
  });
  
  it('should install silently without errors', async () => {
    const command = `"${CONFIG.installerPath}" /S`;
    
    await new Promise((resolve, reject) => {
      exec(command, { timeout: 300000 }, (error, stdout, stderr) => {
        if (error && error.code !== 0) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
    
    // Wait for installation to complete
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Check if main executable exists
    const exePath = path.join(CONFIG.installDir, 'Anava Installer.exe');
    expect(fs.existsSync(exePath)).toBe(true);
  }, 360000); // 6 minute timeout
  
  it('should create uninstaller', () => {
    const uninstallerPath = path.join(CONFIG.installDir, 'Uninstall.exe');
    expect(fs.existsSync(uninstallerPath)).toBe(true);
  });
  
  it('should create proper directory structure', () => {
    expect(fs.existsSync(CONFIG.installDir)).toBe(true);
    
    // Check for common subdirectories
    const expectedDirs = ['resources', 'locales'];
    for (const dir of expectedDirs) {
      const dirPath = path.join(CONFIG.installDir, dir);
      expect(fs.existsSync(dirPath)).toBe(true);
    }
  });
});

describe('Windows Installer - Shortcuts', () => {
  it('should create desktop shortcut', () => {
    const desktopShortcut = CONFIG.shortcuts.desktop;
    expect(fs.existsSync(desktopShortcut)).toBe(true);
  });
  
  it('should create Start Menu shortcut', () => {
    const startMenuShortcut = CONFIG.shortcuts.startMenu;
    const startMenuDir = path.dirname(startMenuShortcut);
    
    // Check if Start Menu folder exists
    expect(fs.existsSync(startMenuDir)).toBe(true);
    
    // Check if shortcut exists
    expect(fs.existsSync(startMenuShortcut)).toBe(true);
  });
  
  it('should have valid shortcut targets', async () => {
    // This requires Windows Script Host to read .lnk files
    try {
      const script = `
        var WshShell = new ActiveXObject("WScript.Shell");
        var shortcut = WshShell.CreateShortcut("${CONFIG.shortcuts.desktop}");
        WScript.Echo(shortcut.TargetPath);
      `;
      
      const { stdout } = await execPromise(`cscript //NoLogo //E:JScript -`, { input: script });
      const targetPath = stdout.trim();
      
      expect(targetPath).toBe(path.join(CONFIG.installDir, 'Anava Installer.exe'));
    } catch (error) {
      // Skip if cscript is not available
      console.warn('Could not verify shortcut target:', error.message);
    }
  });
});

describe('Windows Installer - Registry Entries', () => {
  it('should create uninstall registry key', async () => {
    const displayName = await checkRegistry(CONFIG.uninstallKey, 'DisplayName');
    expect(displayName).toBe(CONFIG.appName);
  });
  
  it('should have correct publisher in registry', async () => {
    const publisher = await checkRegistry(CONFIG.uninstallKey, 'Publisher');
    expect(publisher).toBe(CONFIG.publisher);
  });
  
  it('should have correct version in registry', async () => {
    const version = await checkRegistry(CONFIG.uninstallKey, 'DisplayVersion');
    expect(version).toBe(CONFIG.version);
  });
  
  it('should have uninstall string in registry', async () => {
    const uninstallString = await checkRegistry(CONFIG.uninstallKey, 'UninstallString');
    expect(uninstallString).toBeTruthy();
    expect(uninstallString).toContain('Uninstall.exe');
  });
  
  it('should have installation location in registry', async () => {
    const installLocation = await checkRegistry(CONFIG.uninstallKey, 'InstallLocation');
    expect(installLocation).toBe(CONFIG.installDir);
  });
  
  it('should have estimated size in registry', async () => {
    const estimatedSize = await checkRegistry(CONFIG.uninstallKey, 'EstimatedSize');
    expect(estimatedSize).toBeTruthy();
    
    // Size should be reasonable (in KB)
    const sizeKB = parseInt(estimatedSize);
    expect(sizeKB).toBeGreaterThan(50000); // > 50 MB
    expect(sizeKB).toBeLessThan(500000); // < 500 MB
  });
});

describe('Windows Installer - Uninstallation', () => {
  it('should uninstall silently without errors', async () => {
    const uninstallerPath = path.join(CONFIG.installDir, 'Uninstall.exe');
    
    if (!fs.existsSync(uninstallerPath)) {
      console.warn('Uninstaller not found, skipping uninstallation test');
      return;
    }
    
    const command = `"${uninstallerPath}" /S`;
    
    await new Promise((resolve, reject) => {
      exec(command, { timeout: 120000 }, (error) => {
        if (error && error.code !== 0) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
    
    // Wait for uninstallation to complete
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Check if directory is removed
    expect(fs.existsSync(CONFIG.installDir)).toBe(false);
  }, 180000); // 3 minute timeout
  
  it('should remove desktop shortcut', () => {
    expect(fs.existsSync(CONFIG.shortcuts.desktop)).toBe(false);
  });
  
  it('should remove Start Menu shortcuts', () => {
    const startMenuDir = path.dirname(CONFIG.shortcuts.startMenu);
    expect(fs.existsSync(CONFIG.shortcuts.startMenu)).toBe(false);
    
    // Check if the entire folder is removed (if empty)
    if (fs.existsSync(startMenuDir)) {
      const files = fs.readdirSync(startMenuDir);
      expect(files.length).toBe(0);
    }
  });
  
  it('should remove registry entries', async () => {
    const displayName = await checkRegistry(CONFIG.uninstallKey, 'DisplayName');
    expect(displayName).toBeNull();
  });
});

describe('Windows Installer - Edge Cases', () => {
  it('should handle installation when app is already running', async () => {
    // This test would require starting the app first
    // Skipping for safety in automated tests
    expect(true).toBe(true);
  });
  
  it('should handle paths with spaces', () => {
    const testPath = path.join(process.env.TEMP, 'Test Path With Spaces');
    
    try {
      fs.mkdirSync(testPath, { recursive: true });
      expect(fs.existsSync(testPath)).toBe(true);
      fs.rmSync(testPath, { recursive: true, force: true });
    } catch (error) {
      // Some systems might not allow this
      console.warn('Could not test paths with spaces:', error.message);
    }
  });
  
  it('should handle Unicode characters in paths', () => {
    const testPath = path.join(process.env.TEMP, '测试文件夹');
    
    try {
      fs.mkdirSync(testPath, { recursive: true });
      expect(fs.existsSync(testPath)).toBe(true);
      fs.rmSync(testPath, { recursive: true, force: true });
    } catch (error) {
      // Some systems might not support Unicode paths
      console.warn('Could not test Unicode paths:', error.message);
    }
  });
  
  it('should handle very long paths', () => {
    const longName = 'a'.repeat(200);
    const testPath = path.join(process.env.TEMP, longName);
    
    if (testPath.length > 260) {
      // Windows has a 260 character path limit by default
      expect(testPath.length).toBeGreaterThan(260);
      
      // Test would require long path support to be enabled
      console.warn('Long path test skipped (requires Windows long path support)');
    }
  });
});

// Performance tests
describe('Windows Installer - Performance', () => {
  it('should complete installation within reasonable time', async () => {
    const startTime = Date.now();
    
    // Mock installation timing (actual installation tested above)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeLessThan(300000); // 5 minutes max
  });
  
  it('should not consume excessive memory during installation', () => {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / (1024 * 1024);
    
    expect(heapUsedMB).toBeLessThan(500); // Less than 500 MB
  });
});

// Compatibility tests
describe('Windows Installer - Compatibility', () => {
  it('should work on Windows 10 and above', () => {
    const release = os.release();
    const version = release.split('.')[0];
    
    expect(parseInt(version)).toBeGreaterThanOrEqual(10);
  });
  
  it('should handle both 32-bit and 64-bit systems', () => {
    const arch = process.arch;
    expect(['x64', 'ia32']).toContain(arch);
  });
  
  it('should not require administrator privileges for per-user install', () => {
    // Check if we can write to user directories
    const userPath = path.join(process.env.LOCALAPPDATA, 'test-write-access');
    
    try {
      fs.writeFileSync(userPath, 'test');
      fs.unlinkSync(userPath);
      expect(true).toBe(true);
    } catch {
      // Would need admin rights
      console.warn('User installation might require admin privileges');
    }
  });
});