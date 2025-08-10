#!/usr/bin/env node

const puppeteer = require('puppeteer');
const axios = require('axios');
const https = require('https');

async function testActualLicenseActivation() {
  const ip = '192.168.50.156';
  const username = 'anava';
  const password = 'baton';
  const licenseKey = '3GN5UCXY6VECG6ZYRW2A';
  const applicationName = 'BatonAnalytic';
  
  console.log('========== TESTING ACTUAL LICENSE ACTIVATION ==========');
  console.log('Camera:', ip);
  console.log('License Key:', licenseKey);
  console.log('');
  
  try {
    // Step 1: Get device ID from camera
    console.log('[1] Getting device ID from camera...');
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    
    const listResponse = await axios.get(`https://${ip}/axis-cgi/applications/list.cgi`, {
      headers: { 'Authorization': `Basic ${auth}` },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });
    
    // Extract device ID - this is the MAC address without colons
    const deviceIdMatch = listResponse.data.match(/AXIS_([A-F0-9]{12})/i) || 
                          listResponse.data.match(/serialNumber="([A-F0-9]{12})"/i);
    const deviceId = deviceIdMatch ? deviceIdMatch[1] : 'B8A44F45D624';
    
    console.log('   Device ID:', deviceId);
    
    // Check current license status
    const licenseMatch = listResponse.data.match(new RegExp(`<application[^>]*Name="${applicationName}"[^>]*License="([^"]*)"`, 'i'));
    console.log('   Current License Status:', licenseMatch ? licenseMatch[1] : 'Not found');
    console.log('');
    
    // Step 2: Get license XML using Axis SDK (like the real code does)
    console.log('[2] Getting license XML from Axis using SDK method...');
    
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set up console logging from the page
    page.on('console', msg => console.log('   Browser:', msg.text()));
    
    // Navigate to Axis SDK
    console.log('   Loading Axis SDK...');
    await page.goto('https://www.axis.com/techsup/cgi-bin/pgm/sdk.js', { 
      waitUntil: 'networkidle2',
      timeout: 30000
    }).catch(async (err) => {
      // Try alternative URL
      console.log('   Trying alternative SDK URL...');
      await page.goto('https://www.axis.com/app/acap/sdk.js', { 
        waitUntil: 'networkidle2' 
      });
    });
    
    console.log('   SDK loaded, activating license...');
    
    // Execute the license activation exactly like the real code
    const licenseResult = await page.evaluate(async (deviceId, licenseKey) => {
      try {
        // Method 1: Direct fetch to Axis license server
        const url = `https://slm.axis.com/serials/licenses/validate?serial=${deviceId}&key=${licenseKey}`;
        console.log('Fetching from:', url);
        
        const response = await fetch(url, {
          method: 'GET',
          mode: 'cors'
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const licenseXML = await response.text();
        
        // Validate it's actual XML
        if (!licenseXML.includes('<?xml') && !licenseXML.includes('<License')) {
          throw new Error('Invalid license response - not XML');
        }
        
        return {
          success: true,
          licenseData: licenseXML,
          length: licenseXML.length
        };
        
      } catch (error) {
        // Method 2: Try using SDK if available
        if (typeof window.sdk !== 'undefined' && typeof window.sdk.activateLicense === 'function') {
          console.log('Using SDK method...');
          const result = await window.sdk.activateLicense(deviceId, licenseKey);
          return {
            success: true,
            licenseData: result,
            length: result.length
          };
        }
        
        return {
          success: false,
          error: error.message
        };
      }
    }, deviceId, licenseKey);
    
    await browser.close();
    
    if (!licenseResult.success) {
      throw new Error(`Failed to get license XML: ${licenseResult.error}`);
    }
    
    console.log('   ✓ Got license XML, length:', licenseResult.length);
    console.log('');
    
    // Step 3: Upload the license to camera using our new bulletproof method
    console.log('[3] Uploading license to camera with HTTPS + Basic Auth...');
    
    const uploadUrl = `/axis-cgi/applications/license.cgi?action=uploadlicensekey&package=${applicationName}`;
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    
    const formData = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="fileData"; filename="license.xml"',
      'Content-Type: text/xml',
      '',
      licenseResult.licenseData,
      `--${boundary}--`,
      ''
    ].join('\r\n');
    
    console.log('   URL:', `https://${ip}${uploadUrl}`);
    console.log('   Using Basic auth for user:', username);
    
    const startTime = Date.now();
    const uploadResponse = await axios.post(`https://${ip}${uploadUrl}`, formData, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(formData).toString()
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      }),
      timeout: 15000,
      validateStatus: null // Handle all status codes
    });
    
    const elapsed = Date.now() - startTime;
    console.log('   Response Time:', elapsed, 'ms');
    console.log('   Response Status:', uploadResponse.status);
    console.log('   Response Data:', uploadResponse.data);
    
    if (uploadResponse.status !== 200) {
      throw new Error(`Upload failed with status ${uploadResponse.status}`);
    }
    
    console.log('');
    
    // Step 4: Verify the license was activated
    console.log('[4] Verifying license activation...');
    
    // Wait a moment for the camera to process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const verifyResponse = await axios.get(`https://${ip}/axis-cgi/applications/list.cgi`, {
      headers: { 'Authorization': `Basic ${auth}` },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });
    
    const newLicenseMatch = verifyResponse.data.match(new RegExp(`<application[^>]*Name="${applicationName}"[^>]*License="([^"]*)"`, 'i'));
    const newStatus = newLicenseMatch ? newLicenseMatch[1] : 'Not found';
    
    // Check for expiration date too
    const expirationMatch = verifyResponse.data.match(new RegExp(`<application[^>]*Name="${applicationName}"[^>]*LicenseExpirationDate="([^"]*)"`, 'i'));
    const expirationDate = expirationMatch ? expirationMatch[1] : 'N/A';
    
    console.log('   New License Status:', newStatus);
    if (newStatus === 'Valid') {
      console.log('   Expiration Date:', expirationDate);
    }
    
    console.log('');
    if (newStatus === 'Valid') {
      console.log('✅ LICENSE ACTIVATION SUCCESSFUL!');
      console.log('   The license key has been successfully applied to the camera.');
      console.log('   The camera is now licensed until:', expirationDate);
    } else {
      console.log('⚠️  License was uploaded but status is:', newStatus);
      console.log('   The camera may need a restart or the license key may be invalid.');
    }
    
  } catch (error) {
    console.error('');
    console.error('❌ LICENSE ACTIVATION FAILED');
    console.error('Error:', error.message);
    
    if (error.response) {
      console.error('HTTP Status:', error.response.status);
      console.error('Response:', error.response.data);
    }
    
    console.error('');
    console.error('Troubleshooting:');
    console.error('1. Check the license key is valid');
    console.error('2. Ensure the camera is accessible at', ip);
    console.error('3. Verify the application "BatonAnalytic" is installed');
    console.error('4. Check network connectivity to axis.com');
  }
  
  console.log('');
  console.log('========== END TEST ==========');
}

// Run the test
testActualLicenseActivation()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });