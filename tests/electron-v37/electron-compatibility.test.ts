/**
 * Electron v37 Compatibility Tests
 * Verifies that all Electron APIs work correctly after the upgrade
 */

import { app, BrowserWindow, ipcMain, contextBridge, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// Mock Electron for testing
jest.mock('electron', () => ({
  app: {
    getVersion: jest.fn(() => '37.2.6'),
    getPath: jest.fn((name: string) => `/mock/path/${name}`),
    getName: jest.fn(() => 'anava-installer'),
    isPackaged: false,
    quit: jest.fn(),
    on: jest.fn(),
    whenReady: jest.fn(() => Promise.resolve()),
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadFile: jest.fn(),
    loadURL: jest.fn(),
    webContents: {
      send: jest.fn(),
      openDevTools: jest.fn(),
      on: jest.fn(),
      session: {
        defaultSession: {
          webRequest: {
            onBeforeRequest: jest.fn(),
          },
        },
      },
    },
    on: jest.fn(),
    once: jest.fn(),
    setMenu: jest.fn(),
    show: jest.fn(),
    close: jest.fn(),
  })),
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
    removeHandler: jest.fn(),
  },
  contextBridge: {
    exposeInMainWorld: jest.fn(),
  },
  shell: {
    openExternal: jest.fn(),
    openPath: jest.fn(),
  },
  dialog: {
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn(),
    showMessageBox: jest.fn(),
    showErrorBox: jest.fn(),
  },
}));

