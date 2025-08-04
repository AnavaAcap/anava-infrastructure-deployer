#!/usr/bin/env node

const axios = require('axios');
const AxiosDigestAuth = require('@mhoc/axios-digest-auth').default;

async function testBasicFirst() {
  const ip = '192.168.50.156';
  const username = 'anava';
  const password = 'baton';
  
  console.log(`\n1. Testing basic auth first at ${ip}...`);
  
  try {
    const response = await axios.get(`http://${ip}/axis-cgi/param.cgi?action=list&group=Brand`, {
      auth: { username, password },
      timeout: 5000,
      validateStatus: () => true
    });
    
    console.log('Basic auth response:', response.status);
    if (response.status === 401) {
      console.log('WWW-Authenticate header:', response.headers['www-authenticate']);
    }
  } catch (error) {
    console.error('Basic auth error:', error.message);
  }
  
  console.log(`\n2. Testing digest auth...`);
  
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
    
    console.log('Digest auth success! Status:', response.status);
    console.log('Data preview:', response.data.substring(0, 200));
  } catch (error) {
    console.error('Digest auth failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }
  }
  
  console.log(`\n3. Testing a simpler endpoint...`);
  try {
    const response = await digestAuth.request({
      url: `http://${ip}/axis-cgi/basicdeviceinfo.cgi`,
      method: 'GET',
      timeout: 5000,
    });
    
    console.log('Simple endpoint success! Status:', response.status);
    console.log('Data:', response.data);
  } catch (error) {
    console.error('Simple endpoint failed:', error.message);
  }
}

testBasicFirst();