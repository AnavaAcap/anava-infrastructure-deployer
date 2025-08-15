/**
 * Axis Object Analytics (AOA) Service
 * Provides programmatic control of AOA via VAPIX APIs
 * Based on existing VAPIX implementation patterns in cameraConfigurationService.ts
 * 
 * CRITICAL DISCOVERY: Time in Area UI Toggle Control
 * ====================================================
 * The "Time in Area" toggle in the AOA UI is NOT controlled by filters alone.
 * It requires BOTH:
 * 
 * 1. Filter configuration (for the time duration):
 *    filters: [{ type: 'timeShort', active: true, data: 3000, time: 3000 }]
 * 
 * 2. Trigger condition (THIS controls the UI toggle!):
 *    triggers: [{ 
 *      conditions: [{ 
 *        type: 'individualTimeInArea', 
 *        data: [{ type: 'human', time: 3, alarmTime: 1 }] 
 *      }]
 *    }]
 * 
 * KEY DIFFERENCES:
 * - Filters use milliseconds (data: 3000 = 3 seconds)
 * - Conditions use seconds (time: 3 = 3 seconds)
 * - Both 'data' and 'time' properties should be included in filters for compatibility
 * - Scenario names must be short to avoid error 2004
 * 
 * SUPPORTED API VERSIONS: 1.0 through 1.6 (use 1.0 for compatibility)
 */

import axios from 'axios';
import crypto from 'crypto';
import https from 'https';
import { logger } from '../../utils/logger';
import { getCameraBaseUrl } from '../camera/cameraProtocolUtils';

// Axis Object Analytics API types based on official documentation
export interface AOAScenario {
  id: number;
  name: string;
  type: 'motion' | 'fence' | 'crosslinecount' | 'occupancy';
  enabled?: boolean;
  devices: Array<{ id: number }>;
  triggers: AOATrigger[];
  filters?: AOAFilter[];
  objectClassifications: AOAObjectClassification[];
  perspectives?: AOAPerspective[];
  metadata?: Record<string, any>;
}

export interface AOATrigger {
  type: 'includeArea' | 'fence' | 'countingLine';
  vertices: Array<[number, number]>; // Normalized coordinates [-1, 1]
  direction?: 'left-right' | 'right-left' | 'up-down' | 'down-up' | 'both';
  alarmDirection?: 'in' | 'out' | 'inOrOut';
  conditions?: AOATriggerCondition[]; // CRITICAL: Required for Time in Area UI toggle!
}

export interface AOATriggerCondition {
  type: 'individualTimeInArea' | 'aggregatedTimeInArea';
  data: Array<{
    type: 'human' | 'vehicle' | 'face' | 'licenseplate';
    time: number; // Time in SECONDS (not milliseconds!)
    alarmTime: number; // Number of occurrences before triggering
  }>;
}

export interface AOAFilter {
  type: 'timeShort' | 'timeLong' | 'sizePercentage' | 'sizePercentageMax' | 'sizePerspective' | 'distanceSwayingObject' | 'timeShortLivedLimit';
  active: boolean;
  data?: number; // For timeShort: milliseconds, for size: percentage
  time?: number; // Some versions use 'time' instead of 'data' for timeShort filters
  width?: number; // For size filters
  height?: number; // For size filters
  distance?: number; // For swaying object filter
}

export interface AOAObjectClassification {
  type: 'vehicle' | 'human' | 'car' | 'bus' | 'truck' | 'bike' | 'other';
  selected?: boolean;
  subtypes?: AOAObjectClassification[];
}

export interface AOAPerspective {
  type?: 'corridor' | 'groundPlane';
  corridorMode?: 'shortSide' | 'longSide';
  transform?: number[][];
  cameraHeight?: number;
  groundPlane?: {
    points: Array<{x: number, y: number}>;
  };
}

export interface AOACapabilities {
  version: string;
  supportedScenarioTypes: string[];
  supportedObjectClasses: string[];
  maxScenarios: number;
  features: Record<string, boolean>;
}

