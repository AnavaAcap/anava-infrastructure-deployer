/**
 * AOA Integration Module for Anava Installer
 * Provides high-level functions for AOA configuration during camera deployment
 */

import { ipcMain } from 'electron';
import AOAService from './aoaService';
import { AOANaturalLanguageProcessor, deployNLScenario } from './aoaNLProcessor';
import { logger } from '../../utils/logger';
import { Camera } from '../camera/cameraDiscoveryService';

export interface AOADeploymentConfig {
  enableAOA: boolean;
  scenarios?: Array<{
    name: string;
    type: 'motion' | 'fence' | 'crosslinecount' | 'occupancy';
    humanDetection?: boolean;
    vehicleDetection?: boolean;
    timeInArea?: number;
    customArea?: Array<[number, number]>;
  }>;
  useDefaultScenarios?: boolean;
}

export class AOAIntegration {
  private static instance: AOAIntegration;

  private constructor() {
    this.setupIPC();
  }

  static getInstance(): AOAIntegration {
    if (!AOAIntegration.instance) {
      AOAIntegration.instance = new AOAIntegration();
    }
    return AOAIntegration.instance;
  }

  /**
   * Setup IPC handlers for AOA operations
   */
  private setupIPC() {
    // Configure AOA on camera
    ipcMain.handle('configure-aoa', async (_event, camera: Camera, config: AOADeploymentConfig) => {
      return this.configureAOA(camera, config);
    });

    // Get AOA status
    ipcMain.handle('get-aoa-status', async (_event, cameraIp: string, username: string, password: string) => {
      return this.getAOAStatus(cameraIp, username, password);
    });

    // Create custom scenario
    ipcMain.handle('create-aoa-scenario', async (_event, cameraIp: string, username: string, password: string, scenario: any) => {
      return this.createScenario(cameraIp, username, password, scenario);
    });

    // Test AOA connection
    ipcMain.handle('test-aoa-connection', async (_event, cameraIp: string, username: string, password: string) => {
      return this.testConnection(cameraIp, username, password);
    });

    // Natural Language Processing for AOA scenarios
    ipcMain.handle('aoa-process-natural-language', async (_event, geminiApiKey: string, description: string, context?: string) => {
      return this.processNaturalLanguageScenario(geminiApiKey, description, context);
    });

    // Deploy NL-generated scenario to camera
    ipcMain.handle('aoa-deploy-nl-scenario', async (
      _event, 
      cameraIp: string, 
      username: string, 
      password: string, 
      geminiApiKey: string, 
      description: string, 
      context?: string
    ) => {
      return deployNLScenario(cameraIp, username, password, geminiApiKey, description, context);
    });

    // Get common scenario templates
    ipcMain.handle('aoa-get-common-scenarios', async (_event, geminiApiKey: string) => {
      return this.getCommonScenarios(geminiApiKey);
    });
  }

  /**
   * Configure AOA on a camera during deployment
   */
  async configureAOA(camera: Camera, config: AOADeploymentConfig): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      logger.info('[AOA Integration] Configuring AOA for camera:', camera.ip);

      if (!config.enableAOA) {
        logger.info('[AOA Integration] AOA not enabled for this deployment');
        return {
          success: true,
          message: 'AOA configuration skipped (not enabled)'
        };
      }

      const aoa = new AOAService(
        camera.ip,
        camera.credentials?.username || 'root',
        camera.credentials?.password || ''
      );

      // 1. Start AOA application
      logger.info('[AOA Integration] Starting AOA application...');
      const started = await aoa.startAOA();
      if (!started) {
        throw new Error('Failed to start AOA application');
      }

      // 2. Check if licensed
      const status = await aoa.getStatus();
      if (!status.licensed) {
        logger.warn('[AOA Integration] AOA is not licensed on this camera');
        return {
          success: false,
          message: 'AOA is not licensed. Please activate the AOA license first.'
        };
      }

