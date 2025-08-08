#!/usr/bin/env node

/**
 * Test all network connection options for macOS 15 Sequoia
 * Tests connection to camera at 192.168.50.156
 */

const net = require('net');
const { spawn } = require('child_process');
const { Bonjour } = require('bonjour-service');
const https = require('https');
const dgram = require('dgram');

const CAMERA_IP = '192.168.50.156';
const CAMERA_PORT = 80;

console.log('🔍 Testing Network Connection Options for macOS 15 Sequoia');
console.log('=========================================================');
console.log(`Target Camera: ${CAMERA_IP}:${CAMERA_PORT}`);
console.log('');

// Test 1: Direct TCP Connection
async function testDirectConnection() {
  console.log('📡 Test 1: Direct TCP Connection');
  console.log('--------------------------------');
  
  return new Promise((resolve) => {
    const client = new net.Socket();
    const timeout = setTimeout(() => {
      client.destroy();
      console.log('❌ Connection timed out');
      resolve(false);
    }, 5000);

    client.connect(CAMERA_PORT, CAMERA_IP, () => {
      clearTimeout(timeout);
      console.log('✅ Successfully connected!');
      client.end();
      resolve(true);
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      if (err.code === 'EHOSTUNREACH') {
        console.log('❌ EHOSTUNREACH - Blocked by macOS firewall');
        console.log('   This is the expected error on macOS 15 without permission');
      } else {
        console.log(`❌ Error: ${err.code} - ${err.message}`);
      }
      resolve(false);
    });
  });
}

// Test 2: Bonjour/mDNS Discovery
async function testBonjourDiscovery() {
  console.log('\n📡 Test 2: Bonjour/mDNS Discovery');
  console.log('----------------------------------');
  
  return new Promise((resolve) => {
    try {
      const bonjour = new Bonjour();
      const cameras = [];
      
      console.log('Starting Bonjour browser for Axis cameras...');
      
      // Look for Axis video services
      const browser = bonjour.find({ type: 'axis-video' });
      
      browser.on('up', (service) => {
        console.log(`✅ Found service: ${service.name} at ${service.addresses?.[0] || 'unknown'}`);
        if (service.addresses?.includes(CAMERA_IP)) {
          console.log(`   ✅ This is our target camera!`);
          cameras.push(service);
        }
      });
      
      // Also try generic http services
      const httpBrowser = bonjour.find({ type: 'http' });
      
      httpBrowser.on('up', (service) => {
        if (service.addresses?.includes(CAMERA_IP)) {
          console.log(`✅ Found HTTP service at ${CAMERA_IP}: ${service.name}`);
          cameras.push(service);
        }
      });
      
      setTimeout(() => {
        browser.stop();
        httpBrowser.stop();
        bonjour.destroy();
        
        if (cameras.length > 0) {
          console.log(`✅ Bonjour discovered ${cameras.length} service(s) at target IP`);
          resolve(true);
        } else {
          console.log('❌ No Bonjour services found at target IP');
          console.log('   Camera may not advertise via mDNS');
          resolve(false);
        }
      }, 5000);
    } catch (err) {
      console.log(`❌ Bonjour error: ${err.message}`);
      resolve(false);
    }
  });
}

// Test 3: SSDP Discovery
async function testSSDPDiscovery() {
  console.log('\n📡 Test 3: SSDP/UPnP Discovery');
  console.log('-------------------------------');
  
  return new Promise((resolve) => {
    try {
      const socket = dgram.createSocket('udp4');
      const devices = [];
      
      const SSDP_ADDRESS = '239.255.255.250';
      const SSDP_PORT = 1900;
      const SEARCH_TARGET = 'urn:axis-com:service:BasicService:1';
      
      const searchMessage = Buffer.from(
        'M-SEARCH * HTTP/1.1\r\n' +
        `HOST: ${SSDP_ADDRESS}:${SSDP_PORT}\r\n` +
        'MAN: "ssdp:discover"\r\n' +
        'MX: 3\r\n' +
        `ST: ${SEARCH_TARGET}\r\n` +
        '\r\n'
      );

      socket.on('message', (msg, rinfo) => {
        const message = msg.toString();
        if (rinfo.address === CAMERA_IP) {
          console.log(`✅ SSDP response from ${CAMERA_IP}`);
          devices.push({ ip: rinfo.address, message: message.substring(0, 200) });
        }
      });

      socket.on('error', (err) => {
        if (err.code === 'EACCES' || err.code === 'EPERM') {
          console.log('❌ Permission denied for multicast');
          console.log('   This is expected without multicast entitlement');
        } else {
          console.log(`❌ SSDP error: ${err.code} - ${err.message}`);
        }
        socket.close();
        resolve(false);
      });

      socket.bind(() => {
        try {
          socket.setBroadcast(true);
          socket.setMulticastTTL(128);
          socket.addMembership(SSDP_ADDRESS);
          
          console.log('Sending SSDP discovery packet...');
          socket.send(searchMessage, 0, searchMessage.length, SSDP_PORT, SSDP_ADDRESS);
          
          setTimeout(() => {
            socket.close();
            if (devices.length > 0) {
              console.log(`✅ SSDP discovered camera at ${CAMERA_IP}`);
              resolve(true);
            } else {
              console.log('❌ No SSDP response from camera');
              resolve(false);
            }
          }, 3000);
        } catch (err) {
          console.log(`❌ Failed to setup multicast: ${err.message}`);
          socket.close();
          resolve(false);
        }
      });
    } catch (err) {
      console.log(`❌ SSDP setup error: ${err.message}`);
      resolve(false);
    }
  });
}