export interface AOAStatus {
  running: boolean;
  licensed: boolean;
  scenarios: Array<{
    id: string;
    name: string;
    active: boolean;
    lastTriggered?: string;
  }>;
}

export class AOAService {
  private cameraIp: string;
  private username: string;
  private password: string;
  private port: number;

  constructor(cameraIp: string, username: string, password: string, port: number = 443) {
    this.cameraIp = cameraIp;
    this.username = username;
    this.password = password;
    this.port = port;
  }

  /**
   * Start the AOA application
   */
  async startAOA(): Promise<boolean> {
    try {
      logger.info('[AOA] Starting Object Analytics application...');
      
      const response = await this.simpleDigestAuth(
        'GET',
        '/axis-cgi/applications/control.cgi?action=start&package=objectanalytics'
      );
      
      if (response.data && (response.data.includes('OK') || response.data.includes('ok'))) {
        logger.info('[AOA] Object Analytics started successfully');
        
        // Wait for application to be ready
        await this.waitForAOAReady();
        return true;
      }
      
      return false;
    } catch (error: any) {
      logger.error('[AOA] Error starting Object Analytics:', error.message);
      throw error;
    }
  }

  /**
   * Stop the AOA application
   */
  async stopAOA(): Promise<boolean> {
    try {
      logger.info('[AOA] Stopping Object Analytics application...');
      
      const response = await this.simpleDigestAuth(
        'GET',
        '/axis-cgi/applications/control.cgi?action=stop&package=objectanalytics'
      );
      
      if (response.data && (response.data.includes('OK') || response.data.includes('ok'))) {
        logger.info('[AOA] Object Analytics stopped successfully');
        return true;
      }
      
      return false;
    } catch (error: any) {
      logger.error('[AOA] Error stopping Object Analytics:', error.message);
      throw error;
    }
  }

  /**
   * Get AOA application status
   */
  async getStatus(): Promise<AOAStatus> {
    try {
      logger.info('[AOA] Getting Object Analytics status...');
      
      // Check if application is running
      const appListResponse = await this.simpleDigestAuth(
        'GET',
        '/axis-cgi/applications/list.cgi'
      );
      
      const isRunning = appListResponse.data.includes('Name="objectanalytics"') && 
                       appListResponse.data.includes('Status="Running"');
      const isLicensed = appListResponse.data.includes('License="Valid"');
      
      // Get configured scenarios
      let scenarios: any[] = [];
      if (isRunning) {
        try {
          const scenariosResponse = await this.simpleDigestAuth(
            'POST',
            '/local/objectanalytics/control.cgi',
            JSON.stringify({
              method: 'getScenarios',
              apiVersion: '1.0'
            })
          );
          
          if (scenariosResponse.data && scenariosResponse.data.scenarios) {
            scenarios = scenariosResponse.data.scenarios;
          }
        } catch (e) {
          logger.warn('[AOA] Could not get scenarios:', e);
        }
      }
      
      return {
        running: isRunning,
        licensed: isLicensed,
        scenarios: scenarios.map(s => ({
          id: s.id,
          name: s.name,
          active: s.enabled,
          lastTriggered: s.lastTriggered
        }))
      };
    } catch (error: any) {
      logger.error('[AOA] Error getting status:', error.message);
      throw error;
    }
  }

  /**
   * Get AOA capabilities (alias for getConfigurationCapabilities)
   */
  async getCapabilities(): Promise<any> {
    return this.getConfigurationCapabilities();
  }

  /**
   * Get AOA configuration capabilities (Axis API)
   */
  async getConfigurationCapabilities(): Promise<any> {
    try {
      logger.info('[AOA] Getting configuration capabilities...');
      
      const response = await this.simpleDigestAuth(
        'POST',
        '/local/objectanalytics/control.cgi',
        JSON.stringify({
          method: 'getConfigurationCapabilities',
          apiVersion: '1.0',
          context: 'Anava'
        })
      );
      
      return response.data;
    } catch (error: any) {
      logger.error('[AOA] Error getting configuration capabilities:', error.message);
      throw error;
    }
  }

