/**
 * AOA Configuration Debugger
 * Interactive tool to test and debug AOA configuration
 */

import { AOAService } from './aoaService';
import { logger } from '../../utils/logger';

export class AOADebugger {
  private aoa: AOAService;

  constructor(cameraIp: string, username: string, password: string) {
    this.aoa = new AOAService(cameraIp, username, password);
  }

  /**
   * Analyze current configuration to understand structure
   */
  async analyzeCurrentConfig(): Promise<void> {
    try {
      console.log('\n=== ANALYZING CURRENT AOA CONFIGURATION ===\n');
      
      // Get current config
      const config = await this.aoa.getConfiguration();
      console.log('Current Configuration:', JSON.stringify(config, null, 2));
      
      // Get scenarios
      const scenarios = await this.aoa.getScenarios();
      console.log('\n=== SCENARIOS ===');
      
      for (const scenario of scenarios) {
        console.log(`\nScenario: ${scenario.name} (ID: ${scenario.id})`);
        console.log('Type:', scenario.type);
        console.log('Enabled:', scenario.enabled);
        
        if (scenario.objectClassifications) {
          console.log('Object Classifications:');
          scenario.objectClassifications.forEach((oc: any) => {
            console.log(`  - ${oc.type}: ${oc.selected ? 'ENABLED' : 'DISABLED'}`);
          });
        }
        
        if (scenario.filters) {
          console.log('Filters:');
          scenario.filters.forEach((filter: any) => {
            console.log(`  - Type: ${filter.type}`);
            console.log(`    Active: ${filter.active}`);
            if (filter.data !== undefined) {
              console.log(`    Data: ${filter.data}`);
            }
            if (filter.time !== undefined) {
              console.log(`    Time: ${filter.time}`);
            }
            if (filter.duration !== undefined) {
              console.log(`    Duration: ${filter.duration}`);
            }
          });
        }
        
        if (scenario.triggers) {
          console.log('Triggers:');
          scenario.triggers.forEach((trigger: any) => {
            console.log(`  - Type: ${trigger.type}`);
            if (trigger.vertices) {
              console.log(`    Vertices: ${JSON.stringify(trigger.vertices)}`);
            }
          });
        }
      }
      
    } catch (error) {
      console.error('Error analyzing config:', error);
    }
  }

  /**
   * Create a comprehensive test scenario with all features
   */
  async createFullFeaturedScenario(): Promise<void> {
    try {
      console.log('\n=== CREATING FULL-FEATURED SCENARIO ===\n');
      
      // Get current config to find next ID
      const currentConfig = await this.aoa.getConfiguration();
      const existingScenarios = currentConfig.data?.scenarios || [];
      const nextId = existingScenarios.length > 0 
        ? Math.max(...existingScenarios.map((s: any) => s.id)) + 1 
        : 1;
      
      // Create scenario with all possible configurations
      const scenario = {
        id: nextId,
        name: `FullTest-${nextId}`,
        type: 'motion',
        enabled: true,
        devices: [{ id: 1 }],
        triggers: [{
          type: 'includeArea',
          vertices: [
            [-0.8, -0.8],
            [-0.8, 0.8],
            [0.8, 0.8],
            [0.8, -0.8]
          ]
        }],
        objectClassifications: [
          {
            type: 'human',
            selected: true
          },
          {
            type: 'vehicle', 
            selected: false
          }
        ],
        filters: [
          {
            type: 'timeShort',
            active: true,
            time: 3000  // Try 'time' instead of 'data'
          },
          {
            type: 'loiteringTime',  // Alternative time filter type
            active: true,
            duration: 3  // Try different property names
          },
          {
            type: 'timeLong',  // Another alternative
            active: true,
            data: 3000
          },
          {
            type: 'size',
            active: false,
            minWidth: 50,
            minHeight: 50
          }
        ],
        perspectives: [],  // Add if needed
        metadata: {  // Try additional metadata
          timeInArea: true,
          timeThreshold: 3
        }
      };
      
      console.log('Creating scenario with configuration:', JSON.stringify(scenario, null, 2));
      
      const result = await this.aoa.createScenario(scenario);
      console.log('Creation result:', result);
      
      // Verify the created scenario
      await this.analyzeCurrentConfig();
      
    } catch (error) {
      console.error('Error creating scenario:', error);
    }
  }

