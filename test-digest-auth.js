#!/usr/bin/env node

const AxiosDigestAuth = require('@mhoc/axios-digest-auth').default;

async function testDigestAuth() {
  const ip = process.argv[2] || '192.168.50.156';
  const username = process.argv[3] || 'axis';
  const password = process.argv[4] || 'baton';
  
  console.log(`Testing digest auth at ${ip} with ${username}/${password}...`);
  
  const digestAuth = new AxiosDigestAuth({
    username,
    password,
  });
  
  try {
    const response = await digestAuth.request({
      url: `http://${ip}/axis-cgi/param.cgi?action=list&group=Brand`,
      method: 'GET',
      timeout: 5000,
    });
    
    console.log('Success! Response status:', response.status);
    console.log('Response data:', response.data);
    
    if (response.data.includes('Brand=AXIS')) {
      console.log('✓ Confirmed Axis camera!');
    }
  } catch (error) {
    console.error('Failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
    }
  }
}

testDigestAuth();