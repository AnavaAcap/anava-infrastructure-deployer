/**
 * Axis Object Analytics (AOA) Discovery Tool
 * Discovers VAPIX endpoints and payloads for AOA control
 */

import puppeteer from 'puppeteer';
import { logger } from '../../utils/logger';

export interface AOAEndpoint {
  method: string;
  url: string;
  payload?: any;
  headers?: Record<string, string>;
  description: string;
}

export class AOADiscovery {
  private cameraIp: string;
  private username: string;
  private password: string;
  private baseUrl: string;
  private discoveredEndpoints: AOAEndpoint[] = [];

  constructor(cameraIp: string, username: string, password: string) {
    this.cameraIp = cameraIp;
    this.username = username;
    this.password = password;
    this.baseUrl = `http://${cameraIp}`;
  }

  /**
   * Discover AOA endpoints by monitoring network traffic
   */
  async discoverEndpoints(): Promise<AOAEndpoint[]> {
    const browser = await puppeteer.launch({
      headless: false, // Set to true in production
      devtools: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      
      // Enable request interception
      await page.setRequestInterception(true);
      
      // Monitor all network requests
      const capturedRequests: any[] = [];
      
      page.on('request', async (request) => {
        const url = request.url();
        
        // Capture AOA-related requests
        if (url.includes('/local/objectanalytics') || 
            url.includes('/axis-cgi/applications') ||
            url.includes('scenario') ||
            url.includes('analytics')) {
          
          const requestData = {
            method: request.method(),
            url: url,
            headers: request.headers(),
            postData: request.postData()
          };
          
          capturedRequests.push(requestData);
          
          logger.info('[AOA Discovery] Captured request:', {
            method: requestData.method,
            url: requestData.url,
            hasPayload: !!requestData.postData
          });
        }
        
        request.continue();
      });

      page.on('response', async (response) => {
        const url = response.url();
        
        // Log responses for AOA endpoints
        if (url.includes('/local/objectanalytics') || 
            url.includes('scenario')) {
          try {
            const responseData = await response.text();
            logger.info('[AOA Discovery] Response:', {
              url: url,
              status: response.status(),
              dataLength: responseData.length
            });
          } catch (e) {
            // Ignore errors reading response
          }
        }
      });

      // Authenticate with digest auth
      await page.authenticate({
        username: this.username,
        password: this.password
      });

      // Navigate to AOA interface
      const aoaUrl = `${this.baseUrl}/local/objectanalytics/index.html#/`;
      logger.info('[AOA Discovery] Navigating to:', aoaUrl);
      
      await page.goto(aoaUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Wait for the interface to load
      await page.waitForTimeout(5000);

      // Try to interact with the interface to trigger API calls
      logger.info('[AOA Discovery] Attempting to create a scenario...');
      
      // Look for buttons or links to create scenarios
      const createScenarioButton = await page.$$('[data-test*="create"], [aria-label*="create"], button:has-text("Create"), button:has-text("New"), button:has-text("Add")');
      
      if (createScenarioButton.length > 0) {
        logger.info('[AOA Discovery] Found create button, clicking...');
        await createScenarioButton[0].click();
        await page.waitForTimeout(3000);
      }

      // Try to find scenario configuration options
      const scenarioOptions = await page.evaluate(() => {
        // Look for form elements related to scenarios
        const forms = document.querySelectorAll('form');
        const inputs = document.querySelectorAll('input, select, textarea');
        const buttons = document.querySelectorAll('button');
        
        return {
          formCount: forms.length,
          inputCount: inputs.length,
          buttonCount: buttons.length,
          inputLabels: Array.from(inputs).map(i => {
            const label = (i as HTMLInputElement).getAttribute('aria-label') || 
                         (i as HTMLInputElement).getAttribute('placeholder') ||
                         (i as HTMLInputElement).name;
            return label;
          }).filter(Boolean)
        };
      });

      logger.info('[AOA Discovery] Found UI elements:', scenarioOptions);

      // Try to enable "Humans" as trigger
      const humanCheckbox = await page.$$('input[type="checkbox"][value*="human"], input[type="checkbox"][name*="human"], label:has-text("Human"), label:has-text("Person")');
      
      if (humanCheckbox.length > 0) {
        logger.info('[AOA Discovery] Found human checkbox, clicking...');
        await humanCheckbox[0].click();
        await page.waitForTimeout(2000);
      }

      // Try to set "Time in Area"
      const timeInput = await page.$$('input[type="number"][name*="time"], input[placeholder*="time"], input[aria-label*="time"]');
      
      if (timeInput.length > 0) {
        logger.info('[AOA Discovery] Found time input, setting to 3...');
        await timeInput[0].type('3');
        await page.waitForTimeout(2000);
      }

      // Try to save the scenario
      const saveButton = await page.$$('button:has-text("Save"), button:has-text("Apply"), button:has-text("OK"), button[type="submit"]');
      
      if (saveButton.length > 0) {
        logger.info('[AOA Discovery] Found save button, clicking...');
        await saveButton[0].click();
        await page.waitForTimeout(3000);
      }

      // Process captured requests
      this.processCaptures(capturedRequests);

      // Take a screenshot for debugging
      await page.screenshot({ 
        path: '/Users/ryanwager/anava-infrastructure-deployer/aoa-discovery.png',
        fullPage: true 
      });

      logger.info('[AOA Discovery] Screenshot saved to aoa-discovery.png');

      return this.discoveredEndpoints;

    } catch (error) {
      logger.error('[AOA Discovery] Error:', error);
      throw error;
    } finally {
      await browser.close();
    }
  }

  /**
   * Process captured network requests to identify endpoints
   */
  private processCaptures(requests: any[]): void {
    const uniqueEndpoints = new Map<string, AOAEndpoint>();

    for (const req of requests) {
      const key = `${req.method}:${req.url}`;
      
      if (!uniqueEndpoints.has(key)) {
        const endpoint: AOAEndpoint = {
          method: req.method,
          url: req.url,
          headers: req.headers,
          description: this.describeEndpoint(req.url, req.method)
        };

        if (req.postData) {
          try {
            endpoint.payload = JSON.parse(req.postData);
          } catch {
            endpoint.payload = req.postData;
          }
        }

        uniqueEndpoints.set(key, endpoint);
        this.discoveredEndpoints.push(endpoint);
      }
    }

    logger.info('[AOA Discovery] Discovered endpoints:', this.discoveredEndpoints);
  }

  /**
   * Generate description for endpoint based on URL pattern
   */
  private describeEndpoint(url: string, method: string): string {
    if (url.includes('getScenarios')) {
      return 'Get all configured scenarios';
    } else if (url.includes('setScenario')) {
      return 'Create or update a scenario';
    } else if (url.includes('deleteScenario')) {
      return 'Delete a scenario';
    } else if (url.includes('getStatus')) {
      return 'Get AOA application status';
    } else if (url.includes('getCapabilities')) {
      return 'Get AOA capabilities and supported features';
    } else if (url.includes('control.cgi') && url.includes('start')) {
      return 'Start AOA application';
    } else if (url.includes('control.cgi') && url.includes('stop')) {
      return 'Stop AOA application';
    } else if (url.includes('list.cgi')) {
      return 'List installed applications';
    } else {
      return `${method} request to AOA endpoint`;
    }
  }

  /**
   * Export discovered endpoints to a file
   */
  async exportEndpoints(filepath: string): Promise<void> {
    const fs = require('fs').promises;
    const content = JSON.stringify(this.discoveredEndpoints, null, 2);
    await fs.writeFile(filepath, content);
    logger.info(`[AOA Discovery] Endpoints exported to ${filepath}`);
  }
}

// Test script
async function testDiscovery() {
  const discovery = new AOADiscovery('192.168.50.156', 'anava', 'baton');
  
  try {
    const endpoints = await discovery.discoverEndpoints();
    await discovery.exportEndpoints('/Users/ryanwager/anava-infrastructure-deployer/aoa-endpoints.json');
    
    console.log('\n=== Discovered AOA Endpoints ===');
    endpoints.forEach(ep => {
      console.log(`\n${ep.method} ${ep.url}`);
      console.log(`Description: ${ep.description}`);
      if (ep.payload) {
        console.log('Payload:', JSON.stringify(ep.payload, null, 2));
      }
    });
  } catch (error) {
    console.error('Discovery failed:', error);
  }
}

// Run if executed directly
if (require.main === module) {
  testDiscovery();
}