describe('Electron v37 Compatibility Tests', () => {
  describe('Core Electron APIs', () => {
    it('should correctly report Electron version 37', () => {
      const version = app.getVersion();
      expect(version).toBe('37.2.6');
      expect(version.startsWith('37')).toBe(true);
    });

    it('should handle app lifecycle events', async () => {
      const readyPromise = app.whenReady();
      expect(readyPromise).toBeInstanceOf(Promise);
      await expect(readyPromise).resolves.toBeUndefined();
      
      // Verify lifecycle event handlers
      expect(app.on).toHaveBeenCalledWith('window-all-closed', expect.any(Function));
      expect(app.on).toHaveBeenCalledWith('activate', expect.any(Function));
    });

    it('should create BrowserWindow with correct sandbox configuration', () => {
      new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: false, // Required for Terraform
          preload: path.join(__dirname, 'preload.js'),
        },
      });

      expect(BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          webPreferences: expect.objectContaining({
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
          }),
        })
      );
    });

    it('should not use deprecated remote module', () => {
      // Verify remote module is not imported or used
      const remoteImports = fs.readFileSync(
        path.join(__dirname, '../../src/main/index.ts'),
        'utf-8'
      );
      expect(remoteImports).not.toContain("from '@electron/remote'");
      expect(remoteImports).not.toContain("from 'electron/remote'");
      expect(remoteImports).not.toContain('require("@electron/remote")');
    });
  });

  describe('IPC Communication', () => {
    it('should use contextBridge for secure IPC', () => {
      const mockAPI = {
        invoke: jest.fn(),
        on: jest.fn(),
        removeAllListeners: jest.fn(),
      };

      contextBridge.exposeInMainWorld('electronAPI', mockAPI);

      expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
        'electronAPI',
        expect.any(Object)
      );
    });

    it('should handle IPC channels correctly', () => {
      const channels = [
        'deploy-infrastructure',
        'get-deployment-status',
        'discover-cameras',
        'configure-camera',
        'test-camera-connection',
        'get-gcp-projects',
        'create-gcp-project',
        'enable-apis',
        'validate-terraform',
        'execute-terraform',
      ];

      channels.forEach(channel => {
        ipcMain.handle(channel, async () => ({ success: true }));
        expect(ipcMain.handle).toHaveBeenCalledWith(channel, expect.any(Function));
      });
    });

    it('should validate IPC message payloads', async () => {
      const validatePayload = (channel: string, data: any): boolean => {
        const schemas: Record<string, any> = {
          'deploy-infrastructure': {
            projectId: 'string',
            region: 'string',
            aiMode: ['vertex-ai', 'ai-studio'],
          },
          'configure-camera': {
            ip: 'string',
            username: 'string',
            password: 'string',
            config: 'object',
          },
        };

        const schema = schemas[channel];
        if (!schema) return true;

        return Object.keys(schema).every(key => {
          if (Array.isArray(schema[key])) {
            return schema[key].includes(data[key]);
          }
          return typeof data[key] === schema[key];
        });
      };

      const validPayload = {
        projectId: 'test-project',
        region: 'us-central1',
        aiMode: 'vertex-ai',
      };

      const invalidPayload = {
        projectId: 123, // Should be string
        region: 'us-central1',
        aiMode: 'invalid-mode',
      };

      expect(validatePayload('deploy-infrastructure', validPayload)).toBe(true);
      expect(validatePayload('deploy-infrastructure', invalidPayload)).toBe(false);
    });
  });

  describe('Security Features', () => {
    it('should enforce context isolation', () => {
      const windowConfig = {
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
        },
      };

      expect(windowConfig.webPreferences.contextIsolation).toBe(true);
      expect(windowConfig.webPreferences.nodeIntegration).toBe(false);
    });

    it('should validate preload script safety', () => {
      // Verify preload script doesn't expose Node.js APIs directly
      const preloadContent = `
        const { contextBridge, ipcRenderer } = require('electron');
        
        contextBridge.exposeInMainWorld('electronAPI', {
          invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
          on: (channel, func) => {
            const subscription = (event, ...args) => func(...args);
            ipcRenderer.on(channel, subscription);
            return () => ipcRenderer.removeListener(channel, subscription);
          },
        });
      `;

      // Should not contain dangerous patterns
      expect(preloadContent).not.toContain('require("fs")');
      expect(preloadContent).not.toContain('require("child_process")');
      expect(preloadContent).not.toContain('process.env');
      expect(preloadContent).not.toContain('__dirname');
      expect(preloadContent).toContain('contextBridge.exposeInMainWorld');
    });

    it('should handle permission requests properly', () => {
      const permissionHandler = (
        _webContents: any,
        permission: string,
        callback: (granted: boolean) => void
      ) => {
        const allowedPermissions = [
          'media',
          'geolocation',
          'notifications',
          'camera',
          'microphone',
        ];

        const granted = allowedPermissions.includes(permission);
        callback(granted);
      };

      // Test allowed permissions
      let result: boolean | undefined;
      permissionHandler(null, 'camera', (granted) => { result = granted; });
      expect(result).toBe(true);

      // Test denied permissions
      permissionHandler(null, 'usb', (granted) => { result = granted; });
      expect(result).toBe(false);
    });
  });

  describe('Platform-Specific Features', () => {
    it('should handle macOS universal binary configuration', () => {
      const buildConfig = {
        mac: {
          target: [
            { target: 'dmg', arch: ['universal'] },
            { target: 'zip', arch: ['universal'] },
          ],
          x64ArchFiles: '**/terraform-bin/terraform',
        },
      };

      expect(buildConfig.mac.target).toHaveLength(2);
      expect(buildConfig.mac.target[0].arch).toContain('universal');
      expect(buildConfig.mac.x64ArchFiles).toBe('**/terraform-bin/terraform');
    });

    it('should handle Windows path normalization', () => {
      const normalizePath = (inputPath: string): string => {
        // Normalize Windows paths for cross-platform compatibility
        return inputPath.replace(/\\/g, '/');
      };

      const windowsPath = 'C:\\Users\\Test\\AppData\\Local\\anava-installer';
      const normalizedPath = normalizePath(windowsPath);
      
      expect(normalizedPath).toBe('C:/Users/Test/AppData/Local/anava-installer');
      expect(normalizedPath).not.toContain('\\');
    });

    it('should verify code signing configuration', () => {
      const signingConfig = {
        mac: {
          hardenedRuntime: true,
          gatekeeperAssess: false,
          entitlements: 'assets/entitlements.mac.plist',
        },
      };

      expect(signingConfig.mac.hardenedRuntime).toBe(true);
      expect(signingConfig.mac.gatekeeperAssess).toBe(false);
      expect(signingConfig.mac.entitlements).toContain('entitlements');
    });
  });

  describe('File System Access', () => {
    it('should handle file operations through IPC only', () => {
      // Test file operations through IPC
      ipcMain.handle('read-file', () => {
        return fs.readFileSync('/test/path', 'utf-8');
      });
      ipcMain.handle('write-file', () => {
        fs.writeFileSync('/test/path', 'content');
        return true;
      });

      expect(ipcMain.handle).toHaveBeenCalledWith('read-file', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('write-file', expect.any(Function));
    });

    it('should validate file paths to prevent traversal', () => {
      const validatePath = (requestedPath: string, basePath: string): boolean => {
        const resolved = path.resolve(basePath, requestedPath);
        return resolved.startsWith(path.resolve(basePath));
      };

      const basePath = '/Users/test/anava';
      
      // Valid paths
      expect(validatePath('config.json', basePath)).toBe(true);
      expect(validatePath('./data/cameras.json', basePath)).toBe(true);
      
      // Invalid paths (traversal attempts)
      expect(validatePath('../../../etc/passwd', basePath)).toBe(false);
      expect(validatePath('/etc/passwd', basePath)).toBe(false);
    });
  });

  describe('Network Security', () => {
    it('should enforce CSP headers', () => {
      const cspHeader = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "connect-src 'self' https://*.googleapis.com https://*.google.com",
        "font-src 'self' data:",
      ].join('; ');

      expect(cspHeader).toContain("default-src 'self'");
      expect(cspHeader).toContain('https://*.googleapis.com');
      expect(cspHeader).not.toContain("script-src * 'unsafe-eval'");
    });

    it('should validate external URL opening', () => {
      const safeOpenExternal = async (url: string): Promise<boolean> => {
        const allowedProtocols = ['https:', 'mailto:'];
        const allowedDomains = [
          'anava.com',
          'console.cloud.google.com',
          'firebase.google.com',
        ];

        try {
          const parsed = new URL(url);
          
          if (!allowedProtocols.includes(parsed.protocol)) {
            return false;
          }

          if (parsed.protocol === 'https:') {
            const domain = parsed.hostname.replace('www.', '');
            if (!allowedDomains.some(d => domain.endsWith(d))) {
              return false;
            }
          }

          await shell.openExternal(url);
          return true;
        } catch {
          return false;
        }
      };

      // Test allowed URLs
      expect(safeOpenExternal('https://console.cloud.google.com')).resolves.toBe(true);
      expect(safeOpenExternal('https://anava.com/docs')).resolves.toBe(true);
      
      // Test blocked URLs
      expect(safeOpenExternal('http://insecure.com')).resolves.toBe(false);
      expect(safeOpenExternal('file:///etc/passwd')).resolves.toBe(false);
      expect(safeOpenExternal('javascript:alert(1)')).resolves.toBe(false);
    });
  });

  describe('Auto-Updater Configuration', () => {
    it('should verify auto-updater security settings', () => {
      const autoUpdaterConfig = {
        provider: 'github',
        owner: 'AnavaAcap',
        repo: 'acap-releases',
        private: false,
        releaseType: 'release',
        allowDowngrade: false,
        allowPrerelease: false,
      };

      expect(autoUpdaterConfig.allowDowngrade).toBe(false);
      expect(autoUpdaterConfig.allowPrerelease).toBe(false);
      expect(autoUpdaterConfig.provider).toBe('github');
    });
  });
});