      // 3. Configure scenarios
      if (config.useDefaultScenarios) {
        logger.info('[AOA Integration] Setting up default demo scenarios...');
        const demoSuccess = await aoa.setupDemoConfiguration();
        if (!demoSuccess) {
          throw new Error('Failed to setup demo configuration');
        }
      } else if (config.scenarios && config.scenarios.length > 0) {
        logger.info('[AOA Integration] Creating custom scenarios...');
        
        // Clear existing scenarios first (optional)
        const existingScenarios = await aoa.getScenarios();
        for (const scenario of existingScenarios) {
          await aoa.deleteScenario(scenario.id);
        }

        // Create new scenarios with full configurability
        for (const scenarioConfig of config.scenarios) {
          // Check if this is an advanced scenario configuration
          if (scenarioConfig.type || scenarioConfig.filters || scenarioConfig.vehicleDetection) {
            // Use advanced scenario creation for full control
            await aoa.createAdvancedScenario({
              name: scenarioConfig.name,
              type: scenarioConfig.type || 'motion',
              area: scenarioConfig.customArea || [[-0.9, -0.9], [-0.9, 0.9], [0.9, 0.9], [0.9, -0.9]],
              objectTypes: {
                humans: scenarioConfig.humanDetection !== false,
                vehicles: scenarioConfig.vehicleDetection === true,
                vehicleSubTypes: scenarioConfig.vehicleSubTypes
              },
              filters: {
                timeInArea: scenarioConfig.timeInArea,
                minimumSize: scenarioConfig.minimumObjectSize,
                maximumSize: scenarioConfig.maximumObjectSize,
                swayingObjectDistance: scenarioConfig.swayingObjectDistance,
                shortLivedLimit: scenarioConfig.shortLivedLimit
              },
              crosslineDirection: scenarioConfig.crosslineDirection,
              occupancyThreshold: scenarioConfig.occupancyThreshold
            });
          } else if (scenarioConfig.humanDetection && scenarioConfig.timeInArea) {
            // Use the convenient human detection method with enhanced options
            await aoa.createHumanDetectionScenario(
              scenarioConfig.name,
              scenarioConfig.timeInArea,
              scenarioConfig.customArea,
              {
                enableVehicles: scenarioConfig.vehicleDetection,
                minimumObjectSize: scenarioConfig.minimumObjectSize
              }
            );
          } else {
            // Create custom scenario
            await this.createCustomScenario(aoa, scenarioConfig);
          }
        }
      }

      // 4. Verify configuration
      const finalStatus = await aoa.getStatus();
      const scenarios = await aoa.getScenarios();

      logger.info('[AOA Integration] AOA configuration complete:', {
        running: finalStatus.running,
        licensed: finalStatus.licensed,
        scenarios: scenarios.length
      });