// Test 4: Helper Script
async function testHelperScript() {
  console.log('\n📡 Test 4: Helper Script (Subprocess)');
  console.log('--------------------------------------');
  
  return new Promise((resolve) => {
    const helperPath = require('path').join(__dirname, 'src/main/helpers/network-connect-helper.js');
    const child = spawn(process.execPath, [helperPath, 'test-tcp', CAMERA_IP, CAMERA_PORT.toString()]);
    
    let output = '';
    let error = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      error += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0 && output) {
        try {
          const result = JSON.parse(output);
          if (result.status === 'connected') {
            console.log('✅ Helper script successfully connected!');
            console.log('   This bypasses app-bundle restrictions');
            resolve(true);
          } else {
            console.log(`❌ Helper script failed: ${result.message} (${result.code})`);
            resolve(false);
          }
        } catch (e) {
          console.log(`❌ Failed to parse helper output: ${output}`);
          resolve(false);
        }
      } else {
        console.log(`❌ Helper process failed: ${error || `exit code ${code}`}`);
        resolve(false);
      }
    });

    child.on('error', (err) => {
      console.log(`❌ Failed to spawn helper: ${err.message}`);
      resolve(false);
    });
  });
}

// Test 5: HTTP Request
async function testHTTPRequest() {
  console.log('\n📡 Test 5: HTTP Request to Camera');
  console.log('----------------------------------');
  
  return new Promise((resolve) => {
    const options = {
      hostname: CAMERA_IP,
      port: CAMERA_PORT,
      path: '/axis-cgi/param.cgi?action=list&group=Brand',
      method: 'GET',
      timeout: 5000,
      rejectUnauthorized: false
    };

    const req = require('http').request(options, (res) => {
      console.log(`✅ HTTP Response: ${res.statusCode} ${res.statusMessage}`);
      if (res.statusCode === 401) {
        console.log('   Camera requires authentication (expected)');
      }
      resolve(true);
    });

    req.on('error', (err) => {
      if (err.code === 'EHOSTUNREACH') {
        console.log('❌ EHOSTUNREACH - Blocked by macOS firewall');
      } else {
        console.log(`❌ HTTP error: ${err.code} - ${err.message}`);
      }
      resolve(false);
    });

    req.on('timeout', () => {
      console.log('❌ HTTP request timed out');
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

// Run all tests
async function runAllTests() {
  const results = {
    direct: await testDirectConnection(),
    bonjour: await testBonjourDiscovery(),
    ssdp: await testSSDPDiscovery(),
    helper: await testHelperScript(),
    http: await testHTTPRequest()
  };
  
  console.log('\n📊 Test Results Summary');
  console.log('=======================');
  console.log(`Direct TCP:      ${results.direct ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log(`Bonjour/mDNS:    ${results.bonjour ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log(`SSDP/UPnP:       ${results.ssdp ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log(`Helper Script:   ${results.helper ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log(`HTTP Request:    ${results.http ? '✅ SUCCESS' : '❌ FAILED'}`);
  
  console.log('\n💡 Recommendations:');
  if (!results.direct && !results.http) {
    console.log('• Direct connections are blocked by macOS firewall');
    console.log('• You need to either:');
    console.log('  1. Wait for Apple to approve multicast entitlement');
    console.log('  2. Use helper script workaround');
    console.log('  3. Add app to firewall manually');
  }
  
  if (results.helper) {
    console.log('• Helper script works! Use this as immediate workaround');
  }
  
  if (results.bonjour) {
    console.log('• Bonjour works! This should trigger permission dialog');
  }
  
  if (results.ssdp) {
    console.log('• SSDP works! Camera supports discovery protocol');
  }
}

// Run tests
runAllTests().catch(console.error);