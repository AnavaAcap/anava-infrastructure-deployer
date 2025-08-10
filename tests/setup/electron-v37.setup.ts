/**
 * Setup file for Electron v37 tests
 */

// Mock electron module if not available in test environment
jest.mock('electron', () => ({
  app: {
    getVersion: jest.fn(() => '37.2.6'),
    getPath: jest.fn((name: string) => `/mock/path/${name}`),
    getName: jest.fn(() => 'anava-installer'),
    isPackaged: false,
    quit: jest.fn(),
    on: jest.fn(),
    whenReady: jest.fn(() => Promise.resolve()),
    getAppPath: jest.fn(() => '/mock/app/path'),
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadFile: jest.fn(),
    loadURL: jest.fn(),
    webContents: {
      send: jest.fn(),
      openDevTools: jest.fn(),
      on: jest.fn(),
      executeJavaScript: jest.fn(),
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
    destroy: jest.fn(),
    isDestroyed: jest.fn(() => false),
  })),
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
    removeHandler: jest.fn(),
    listenerCount: jest.fn(() => 0),
  },
  ipcRenderer: {
    invoke: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
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

// Mock child_process for Terraform tests
jest.mock('child_process', () => ({
  spawn: jest.fn(),
  exec: jest.fn(),
  execSync: jest.fn((cmd: string) => {
    // Mock responses for common commands
    if (cmd.includes('find')) {
      return 'src/main/index.ts\nsrc/main/services/gcpOAuthService.ts\n';
    }
    if (cmd.includes('npm audit')) {
      return JSON.stringify({
        metadata: {
          vulnerabilities: {
            total: 2,
            critical: 0,
            high: 2,
            moderate: 0,
            low: 0,
          },
        },
      });
    }
    return '';
  }),
}));

// Mock fs for file system operations
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn((path: string) => {
    // Return mock content based on path
    if (path.includes('package.json')) {
      return JSON.stringify({
        name: 'anava-installer',
        version: '0.9.178',
        devDependencies: {
          electron: '^37.2.6',
          'electron-builder': '^26.0.12',
        },
        dependencies: {
          axios: '^1.10.0',
        },
        overrides: {
          ip: '^2.0.1',
        },
      });
    }
    if (path.includes('main/index.ts')) {
      return `
        import { app, BrowserWindow } from 'electron';
        
        const createWindow = () => {
          const mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            webPreferences: {
              nodeIntegration: false,
              contextIsolation: true,
              sandbox: false, // Required for Terraform
            },
          });
        };
      `;
    }
    if (path.includes('preload')) {
      return `
        const { contextBridge, ipcRenderer } = require('electron');
        
        contextBridge.exposeInMainWorld('electronAPI', {
          invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
        });
      `;
    }
    return '';
  }),
  existsSync: jest.fn(() => true),
  promises: {
    writeFile: jest.fn(),
    readFile: jest.fn(),
    unlink: jest.fn(),
  },
}));

// Mock electron-store
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn((key: string) => {
      const store: Record<string, any> = {
        apiKey: 'mock-api-key',
        deploymentState: {
          projectId: 'test-project',
          region: 'us-central1',
        },
      };
      return store[key];
    }),
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
  }));
});

// Mock external libraries
jest.mock('axios');
jest.mock('bonjour-service');
jest.mock('node-ssdp');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.ELECTRON_VERSION = '37.2.6';

// Global test utilities
global.gc = jest.fn(); // Mock garbage collection

// Increase timeout for async operations
jest.setTimeout(30000);

// Suppress console output during tests unless there's an error
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
  console.log = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.log = originalConsoleLog;
});