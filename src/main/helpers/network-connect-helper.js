#!/usr/bin/env node

/**
 * Network Connection Helper
 * This helper script runs as a separate process to bypass Electron app-bundle restrictions
 * on macOS 15 Sequoia. It inherits a more permissive environment similar to Terminal.
 */

const net = require('net');
const https = require('https');
const http = require('http');

// Parse command line arguments
const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error(JSON.stringify({ 
    status: 'error', 
    message: 'Usage: node network-connect-helper.js <command> <...args>' 
  }));
  process.exit(1);
}

/**
 * Test TCP connection to a host
 */
async function testTcpConnection(host, port) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    const timeout = setTimeout(() => {
      client.destroy();
      resolve({ 
        status: 'error', 
        message: 'Connection timed out', 
        code: 'ETIMEDOUT',
        host,
        port 
      });
    }, 5000);

    client.connect(parseInt(port), host, () => {
      clearTimeout(timeout);
      client.end();
      resolve({ 
        status: 'connected', 
        host, 
        port,
        message: 'Successfully connected' 
      });
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      resolve({ 
        status: 'error', 
        message: err.message, 
        code: err.code,
        host,
        port 
      });
    });
  });
}

/**
 * Make HTTP request to a URL
 */
async function makeHttpRequest(url, method = 'GET', headers = {}, data = null) {
  return new Promise((resolve) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const lib = isHttps ? https : http;
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: {
        'User-Agent': 'Anava-Vision-Helper/1.0',
        ...headers
      },
      rejectUnauthorized: false, // Allow self-signed certificates
      timeout: 10000
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          status: 'success',
          statusCode: res.statusCode,
          headers: res.headers,
          data: data.substring(0, 1000) // Limit response size
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        status: 'error',
        message: err.message,
        code: err.code
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        status: 'error',
        message: 'Request timed out',
        code: 'ETIMEDOUT'
      });
    });

    if (data) {
      req.write(data);
    }
    req.end();
  });
}

/**
 * Discover cameras using SSDP
 */
async function discoverCameras() {
  return new Promise((resolve) => {
    try {
      const dgram = require('dgram');
      const socket = dgram.createSocket('udp4');
      const cameras = [];
      
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
        if (message.includes('200 OK')) {
          cameras.push({
            ip: rinfo.address,
            port: rinfo.port,
            message: message.substring(0, 500)
          });
        }
      });

      socket.on('error', (err) => {
        socket.close();
        resolve({
          status: 'error',
          message: err.message,
          code: err.code
        });
      });

      socket.bind(() => {
        socket.setBroadcast(true);
        socket.setMulticastTTL(128);
        
        socket.send(searchMessage, 0, searchMessage.length, SSDP_PORT, SSDP_ADDRESS);
        
        setTimeout(() => {
          socket.close();
          resolve({
            status: 'success',
            cameras
          });
        }, 3000);
      });
    } catch (err) {
      resolve({
        status: 'error',
        message: err.message,
        code: 'UNKNOWN'
      });
    }
  });
}

// Main execution
(async () => {
  try {
    let result;
    
    switch (command) {
      case 'test-tcp':
        const [host, port] = args;
        if (!host || !port) {
          throw new Error('test-tcp requires host and port arguments');
        }
        result = await testTcpConnection(host, port);
        break;
        
      case 'http-request':
        const [url, method = 'GET'] = args;
        if (!url) {
          throw new Error('http-request requires url argument');
        }
        result = await makeHttpRequest(url, method);
        break;
        
      case 'discover-cameras':
        result = await discoverCameras();
        break;
        
      default:
        throw new Error(`Unknown command: ${command}`);
    }
    
    console.log(JSON.stringify(result));
    process.exit(0);
  } catch (error) {
    console.error(JSON.stringify({
      status: 'error',
      message: error.message,
      command
    }));
    process.exit(1);
  }
})();