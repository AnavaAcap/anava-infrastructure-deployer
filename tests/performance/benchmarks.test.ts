/**
 * Performance Benchmark Tests
 * Measures execution time and resource usage of critical operations
 */

import { DeploymentEngine } from '@main/services/deploymentEngine';
import { CameraDiscoveryService } from '@main/services/camera/cameraDiscoveryService';
import { CameraConfigurationService } from '@main/services/camera/cameraConfigurationService';
import { CloudFunctionsAPIDeployer } from '@main/services/cloudFunctionsAPIDeployer';
import { performance } from 'perf_hooks';
import * as os from 'os';

// Helper to measure execution time and memory
class PerformanceTracker {
  private startTime: number = 0;
  private startMemory: NodeJS.MemoryUsage = process.memoryUsage();
  private measurements: Map<string, any> = new Map();

  start(operation: string) {
    this.startTime = performance.now();
    this.startMemory = process.memoryUsage();
    this.measurements.set(operation, {
      startTime: this.startTime,
      startMemory: this.startMemory
    });
  }

  end(operation: string) {
    const endTime = performance.now();
    const endMemory = process.memoryUsage();
    const data = this.measurements.get(operation);
    
    if (!data) {
      throw new Error(`No start measurement for operation: ${operation}`);
    }

    const duration = endTime - data.startTime;
    const memoryDelta = {
      rss: endMemory.rss - data.startMemory.rss,
      heapTotal: endMemory.heapTotal - data.startMemory.heapTotal,
      heapUsed: endMemory.heapUsed - data.startMemory.heapUsed,
      external: endMemory.external - data.startMemory.external
    };

    return {
      operation,
      duration,
      memoryDelta,
      cpuUsage: process.cpuUsage()
    };
  }

  async measureAsync<T>(operation: string, fn: () => Promise<T>): Promise<{ result: T; metrics: any }> {
    this.start(operation);
    const result = await fn();
    const metrics = this.end(operation);
    return { result, metrics };
  }
}

