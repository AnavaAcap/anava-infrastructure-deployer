const puppeteer = require('puppeteer');

const CAMERA_IP = '192.168.50.156';
const USERNAME = 'anava';
const PASSWORD = 'baton';

(async () => {
  console.log('Looking for API key in camera web UI...');
  
  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
  });
  
  const page = await browser.newPage();
  
  // Intercept all requests to find API key
  await page.setRequestInterception(true);
  
  page.on('request', request => {
    const headers = request.headers();
    
    // Check for API key in headers
    if (headers['authorization'] || headers['apikey'] || headers['x-api-key']) {
      console.log('\n*** API Key found! ***');
      console.log('URL:', request.url());
      console.log('Headers:', headers);
    }
    
    // Check if request to Axis API
    if (request.url().includes('gateway.api.axis.com')) {
      console.log('\n*** Axis API Request ***');
      console.log('URL:', request.url());
      console.log('Method:', request.method());
      console.log('Headers:', headers);
      console.log('Post Data:', request.postData());
    }
    
    request.continue();
  });
  
  // Navigate and authenticate
  await page.goto(`http://${CAMERA_IP}`, { waitUntil: 'networkidle2' });
  await page.authenticate({
    username: USERNAME,
    password: PASSWORD
  });
  
  console.log('\nPlease navigate to license activation page and watch for API key...');
  
  // Keep browser open
  await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
})();