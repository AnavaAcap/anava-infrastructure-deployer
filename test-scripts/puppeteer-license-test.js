const puppeteer = require('puppeteer');

const CAMERA_IP = '192.168.50.156';
const USERNAME = 'anava';
const PASSWORD = 'baton';
const LICENSE_KEY = '2Z7YMSDTTF44N5JAX422';

(async () => {
  console.log('Starting Puppeteer to observe license activation...');
  
  const browser = await puppeteer.launch({
    headless: false, // Show the browser
    devtools: true,  // Open DevTools automatically
    slowMo: 100      // Slow down actions
  });
  
  const page = await browser.newPage();
  
  // Enable request interception to log all network requests
  await page.setRequestInterception(true);
  
  page.on('request', request => {
    if (request.url().includes('axis-cgi')) {
      console.log('\n=== REQUEST ===');
      console.log('URL:', request.url());
      console.log('Method:', request.method());
      console.log('Headers:', request.headers());
      if (request.postData()) {
        console.log('POST Data:', request.postData());
      }
    }
    request.continue();
  });
  
  page.on('response', response => {
    if (response.url().includes('axis-cgi')) {
      console.log('\n=== RESPONSE ===');
      console.log('URL:', response.url());
      console.log('Status:', response.status());
      console.log('Headers:', response.headers());
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
  console.log('1. Navigate to Applications page');
  console.log('2. Find BatonAnalytic application');
  console.log('3. Click on License or Configure');
  console.log('4. Enter license key:', LICENSE_KEY);
  console.log('5. Click Apply/Submit');
  console.log('\nWatch the console for the exact API calls!');
  
  // Keep browser open for 30 minutes
  await new Promise(resolve => setTimeout(resolve, 30 * 60 * 1000));
})();