  /**
   * Get supported API versions
   */
  async getSupportedVersions(): Promise<string[]> {
    try {
      logger.info('[AOA] Getting supported API versions...');
      
      const response = await this.simpleDigestAuth(
        'POST',
        '/local/objectanalytics/control.cgi',
        JSON.stringify({
          method: 'getSupportedVersions'
        })
      );
      
      if (response.data && response.data.apiVersions) {
        return response.data.apiVersions;
      }
      
      return ['1.0'];
    } catch (error: any) {
      logger.error('[AOA] Error getting supported versions:', error.message);
      throw error;
    }
  }

  /**
   * Get a specific scenario by ID
   */
  async getScenario(scenarioId: number): Promise<AOAScenario | undefined> {
    try {
      const config = await this.getConfiguration();
      return config.scenarios?.find((s: AOAScenario) => s.id === scenarioId);
    } catch (error: any) {
      logger.error(`[AOA] Error getting scenario ${scenarioId}:`, error.message);
      return undefined;
    }
  }

  /**
   * Get current AOA configuration
   */
  async getConfiguration(): Promise<any> {
    try {
      logger.info('[AOA] Getting current configuration...');
      
      const response = await this.simpleDigestAuth(
        'POST',
        '/local/objectanalytics/control.cgi',
        JSON.stringify({
          method: 'getConfiguration',
          apiVersion: '1.0',
          context: 'Anava'
        })
      );
      
      return response.data;
    } catch (error: any) {
      logger.error('[AOA] Error getting configuration:', error.message);
      throw error;
    }
  }

  /**
   * Set complete AOA configuration
   */
  async setConfiguration(configuration: any): Promise<boolean> {
    try {
      logger.info('[AOA] Setting configuration...');
      
      const response = await this.simpleDigestAuth(
        'POST',
        '/local/objectanalytics/control.cgi',
        JSON.stringify({
          method: 'setConfiguration',
          apiVersion: '1.0',
          context: 'Anava',
          params: configuration
        })
      );
      
      if (response.data && !response.data.error) {
        logger.info('[AOA] Configuration set successfully');
        return true;
      }
      
      logger.error('[AOA] Failed to set configuration:', response.data);
      return false;
    } catch (error: any) {
      logger.error('[AOA] Error setting configuration:', error.message);
      throw error;
    }
  }

  /**
   * Create a new scenario using Axis API format
   */
  async createScenario(scenario: AOAScenario): Promise<boolean> {
    try {
      logger.info('[AOA] Creating scenario:', scenario.name);
      
      // Get current configuration
      const currentConfig = await this.getConfiguration();
      const configuration = currentConfig.data || {
        devices: [{ id: 1, rotation: 0 }],
        scenarios: []
      };
      
      // Add new scenario
      configuration.scenarios = configuration.scenarios || [];
      configuration.scenarios.push(scenario);
      
      // Set the updated configuration
      return await this.setConfiguration(configuration);
    } catch (error: any) {
      logger.error('[AOA] Error creating scenario:', error.message);
      throw error;
    }
  }

