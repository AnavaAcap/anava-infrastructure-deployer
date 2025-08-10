#!/usr/bin/env node

const axios = require('axios');
const https = require('https');
const puppeteer = require('puppeteer');

async function getLicenseXMLFromAxis(deviceId, licenseKey) {
  console.log('[Test] Getting license XML from Axis using Puppeteer...');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Load the Axis SDK page
    await page.goto('https://www.axis.com/app/acap/sdk.js', { 
      waitUntil: 'networkidle2' 
    });
    
    // Execute the license activation in the browser context
    const result = await page.evaluate(async (deviceId, licenseKey) => {
      // The SDK should be loaded
      if (typeof window.activateLicense === 'function') {
        const response = await window.activateLicense(deviceId, licenseKey);
        return {
          success: true,
          licenseData: response
        };
      }
      
      // Fallback: construct the URL manually
      const url = `https://slm.axis.com/serials/licenses/validate?serial=${deviceId}&key=${licenseKey}`;
      
      try {
        const response = await fetch(url);
        const text = await response.text();
        return {
          success: true,
          licenseData: text
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }, deviceId, licenseKey);
    
    await browser.close();
    
    if (result.success) {
      return result.licenseData;
    } else {
      throw new Error(`Failed to get license: ${result.error}`);
    }
    
  } catch (error) {
    await browser.close();
    throw error;
  }
}

async function testLicenseActivation() {
  const ip = '192.168.50.156';
  const username = 'anava';
  const password = 'baton';
  const licenseKey = '3GN5UCXY6VECG6ZYRW2A';
  const applicationName = 'BatonAnalytic';
  
  console.log('========== LICENSE ACTIVATION TEST ==========');
  console.log('Camera IP:', ip);
  console.log('Application:', applicationName);
  console.log('License Key:', licenseKey);
  console.log('');
  
  const auth = Buffer.from(`${username}:${password}`).toString('base64');
  
  try {
    // Step 1: Get device ID from camera
    console.log('[Step 1] Getting device ID from camera...');
    const listResponse = await axios.get(`https://${ip}/axis-cgi/applications/list.cgi`, {
      headers: {
        'Authorization': `Basic ${auth}`
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    });
    
    const deviceIdMatch = listResponse.data.match(/AXIS_([A-F0-9]{12})/i);
    const deviceId = deviceIdMatch ? deviceIdMatch[1] : 'B8A44F45D624';
    console.log('✓ Device ID:', deviceId);
    
    // Check current license status
    const currentLicenseMatch = listResponse.data.match(new RegExp(`<application[^>]*Name="${applicationName}"[^>]*License="([^"]*)"`, 'i'));
    console.log('✓ Current license status:', currentLicenseMatch ? currentLicenseMatch[1] : 'Not found');
    console.log('');
    
    // Step 2: Get license XML from Axis
    console.log('[Step 2] Getting license XML from Axis server...');
    const licenseXML = await getLicenseXMLFromAxis(deviceId, licenseKey);
    console.log('✓ Got license XML, length:', licenseXML.length);
    console.log('');
    
    // Step 3: Upload license to camera
    console.log('[Step 3] Uploading license to camera...');
    const uploadUrl = `/axis-cgi/applications/license.cgi?action=uploadlicensekey&package=${applicationName}`;
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    
    const formData = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="fileData"; filename="license.xml"',
      'Content-Type: text/xml',
      '',
      licenseXML,
      `--${boundary}--`,
      ''
    ].join('\r\n');
    
    const uploadResponse = await axios.post(`https://${ip}${uploadUrl}`, formData, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(formData).toString()
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      }),
      timeout: 15000
    });
    
    console.log('✓ Upload response status:', uploadResponse.status);
    console.log('✓ Upload response data:', uploadResponse.data);
    console.log('');
    
    // Step 4: Verify license activation
    console.log('[Step 4] Verifying license activation...');
    const verifyResponse = await axios.get(`https://${ip}/axis-cgi/applications/list.cgi`, {
      headers: {
        'Authorization': `Basic ${auth}`
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    });
    
    const newLicenseMatch = verifyResponse.data.match(new RegExp(`<application[^>]*Name="${applicationName}"[^>]*License="([^"]*)"`, 'i'));
    const newStatus = newLicenseMatch ? newLicenseMatch[1] : 'Not found';
    console.log('✓ New license status:', newStatus);
    
    if (newStatus === 'Valid') {
      console.log('');
      console.log('✅ LICENSE ACTIVATION SUCCESSFUL!');
    } else {
      console.log('');
      console.log('⚠️ License uploaded but status is:', newStatus);
    }
    
  } catch (error) {
    console.error('');
    console.error('❌ LICENSE ACTIVATION FAILED');
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
  
  console.log('');
  console.log('========== END TEST ==========');
}

// Run the test
testLicenseActivation().catch(console.error);