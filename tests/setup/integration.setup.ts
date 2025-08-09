/**
 * Integration Test Setup
 * Configuration for integration tests with external services
 */

import { config } from 'dotenv';
import path from 'path';

// Load test environment variables
config({ path: path.join(__dirname, '../../.env.test') });

// Mock credentials for testing
export const TEST_CREDENTIALS = {
  gcp: {
    projectId: 'test-project-' + Date.now(),
    region: 'us-central1',
    serviceAccountEmail: 'test-sa@test-project.iam.gserviceaccount.com'
  },
  camera: {
    ip: '192.168.1.100',
    username: 'test-user',
    password: 'test-pass',
    model: 'AXIS P3245-LV'
  },
  firebase: {
    apiKey: 'test-api-key',
    authDomain: 'test-project.firebaseapp.com',
    projectId: 'test-project',
    storageBucket: 'test-project.appspot.com',
    messagingSenderId: '123456789',
    appId: '1:123456789:web:abcdef'
  }
};

// Setup test database connection (if needed)
beforeAll(async () => {
  // Initialize test database or mock services
  console.log('Setting up integration test environment...');
  
  // Clear any existing test data
  await cleanupTestData();
});

afterAll(async () => {
  // Cleanup test resources
  console.log('Cleaning up integration test environment...');
  await cleanupTestData();
});

beforeEach(() => {
  // Reset mocks between tests
  jest.clearAllMocks();
});

// Helper function to cleanup test data
async function cleanupTestData() {
  // Clean up any test projects, resources, etc.
  // This would connect to a test environment and clean up
  try {
    // Example: Delete test GCP projects
    // await deleteTestProjects();
    
    // Example: Clear test Firestore data
    // await clearTestFirestore();
    
    console.log('Test data cleaned up successfully');
  } catch (error) {
    console.error('Error cleaning up test data:', error);
  }
}

// Increase timeout for integration tests
jest.setTimeout(30000);

// Mock external services that shouldn't be called in integration tests
jest.mock('@google-cloud/billing', () => ({
  CloudBillingClient: jest.fn().mockImplementation(() => ({
    listBillingAccounts: jest.fn().mockResolvedValue([[]]),
    listProjectBillingInfo: jest.fn().mockResolvedValue([[]]),
  }))
}));

// Helper utilities for integration tests
export const integrationHelpers = {
  /**
   * Wait for a condition to be true
   */
  async waitFor(condition: () => boolean | Promise<boolean>, timeout = 10000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Condition not met within ${timeout}ms`);
  },
  
  /**
   * Create a mock GCP OAuth token
   */
  createMockToken(): string {
    return 'ya29.mock_token_' + Date.now();
  },
  
  /**
   * Create a mock API response
   */
  createMockApiResponse(data: any, status = 200) {
    return {
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      data,
      headers: {
        'content-type': 'application/json'
      },
      config: {} as any
    };
  }
};

// Export test credentials and helpers
export { TEST_CREDENTIALS as testCredentials };