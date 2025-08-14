#!/usr/bin/env node
/**
 * Test Vision Architect Deployment with Correct ACAP Endpoints
 * 
 * This script tests the deployment of Vision Architect systems using the 
 * correct endpoints: createSkill, createSecurityProfile, and AOA scenarios
 */

const axios = require('axios');
const https = require('https');
const crypto = require('crypto');

// Configuration
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

// Test individual endpoints
async function testCreateSkill() {
  console.log('\n📝 Testing createSkill endpoint...');
  const url = `https://${CAMERA_IP}/local/BatonAnalytic/baton_analytic.cgi?command=createSkill`;
  
  const skill = {
    name: 'TestSkill',
    description: 'Test skill for Vision Architect',
    category: 'security',
    analysisConfiguration: {
      description: 'Test analysis',
      questions: [],
      objectDetection: ['person'],
      responseCriteria: 'Always alert',
      talkdownActivated: false,
      elevenLabsVoiceId: ''
    }
  };
  
  try {
    const response = await axios.post(url, skill, {
      headers: {
        'Authorization': getBasicAuth(USERNAME, PASSWORD),
        'Content-Type': 'application/json'
      },
      validateStatus: () => true,
      timeout: 10000,
      httpsAgent
    });
    
    console.log('  Status:', response.status);
    console.log('  Response:', JSON.stringify(response.data).substring(0, 200));
    
    if (response.status === 200) {
      console.log('  ✅ createSkill endpoint exists and works');
      return true;
    } else if (response.status === 400 && response.data === 'Command not found.\n') {
      console.log('  ❌ createSkill command not implemented in ACAP');
      return false;
    } else {
      console.log('  ⚠️  Unexpected response:', response.status);
      return false;
    }
  } catch (error) {
    console.error('  ❌ Error:', error.message);
    return false;
  }
}

async function testCreateSecurityProfile() {
  console.log('\n🛡️  Testing createSecurityProfile endpoint...');
  const url = `https://${CAMERA_IP}/local/BatonAnalytic/baton_analytic.cgi?command=createSecurityProfile`;
  
  const profile = {
    name: 'TestProfile',
    skillId: 'TestSkill',
    preFilterModel: 'gemini-1.5-flash',
    fullAnalysisModel: 'gemini-1.5-pro',
    viewArea: 1,
    analysisSchedule: '',
    trigger: {
      type: 'Object',
      port: 1,
      profile: 'TestScenario'
    },
    activeMonitoring: {
      enabled: false,
      intervalMs: 5000,
      maxDurationSec: 120
    }
  };
  
  try {
    const response = await axios.post(url, profile, {
      headers: {
        'Authorization': getBasicAuth(USERNAME, PASSWORD),
        'Content-Type': 'application/json'
      },
      validateStatus: () => true,
      timeout: 10000,
      httpsAgent
    });
    
    console.log('  Status:', response.status);
    console.log('  Response:', JSON.stringify(response.data).substring(0, 200));
    
    if (response.status === 200) {
      console.log('  ✅ createSecurityProfile endpoint exists and works');
      return true;
    } else if (response.status === 400 && response.data === 'Command not found.\n') {
      console.log('  ❌ createSecurityProfile command not implemented in ACAP');
      return false;
    } else {
      console.log('  ⚠️  Unexpected response:', response.status);
      return false;
    }
  } catch (error) {
    console.error('  ❌ Error:', error.message);
    return false;
  }
}

async function testAOAControl() {
  console.log('\n🎯 Testing AOA control endpoint...');
  const url = `https://${CAMERA_IP}/local/objectanalytics/control.cgi`;
  
  const payload = {
    method: 'getSupportedVersions',
    apiVersion: '1.0'
  };
  
  try {
    const response = await axios.post(url, JSON.stringify(payload), {
      headers: {
        'Authorization': getBasicAuth(USERNAME, PASSWORD),
        'Content-Type': 'application/json'
      },
      validateStatus: () => true,
      timeout: 10000,
      httpsAgent
    });
    
    console.log('  Status:', response.status);
    
    if (response.status === 200) {
      console.log('  Response:', JSON.stringify(response.data).substring(0, 200));
      console.log('  ✅ AOA control endpoint exists and works');
      return true;
    } else if (response.status === 404) {
      console.log('  ❌ AOA not installed on camera');
      return false;
    } else {
      console.log('  ⚠️  Unexpected response:', response.status);
      return false;
    }
  } catch (error) {
    console.error('  ❌ Error:', error.message);
    return false;
  }
}

