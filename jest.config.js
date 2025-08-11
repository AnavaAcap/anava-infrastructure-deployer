module.exports = {
  // Use different configurations for different test types
  projects: [
    {
      displayName: 'unit',
      testMatch: [
        '<rootDir>/src/**/__tests__/**/*.test.ts',
        '<rootDir>/src/**/__tests__/**/*.test.tsx',
        '<rootDir>/tests/unit/**/*.test.ts'
      ],
      preset: 'ts-jest',
      testEnvironment: 'node',
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@main/(.*)$': '<rootDir>/src/main/$1',
        '^@renderer/(.*)$': '<rootDir>/src/renderer/$1',
        '^@types/(.*)$': '<rootDir>/src/types/$1',
        // Mock electron in unit tests
        '^electron$': '<rootDir>/tests/__mocks__/electron.ts'
      },
      setupFilesAfterEnv: ['<rootDir>/tests/setup/unit.setup.ts'],
      coveragePathIgnorePatterns: [
        '/node_modules/',
        '/dist/',
        '/__tests__/',
        '/tests/',
        '.d.ts$'
      ],
      collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/**/index.ts',
        '!src/renderer/index.tsx'
      ]
    },
    {
      displayName: 'integration',
      testMatch: [
        '<rootDir>/tests/integration/**/*.test.ts'
      ],
      preset: 'ts-jest',
      testEnvironment: 'node',
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@main/(.*)$': '<rootDir>/src/main/$1',
        '^@renderer/(.*)$': '<rootDir>/src/renderer/$1',
        '^@types/(.*)$': '<rootDir>/src/types/$1'
      },
      setupFilesAfterEnv: ['<rootDir>/tests/setup/integration.setup.ts'],
      testTimeout: 30000 // 30 seconds for integration tests
    },
    {
      displayName: 'e2e',
      testMatch: [
        '<rootDir>/tests/e2e/**/*.test.ts'
      ],
      preset: 'ts-jest',
      testEnvironment: 'node',
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@main/(.*)$': '<rootDir>/src/main/$1',
        '^@renderer/(.*)$': '<rootDir>/src/renderer/$1',
        '^@types/(.*)$': '<rootDir>/src/types/$1'
      },
      setupFilesAfterEnv: ['<rootDir>/tests/setup/e2e.setup.ts'],
      testTimeout: 120000, // 2 minutes for e2e tests
      maxWorkers: 1 // Run e2e tests serially
    },
    {
      displayName: 'security',
      testMatch: [
        '<rootDir>/tests/security/**/*.test.ts',
        '<rootDir>/test-suite/security-tests.spec.js'
      ],
      preset: 'ts-jest',
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/setup/security.setup.ts'],
      testTimeout: 60000 // 1 minute for security tests
    },
    {
      displayName: 'regression',
      testMatch: [
        '<rootDir>/test-suite/regression-tests.spec.js'
      ],
      testEnvironment: 'node',
      testTimeout: 30000
    },
    {
      displayName: 'integration-v178',
      testMatch: [
        '<rootDir>/test-suite/integration-tests.spec.js'
      ],
      testEnvironment: 'node',
      testTimeout: 60000
    },
    {
      displayName: 'electron-v37',
      testMatch: [
        '<rootDir>/tests/electron-v37/**/*.test.ts'
      ],
      preset: 'ts-jest',
      testEnvironment: 'node',
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@main/(.*)$': '<rootDir>/src/main/$1',
        '^@renderer/(.*)$': '<rootDir>/src/renderer/$1',
        '^@types/(.*)$': '<rootDir>/src/types/$1',
        '^electron$': '<rootDir>/tests/__mocks__/electron.ts'
      },
      setupFilesAfterEnv: ['<rootDir>/tests/setup/electron-v37.setup.ts'],
      testTimeout: 30000
    }
  ],
  
  // Global settings
  collectCoverage: false, // Enable with --coverage flag
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  
  // Coverage thresholds for critical paths
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80
    },
    './src/main/services/deploymentEngine.ts': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/main/services/camera/': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  
  // Performance tracking
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './test-results',
      outputName: 'junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }],
    ['./tests/reporters/performance-reporter.js', {
      outputPath: './test-results/performance.json'
    }]
  ],
  
  // Test utilities
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/release/'
  ],
  
  verbose: true
};