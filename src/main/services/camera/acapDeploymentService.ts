import { ipcMain } from 'electron';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import https from 'https';
import { Camera } from './cameraDiscoveryService';

export interface DeploymentResult {
  success: boolean;
  cameraId: string;
  ip: string;
  message: string;
  error?: string;
}

export class ACAPDeploymentService {
  private static instance: ACAPDeploymentService | null = null;
  
  constructor() {
    // Prevent multiple instances
    if (ACAPDeploymentService.instance) {
      return ACAPDeploymentService.instance;
    }
    ACAPDeploymentService.instance = this;
    this.setupIPC();
  }

  private setupIPC() {
    ipcMain.handle('deploy-acap', async (_event, camera: Camera, acapPath: string) => {
      return this.deployACAP(camera, acapPath);
    });
    
    ipcMain.handle('uninstall-acap', async (_event, camera: Camera, appName: string) => {
      return this.uninstallACAP(camera, appName);
    });
    
    ipcMain.handle('list-installed-acaps', async (_event, camera: Camera) => {
      return this.listInstalledACAPs(camera);
    });
  }

  async deployACAP(camera: Camera, acapPath: string): Promise<DeploymentResult> {
    try {
      console.log(`[ACAPDeployment] ========== STARTING DEPLOYMENT ==========`);
      console.log(`[ACAPDeployment] Target camera: ${camera.ip}`);
      console.log(`[ACAPDeployment] ACAP file: ${acapPath}`);

      if (!fs.existsSync(acapPath)) {
        throw new Error(`ACAP file not found: ${acapPath}`);
      }

      const fileSize = fs.statSync(acapPath).size;
      const fileName = path.basename(acapPath);
      console.log(`[ACAPDeployment] File name: ${fileName}`);
      console.log(`[ACAPDeployment] File size: ${fileSize} bytes (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

      // First, check if we can connect to the camera
      const credentials = camera.credentials;
      if (!credentials || !credentials.username || !credentials.password) {
        throw new Error('Camera credentials are required for deployment');
      }
      console.log(`[ACAPDeployment] Testing connection with user: ${credentials.username}`);
      const testResult = await this.testConnection(camera.ip, credentials.username, credentials.password);
      
      if (!testResult) {
        throw new Error('Cannot connect to camera - check credentials');
      }
      console.log(`[ACAPDeployment] Connection test successful`);

      // Upload the ACAP (always upload, no checking)
      console.log(`[ACAPDeployment] Starting ACAP upload...`);
      const uploadResult = await this.uploadACAP(
        camera.ip,
        credentials.username,
        credentials.password,
        acapPath
      );

      if (uploadResult.success) {
        console.log(`[ACAPDeployment] ========== DEPLOYMENT SUCCESSFUL ==========`);
        return {
          success: true,
          cameraId: camera.id,
          ip: camera.ip,
          message: 'ACAP deployed successfully'
        };
      } else {
        throw new Error(uploadResult.error || 'Upload failed');
      }

    } catch (error: any) {
      console.error(`[ACAPDeployment] ========== DEPLOYMENT FAILED ==========`);
      console.error(`[ACAPDeployment] Error deploying to ${camera.ip}:`, error);
      return {
        success: false,
        cameraId: camera.id,
        ip: camera.ip,
        message: 'Deployment failed',
        error: error.message
      };
    }
  }

  async uninstallACAP(camera: Camera, appName: string): Promise<DeploymentResult> {
    try {
      const credentials = camera.credentials;
      if (!credentials || !credentials.username || !credentials.password) {
        throw new Error('Camera credentials are required for deployment');
      }
      
      const response = await this.digestAuth(
        camera.ip,
        credentials.username,
        credentials.password,
        'POST',
        '/axis-cgi/applications/control.cgi',
        `action=remove&package=${appName}`
      );

      if (response && response.status === 200) {
        return {
          success: true,
          cameraId: camera.id,
          ip: camera.ip,
          message: `ACAP ${appName} uninstalled successfully`
        };
      } else {
        throw new Error('Uninstall failed');
      }

    } catch (error: any) {
      return {
        success: false,
        cameraId: camera.id,
        ip: camera.ip,
        message: 'Uninstall failed',
        error: error.message
      };
    }
  }

  async listInstalledACAPs(camera: Camera): Promise<any[]> {
    try {
      const credentials = camera.credentials;
      if (!credentials || !credentials.username || !credentials.password) {
        throw new Error('Camera credentials are required for deployment');
      }
      
      console.log(`[listInstalledACAPs] Querying installed ACAPs on ${camera.ip}`);
      const response = await this.digestAuth(
        camera.ip,
        credentials.username,
        credentials.password,
        'GET',
        '/axis-cgi/applications/list.cgi'
      );

      if (response && response.data) {
        const apps: any[] = [];
        const data = String(response.data);
        console.log(`[listInstalledACAPs] Raw response:\n${data}`);
        
        // Check if response is XML format
        if (data.includes('<reply') && data.includes('<application')) {
          // Parse XML response
          const applicationMatches = data.matchAll(/<application\s+([^>]+)>/g);
          let appIndex = 0;
          
          for (const match of applicationMatches) {
            const attributes = match[1];
            const app: any = { id: `app${++appIndex}` };
            
            // Extract attributes
            const attrMatches = attributes.matchAll(/(\w+)="([^"]*)"/g);
            for (const [, key, value] of attrMatches) {
              app[key.toLowerCase()] = value;
            }
            
            if (app.name) {
              app.packagename = app.name; // for compatibility
              apps.push(app);
            }
          }
        } else {
          // Original text format parsing (for older cameras)
          const appMap = new Map<string, any>();
          const lines = data.split('\n');
          
          for (const line of lines) {
            const match = line.match(/^(\w+)\.(\w+)="?([^"\n]+)"?/);
            if (match) {
              const [, appId, property, value] = match;
              if (!appMap.has(appId)) {
                appMap.set(appId, {});
              }
              const app = appMap.get(appId);
              app[property.toLowerCase()] = value;
            }
          }
          
          // Convert map to array
          for (const [appId, app] of appMap) {
            if (app.name) {
              apps.push({
                id: appId,
                name: app.name,
                nicename: app.nicename,
                vendor: app.vendor,
                version: app.version,
                status: app.status,
                applicationid: app.applicationid,
                packagename: app.name // for compatibility
              });
            }
          }
        }
        
        console.log(`[listInstalledACAPs] Found ${apps.length} installed ACAPs`);
        apps.forEach(app => {
          console.log(`[listInstalledACAPs] - ${app.name} v${app.version} (${app.status})`);
        });
        
        return apps;
      }
      
      return [];
    } catch (error) {
      console.error('[listInstalledACAPs] Error:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        cameraIp: camera.ip
      });
      throw new Error(`Failed to list installed ACAPs on camera ${camera.ip}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async testConnection(ip: string, username: string, password: string): Promise<boolean> {
    try {
      const response = await this.digestAuth(
        ip,
        username,
        password,
        'GET',
        '/axis-cgi/param.cgi?action=list&group=Brand'
      );

      return response && response.status === 200;
    } catch (error) {
      return false;
    }
  }

  private async uploadACAP(ip: string, username: string, password: string, acapPath: string): Promise<any> {
    try {
      console.log('[uploadACAP] ===== VAPIX ACAP Upload Process =====');
      
      const fileName = path.basename(acapPath);
      const fileStats = fs.statSync(acapPath);
      
      console.log('[uploadACAP] File path:', acapPath);
      console.log('[uploadACAP] File size:', fileStats.size);
      console.log('[uploadACAP] File name:', fileName);
      
      // Create a function to generate fresh form data
      const createForm = () => {
        const form = new FormData();
        const fileStream = fs.createReadStream(acapPath);
        
        form.append('packfil', fileStream, {
          filename: fileName,
          contentType: 'application/octet-stream',
          knownLength: fileStats.size
        });
        
        return form;
      };

      const response = await this.digestAuthWithFormFactory(
        ip,
        username,
        password,
        'POST',
        '/axis-cgi/applications/upload.cgi',
        createForm,
        {
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 300000 // 5 minutes timeout for large ACAP files
        }
      );

      console.log('[uploadACAP] Response status:', response?.status);
      console.log('[uploadACAP] Response headers:', response?.headers);
      
      if (response && response.status === 200) {
        const responseData = String(response.data);
        console.log('[uploadACAP] Response body:', responseData);
        
        // Check for VAPIX error messages in response
        if (responseData.includes('Error') || responseData.includes('Failed')) {
          console.log('[uploadACAP] VAPIX returned error in response body');
          return { success: false, error: `VAPIX error: ${responseData}` };
        }
        
        // Some cameras return a simple "OK" or the package name on success
        console.log('[uploadACAP] Upload completed successfully');
        
        // After upload, the ACAP should be automatically installed
        // Wait a moment for installation to complete
        console.log('[uploadACAP] Waiting for ACAP installation to complete...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        return { success: true };
      } else {
        const errorBody = response?.data ? String(response.data) : 'No response body';
        console.log('[uploadACAP] Upload failed with status:', response?.status);
        console.log('[uploadACAP] Error response:', errorBody);
        return { success: false, error: `Upload failed with status ${response?.status}: ${errorBody}` };
      }

    } catch (error: any) {
      console.error('[uploadACAP] Exception during upload:', error);
      console.error('[uploadACAP] Error details:', error.message);
      if (error.response) {
        console.error('[uploadACAP] Error response status:', error.response.status);
        console.error('[uploadACAP] Error response data:', error.response.data);
      }
      return { success: false, error: error.message };
    }
  }

  private async digestAuthWithFormFactory(
    ip: string,
    username: string,
    password: string,
    method: string,
    uri: string,
    formFactory: () => FormData,
    options: any = {}
  ): Promise<any> {
    try {
      const url = `http://${ip}${uri}`;
      const httpsAgent = new https.Agent({ rejectUnauthorized: false });
      
      // First request to get the digest challenge
      const form1 = formFactory();
      const config1: any = {
        method,
        url,
        httpsAgent,
        timeout: options.timeout || 300000,
        validateStatus: () => true,
        data: form1,
        headers: {
          ...form1.getHeaders(),
          ...options.headers
        },
        ...options
      };

      console.log(`[digestAuth] ${method} ${url}`);
      console.log('[digestAuth] Making first request for digest challenge...');
      const response1 = await axios(config1);

      if (response1.status === 401) {
        const wwwAuth = response1.headers['www-authenticate'];
        console.log('[digestAuth] Got 401 challenge:', wwwAuth);
        
        if (wwwAuth && wwwAuth.includes('Digest')) {
          // Parse digest parameters
          const digestData: any = {};
          const regex = /(\w+)=(?:"([^"]+)"|([^,]+))/g;
          let match;
          while ((match = regex.exec(wwwAuth)) !== null) {
            digestData[match[1]] = match[2] || match[3];
          }

          console.log('[digestAuth] Building digest response...');

          // Build digest header
          const nc = '00000001';
          const cnonce = crypto.randomBytes(8).toString('hex');
          const ha1 = crypto.createHash('md5')
            .update(`${username}:${digestData.realm}:${password}`)
            .digest('hex');
          const ha2 = crypto.createHash('md5')
            .update(`${method}:${uri}`)
            .digest('hex');
          const response = crypto.createHash('md5')
            .update(`${ha1}:${digestData.nonce}:${nc}:${cnonce}:${digestData.qop}:${ha2}`)
            .digest('hex');
          
          let authHeader = `Digest username="${username}", realm="${digestData.realm}", nonce="${digestData.nonce}", uri="${uri}", qop="${digestData.qop}", nc=${nc}, cnonce="${cnonce}", response="${response}"`;
          
          if (digestData.algorithm) {
            authHeader += `, algorithm=${digestData.algorithm}`;
          }
          
          console.log('[digestAuth] Making authenticated request with fresh form...');
          
          // Create fresh form for second request
          const form2 = formFactory();
          const config2 = {
            ...config1,
            data: form2,
            headers: {
              ...form2.getHeaders(),
              'Authorization': authHeader,
              ...options.headers
            }
          };

          const response2 = await axios(config2);
          console.log('[digestAuth] Authenticated response status:', response2.status);
          return response2;
        }
      } else if (response1.status === 200) {
        console.log('[digestAuth] No authentication required, got 200 OK');
        return response1;
      }
      
      throw new Error(`Unexpected response: ${response1.status}`);
    } catch (error: any) {
      console.error('[digestAuth] Error:', error.message);
      if (error.code) {
        console.error('[digestAuth] Error code:', error.code);
      }
      throw error;
    }
  }

  private async digestAuth(
    ip: string,
    username: string,
    password: string,
    method: string,
    uri: string,
    data?: any,
    options: any = {}
  ): Promise<any> {
    try {
      const url = `http://${ip}${uri}`;
      const httpsAgent = new https.Agent({ rejectUnauthorized: false });
      
      // First request to get the digest challenge
      const config1: any = {
        method,
        url,
        httpsAgent,
        timeout: options.timeout || 300000, // 5 minutes for large file uploads (increased from 2 min)
        validateStatus: () => true,
        ...options
      };

      if (data) {
        config1.data = data;
      }

      console.log(`[digestAuth] ${method} ${url}`);
      console.log('[digestAuth] Making first request for digest challenge...');
      const response1 = await axios(config1);

      if (response1.status === 401) {
        const wwwAuth = response1.headers['www-authenticate'];
        console.log('[digestAuth] Got 401 challenge:', wwwAuth);
        
        if (wwwAuth && wwwAuth.includes('Digest')) {
          // Parse digest parameters
          const digestData: any = {};
          const regex = /(\w+)=(?:"([^"]+)"|([^,]+))/g;
          let match;
          while ((match = regex.exec(wwwAuth)) !== null) {
            digestData[match[1]] = match[2] || match[3];
          }

          console.log('[digestAuth] Digest realm:', digestData.realm);
          console.log('[digestAuth] Digest qop:', digestData.qop);

          // Build digest header
          const nc = '00000001';
          const cnonce = crypto.randomBytes(8).toString('hex');
          const ha1 = crypto.createHash('md5')
            .update(`${username}:${digestData.realm}:${password}`)
            .digest('hex');
          const ha2 = crypto.createHash('md5')
            .update(`${method}:${uri}`)
            .digest('hex');
          const response = crypto.createHash('md5')
            .update(`${ha1}:${digestData.nonce}:${nc}:${cnonce}:${digestData.qop}:${ha2}`)
            .digest('hex');
          
          // Include algorithm if specified
          let authHeader = `Digest username="${username}", realm="${digestData.realm}", nonce="${digestData.nonce}", uri="${uri}", qop="${digestData.qop}", nc=${nc}, cnonce="${cnonce}", response="${response}"`;
          
          if (digestData.algorithm) {
            authHeader += `, algorithm=${digestData.algorithm}`;
          }
          
          console.log('[digestAuth] Sending authenticated request...');
          
          // Second request with auth
          const config2 = {
            ...config1,
            headers: {
              ...config1.headers,
              'Authorization': authHeader
            }
          };

          try {
            console.log('[digestAuth] Request config:', {
              method: config2.method,
              url: config2.url,
              timeout: config2.timeout,
              hasData: !!config2.data,
              dataType: config2.data ? typeof config2.data : 'none'
            });
            
            const response2 = await axios(config2);
            console.log('[digestAuth] Authenticated response status:', response2.status);
            return response2;
          } catch (error: any) {
            console.error('[digestAuth] Authenticated request failed:', error.message);
            if (error.code === 'ECONNRESET') {
              console.error('[digestAuth] Connection reset by camera - this may happen if ACAP is already installed');
            }
            throw error;
          }
        }
      } else if (response1.status === 200) {
        // No auth required
        console.log('[digestAuth] No authentication required, got 200 OK');
        return response1;
      }
      
      throw new Error(`Unexpected response: ${response1.status}`);
    } catch (error: any) {
      console.error('[digestAuth] Error:', error.message);
      if (error.code) {
        console.error('[digestAuth] Error code:', error.code);
      }
      throw error;
    }
  }
}