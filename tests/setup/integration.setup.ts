/**
 * Integration Test Setup
 * Common utilities and mocks for integration tests
 */

export const TEST_CREDENTIALS = {
  gcp: {
    projectId: 'test-project-123',
    region: 'us-central1',
    projectNumber: '123456789'
  },
  firebase: {
    apiKey: 'AIza-test-key-123',
    authDomain: 'test-project-123.firebaseapp.com',
    projectId: 'test-project-123',
    storageBucket: 'test-project-123.appspot.com',
    messagingSenderId: '123456789',
    appId: '1:123456789:web:abcdef123456'
  },
  camera: {
    ip: '192.168.1.100',
    username: 'root',
    password: 'testpass123'
  }
};

export const integrationHelpers = {
  createMockToken: () => {
    return 'ya29.test-access-token-' + Date.now();
  },
  
  createMockServiceAccount: (name: string) => {
    return {
      email: `${name}@${TEST_CREDENTIALS.gcp.projectId}.iam.gserviceaccount.com`,
      name: `projects/${TEST_CREDENTIALS.gcp.projectId}/serviceAccounts/${name}@${TEST_CREDENTIALS.gcp.projectId}.iam.gserviceaccount.com`,
      projectId: TEST_CREDENTIALS.gcp.projectId,
      uniqueId: '1234567890' + name.length
    };
  },
  
  createMockCloudFunction: (name: string) => {
    return {
      name: `projects/${TEST_CREDENTIALS.gcp.projectId}/locations/${TEST_CREDENTIALS.gcp.region}/functions/${name}`,
      httpsTrigger: {
        url: `https://${TEST_CREDENTIALS.gcp.region}-${TEST_CREDENTIALS.gcp.projectId}.cloudfunctions.net/${name}`
      },
      state: 'ACTIVE',
      serviceAccountEmail: `${name}-sa@${TEST_CREDENTIALS.gcp.projectId}.iam.gserviceaccount.com`
    };
  },
  
  createMockApiGateway: () => {
    return {
      name: `projects/${TEST_CREDENTIALS.gcp.projectId}/locations/${TEST_CREDENTIALS.gcp.region}/gateways/anava-gateway`,
      defaultHostname: `anava-gateway-abc123-uc.a.run.app`,
      state: 'ACTIVE',
      apiConfig: 'anava-config-v1'
    };
  },
  
  mockDelay: (ms: number) => {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

// Global test setup
beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.GCP_PROJECT_ID = TEST_CREDENTIALS.gcp.projectId;
});

afterAll(() => {
  // Cleanup
  delete process.env.GCP_PROJECT_ID;
});