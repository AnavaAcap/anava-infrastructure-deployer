#!/usr/bin/env node
/**
 * Discover available ACAP commands
 */

const axios = require('axios');
const https = require('https');

const CAMERA_IP = '192.168.50.156';
const USERNAME = 'anava';
const PASSWORD = 'baton';

// Create HTTPS agent that ignores self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// Helper function for Basic auth
function getBasicAuth(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

// Known commands to test
const COMMANDS_TO_TEST = [
  // Existing commands
  'getSceneDescription',
  'setInstallerConfig',
  'getInstallerConfig',
  'pushCameraSettings',
  'getDeviceInfo',
  'getSystemConfig',
  
  // Vision Architect commands (might not exist yet)
  'deployVisionSystem',
  'createSkill',
  'createSecurityProfile',
  'createAOAScenario',
  'listSkills',
  'listSecurityProfiles',
  'listAOAScenarios',
  
  // Other potential commands
  'listCommands',
  'help',
  'version',
  'status',
  'ping',
  
  // AOA-related commands
  'generateFromDescription',
  'getAOAStatus',
  'configureAOA'
];

async function testCommand(command) {
  const url = `https://${CAMERA_IP}/local/BatonAnalytic/baton_analytic.cgi?command=${command}`;
  
  try {
    // Try GET first
    const response = await axios.get(url, {
      headers: {
        'Authorization': getBasicAuth(USERNAME, PASSWORD)
      },
      validateStatus: () => true,
      timeout: 5000,
      httpsAgent
    });
    
    if (response.status === 200) {
      return { command, status: 'EXISTS', method: 'GET', response: response.data };
    } else if (response.status === 405) {
      // Method not allowed, try POST
      const postResponse = await axios.post(url, '{}', {
        headers: {
          'Authorization': getBasicAuth(USERNAME, PASSWORD),
          'Content-Type': 'application/json'
        },
        validateStatus: () => true,
        timeout: 5000,
        httpsAgent
      });
      
      if (postResponse.status === 200) {
        return { command, status: 'EXISTS', method: 'POST', response: postResponse.data };
      } else if (postResponse.status === 400 && postResponse.data !== 'Command not found.\n') {
        return { command, status: 'EXISTS (needs params)', method: 'POST', response: postResponse.data };
      }
    } else if (response.status === 400 && response.data === 'Command not found.\n') {
      return { command, status: 'NOT_FOUND' };
    }
    
    return { command, status: 'UNKNOWN', code: response.status, data: response.data };
  } catch (error) {
    return { command, status: 'ERROR', error: error.message };
  }
}

async function discoverCommands() {
  console.log('========================================');
  console.log('ACAP Command Discovery');
  console.log('========================================');
  console.log('Camera:', CAMERA_IP);
  console.log('Testing', COMMANDS_TO_TEST.length, 'commands...\n');
  
  const results = {
    exists: [],
    needsParams: [],
    notFound: [],
    errors: []
  };
  
  for (const command of COMMANDS_TO_TEST) {
    process.stdout.write(`Testing ${command}...`);
    const result = await testCommand(command);
    
    if (result.status === 'EXISTS') {
      console.log(` ✅ EXISTS (${result.method})`);
      results.exists.push(result);
    } else if (result.status === 'EXISTS (needs params)') {
      console.log(` ⚠️  EXISTS but needs parameters`);
      results.needsParams.push(result);
    } else if (result.status === 'NOT_FOUND') {
      console.log(` ❌ NOT FOUND`);
      results.notFound.push(command);
    } else if (result.status === 'ERROR') {
      console.log(` ⚠️  ERROR: ${result.error}`);
      results.errors.push(result);
    } else {
      console.log(` ❓ UNKNOWN: ${result.code}`);
      results.errors.push(result);
    }
  }
  
  console.log('\n========================================');
  console.log('SUMMARY');
  console.log('========================================');
  
  if (results.exists.length > 0) {
    console.log('\n✅ WORKING COMMANDS:');
    results.exists.forEach(r => {
      console.log(`  - ${r.command} (${r.method})`);
      if (typeof r.response === 'object') {
        console.log(`    Response: ${JSON.stringify(r.response).substring(0, 100)}...`);
      }
    });
  }
  
  if (results.needsParams.length > 0) {
    console.log('\n⚠️  COMMANDS THAT NEED PARAMETERS:');
    results.needsParams.forEach(r => {
      console.log(`  - ${r.command}`);
      console.log(`    Response: ${r.response}`);
    });
  }
  
  if (results.notFound.length > 0) {
    console.log('\n❌ COMMANDS NOT FOUND:');
    results.notFound.forEach(cmd => console.log(`  - ${cmd}`));
  }
  
  if (results.errors.length > 0) {
    console.log('\n⚠️  ERRORS:');
    results.errors.forEach(r => {
      console.log(`  - ${r.command}: ${r.error || `Status ${r.code}`}`);
    });
  }
  
  console.log('\n========================================');
  console.log('RECOMMENDATIONS');
  console.log('========================================');
  
  if (!results.exists.find(r => r.command === 'deployVisionSystem')) {
    console.log('• The ACAP needs to implement deployVisionSystem command for Vision Architect');
  }
  
  if (!results.exists.find(r => r.command === 'listCommands')) {
    console.log('• Consider implementing a listCommands endpoint for discovery');
  }
  
  if (results.exists.find(r => r.command === 'generateFromDescription')) {
    console.log('• The ACAP supports AOA natural language processing');
  }
  
  console.log('\nTotal: ' + 
    `${results.exists.length} working, ` +
    `${results.needsParams.length} need params, ` +
    `${results.notFound.length} not found`
  );
}

// Run discovery
discoverCommands().catch(error => {
  console.error('Discovery failed:', error);
  process.exit(1);
});