  /**
   * Test different filter configurations
   */
  async testFilterVariations(): Promise<void> {
    try {
      console.log('\n=== TESTING FILTER VARIATIONS ===\n');
      
      const filterVariations = [
        {
          name: 'TimeShort-Data',
          filters: [{
            type: 'timeShort',
            active: true,
            data: 3000
          }]
        },
        {
          name: 'TimeShort-Time',
          filters: [{
            type: 'timeShort',
            active: true,
            time: 3000
          }]
        },
        {
          name: 'TimeShort-Duration',
          filters: [{
            type: 'timeShort',
            active: true,
            duration: 3
          }]
        },
        {
          name: 'Loitering',
          filters: [{
            type: 'loitering',
            active: true,
            time: 3000
          }]
        },
        {
          name: 'DwellTime',
          filters: [{
            type: 'dwellTime',
            active: true,
            threshold: 3000
          }]
        },
        {
          name: 'TimeInArea',
          filters: [{
            type: 'timeInArea',
            active: true,
            seconds: 3
          }]
        }
      ];
      
      for (const variation of filterVariations) {
        console.log(`\nTesting filter variation: ${variation.name}`);
        
        const currentConfig = await this.aoa.getConfiguration();
        const existingScenarios = currentConfig.data?.scenarios || [];
        const nextId = existingScenarios.length > 0 
          ? Math.max(...existingScenarios.map((s: any) => s.id)) + 1 
          : 1;
        
        const scenario = {
          id: nextId,
          name: variation.name,
          type: 'motion',
          enabled: true,
          devices: [{ id: 1 }],
          triggers: [{
            type: 'includeArea',
            vertices: [[-0.5, -0.5], [-0.5, 0.5], [0.5, 0.5], [0.5, -0.5]]
          }],
          objectClassifications: [{
            type: 'human',
            selected: true
          }],
          filters: variation.filters
        };
        
        try {
          const result = await this.aoa.createScenario(scenario);
          console.log(`  Result: ${result ? 'SUCCESS' : 'FAILED'}`);
          
          if (result) {
            // Check what was actually created
            const scenarios = await this.aoa.getScenarios();
            const created = scenarios.find((s: any) => s.name === variation.name);
            if (created && created.filters) {
              console.log('  Created filters:', JSON.stringify(created.filters, null, 2));
            }
          }
        } catch (err: any) {
          console.log(`  Error: ${err.message}`);
        }
      }
      
    } catch (error) {
      console.error('Error testing filter variations:', error);
    }
  }

  /**
   * Try to update an existing scenario to enable Time in Area
   */
  async updateScenarioWithTimeInArea(scenarioId: number): Promise<void> {
    try {
      console.log(`\n=== UPDATING SCENARIO ${scenarioId} WITH TIME IN AREA ===\n`);
      
      // Get the current scenario
      const scenarios = await this.aoa.getScenarios();
      const scenario = scenarios.find((s: any) => s.id === scenarioId);
      
      if (!scenario) {
        console.log('Scenario not found');
        return;
      }
      
      console.log('Current scenario:', JSON.stringify(scenario, null, 2));
      
      // Try different approaches to enable Time in Area
      const updates = [
        {
          description: 'Add timeShort filter with active=true',
          update: {
            filters: [
              ...(scenario.filters || []).filter((f: any) => f.type !== 'timeShort'),
              {
                type: 'timeShort',
                active: true,
                data: 3000
              }
            ]
          }
        },
        {
          description: 'Set entire configuration with time filter',
          update: {
            ...scenario,
            filters: [{
              type: 'timeShort',
              active: true,
              data: 3000
            }]
          }
        },
        {
          description: 'Add metadata for time in area',
          update: {
            ...scenario,
            metadata: {
              timeInArea: true,
              timeThreshold: 3
            },
            filters: [{
              type: 'timeShort',
              active: true,
              data: 3000
            }]
          }
        }
      ];
      
      for (const { description, update } of updates) {
        console.log(`\nTrying: ${description}`);
        console.log('Update payload:', JSON.stringify(update, null, 2));
        
        try {
          const result = await this.aoa.updateScenario(scenarioId, update);
          console.log('Result:', result ? 'SUCCESS' : 'FAILED');
          
          if (result) {
            // Verify the update
            const updatedScenarios = await this.aoa.getScenarios();
            const updated = updatedScenarios.find((s: any) => s.id === scenarioId);
            console.log('Updated scenario filters:', JSON.stringify(updated?.filters, null, 2));
            
            if (updated?.filters?.some((f: any) => f.active === true)) {
              console.log('✅ Time filter appears to be active!');
              break;
            }
          }
        } catch (err: any) {
          console.log('Error:', err.message);
        }
      }
      
    } catch (error) {
      console.error('Error updating scenario:', error);
    }
  }

  /**
   * Get capabilities to understand supported features
   */
  async getCapabilities(): Promise<void> {
    try {
      console.log('\n=== AOA CAPABILITIES ===\n');
      
      const capabilities = await this.aoa.getCapabilities();
      console.log('Capabilities:', JSON.stringify(capabilities, null, 2));
      
    } catch (error) {
      console.error('Error getting capabilities:', error);
    }
  }
}

// Test script
async function debugAOA() {
  const aoaDebugger = new AOADebugger('192.168.50.156', 'anava', 'baton');
  
  console.log('Starting AOA debugging session...\n');
  
  // Analyze current state
  await aoaDebugger.analyzeCurrentConfig();
  
  // Get capabilities
  await aoaDebugger.getCapabilities();
  
  // Test filter variations
  await aoaDebugger.testFilterVariations();
  
  // Create a full-featured scenario
  await aoaDebugger.createFullFeaturedScenario();
  
  // Try to update an existing scenario
  const scenarios = await new AOAService('192.168.50.156', 'anava', 'baton').getScenarios();
  if (scenarios.length > 0) {
    await aoaDebugger.updateScenarioWithTimeInArea(scenarios[0].id);
  }
}

// Run if executed directly
if (require.main === module) {
  debugAOA().catch(console.error);
}

export default AOADebugger;