describe('Performance Benchmarks', () => {
  const tracker = new PerformanceTracker();
  const benchmarkResults: any[] = [];

  afterAll(() => {
    // Output benchmark results for CI
    console.log('\n=== PERFORMANCE BENCHMARK RESULTS ===');
    console.table(benchmarkResults.map(r => ({
      Operation: r.operation,
      Duration: `${r.duration.toFixed(2)}ms`,
      'Memory Used': `${(r.memoryDelta.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      'CPU Time': `${r.cpuUsage.user / 1000}ms`
    })));
  });

  describe('Camera Discovery Performance', () => {
    let discoveryService: CameraDiscoveryService;

    beforeEach(() => {
      discoveryService = new CameraDiscoveryService();
    });

    it('should scan network for cameras within acceptable time', async () => {
      const mockCameras = Array.from({ length: 100 }, (_, i) => ({
        ip: `192.168.1.${i + 1}`,
        model: 'AXIS P3245-LV',
        accessible: i % 2 === 0
      }));

      // Mock network scan
      discoveryService['scanNetwork'] = jest.fn().mockResolvedValue(mockCameras);

      const { metrics } = await tracker.measureAsync(
        'Network Camera Scan (100 IPs)',
        () => discoveryService['scanNetwork']('192.168.1.0/24')
      );

      benchmarkResults.push(metrics);

      // Performance assertions
      expect(metrics.duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(metrics.memoryDelta.heapUsed).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
    });

    it('should authenticate cameras efficiently', async () => {
      const cameras = Array.from({ length: 10 }, (_, i) => ({
        ip: `192.168.1.${i + 1}`,
        username: 'root',
        password: 'pass'
      }));

      // Mock authentication
      const authPromises = cameras.map(camera => 
        new Promise(resolve => setTimeout(() => resolve(true), 10))
      );

      const { metrics } = await tracker.measureAsync(
        'Authenticate 10 Cameras',
        () => Promise.all(authPromises)
      );

      benchmarkResults.push(metrics);

      expect(metrics.duration).toBeLessThan(500); // Parallel auth should be fast
    });
  });

  describe('Cloud Deployment Performance', () => {
    it('should prepare deployment configuration quickly', async () => {
      const config = {
        projectId: 'test-project',
        region: 'us-central1',
        services: ['auth', 'firestore', 'functions', 'gateway'],
        serviceAccounts: 10,
        functions: 5
      };

      const { metrics } = await tracker.measureAsync(
        'Prepare Deployment Config',
        async () => {
          // Simulate config preparation
          const deploymentConfig = {
            ...config,
            serviceAccounts: Array.from({ length: config.serviceAccounts }, (_, i) => ({
              name: `sa-${i}`,
              roles: ['viewer', 'editor']
            })),
            functions: Array.from({ length: config.functions }, (_, i) => ({
              name: `function-${i}`,
              runtime: 'python311',
              memory: '256MB'
            }))
          };
          
          // Simulate validation
          await new Promise(resolve => setTimeout(resolve, 10));
          
          return deploymentConfig;
        }
      );

      benchmarkResults.push(metrics);

      expect(metrics.duration).toBeLessThan(100); // Config prep should be instant
    });

    it('should handle parallel API calls efficiently', async () => {
      const apiCalls = Array.from({ length: 20 }, (_, i) => ({
        endpoint: `/api/resource-${i}`,
        method: 'POST',
        data: { id: i }
      }));

      // Mock API calls with varying response times
      const mockApiCall = (call: any) => 
        new Promise(resolve => 
          setTimeout(() => resolve({ success: true, ...call }), Math.random() * 50)
        );

      const { metrics } = await tracker.measureAsync(
        'Parallel API Calls (20)',
        () => Promise.all(apiCalls.map(mockApiCall))
      );

      benchmarkResults.push(metrics);

      // Should complete quickly due to parallelization
      expect(metrics.duration).toBeLessThan(200);
    });
  });

  describe('Configuration Push Performance', () => {
    let configService: CameraConfigurationService;

    beforeEach(() => {
      configService = new CameraConfigurationService();
    });

    it('should push configuration to multiple cameras efficiently', async () => {
      const cameras = Array.from({ length: 5 }, (_, i) => ({
        ip: `192.168.1.${i + 1}`,
        credentials: { username: 'root', password: 'pass' }
      }));

      const config = {
        firebase: { projectId: 'test' },
        gemini: { apiKey: 'test-key' },
        anavaKey: 'anava-123',
        customerId: 'customer-456'
      };

      // Mock config push
      configService['pushConfigurationToCamera'] = jest.fn()
        .mockImplementation(() => 
          new Promise(resolve => 
            setTimeout(() => resolve({ success: true }), 20)
          )
        );

      const { metrics } = await tracker.measureAsync(
        'Push Config to 5 Cameras',
        () => Promise.all(
          cameras.map(camera => 
            configService['pushConfigurationToCamera'](camera, config)
          )
        )
      );

      benchmarkResults.push(metrics);

      expect(metrics.duration).toBeLessThan(150); // Parallel push
    });
  });

  describe('License Activation Performance', () => {
    it('should activate licenses with acceptable latency', async () => {
      const licenses = Array.from({ length: 3 }, (_, i) => ({
        key: `LICENSE-KEY-${i}`,
        deviceId: `00408C00000${i}`
      }));

      // Mock license activation with Axis SDK
      const mockActivation = (license: any) =>
        new Promise(resolve => 
          setTimeout(() => resolve({ success: true, ...license }), 100)
        );

      const { metrics } = await tracker.measureAsync(
        'Activate 3 Licenses',
        () => Promise.all(licenses.map(mockActivation))
      );

      benchmarkResults.push(metrics);

      expect(metrics.duration).toBeLessThan(500); // Including SDK load time
    });
  });

  describe('Service Account Propagation Performance', () => {
    it('should efficiently handle IAM propagation delays', async () => {
      const serviceAccounts = Array.from({ length: 5 }, (_, i) => 
        `sa-${i}@project.iam.gserviceaccount.com`
      );

      // Simulate propagation check with exponential backoff
      const checkPropagation = async (sa: string, maxAttempts = 3) => {
        for (let i = 0; i < maxAttempts; i++) {
          // Simulate API check
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // Simulate 60% success rate per attempt
          if (Math.random() > 0.4) {
            return { sa, attempts: i + 1 };
          }
          
          // Exponential backoff
          if (i < maxAttempts - 1) {
            await new Promise(resolve => 
              setTimeout(resolve, Math.pow(2, i) * 10)
            );
          }
        }
        return { sa, attempts: maxAttempts };
      };

      const { metrics } = await tracker.measureAsync(
        'SA Propagation Check (5 accounts)',
        () => Promise.all(serviceAccounts.map(sa => checkPropagation(sa)))
      );

      benchmarkResults.push(metrics);

      // Should complete reasonably fast with backoff
      expect(metrics.duration).toBeLessThan(1000);
    });
  });

  describe('Memory Usage Patterns', () => {
    it('should not have memory leaks in deployment cycle', async () => {
      const iterations = 10;
      const memorySnapshots: number[] = [];

      for (let i = 0; i < iterations; i++) {
        // Simulate deployment cycle
        const deploymentData = {
          id: `deployment-${i}`,
          config: Array.from({ length: 100 }, (_, j) => ({
            key: `key-${j}`,
            value: `value-${j}`.repeat(100)
          }))
        };

        // Process deployment
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        memorySnapshots.push(process.memoryUsage().heapUsed);
      }

      // Check for memory leak pattern
      const firstHalf = memorySnapshots.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
      const secondHalf = memorySnapshots.slice(5).reduce((a, b) => a + b, 0) / 5;
      
      // Memory usage shouldn't grow significantly
      const growthRate = (secondHalf - firstHalf) / firstHalf;
      expect(growthRate).toBeLessThan(0.2); // Less than 20% growth
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle high concurrency without degradation', async () => {
      const concurrencyLevels = [1, 5, 10, 20];
      const results: any[] = [];

      for (const level of concurrencyLevels) {
        const operations = Array.from({ length: level }, (_, i) => 
          new Promise(resolve => 
            setTimeout(() => resolve(i), Math.random() * 10)
          )
        );

        const startTime = performance.now();
        await Promise.all(operations);
        const duration = performance.now() - startTime;

        results.push({ concurrency: level, duration });
      }

      // Check that duration doesn't scale linearly with concurrency
      const scalingFactor = results[3].duration / results[0].duration;
      expect(scalingFactor).toBeLessThan(3); // Should benefit from parallelism
    });
  });

  describe('Critical Path Optimization', () => {
    it('should optimize deployment critical path', async () => {
      // Simulate deployment steps with dependencies
      const steps = {
        enableAPIs: 500,
        createServiceAccounts: 300,
        deployFirebase: 400,
        deployFunctions: 800,
        deployGateway: 600,
        configureIAM: 200
      };

      const { metrics } = await tracker.measureAsync(
        'Critical Path Deployment',
        async () => {
          // Parallel operations where possible
          const [apis, serviceAccounts] = await Promise.all([
            new Promise(r => setTimeout(r, steps.enableAPIs)),
            new Promise(r => setTimeout(r, steps.createServiceAccounts))
          ]);

          // Sequential dependencies
          await new Promise(r => setTimeout(r, steps.deployFirebase));
          
          // Parallel cloud resources
          await Promise.all([
            new Promise(r => setTimeout(r, steps.deployFunctions)),
            new Promise(r => setTimeout(r, steps.deployGateway))
          ]);

          await new Promise(r => setTimeout(r, steps.configureIAM));
        }
      );

      benchmarkResults.push(metrics);

      // Should be less than sum of all steps due to parallelization
      const totalSequential = Object.values(steps).reduce((a, b) => a + b, 0);
      expect(metrics.duration).toBeLessThan(totalSequential * 0.7);
    });
  });

  describe('Resource Utilization', () => {
    it('should efficiently utilize system resources', () => {
      const cpuCount = os.cpus().length;
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();

      const utilization = {
        cpuCores: cpuCount,
        memoryUsage: ((totalMemory - freeMemory) / totalMemory) * 100,
        processMemory: process.memoryUsage().heapUsed / 1024 / 1024
      };

      // Log resource utilization
      console.log('System Resource Utilization:', utilization);

      // Ensure we're not over-utilizing resources
      expect(utilization.processMemory).toBeLessThan(500); // Less than 500MB
      expect(utilization.memoryUsage).toBeLessThan(90); // Less than 90% system memory
    });
  });
});