  /**
   * Create a scenario with human detection and time in area trigger (Axis format)
   */
  async createHumanDetectionScenario(
    name: string = 'Human Detection',
    timeInAreaSeconds: number = 3,
    areaVertices?: Array<[number, number]>,
    options?: {
      enableVehicles?: boolean;
      minimumObjectSize?: { width: number; height: number };
      perspective?: Array<[number, number]>;
    }
  ): Promise<boolean> {
    try {
      logger.info('[AOA] Creating human detection scenario...');
      
      // Default area vertices if not provided (full frame in normalized coordinates)
      // Axis uses normalized coordinates from -1 to 1
      const vertices: Array<[number, number]> = areaVertices || [
        [-0.9, -0.9],
        [-0.9, 0.9],
        [0.9, 0.9],
        [0.9, -0.9]
      ];
      
      // Get next available scenario ID
      const currentConfig = await this.getConfiguration();
      const existingScenarios = currentConfig.data?.scenarios || [];
      const nextId = existingScenarios.length > 0 
        ? Math.max(...existingScenarios.map((s: any) => s.id)) + 1 
        : 1;
      
      // Build filters array
      const filters: any[] = [];
      
      // Add time in area filter if specified
      // CRITICAL: Filter alone does NOT enable the Time in Area toggle in UI!
      // Must also add conditions to the trigger (see below)
      if (timeInAreaSeconds > 0) {
        filters.push({
          type: 'timeShort',
          active: true,
          data: timeInAreaSeconds * 1000, // milliseconds
          time: timeInAreaSeconds * 1000  // Include both for compatibility
        });
      }
      
      // Add minimum object size filter if specified
      if (options?.minimumObjectSize) {
        filters.push({
          type: 'sizePercentage',
          width: options.minimumObjectSize.width,
          height: options.minimumObjectSize.height
        });
      }
      
      // Build object classifications
      const objectClassifications: any[] = [
        {
          type: 'human',
          selected: true
        }
      ];
      
      if (options?.enableVehicles) {
        objectClassifications.push({
          type: 'vehicle',
          selected: true,
          subTypes: [
            { type: 'car' },
            { type: 'bus' },
            { type: 'truck' },
            { type: 'motorcycle/bicycle' }
          ]
        });
      }
      
      // Build triggers with Time in Area conditions if specified
      const triggers: any[] = [{
        type: 'includeArea',
        vertices: vertices
      }];
      
      // CRITICAL: This condition controls the Time in Area UI toggle!
      // Without this, the toggle will appear OFF even if filters are set
      if (timeInAreaSeconds > 0) {
        triggers[0].conditions = [{
          type: 'individualTimeInArea',
          data: [
            {
              type: 'human',
              time: timeInAreaSeconds, // SECONDS (not milliseconds!)
              alarmTime: 1  // Trigger after 1 occurrence
            }
          ]
        }];
        
        // Add vehicle condition if vehicles are enabled
        if (options?.enableVehicles) {
          triggers[0].conditions[0].data.push({
            type: 'vehicle',
            time: timeInAreaSeconds,
            alarmTime: 1
          });
        }
      }
      
      const scenario: AOAScenario = {
        id: nextId,
        name: name,
        type: 'motion', // Motion detection with area trigger
        enabled: true,
        devices: [{ id: 1 }], // Default to first camera device
        triggers: triggers,
        filters: filters,
        objectClassifications: objectClassifications
      };
      
      // Add perspective if specified
      if (options?.perspective) {
        (scenario as any).perspective = options.perspective;
      }
      
      return await this.createScenario(scenario);
    } catch (error: any) {
      logger.error('[AOA] Error creating human detection scenario:', error.message);
      throw error;
    }
  }

  /**
   * Update an existing scenario
   */
  async updateScenario(scenarioId: number, updates: Partial<AOAScenario>): Promise<boolean> {
    try {
      logger.info('[AOA] Updating scenario:', scenarioId);
      
      // Get current configuration
      const currentConfig = await this.getConfiguration();
      const configuration = currentConfig.data || { scenarios: [] };
      
      // Find and update the scenario
      const scenarioIndex = configuration.scenarios.findIndex((s: any) => s.id === scenarioId);
      
      if (scenarioIndex === -1) {
        throw new Error(`Scenario ${scenarioId} not found`);
      }
      
      // Merge updates
      configuration.scenarios[scenarioIndex] = {
        ...configuration.scenarios[scenarioIndex],
        ...updates
      };
      
      // Set the updated configuration
      return await this.setConfiguration(configuration);
    } catch (error: any) {
      logger.error('[AOA] Error updating scenario:', error.message);
      throw error;
    }
  }

