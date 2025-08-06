const puppeteer = require('puppeteer');

const CAMERA_IP = '192.168.50.156';
const USERNAME = 'anava';
const PASSWORD = 'baton';
const LICENSE_KEY = '2Z7YMSDTTF44N5JAX422';

(async () => {
  console.log('Starting Puppeteer to capture ALL network requests during license activation...');
  
  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
    slowMo: 100
  });
  
  const page = await browser.newPage();
  
  // Capture ALL requests
  const requests = [];
  
  await page.setRequestInterception(true);
  
  page.on('request', request => {
    const url = request.url();
    if (!url.includes('.png') && !url.includes('.jpg') && !url.includes('.css') && !url.includes('.woff')) {
      const requestData = {
        timestamp: new Date().toISOString(),
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        postData: request.postData()
      };
      requests.push(requestData);
      
      console.log(`\n[${requestData.timestamp}]`);
      console.log(`${request.method()} ${request.url()}`);
      if (request.postData()) {
        console.log('POST Data:', request.postData());
      }
    }
    request.continue();
  });
  
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('license') || url.includes('BatonAnalytic')) {
      console.log(`\nRESPONSE: ${response.status()} ${url}`);
      try {
        const text = await response.text();
        if (text.includes('<LicenseKey>') || text.includes('<?xml')) {
          console.log('*** XML RESPONSE FOUND! ***');
          console.log(text);
        } else if (text.length < 500) {
          console.log('Response body:', text);
        }
      } catch (e) {
        // Ignore if we can't get the body
      }
    }
  });
  
  // Navigate to camera
  console.log(`\nNavigating to http://${CAMERA_IP}`);
  await page.goto(`http://${CAMERA_IP}`, { waitUntil: 'networkidle2' });
  
  // Handle basic auth
  await page.authenticate({
    username: USERNAME,
    password: PASSWORD
  });
  
  // Wait for page to load
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('\n=== READY ===');
  console.log('Please navigate to the license activation page and enter the key.');
  console.log('I will capture ALL requests to see how the XML is generated.');
  console.log('\nLicense key to use:', LICENSE_KEY);
  
  // Keep browser open
  await new Promise(resolve => setTimeout(resolve, 10 * 60 * 1000));
  
  // Save all requests
  console.log('\n\n=== ALL LICENSE-RELATED REQUESTS ===');
  requests
    .filter(r => r.url.includes('license') || r.url.includes('BatonAnalytic'))
    .forEach(r => {
      console.log(`\n${r.timestamp}: ${r.method} ${r.url}`);
      if (r.postData) console.log('Data:', r.postData);
    });
})();