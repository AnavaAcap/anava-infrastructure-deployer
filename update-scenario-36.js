#!/usr/bin/env node

const axios = require('axios');
const crypto = require('crypto');

// Simple console logger
const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  error: (...args) => console.error('[ERROR]', ...args)
};

class AOAService {
  constructor(cameraIp, username, password) {
    this.cameraIp = cameraIp;
    this.username = username;
    this.password = password;
    this.baseUrl = `http://${cameraIp}`;
  }

  async simpleDigestAuth(method, path, body = null) {
    const url = `${this.baseUrl}${path}`;
    
    try {
      const initialResponse = await axios({
        method,
        url,
        validateStatus: () => true
      });

      if (initialResponse.status === 200) {
        return initialResponse;
      }

      if (initialResponse.status !== 401) {
        throw new Error(`Unexpected status: ${initialResponse.status}`);
      }

      const authHeader = initialResponse.headers['www-authenticate'];
      if (!authHeader || !authHeader.includes('Digest')) {
        throw new Error('No digest auth challenge received');
      }

      const realm = authHeader.match(/realm="([^"]+)"/)?.[1];
      const nonce = authHeader.match(/nonce="([^"]+)"/)?.[1];
      const opaque = authHeader.match(/opaque="([^"]+)"/)?.[1];
      const qop = authHeader.match(/qop="([^"]+)"/)?.[1];

      const nc = '00000001';
      const cnonce = crypto.randomBytes(16).toString('hex');
      
      const ha1 = crypto.createHash('md5')
        .update(`${this.username}:${realm}:${this.password}`)
        .digest('hex');
      
      const ha2 = crypto.createHash('md5')
        .update(`${method}:${path}`)
        .digest('hex');
      
      const response = crypto.createHash('md5')
        .update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
        .digest('hex');

      const authValue = `Digest username="${this.username}", realm="${realm}", ` +
        `nonce="${nonce}", uri="${path}", qop=${qop}, nc=${nc}, ` +
        `cnonce="${cnonce}", response="${response}"` +
        (opaque ? `, opaque="${opaque}"` : '');

      const config = {
        method,
        url,
        headers: {
          'Authorization': authValue,
          'Content-Type': 'application/json'
        }
      };

      if (body) {
        config.data = body;
      }

      return await axios(config);
    } catch (error) {
      logger.error('Auth failed:', error.message);
      throw error;
    }
  }

  async getConfiguration() {
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
  }

  async setConfiguration(configuration) {
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
    return response.data;
  }
}

async function updateScenario36() {
  const aoa = new AOAService('192.168.50.156', 'anava', 'baton');
  
  try {
    console.log('\n=== UPDATING SCENARIO 36 TO 3 SECONDS ===\n');
    
    // Get current configuration
    const currentConfig = await aoa.getConfiguration();
    const scenarios = currentConfig.data?.scenarios || [];
    
    // Find scenario 36
    const scenario36Index = scenarios.findIndex(s => s.id === 36);
    if (scenario36Index === -1) {
      console.log('❌ Scenario 36 not found');
      return;
    }
    
    const scenario36 = scenarios[scenario36Index];
    console.log('Found scenario 36:', scenario36.name);
    console.log('Current trigger conditions:', JSON.stringify(scenario36.triggers[0].conditions, null, 2));
    
    // Update the Time in Area from 4 seconds to 3 seconds
    if (scenario36.triggers && scenario36.triggers[0] && scenario36.triggers[0].conditions) {
      const conditions = scenario36.triggers[0].conditions;
      
      // Find and update the individualTimeInArea condition
      conditions.forEach(cond => {
        if (cond.type === 'individualTimeInArea' && cond.data) {
          cond.data.forEach(d => {
            if (d.type === 'human') {
              console.log(`\nChanging time from ${d.time} seconds to 3 seconds`);
              d.time = 3;  // Change from 4 to 3 seconds
            }
          });
        }
      });
    }
    
    // Also update the filters to match
    if (scenario36.filters) {
      scenario36.filters.forEach(filter => {
        if (filter.type === 'timeShort') {
          filter.data = 3000;  // 3 seconds in milliseconds
          filter.time = 3000;
        }
      });
    }
    
    // Update the configuration
    console.log('\nUpdating configuration...');
    const result = await aoa.setConfiguration(currentConfig.data);
    
    if (result.error) {
      console.log('❌ Error:', result.error.message);
    } else {
      console.log('✅ Successfully updated scenario 36!');
    }
    
    // Verify the update
    console.log('\n=== VERIFYING UPDATE ===\n');
    const verifyConfig = await aoa.getConfiguration();
    const updatedScenario = verifyConfig.data?.scenarios?.find(s => s.id === 36);
    
    if (updatedScenario && updatedScenario.triggers[0].conditions) {
      const condition = updatedScenario.triggers[0].conditions[0];
      if (condition.data && condition.data[0]) {
        console.log(`✅ Scenario 36 (${updatedScenario.name}) now has Time in Area set to: ${condition.data[0].time} seconds`);
        console.log('\nYou can now check the UI at:');
        console.log('http://192.168.50.156/local/objectanalytics/index.html#/scenario/36');
        console.log('The Time in Area should show as 3 seconds and the toggle should be ON!');
      }
    }
    
  } catch (error) {
    console.error('Update failed:', error);
  }
}

// Run the update
updateScenario36().catch(console.error);