  /**
   * Delete a scenario
   */
  async deleteScenario(scenarioId: number): Promise<boolean> {
    try {
      logger.info('[AOA] Deleting scenario:', scenarioId);
      
      // Get current configuration
      const currentConfig = await this.getConfiguration();
      const configuration = currentConfig.data || { scenarios: [] };
      
      // Remove the scenario
      configuration.scenarios = configuration.scenarios.filter((s: any) => s.id !== scenarioId);
      
      // Set the updated configuration
      return await this.setConfiguration(configuration);
    } catch (error: any) {
      logger.error('[AOA] Error deleting scenario:', error.message);
      throw error;
    }
  }

  /**
   * Get all configured scenarios
   */
  async getScenarios(): Promise<AOAScenario[]> {
    try {
      logger.info('[AOA] Getting configured scenarios...');
      
      const config = await this.getConfiguration();
      
      if (config.data && config.data.scenarios) {
        return config.data.scenarios;
      }
      
      return [];
    } catch (error: any) {
      logger.error('[AOA] Error getting scenarios:', error.message);
      throw error;
    }
  }

  /**
   * Enable or disable a scenario
   */
  async setScenarioEnabled(scenarioId: string, enabled: boolean): Promise<boolean> {
    try {
      logger.info(`[AOA] ${enabled ? 'Enabling' : 'Disabling'} scenario:`, scenarioId);
      
      return await this.updateScenario(Number(scenarioId), { enabled });
    } catch (error: any) {
      logger.error('[AOA] Error setting scenario enabled state:', error.message);
      throw error;
    }
  }

  /**
   * Configure perspective calibration
   */
  async configurePerspective(
    scenarioId: string,
    cameraHeight: number,
    groundPlanePoints: Array<{x: number, y: number}>
  ): Promise<boolean> {
    try {
      logger.info('[AOA] Configuring perspective for scenario:', scenarioId);
      
      const perspective: AOAPerspective = {
        type: 'groundPlane',
        cameraHeight: cameraHeight,
        groundPlane: {
          points: groundPlanePoints
        }
      };
      
      // Add perspective to perspectives array
      const currentScenario = await this.getScenario(Number(scenarioId));
      const perspectives = currentScenario?.perspectives || [];
      perspectives.push(perspective);
      
      return await this.updateScenario(Number(scenarioId), { perspectives });
    } catch (error: any) {
      logger.error('[AOA] Error configuring perspective:', error.message);
      throw error;
    }
  }

  /**
   * Get metadata stream configuration
   */
  async getMetadataStreamConfig(): Promise<any> {
    try {
      logger.info('[AOA] Getting metadata stream configuration...');
      
      const payload = {
        method: 'getMetadataStreamConfig',
        apiVersion: '1.0'
      };
      
      const response = await this.simpleDigestAuth(
        'POST',
        '/local/objectanalytics/control.cgi',
        JSON.stringify(payload)
      );
      
      return response.data;
    } catch (error: any) {
      logger.error('[AOA] Error getting metadata stream config:', error.message);
      throw error;
    }
  }

