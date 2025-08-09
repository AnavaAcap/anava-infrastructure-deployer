/**
 * Unit Test Setup
 * Configuration and global mocks for unit tests
 */

import { TextEncoder, TextDecoder } from 'util';

// Polyfill for Node.js environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Mock console methods to reduce noise during tests
const originalConsole = { ...console };
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  // Keep error and warn for debugging
  error: originalConsole.error,
  warn: originalConsole.warn,
};

// Mock timers for controlled testing
beforeEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.IS_TEST = 'true';

// Mock Electron Store for unit tests
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => {
    const store = new Map();
    return {
      get: jest.fn((key: string, defaultValue?: any) => store.get(key) ?? defaultValue),
      set: jest.fn((key: string, value: any) => store.set(key, value)),
      delete: jest.fn((key: string) => store.delete(key)),
      clear: jest.fn(() => store.clear()),
      has: jest.fn((key: string) => store.has(key)),
      store
    };
  });
});

// Mock fs/promises for controlled file operations
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  access: jest.fn(),
  stat: jest.fn(),
  readdir: jest.fn(),
  unlink: jest.fn(),
  rmdir: jest.fn()
}));

// Increase timeout for async operations
jest.setTimeout(10000);

// Custom matchers for better assertions
expect.extend({
  toBeValidUrl(received: string) {
    try {
      new URL(received);
      return {
        pass: true,
        message: () => `Expected ${received} not to be a valid URL`
      };
    } catch {
      return {
        pass: false,
        message: () => `Expected ${received} to be a valid URL`
      };
    }
  },
  
  toBeValidIP(received: string) {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const pass = ipRegex.test(received);
    return {
      pass,
      message: () => pass 
        ? `Expected ${received} not to be a valid IP address`
        : `Expected ${received} to be a valid IP address`
    };
  },
  
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    return {
      pass,
      message: () => pass
        ? `Expected ${received} not to be within range ${floor} - ${ceiling}`
        : `Expected ${received} to be within range ${floor} - ${ceiling}`
    };
  }
});

// Declare custom matchers for TypeScript
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUrl(): R;
      toBeValidIP(): R;
      toBeWithinRange(floor: number, ceiling: number): R;
    }
  }
}