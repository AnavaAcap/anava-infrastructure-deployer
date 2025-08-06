const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const axios = require('axios');
const crypto = require('crypto');

const ip = '192.168.50.156';
const username = 'anava';
const password = 'baton';
const licenseKey = '2Z7YMSDTTF44N5JAX422';

async function testGenerateXML() {
  console.log('Testing if Axis generates the XML from plain key...\n');
  
  // The web UI might be calling an endpoint to get the XML format
  // Let's try different combinations
  
  const baseUrls = [
    `/axis-cgi/applications/license.cgi`,
    `/axis-cgi/license.cgi`,
    `/axis-cgi/applications/control.cgi`
  ];
  
  const params = [
    `?action=generate&key=${licenseKey}&package=BatonAnalytic`,
    `?action=prepare&key=${licenseKey}&package=BatonAnalytic`,
    `?action=getxml&key=${licenseKey}&package=BatonAnalytic`,
    `?key=${licenseKey}&package=BatonAnalytic`,
    `?licensekey=${licenseKey}&package=BatonAnalytic`,
    `?action=uploadlicensekey&key=${licenseKey}&package=BatonAnalytic`,
    // Maybe it needs app ID
    `?action=generate&key=${licenseKey}&ApplicationID=415129`,
    `?key=${licenseKey}&ApplicationID=415129`,
  ];
  
  for (const baseUrl of baseUrls) {
    for (const param of params) {
      const url = `http://${ip}${baseUrl}${param}`;
      console.log(`\nTrying: ${baseUrl}${param}`);
      
      // Try GET with digest auth
      const command = `curl -s --digest -u "${username}:${password}" "${url}"`;
      
      try {
        const { stdout, stderr } = await execPromise(command);
        
        // Check if response contains XML
        if (stdout.includes('<LicenseKey>') || stdout.includes('<?xml')) {
          console.log('*** FOUND XML RESPONSE! ***');
          console.log(stdout);
          return;
        } else if (stdout.length > 100) {
          console.log('Response (truncated):', stdout.substring(0, 100) + '...');
        } else {
          console.log('Response:', stdout);
        }
      } catch (err) {
        console.log('Error:', err.code || err.message);
      }
    }
  }
  
  // Also try the exact URL from Puppeteer but as GET
  console.log('\n\n=== Trying exact Puppeteer URL as GET ===');
  const puppeteerUrl = `http://${ip}/axis-cgi/applications/license.cgi?action=uploadlicensekey&package=BatonAnalytic`;
  
  const getCommand = `curl -v --digest -u "${username}:${password}" "${puppeteerUrl}"`;
  
  try {
    const { stdout, stderr } = await execPromise(getCommand);
    console.log('Response:', stdout);
    console.log('Headers:', stderr);
  } catch (err) {
    console.log('Error:', err.stdout || err.message);
  }
}

testGenerateXML();