  /**
   * Create a comprehensive scenario with all configuration options
   */
  async createAdvancedScenario(config: {
    name: string;
    type: 'motion' | 'fence' | 'crosslinecount' | 'occupancy';
    area: Array<[number, number]>;
    objectTypes: {
      humans?: boolean;
      vehicles?: boolean;
      vehicleSubTypes?: string[];
    };
    filters?: {
      timeInArea?: number; // seconds
      minimumSize?: { width: number; height: number }; // percentage
      maximumSize?: { width: number; height: number }; // percentage
      swayingObjectDistance?: number;
      shortLivedLimit?: number; // seconds
    };
    crosslineDirection?: 'left-right' | 'right-left' | 'both';
    occupancyThreshold?: number; // for occupancy type
  }): Promise<boolean> {
    try {
      logger.info('[AOA] Creating advanced scenario:', config.name);
      
      // Get next available scenario ID
      const currentConfig = await this.getConfiguration();
      const existingScenarios = currentConfig.data?.scenarios || [];
      const nextId = existingScenarios.length > 0 
        ? Math.max(...existingScenarios.map((s: any) => s.id)) + 1 
        : 1;
      
      // Build filters
      const filters: any[] = [];
      
      if (config.filters?.timeInArea) {
        filters.push({
          type: 'timeShort',
          active: true,
          data: config.filters.timeInArea * 1000,
          time: config.filters.timeInArea * 1000
        });
      }
      
      if (config.filters?.minimumSize) {
        filters.push({
          type: 'sizePercentage',
          width: config.filters.minimumSize.width,
          height: config.filters.minimumSize.height
        });
      }
      
      if (config.filters?.maximumSize) {
        filters.push({
          type: 'sizePercentageMax',
          width: config.filters.maximumSize.width,
          height: config.filters.maximumSize.height
        });
      }
      
      if (config.filters?.swayingObjectDistance) {
        filters.push({
          type: 'distanceSwayingObject',
          distance: config.filters.swayingObjectDistance
        });
      }
      
      if (config.filters?.shortLivedLimit) {
        filters.push({
          type: 'timeShortLivedLimit',
          time: config.filters.shortLivedLimit
        });
      }
      
      // Build object classifications
      const objectClassifications: any[] = [];
      
      if (config.objectTypes.humans) {
        objectClassifications.push({
          type: 'human',
          selected: true
        });
      }
      
      if (config.objectTypes.vehicles) {
        const vehicleClass: any = {
          type: 'vehicle',
          selected: true
        };
        
        if (config.objectTypes.vehicleSubTypes && config.objectTypes.vehicleSubTypes.length > 0) {
          vehicleClass.subTypes = config.objectTypes.vehicleSubTypes.map(t => ({ type: t }));
        } else {
          vehicleClass.subTypes = [
            { type: 'car' },
            { type: 'bus' },
            { type: 'truck' },
            { type: 'motorcycle/bicycle' }
          ];
        }
        
        objectClassifications.push(vehicleClass);
      }
      
      // Build triggers based on scenario type
      const triggers: any[] = [];
      
      if (config.type === 'motion' || config.type === 'occupancy') {
        const trigger: any = {
          type: 'includeArea',
          vertices: config.area
        };
        
        // CRITICAL: This condition controls the Time in Area UI toggle!
        // Must include BOTH filter AND trigger condition for UI to show as enabled
        if (config.filters?.timeInArea) {
          const conditionData: any[] = [];
          
          // Add conditions for each object type with time in area
          if (config.objectTypes.humans) {
            conditionData.push({
              type: 'human',
              time: config.filters.timeInArea, // SECONDS (not milliseconds!)
              alarmTime: 1
            });
          }
          
          if (config.objectTypes.vehicles) {
            conditionData.push({
              type: 'vehicle',
              time: config.filters.timeInArea, // SECONDS (not milliseconds!)
              alarmTime: 1
            });
          }
          
          // Combine all object types into a single condition
          if (conditionData.length > 0) {
            trigger.conditions = [{
              type: 'individualTimeInArea',
              data: conditionData
            }];
          }
        }
        
        triggers.push(trigger);
      } else if (config.type === 'fence') {
        triggers.push({
          type: 'fence',
          vertices: config.area
        });
      } else if (config.type === 'crosslinecount') {
        triggers.push({
          type: 'countingLine',
          vertices: config.area,
          direction: config.crosslineDirection || 'both'
        });
      }
      
      // Build scenario
      const scenario: any = {
        id: nextId,
        name: config.name,
        type: config.type,
        enabled: true,
        devices: [{ id: 1 }],
        triggers: triggers,
        filters: filters,
        objectClassifications: objectClassifications
      };
      
      // Add occupancy threshold if applicable
      if (config.type === 'occupancy' && config.occupancyThreshold) {
        scenario.occupancyThreshold = config.occupancyThreshold;
      }
      
      return await this.createScenario(scenario);
    } catch (error: any) {
      logger.error('[AOA] Error creating advanced scenario:', error.message);
      throw error;
    }
  }

