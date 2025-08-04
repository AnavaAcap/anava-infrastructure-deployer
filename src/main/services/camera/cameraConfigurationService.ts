import { ipcMain } from 'electron';
import axios from 'axios';
import crypto from 'crypto';
import FormData from 'form-data';
import { Camera } from './cameraDiscoveryService';

export interface ConfigurationResult {
  success: boolean;
  cameraId: string;
  message: string;
  error?: string;
}

export class CameraConfigurationService {
  constructor() {
    this.setupIPC();
  }

  private setupIPC() {
    ipcMain.handle('configure-camera', async (_event, camera: Camera, config: any) => {
      return this.configureCamera(camera, config);
    });

    ipcMain.handle('push-camera-settings', async (_event, ip: string, username: string, password: string, configPayload: any) => {
      return this.pushSystemConfig(ip, username, password, configPayload);
    });

    ipcMain.handle('get-camera-settings', async (_event, ip: string, username: string, password: string) => {
      return this.getSystemConfig(ip, username, password);
    });
  }

  async configureCamera(camera: Camera, deploymentConfig: any): Promise<ConfigurationResult> {
    try {
      console.log(`[CameraConfig] Configuring camera ${camera.ip} with deployment settings`);

      // Prepare the configuration payload in the expected format
      const payload = {
        firebase: {
          apiKey: deploymentConfig.firebaseConfig?.apiKey || deploymentConfig.firebaseApiKey || '',
          authDomain: deploymentConfig.firebaseConfig?.authDomain || `${deploymentConfig.projectId}.firebaseapp.com`,
          projectId: deploymentConfig.firebaseConfig?.projectId || deploymentConfig.projectId,
          storageBucket: deploymentConfig.firebaseConfig?.storageBucket || `${deploymentConfig.projectId}.appspot.com`,
          messagingSenderId: deploymentConfig.firebaseConfig?.messagingSenderId || '',
          appId: deploymentConfig.firebaseConfig?.appId || '',
          databaseId: deploymentConfig.firebaseConfig?.databaseId || '(default)'
        },
        gemini: deploymentConfig.aiMode === 'ai-studio' ? {
          apiKey: deploymentConfig.aiStudioApiKey || '',
          vertexApiGatewayUrl: '', // Not used in AI Studio mode
          vertexApiGatewayKey: '', // Not used in AI Studio mode
          vertexGcpProjectId: deploymentConfig.projectId,
          vertexGcpRegion: deploymentConfig.region || 'us-central1',
          vertexGcsBucketName: deploymentConfig.gcsBucketName || `${deploymentConfig.projectId}-anava-analytics`
        } : {
          apiKey: '', // Not used in Vertex AI mode
          vertexApiGatewayUrl: deploymentConfig.apiGatewayUrl,
          vertexApiGatewayKey: deploymentConfig.apiKey,
          vertexGcpProjectId: deploymentConfig.projectId,
          vertexGcpRegion: deploymentConfig.region || 'us-central1',
          vertexGcsBucketName: deploymentConfig.gcsBucketName || `${deploymentConfig.projectId}-anava-analytics`
        },
        anavaKey: deploymentConfig.anavaKey || '',
        customerId: deploymentConfig.customerId || ''
      };

      console.log('[CameraConfig] Configuration payload:', JSON.stringify(payload, null, 2));

      // Send configuration to camera
      const response = await this.sendConfiguration(
        camera.ip,
        camera.credentials?.username || 'root',
        camera.credentials?.password || 'pass',
        payload
      );

      if (response.success) {
        // If we have an Anava license key, activate it
        if (deploymentConfig.anavaKey) {
          console.log('[CameraConfig] Activating Anava license key...');
          try {
            await this.activateLicenseKey(
              camera.ip,
              camera.credentials?.username || 'root',
              camera.credentials?.password || 'pass',
              deploymentConfig.anavaKey,
              'BatonAnalytic' // Application name
            );
            console.log('[CameraConfig] License key activated successfully');
          } catch (licenseError: any) {
            console.error('[CameraConfig] Failed to activate license key:', licenseError);
            // Non-fatal - configuration succeeded, just license activation failed
          }
        }

        return {
          success: true,
          cameraId: camera.id,
          message: 'Camera configured successfully'
        };
      } else {
        throw new Error(response.error || 'Configuration failed');
      }

    } catch (error: any) {
      console.error(`[CameraConfig] Error configuring ${camera.ip}:`, error);
      return {
        success: false,
        cameraId: camera.id,
        message: 'Configuration failed',
        error: error.message
      };
    }
  }

