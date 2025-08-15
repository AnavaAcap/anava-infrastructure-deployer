/**
 * Setup for Dual Repository Release Testing
 * 
 * Configures test environment for validating the dual repository release system:
 * - ACAP releases repository testing
 * - vision-releases repository testing
 * - Static download URL validation
 * - Branding consistency checks
 */

import '@testing-library/jest-dom';

// Global test configuration for dual repository tests
global.console = {
  ...console,
  warn: jest.fn(), // Suppress warnings in tests
  error: jest.fn(), // Capture errors for validation
};

// Mock GitHub API responses for testing
global.fetch = jest.fn();

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.GITHUB_REPOSITORY = 'AnavaAcap/anava-infrastructure-deployer';

// Test data for dual repository validation
export const testData = {
  repositories: {
    acapReleases: 'https://github.com/AnavaAcap/acap-releases',
    visionReleases: 'https://github.com/AnavaAcap/vision-releases'
  },
  staticUrls: {
    windows: 'https://github.com/AnavaAcap/vision-releases/releases/latest/download/Anava.Vision.Setup.exe',
    macos: 'https://github.com/AnavaAcap/vision-releases/releases/latest/download/Anava.Vision.dmg'
  },
  expectedBranding: {
    productName: 'Anava Vision',
    appId: 'com.anava.vision',
    shortcutName: 'Anava Vision',
    sidebarTitle: 'Vision Architect'
  },
  securityRequirements: {
    minElectronVersion: 22,
    requiredSecrets: [
      'APPLE_DEVELOPER_CERTIFICATE',
      'APPLE_DEVELOPER_CERTIFICATE_PASSWORD',
      'APPLE_ID',
      'APPLE_APP_SPECIFIC_PASSWORD',
      'GITHUB_TOKEN'
    ]
  }
};

// Mock HTTP responses for URL validation tests
beforeEach(() => {
  (fetch as jest.MockedFunction<typeof fetch>).mockClear();
});

afterEach(() => {
  jest.clearAllMocks();
});

// Helper functions for dual repository testing
export const testHelpers = {
  validateStaticUrl: (url: string): boolean => {
    return url.startsWith('https://github.com/AnavaAcap/vision-releases/releases/latest/download/');
  },
  
  validateVersionedUrl: (url: string, version: string): boolean => {
    return url.includes(version) && url.startsWith('https://github.com/AnavaAcap/acap-releases/');
  },
  
  checkBrandingConsistency: (content: string): { hasOldBranding: boolean; hasNewBranding: boolean } => {
    const hasOldBranding = content.includes('Anava Installer') && 
                          !content.includes('was') && 
                          !content.includes('formerly');
    const hasNewBranding = content.includes('Anava Vision');
    
    return { hasOldBranding, hasNewBranding };
  },
  
  validatePortSupport: (url: string): boolean => {
    const portPattern = /:\d+/;
    const ipPattern = /\d+\.\d+\.\d+\.\d+/;
    
    return ipPattern.test(url) && (portPattern.test(url) || url.includes('443') || url.includes('80'));
  }
};

// Export for use in tests
export { testData as default };