  /**
   * Setup a complete AOA configuration for demo (Axis format)
   */
  async setupDemoConfiguration(): Promise<boolean> {
    try {
      logger.info('[AOA] Setting up demo configuration...');
      
      // 1. Ensure AOA is running
      await this.startAOA();
      
      // 2. Create complete configuration with multiple scenarios
      const configuration = {
        devices: [
          { id: 1, rotation: 0 }
        ],
        metadataOverlay: [
          { id: 1, reference: 1 }
        ],
        scenarios: [
          {
            id: 1,
            name: 'Entry Detection',
            type: 'crosslinecount',
            devices: [{ id: 1 }],
            triggers: [{
              type: 'countingLine',
              vertices: [[-0.5, -0.9], [-0.5, 0.9]], // Vertical line in center
              direction: 'left-right'
            }],
            objectClassifications: [
              { type: 'human', selected: true }
            ]
          },
          {
            id: 2,
            name: 'Loitering Detection',
            type: 'motion',
            devices: [{ id: 1 }],
            triggers: [{
              type: 'includeArea',
              vertices: [
                [-0.9, -0.9],
                [-0.9, 0.9],
                [0.9, 0.9],
                [0.9, -0.9]
              ],
              // CRITICAL: This condition makes Time in Area toggle show as ON in UI!
              conditions: [{
                type: 'individualTimeInArea',
                data: [{
                  type: 'human',
                  time: 3, // 3 seconds (not milliseconds!)
                  alarmTime: 1
                }]
              }]
            }],
            filters: [
              {
                type: 'timeShort',
                active: true,
                data: 3000, // 3000 milliseconds
                time: 3000  // Include both properties for compatibility
              }
            ],
            objectClassifications: [
              { type: 'human', selected: true }
            ]
          },
          {
            id: 3,
            name: 'Vehicle Counting',
            type: 'crosslinecount',
            devices: [{ id: 1 }],
            triggers: [{
              type: 'countingLine',
              vertices: [[-0.9, 0], [0.9, 0]], // Horizontal line in center
              direction: 'both'
            }],
            objectClassifications: [
              { type: 'vehicle', selected: true }
            ]
          },
          {
            id: 4,
            name: 'Perimeter Protection',
            type: 'fence',
            devices: [{ id: 1 }],
            triggers: [{
              type: 'fence',
              vertices: [
                [-0.95, -0.95],
                [-0.95, 0.95],
                [0.95, 0.95],
                [0.95, -0.95]
              ],
              alarmDirection: 'in'
            }],
            objectClassifications: [
              { type: 'human', selected: true },
              { type: 'vehicle', selected: true }
            ]
          }
        ]
      };
      
      // 3. Set the configuration
      const success = await this.setConfiguration(configuration);
      
      if (success) {
        logger.info('[AOA] Demo configuration setup complete with 4 scenarios');
        
        // 4. Log the scenario details
        const scenarios = await this.getScenarios();
        logger.info('[AOA] Active scenarios:', scenarios.map(s => ({
          id: s.id,
          name: s.name,
          type: s.type
        })));
      }
      
      return success;
    } catch (error: any) {
      logger.error('[AOA] Error setting up demo configuration:', error.message);
      throw error;
    }
  }