  private async sendConfiguration(
    ip: string,
    username: string,
    password: string,
    config: any
  ): Promise<any> {
    try {
      const url = `http://${ip}/local/BatonAnalytic/baton_analytic.cgi?command=setInstallerConfig`;
      
      // First request to get digest challenge
      const response1 = await axios.post(url, config, {
        timeout: 10000,
        validateStatus: () => true,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response1.status === 401) {
        // Handle digest authentication
        const wwwAuth = response1.headers['www-authenticate'];
        if (wwwAuth && wwwAuth.includes('Digest')) {
          const authHeader = this.buildDigestAuth(
            username,
            password,
            'POST',
            '/local/BatonAnalytic/baton_analytic.cgi?command=setInstallerConfig',
            wwwAuth
          );

          // Second request with auth
          const response2 = await axios.post(url, config, {
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          });

          if (response2.status === 200) {
            console.log('[CameraConfig] Configuration response:', response2.data);
            return { success: true, data: response2.data };
          } else {
            throw new Error(`Configuration failed with status ${response2.status}`);
          }
        }
      } else if (response1.status === 200) {
        // No auth required
        console.log('[CameraConfig] Configuration response:', response1.data);
        return { success: true, data: response1.data };
      }

      throw new Error(`Unexpected response: ${response1.status}`);
    } catch (error: any) {
      console.error('[CameraConfig] Error sending configuration:', error);
      return { success: false, error: error.message };
    }
  }

  private buildDigestAuth(
    username: string,
    password: string,
    method: string,
    uri: string,
    authHeader: string
  ): string {
    // Parse digest parameters
    const digestData: any = {};
    const regex = /(\w+)=(?:"([^"]+)"|([^,]+))/g;
    let match;
    while ((match = regex.exec(authHeader)) !== null) {
      digestData[match[1]] = match[2] || match[3];
    }

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
    
    return `Digest username="${username}", realm="${digestData.realm}", nonce="${digestData.nonce}", uri="${uri}", qop=${digestData.qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"`;
  }

  async pushSystemConfig(
    ip: string,
    username: string,
    password: string,
    configPayload: any
  ): Promise<any> {
    try {
      // Use the setInstallerConfig endpoint for proper merging
      const url = `http://${ip}/local/BatonAnalytic/baton_analytic.cgi?command=setInstallerConfig`;
      
      console.log('[CameraConfig] Pushing installer config to camera:', ip);
      console.log('[CameraConfig] Config payload:', JSON.stringify(configPayload, null, 2));
      
      // Extract Anava key from the payload if it exists
      const anavaKey = configPayload?.anavaKey;
      
      // First request to get digest challenge
      const response1 = await axios.post(url, configPayload, {
        timeout: 10000,
        validateStatus: () => true,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response1.status === 401) {
        // Handle digest authentication
        const wwwAuth = response1.headers['www-authenticate'];
        if (wwwAuth && wwwAuth.includes('Digest')) {
          const authHeader = this.buildDigestAuth(
            username,
            password,
            'POST',
            '/local/BatonAnalytic/baton_analytic.cgi?command=setInstallerConfig',
            wwwAuth
          );

          // Second request with auth
          const response2 = await axios.post(url, configPayload, {
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          });

          if (response2.status === 200) {
            console.log('[CameraConfig] SystemConfig push response:', response2.data);
            
            // If we have an Anava license key, activate it
            if (anavaKey) {
              console.log('[CameraConfig] Activating Anava license key...');
              try {
                await this.activateLicenseKey(ip, username, password, anavaKey, 'BatonAnalytic');
                console.log('[CameraConfig] License key activated successfully');
                return { success: true, data: response2.data, licenseActivated: true };
              } catch (licenseError: any) {
                console.error('[CameraConfig] Failed to activate license key:', licenseError);
                // Non-fatal - configuration succeeded, just license activation failed
                return { success: true, data: response2.data, licenseActivated: false, licenseError: licenseError.message };
              }
            }
            
            return { success: true, data: response2.data };
          } else {
            throw new Error(`Configuration failed with status ${response2.status}`);
          }
        }
      } else if (response1.status === 200) {
        // No auth required
        console.log('[CameraConfig] SystemConfig push response:', response1.data);
        
        // If we have an Anava license key, activate it
        if (anavaKey) {
          console.log('[CameraConfig] Activating Anava license key...');
          try {
            await this.activateLicenseKey(ip, username, password, anavaKey, 'BatonAnalytic');
            console.log('[CameraConfig] License key activated successfully');
            return { success: true, data: response1.data, licenseActivated: true };
          } catch (licenseError: any) {
            console.error('[CameraConfig] Failed to activate license key:', licenseError);
            // Non-fatal - configuration succeeded, just license activation failed
            return { success: true, data: response1.data, licenseActivated: false, licenseError: licenseError.message };
          }
        }
        
        return { success: true, data: response1.data };
      }

      throw new Error(`Unexpected response: ${response1.status}`);
    } catch (error: any) {
      console.error('[CameraConfig] Error pushing SystemConfig:', error);
      return { success: false, error: error.message };
    }
  }

  async getSystemConfig(
    ip: string,
    username: string,
    password: string
  ): Promise<any> {
    try {
      // Use the getSystemConfig endpoint to retrieve current settings
      const url = `http://${ip}/local/BatonAnalytic/baton_analytic.cgi?command=getSystemConfig`;
      
      console.log('[CameraConfig] Getting SystemConfig from camera:', ip);
      
      // First request to get digest challenge
      const response1 = await axios.get(url, {
        timeout: 10000,
        validateStatus: () => true
      });

      if (response1.status === 401) {
        // Handle digest authentication
        const wwwAuth = response1.headers['www-authenticate'];
        if (wwwAuth && wwwAuth.includes('Digest')) {
          const authHeader = this.buildDigestAuth(
            username,
            password,
            'GET',
            '/local/BatonAnalytic/baton_analytic.cgi?command=getSystemConfig',
            wwwAuth
          );

          // Second request with auth
          const response2 = await axios.get(url, {
            headers: {
              'Authorization': authHeader
            },
            timeout: 10000
          });

          if (response2.status === 200) {
            console.log('[CameraConfig] SystemConfig retrieved:', response2.data);
            return { success: true, data: response2.data };
          } else {
            throw new Error(`Get config failed with status ${response2.status}`);
          }
        }
      } else if (response1.status === 200) {
        // No auth required
        console.log('[CameraConfig] SystemConfig retrieved:', response1.data);
        return { success: true, data: response1.data };
      }

      throw new Error(`Unexpected response: ${response1.status}`);
    } catch (error: any) {
      console.error('[CameraConfig] Error getting SystemConfig:', error);
      return { success: false, error: error.message };
    }
  }

  async activateLicenseKey(
    ip: string,
    username: string,
    password: string,
    licenseKey: string,
    applicationName: string
  ): Promise<void> {
    try {
      // First, check if the application is installed
      const listUrl = `http://${ip}/axis-cgi/applications/list.cgi`;
      
      console.log('[CameraConfig] Checking application status for license activation...');
      
      // Get installed applications
      const response1 = await axios.get(listUrl, {
        timeout: 10000,
        validateStatus: () => true
      });

      let appListData = '';
      
      if (response1.status === 401) {
        // Handle digest authentication
        const wwwAuth = response1.headers['www-authenticate'];
        if (wwwAuth && wwwAuth.includes('Digest')) {
          const authHeader = this.buildDigestAuth(
            username,
            password,
            'GET',
            '/axis-cgi/applications/list.cgi',
            wwwAuth
          );

          const response2 = await axios.get(listUrl, {
            headers: {
              'Authorization': authHeader
            },
            timeout: 10000
          });

          appListData = response2.data;
        }
      } else if (response1.status === 200) {
        appListData = response1.data;
      }

      // Check if application is in the list
      if (!appListData.includes(applicationName)) {
        console.warn(`[CameraConfig] Application ${applicationName} not found on camera, skipping license activation`);
        return;
      }

      // Now activate the license key
      const licenseUrl = `http://${ip}/axis-cgi/applications/license.cgi?action=uploadlicensekey&package=${applicationName}`;
      
      console.log('[CameraConfig] Uploading license key for', applicationName);

      // Create form data with the license key
      const form = new FormData();
      
      // The license key might be in XML format or just a plain key
      // For now, we'll send it as plain text
      const licenseBuffer = Buffer.from(licenseKey, 'utf-8');
      form.append('licenseKey', licenseBuffer, {
        filename: `${applicationName}LicenseKey.txt`,
        contentType: 'application/octet-stream'
      });

      // First request to get digest challenge
      const licenseResponse1 = await axios.post(licenseUrl, form, {
        headers: {
          ...form.getHeaders()
        },
        timeout: 10000,
        validateStatus: () => true
      });

      if (licenseResponse1.status === 401) {
        // Handle digest authentication
        const wwwAuth = licenseResponse1.headers['www-authenticate'];
        if (wwwAuth && wwwAuth.includes('Digest')) {
          const authHeader = this.buildDigestAuth(
            username,
            password,
            'POST',
            `/axis-cgi/applications/license.cgi?action=uploadlicensekey&package=${applicationName}`,
            wwwAuth
          );

          // Recreate form data
          const form2 = new FormData();
          form2.append('licenseKey', licenseBuffer, {
            filename: `${applicationName}LicenseKey.txt`,
            contentType: 'application/octet-stream'
          });

          const licenseResponse2 = await axios.post(licenseUrl, form2, {
            headers: {
              ...form2.getHeaders(),
              'Authorization': authHeader
            },
            timeout: 10000
          });

          if (licenseResponse2.status === 200) {
            console.log('[CameraConfig] License key uploaded successfully');
          } else {
            throw new Error(`License activation failed with status ${licenseResponse2.status}`);
          }
        }
      } else if (licenseResponse1.status === 200) {
        console.log('[CameraConfig] License key uploaded successfully');
      } else {
        throw new Error(`License activation failed with status ${licenseResponse1.status}`);
      }
    } catch (error: any) {
      console.error('[CameraConfig] Error activating license key:', error);
      throw error;
    }
  }
}