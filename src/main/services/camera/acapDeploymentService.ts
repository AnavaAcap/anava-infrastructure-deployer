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
  constructor() {
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
      console.log(`[ACAPDeployment] Deploying to ${camera.ip}`);
      console.log(`[ACAPDeployment] ACAP file: ${acapPath}`);

      if (!fs.existsSync(acapPath)) {
        throw new Error(`ACAP file not found: ${acapPath}`);
      }

      const fileSize = fs.statSync(acapPath).size;
      console.log(`[ACAPDeployment] File size: ${fileSize} bytes`);

      // First, check if we can connect to the camera
      const credentials = camera.credentials || { username: 'root', password: 'pass' };
      const testResult = await this.testConnection(camera.ip, credentials.username, credentials.password);
      
      if (!testResult) {
        throw new Error('Cannot connect to camera - check credentials');
      }

      // Upload the ACAP
      console.log(`[ACAPDeployment] Starting upload...`);
      const uploadResult = await this.uploadACAP(
        camera.ip,
        credentials.username,
        credentials.password,
        acapPath
      );

      if (uploadResult.success) {
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
      const credentials = camera.credentials || { username: 'root', password: 'pass' };
      
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

  async listInstalledACAPs(camera: Camera): Promise<string[]> {
    try {
      const credentials = camera.credentials || { username: 'root', password: 'pass' };
      
      const response = await this.digestAuth(
        camera.ip,
        credentials.username,
        credentials.password,
        'GET',
        '/axis-cgi/applications/list.cgi'
      );

      if (response && response.data) {
        const apps: string[] = [];
        const lines = response.data.split('\n');
        
        for (const line of lines) {
          if (line.includes('Name=')) {
            const match = line.match(/Name="([^"]+)"/);
            if (match) {
              apps.push(match[1]);
            }
          }
        }
        
        return apps;
      }
      
      return [];
    } catch (error) {
      console.error('Error listing ACAPs:', error);
      return [];
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
      console.log('[uploadACAP] Preparing form data...');
      
      const form = new FormData();
      const fileStream = fs.createReadStream(acapPath);
      const fileName = path.basename(acapPath);
      
      form.append('packfil', fileStream, {
        filename: fileName,
        contentType: 'application/octet-stream'
      });

      const headers = form.getHeaders();
      console.log('[uploadACAP] Form headers:', headers);

      const response = await this.digestAuth(
        ip,
        username,
        password,
        'POST',
        '/axis-cgi/applications/upload.cgi',
        form,
        {
          headers: headers,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 60000 // 60 second timeout for large files
        }
      );

      if (response && response.status === 200) {
        console.log('[uploadACAP] Upload successful');
        return { success: true };
      } else {
        console.log('[uploadACAP] Upload failed:', response?.status);
        return { success: false, error: `Upload failed with status ${response?.status}` };
      }

    } catch (error: any) {
      console.error('[uploadACAP] Error:', error);
      return { success: false, error: error.message };
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
        timeout: options.timeout || 30000,
        validateStatus: () => true,
        ...options
      };

      if (data) {
        config1.data = data;
      }

      console.log('[digestAuth] Making first request for challenge...');
      const response1 = await axios(config1);

      if (response1.status === 401) {
        const wwwAuth = response1.headers['www-authenticate'];
        if (wwwAuth && wwwAuth.includes('Digest')) {
          // Parse digest parameters
          const digestData: any = {};
          const regex = /(\w+)=(?:"([^"]+)"|([^,]+))/g;
          let match;
          while ((match = regex.exec(wwwAuth)) !== null) {
            digestData[match[1]] = match[2] || match[3];
          }

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
          
          const authHeader = `Digest username="${username}", realm="${digestData.realm}", nonce="${digestData.nonce}", uri="${uri}", qop=${digestData.qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"`;
          
          // Second request with auth
          const config2 = {
            ...config1,
            headers: {
              ...config1.headers,
              'Authorization': authHeader
            }
          };

          const response2 = await axios(config2);
          return response2;
        }
      } else if (response1.status === 200) {
        // No auth required
        return response1;
      }
      
      throw new Error(`Unexpected response: ${response1.status}`);
    } catch (error: any) {
      console.error('[digestAuth] Error:', error.message);
      throw error;
    }
  }
}