  /**
   * Wait for AOA to be ready after starting
   */
  private async waitForAOAReady(maxAttempts: number = 10, delayMs: number = 3000): Promise<boolean> {
    logger.info('[AOA] Waiting for Object Analytics to be ready...');
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await this.simpleDigestAuth(
          'GET',
          '/axis-cgi/applications/list.cgi'
        );
        
        if (response.data && response.data.includes('Name="objectanalytics"') && 
            response.data.includes('Status="Running"')) {
          logger.info('[AOA] Object Analytics is running!');
          
          // Give it a bit more time to fully initialize
          await new Promise(resolve => setTimeout(resolve, 2000));
          return true;
        }
      } catch (error: any) {
        logger.warn(`[AOA] Check ${attempt}/${maxAttempts} failed:`, error.message);
      }
      
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    logger.warn('[AOA] Object Analytics did not become ready');
    return false;
  }

  /**
   * Simple digest auth implementation (copied from cameraConfigurationService)
   */
  private async simpleDigestAuth(
    method: string,
    uri: string,
    data?: any,
    timeout?: number
  ): Promise<any> {
    try {
      const baseUrl = await getCameraBaseUrl(this.cameraIp, this.username, this.password, undefined, this.port);
      const url = `${baseUrl}${uri}`;
      
      logger.debug(`[AOA] ${method} ${url}`);
      
      // First request to get digest challenge
      const isHttps = url.startsWith('https');
      const response1 = await axios({
        method,
        url,
        data,
        validateStatus: () => true,
        timeout: timeout || 20000,
        httpsAgent: isHttps ? new https.Agent({
          rejectUnauthorized: false
        }) : undefined,
      });

      if (response1.status === 401) {
        const wwwAuth = response1.headers['www-authenticate'];
        
        if (wwwAuth && wwwAuth.toLowerCase().includes('basic')) {
          // Basic auth
          const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
          const response2 = await axios({
            method,
            url,
            data,
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json'
            },
            timeout: timeout || 20000,
            httpsAgent: isHttps ? new https.Agent({
              rejectUnauthorized: false
            }) : undefined,
          });
          
          if (response2.status === 200) {
            return response2;
          } else {
            throw new Error(`Request failed with status ${response2.status}`);
          }
        } else if (wwwAuth && wwwAuth.includes('Digest')) {
          // Digest auth
          const digestData: any = {};
          const regex = /(\w+)=(?:"([^"]+)"|([^,]+))/g;
          let match;
          while ((match = regex.exec(wwwAuth)) !== null) {
            digestData[match[1]] = match[2] || match[3];
          }

          const nc = '00000001';
          const cnonce = crypto.randomBytes(8).toString('hex');
          const qop = digestData.qop || 'auth';

          const ha1 = crypto.createHash('md5')
            .update(`${this.username}:${digestData.realm}:${this.password}`)
            .digest('hex');

          const ha2 = crypto.createHash('md5')
            .update(`${method}:${uri}`)
            .digest('hex');

          const response = crypto.createHash('md5')
            .update(`${ha1}:${digestData.nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
            .digest('hex');

          const authHeader = `Digest username="${this.username}", realm="${digestData.realm}", nonce="${digestData.nonce}", uri="${uri}", algorithm="${digestData.algorithm || 'MD5'}", response="${response}", qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;

          const headers: any = {
            'Authorization': authHeader
          };
          
          if (method === 'POST' && data) {
            headers['Content-Type'] = 'application/json';
            headers['Content-Length'] = Buffer.byteLength(data).toString();
          }
          
          const response2 = await axios({
            method,
            url,
            data,
            headers,
            timeout: timeout || 20000,
            validateStatus: () => true,
            httpsAgent: isHttps ? new https.Agent({
              rejectUnauthorized: false
            }) : undefined,
          });

          logger.debug(`[AOA] Response status: ${response2.status}`);
          return response2;
        }
      }
      
      if (response1.status === 200) {
        return response1;
      } else {
        throw new Error(`Request failed with status ${response1.status}`);
      }
    } catch (error: any) {
      logger.error(`[AOA] Request error:`, error.message);
      throw error;
    }
  }
}

export default AOAService;