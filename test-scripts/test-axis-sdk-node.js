const puppeteer = require('puppeteer');

async function getLicenseXMLFromAxisSDK(applicationId, deviceId, licenseCode) {
  console.log('Using Axis SDK to convert license key to XML...');
  console.log('Application ID:', applicationId);
  console.log('Device ID:', deviceId);
  console.log('License Code:', licenseCode);
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => {
      console.log('Browser console:', msg.text());
    });
    
    // Set up the HTML with the SDK
    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body>
        <script src="https://www.axis.com/app/acap/sdk.js"></script>
        <script>
          function convertLicense() {
            return new Promise((resolve, reject) => {
              window.ACAP.registerLicenseKey(
                { 
                  applicationId: '${applicationId}',
                  deviceId: '${deviceId}',
                  licenseCode: '${licenseCode}'
                },
                result => {
                  if (result.data) {
                    resolve(result.data);
                  } else {
                    reject(result.error);
                  }
                }
              );
            });
          }
          
          window.acapAsyncInit = async function() {
            try {
              window.__result = await convertLicense();
              window.__ready = true;
            } catch (error) {
              window.__error = error;
              window.__ready = true;
            }
          };
          
          if (window.ACAP && typeof window.ACAP.registerLicenseKey === 'function') {
            window.acapAsyncInit();
          }
        </script>
      </body>
      </html>
    `;
    
    await page.setContent(html);
    
    // Wait for the SDK to complete
    await page.waitForFunction(() => window.__ready === true, { timeout: 30000 });
    
    // Get the result
    const result = await page.evaluate(() => {
      if (window.__error) {
        throw window.__error;
      }
      return window.__result;
    });
    
    console.log('\nSDK Response:', JSON.stringify(result, null, 2));
    
    if (result && result.licenseKey && result.licenseKey.xml) {
      console.log('\nExtracted XML:');
      console.log(result.licenseKey.xml);
      return result.licenseKey.xml;
    }
    
    throw new Error('No XML in response');
    
  } finally {
    await browser.close();
  }
}

// Test with your license
async function test() {
  try {
    const xml = await getLicenseXMLFromAxisSDK(
      '415129',              // BatonAnalytic app ID
      'B8A44F45D624',       // Your camera's device ID
      '2Z7YMSDTTF44N5JAX422' // Your license code
    );
    
    console.log('\n✅ Success! Got license XML');
    
    // Now test uploading it
    console.log('\nTesting upload to camera...');
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    const fs = require('fs').promises;
    
    // Save XML to temp file
    const tempFile = '/tmp/license-from-sdk.xml';
    await fs.writeFile(tempFile, xml);
    
    const command = `curl -v --digest -u "anava:baton" \
      -F "fileData=@${tempFile};type=text/xml" \
      "http://192.168.50.156/axis-cgi/applications/license.cgi?action=uploadlicensekey&package=BatonAnalytic"`;
    
    const { stdout, stderr } = await execPromise(command);
    console.log('\nUpload response:', stdout);
    
    // Clean up
    await fs.unlink(tempFile);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

test();