// Test a full Vision Architect system deployment
async function testFullSystemDeployment() {
  console.log('\n🚀 Testing Full Vision Architect System Deployment...');
  console.log('========================================');
  
  // Example system generated by Vision Architect
  const visionSystem = {
    systemOverview: 'Test security monitoring system',
    axisScenarios: [
      {
        name: 'MotionDetect',
        type: 'motion',
        enabled: true,
        triggers: [{
          type: 'includeArea',
          vertices: [[-0.9, -0.9], [-0.9, 0.9], [0.9, 0.9], [0.9, -0.9]]
        }],
        filters: [],
        objectClassifications: [
          { type: 'human', selected: true }
        ]
      }
    ],
    skills: [
      {
        name: 'SuspiciousActivity',
        description: 'Detects suspicious behavior patterns',
        category: 'security',
        analysisConfiguration: {
          description: 'Analyze for suspicious activity',
          questions: [],
          objectDetection: ['person'],
          responseCriteria: 'Alert on suspicious behavior',
          talkdownActivated: false,
          elevenLabsVoiceId: ''
        }
      }
    ],
    securityProfiles: [
      {
        name: 'NightWatch',
        skillId: 'SuspiciousActivity',
        preFilterModel: 'gemini-1.5-flash',
        fullAnalysisModel: 'gemini-1.5-pro',
        viewArea: 1,
        analysisSchedule: '',
        trigger: {
          type: 'Object',
          port: 1,
          profile: 'MotionDetect'
        },
        activeMonitoring: {
          enabled: true,
          intervalMs: 5000,
          maxDurationSec: 120
        }
      }
    ],
    systemJustification: 'Comprehensive security monitoring for after-hours protection'
  };
  
  console.log('\nSystem to deploy:');
  console.log(`  - ${visionSystem.axisScenarios.length} AOA scenario(s)`);
  console.log(`  - ${visionSystem.skills.length} skill(s)`);
  console.log(`  - ${visionSystem.securityProfiles.length} security profile(s)`);
  
  let successCount = 0;
  let totalCount = 0;
  
  // Deploy Skills
  console.log('\n📝 Deploying Skills...');
  for (const skill of visionSystem.skills) {
    totalCount++;
    console.log(`  Deploying skill: ${skill.name}`);
    
    const url = `https://${CAMERA_IP}/local/BatonAnalytic/baton_analytic.cgi?command=createSkill`;
    
    try {
      const response = await axios.post(url, skill, {
        headers: {
          'Authorization': getBasicAuth(USERNAME, PASSWORD),
          'Content-Type': 'application/json'
        },
        validateStatus: () => true,
        timeout: 10000,
        httpsAgent
      });
      
      if (response.status === 200) {
        console.log(`    ✅ Skill deployed successfully`);
        successCount++;
      } else if (response.status === 400 && response.data === 'Command not found.\n') {
        console.log(`    ❌ createSkill not implemented in ACAP`);
      } else {
        console.log(`    ⚠️  Unexpected response: ${response.status}`);
      }
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
    }
  }
  
  // Deploy Security Profiles
  console.log('\n🛡️  Deploying Security Profiles...');
  for (const profile of visionSystem.securityProfiles) {
    totalCount++;
    console.log(`  Deploying profile: ${profile.name}`);
    
    const url = `https://${CAMERA_IP}/local/BatonAnalytic/baton_analytic.cgi?command=createSecurityProfile`;
    
    try {
      const response = await axios.post(url, profile, {
        headers: {
          'Authorization': getBasicAuth(USERNAME, PASSWORD),
          'Content-Type': 'application/json'
        },
        validateStatus: () => true,
        timeout: 10000,
        httpsAgent
      });
      
      if (response.status === 200) {
        console.log(`    ✅ Profile deployed successfully`);
        successCount++;
      } else if (response.status === 400 && response.data === 'Command not found.\n') {
        console.log(`    ❌ createSecurityProfile not implemented in ACAP`);
      } else {
        console.log(`    ⚠️  Unexpected response: ${response.status}`);
      }
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
    }
  }
  
  // Deploy AOA Scenarios
  console.log('\n🎯 Deploying AOA Scenarios...');
  // Note: This would use the AOA control.cgi API as shown in aoaService.ts
  // For now, we'll just test if AOA is available
  
  const aoaUrl = `https://${CAMERA_IP}/local/objectanalytics/control.cgi`;
  const getConfigPayload = {
    method: 'getConfiguration',
    apiVersion: '1.0',
    context: 'VisionArchitect'
  };
  
  try {
    const response = await axios.post(aoaUrl, JSON.stringify(getConfigPayload), {
      headers: {
        'Authorization': getBasicAuth(USERNAME, PASSWORD),
        'Content-Type': 'application/json'
      },
      validateStatus: () => true,
      timeout: 10000,
      httpsAgent
    });
    
    if (response.status === 200) {
      console.log('  ✅ AOA is available for scenario deployment');
      console.log('  Current AOA configuration retrieved');
      // In real deployment, we would add scenarios to the configuration
      // and call setConfiguration to deploy them
    } else if (response.status === 404) {
      console.log('  ❌ AOA not installed on camera');
    } else {
      console.log('  ⚠️  Unexpected AOA response:', response.status);
    }
  } catch (error) {
    console.log('  ❌ AOA Error:', error.message);
  }
  
  console.log('\n========================================');
  console.log('DEPLOYMENT SUMMARY');
  console.log('========================================');
  console.log(`Successfully deployed: ${successCount}/${totalCount} components`);
  
  if (successCount === totalCount) {
    console.log('✅ All components deployed successfully!');
  } else if (successCount === 0) {
    console.log('❌ No components could be deployed');
    console.log('⚠️  The ACAP may need to be updated with Vision Architect support');
  } else {
    console.log('⚠️  Partial deployment - some components failed');
  }
}

// Main test runner
async function runTests() {
  console.log('========================================');
  console.log('VISION ARCHITECT DEPLOYMENT TEST');
  console.log('========================================');
  console.log('Camera:', CAMERA_IP);
  console.log('Username:', USERNAME);
  console.log('Testing deployment endpoints...\n');
  
  // Test individual endpoints
  const skillWorks = await testCreateSkill();
  const profileWorks = await testCreateSecurityProfile();
  const aoaWorks = await testAOAControl();
  
  console.log('\n========================================');
  console.log('ENDPOINT TEST RESULTS');
  console.log('========================================');
  console.log('createSkill:', skillWorks ? '✅ Working' : '❌ Not implemented');
  console.log('createSecurityProfile:', profileWorks ? '✅ Working' : '❌ Not implemented');
  console.log('AOA control:', aoaWorks ? '✅ Working' : '❌ Not available');
  
  if (!skillWorks && !profileWorks) {
    console.log('\n⚠️  WARNING: Vision Architect endpoints not implemented in ACAP');
    console.log('The ACAP needs to be updated to support Vision Architect deployment');
  }
  
  // Test full system deployment
  await testFullSystemDeployment();
  
  console.log('\n========================================');
  console.log('TEST COMPLETE');
  console.log('========================================');
  
  if (!skillWorks || !profileWorks) {
    console.log('\n📝 NEXT STEPS:');
    console.log('1. Update the ACAP to implement createSkill and createSecurityProfile endpoints');
    console.log('2. These endpoints should accept the skill/profile objects and store them');
    console.log('3. The ACAP should then use these configurations to process camera events');
    console.log('4. AOA scenarios can be deployed using the existing AOA control.cgi API');
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});