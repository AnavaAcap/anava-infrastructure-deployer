/**
 * Unit Test Setup
 * Common configuration for unit tests
 */

// Import custom matchers
import './customMatchers';

// Mock logger to prevent filesystem operations during tests
jest.mock('@main/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn()
  })),
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn()
  })),
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn()
  }
}));

// Mock electron module
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn((path) => `/mock/path/${path}`),
    getVersion: jest.fn(() => '1.0.0'),
    getName: jest.fn(() => 'anava-installer'),
    on: jest.fn(),
    whenReady: jest.fn(() => Promise.resolve())
  },
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
    removeHandler: jest.fn()
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadURL: jest.fn(),
    on: jest.fn(),
    webContents: {
      send: jest.fn(),
      on: jest.fn()
    }
  })),
  dialog: {
    showMessageBox: jest.fn(),
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn()
  }
}));

// Mock fs for file operations
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    access: jest.fn()
  }
}));

// Set test environment
process.env.NODE_ENV = 'test';