      return {
        success: true,
        message: `AOA configured successfully with ${scenarios.length} scenarios`,
        details: {
          running: finalStatus.running,
          licensed: finalStatus.licensed,
          scenarios: scenarios.map(s => ({
            id: s.id,
            name: s.name,
            type: s.type,
            enabled: s.enabled
          }))
        }
      };

    } catch (error: any) {
      logger.error('[AOA Integration] Configuration failed:', error);
      return {
        success: false,
        message: `AOA configuration failed: ${error.message}`
      };
    }
  }

  /**
   * Create a custom scenario based on configuration
   */
  private async createCustomScenario(aoa: AOAService, config: any): Promise<void> {
    const scenario: any = {
      id: Date.now() % 1000, // Generate ID
      name: config.name,
      type: config.type,
      enabled: true,
      devices: [{ id: 1 }],
      triggers: [],
      objectClassifications: []
    };

    // Configure triggers based on type
    switch (config.type) {
      case 'motion':
        scenario.triggers.push({
          type: 'includeArea',
          vertices: config.customArea || [
            [-0.9, -0.9],
            [-0.9, 0.9],
            [0.9, 0.9],
            [0.9, -0.9]
          ]
        });
        if (config.timeInArea) {
          scenario.filters = [{
            type: 'timeShort',
            active: true,
            data: config.timeInArea * 1000
          }];
        }
        break;

      case 'crosslinecount':
        scenario.triggers.push({
          type: 'countingLine',
          vertices: config.customArea || [[-0.5, -0.9], [-0.5, 0.9]],
          direction: 'both'
        });
        break;

      case 'fence':
        scenario.triggers.push({
          type: 'fence',
          vertices: config.customArea || [
            [-0.95, -0.95],
            [-0.95, 0.95],
            [0.95, 0.95],
            [0.95, -0.95]
          ],
          alarmDirection: 'in'
        });
        break;
    }

    // Configure object classifications
    if (config.humanDetection) {
      scenario.objectClassifications.push({
        type: 'human',
        selected: true
      });
    }
    if (config.vehicleDetection) {
      scenario.objectClassifications.push({
        type: 'vehicle',
        selected: true
      });
    }

    await aoa.createScenario(scenario);
  }

  /**
   * Get AOA status for a camera
   */
  async getAOAStatus(cameraIp: string, username: string, password: string): Promise<any> {
    try {
      const aoa = new AOAService(cameraIp, username, password);
      const status = await aoa.getStatus();
      const scenarios = await aoa.getScenarios();

      return {
        success: true,
        data: {
          ...status,
          scenarios: scenarios
        }
      };
    } catch (error: any) {
      logger.error('[AOA Integration] Failed to get status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create a single scenario
   */
  async createScenario(cameraIp: string, username: string, password: string, scenario: any): Promise<any> {
    try {
      const aoa = new AOAService(cameraIp, username, password);
      const success = await aoa.createScenario(scenario);

      return {
        success,
        message: success ? 'Scenario created successfully' : 'Failed to create scenario'
      };
    } catch (error: any) {
      logger.error('[AOA Integration] Failed to create scenario:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test AOA connection and availability
   */
  async testConnection(cameraIp: string, username: string, password: string): Promise<any> {
    try {
      const aoa = new AOAService(cameraIp, username, password);
      
      // Try to get supported versions
      const versions = await aoa.getSupportedVersions();
      
      // Get status
      const status = await aoa.getStatus();

      return {
        success: true,
        available: true,
        versions,
        status: {
          running: status.running,
          licensed: status.licensed
        }
      };
    } catch (error: any) {
      logger.error('[AOA Integration] Connection test failed:', error);
      
      // Check if it's a 404 (AOA not installed)
      if (error.message?.includes('404')) {
        return {
          success: false,
          available: false,
          message: 'AOA is not installed on this camera'
        };
      }

      return {
        success: false,
        available: false,
        error: error.message
      };
    }
  }

  /**
   * Quick setup for demo/testing
   */
  async quickDemoSetup(camera: Camera): Promise<any> {
    return this.configureAOA(camera, {
      enableAOA: true,
      useDefaultScenarios: true
    });
  }

  /**
   * Process natural language description into AOA scenario
   */
  async processNaturalLanguageScenario(
    geminiApiKey: string, 
    description: string, 
    context?: string
  ): Promise<any> {
    try {
      logger.info('[AOA Integration] Processing NL description:', description);
      
      const processor = new AOANaturalLanguageProcessor(geminiApiKey);
      const result = await processor.processNaturalLanguage({
        description,
        cameraContext: context,
        strictness: 'medium'
      });

      return result;
    } catch (error: any) {
      logger.error('[AOA Integration] NL processing failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get common scenario templates using AI
   */
  async getCommonScenarios(geminiApiKey: string): Promise<any> {
    try {
      logger.info('[AOA Integration] Generating common scenario templates...');
      
      const processor = new AOANaturalLanguageProcessor(geminiApiKey);
      const scenarios = await processor.generateCommonScenarios();
      
      return {
        success: true,
        scenarios
      };
    } catch (error: any) {
      logger.error('[AOA Integration] Failed to generate common scenarios:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
export default AOAIntegration.getInstance();