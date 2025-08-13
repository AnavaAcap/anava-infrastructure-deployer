#!/usr/bin/env node
/**
 * Test script for Axis Object Analytics (AOA) Service
 * Run with: npx ts-node src/main/services/aoa/testAOA.ts
 */

import AOAService from './aoaService';
import { logger } from '../../utils/logger';

// Configure your camera details here
const CAMERA_IP = '192.168.50.156';
const USERNAME = 'anava';
const PASSWORD = 'baton';

async function testAOAService() {
  console.log('========================================');
  console.log('Axis Object Analytics (AOA) Test Suite');
  console.log('========================================\n');

  const aoa = new AOAService(CAMERA_IP, USERNAME, PASSWORD);

  try {
    // 1. Check supported versions
    console.log('1. Checking supported API versions...');
    const versions = await aoa.getSupportedVersions();
    console.log('   Supported versions:', versions);
    console.log('   ✅ Version check complete\n');

    // 2. Start AOA application
    console.log('2. Starting AOA application...');
    const started = await aoa.startAOA();
    console.log(`   AOA started: ${started ? '✅' : '❌'}\n`);

    // 3. Get application status
    console.log('3. Getting AOA status...');
    const status = await aoa.getStatus();
    console.log('   Status:', {
      running: status.running ? '✅' : '❌',
      licensed: status.licensed ? '✅' : '❌',
      scenarios: status.scenarios.length
    });
    console.log('\n');

    // 4. Get configuration capabilities
    console.log('4. Getting configuration capabilities...');
    const capabilities = await aoa.getConfigurationCapabilities();
    console.log('   Capabilities received:', capabilities ? '✅' : '❌');
    if (capabilities?.data) {
      console.log('   - Max scenarios:', capabilities.data.maxNbrOfScenarios || 'N/A');
      console.log('   - Scenario types:', capabilities.data.scenarioTypes || 'N/A');
    }
    console.log('\n');

    // 5. Get current configuration
    console.log('5. Getting current configuration...');
    const currentConfig = await aoa.getConfiguration();
    console.log('   Current scenarios:', currentConfig.data?.scenarios?.length || 0);
    console.log('\n');

    // 6. Create human detection scenario
    console.log('6. Creating human detection scenario...');
    const humanDetectionCreated = await aoa.createHumanDetectionScenario(
      'Test Human Detection',
      3 // 3 seconds time in area
    );
    console.log(`   Human detection scenario created: ${humanDetectionCreated ? '✅' : '❌'}\n`);

    // 7. List all scenarios
    console.log('7. Listing all scenarios...');
    const scenarios = await aoa.getScenarios();
    console.log('   Total scenarios:', scenarios.length);
    scenarios.forEach(s => {
      console.log(`   - [${s.id}] ${s.name} (${s.type}) - ${s.enabled ? 'Enabled' : 'Disabled'}`);
    });
    console.log('\n');

    // 8. Test scenario update
    if (scenarios.length > 0) {
      console.log('8. Testing scenario update...');
      const firstScenario = scenarios[0];
      const updated = await aoa.updateScenario(firstScenario.id, {
        name: `${firstScenario.name} (Updated)`
      });
      console.log(`   Scenario update: ${updated ? '✅' : '❌'}\n`);
    }

    // 9. Setup demo configuration (optional - this will replace existing config)
    console.log('9. Setup demo configuration? (y/n)');
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    await new Promise<void>((resolve) => {
      rl.question('   ', async (answer: string) => {
        if (answer.toLowerCase() === 'y') {
          console.log('   Setting up demo configuration...');
          const demoSetup = await aoa.setupDemoConfiguration();
          console.log(`   Demo setup: ${demoSetup ? '✅' : '❌'}\n`);
        } else {
          console.log('   Skipping demo setup\n');
        }
        rl.close();
        resolve();
      });
    });

    // 10. Final status check
    console.log('10. Final status check...');
    const finalStatus = await aoa.getStatus();
    console.log('    Final configuration:');
    console.log('    - Running:', finalStatus.running ? '✅' : '❌');
    console.log('    - Licensed:', finalStatus.licensed ? '✅' : '❌');
    console.log('    - Active scenarios:', finalStatus.scenarios.length);
    finalStatus.scenarios.forEach(s => {
      console.log(`      • ${s.name} (${s.active ? 'Active' : 'Inactive'})`);
    });

    console.log('\n========================================');
    console.log('✅ AOA Test Suite Complete!');
    console.log('========================================');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testAOAService().catch(console.error);
}