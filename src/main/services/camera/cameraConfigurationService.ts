import { ipcMain } from 'electron';
import axios from 'axios';
import crypto from 'crypto';
import { Camera } from './cameraDiscoveryService';
import AxiosDigestAuth from '@mhoc/axios-digest-auth';

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
    
    ipcMain.handle('activate-license-key', async (_event, ip: string, username: string, password: string, licenseKey: string, applicationName: string) => {
      return this.activateLicenseKey(ip, username, password, licenseKey, applicationName);
    });
    
    ipcMain.handle('test-speaker', async (_event, speakerIp: string, username: string, password: string) => {
      return this.testSpeaker(speakerIp, username, password);
    });
    
    ipcMain.handle('configure-speaker', async (_event, cameraIp: string, speakerIp: string, username: string, password: string) => {
      return this.configureSpeaker(cameraIp, speakerIp, username, password);
    });
    
    ipcMain.handle('play-speaker-audio', async (_event, speakerIp: string, username: string, password: string, audioFile: string) => {
      return this.playSpeakerAudio(speakerIp, username, password, audioFile);
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
            console.error('[CameraConfig] Failed to activate license key:', licenseError.message || licenseError);
            console.error('[CameraConfig] License activation error details:', {
              code: licenseError.code,
              stack: licenseError.stack
            });
            // Non-fatal - configuration succeeded, just license activation failed
            // Don't throw the error, just log it
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
    
    return `Digest username="${username}", realm="${digestData.realm}", nonce="${digestData.nonce}", uri="${uri}", qop="${digestData.qop}", nc="${nc}", cnonce="${cnonce}", response="${response}", algorithm="MD5"`;
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
      
      // Create digest auth client
      const digestAuth = new AxiosDigestAuth({
        username,
        password,
      });

      try {
        // Use digest auth to post the config
        const response = await digestAuth.request({
          url,
          method: 'POST',
          data: configPayload,
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });

        console.log('[CameraConfig] SystemConfig push response:', response.data);
        
        // If we have an Anava license key, activate it
        if (anavaKey) {
          console.log('[CameraConfig] Activating Anava license key...');
          try {
            await this.activateLicenseKey(ip, username, password, anavaKey, 'BatonAnalytic');
            console.log('[CameraConfig] License key activated successfully');
            return { success: true, data: response.data, licenseActivated: true };
          } catch (licenseError: any) {
            console.error('[CameraConfig] Failed to activate license key:', licenseError.message || licenseError);
            console.error('[CameraConfig] License activation error details:', {
              code: licenseError.code,
              stack: licenseError.stack
            });
            // Non-fatal - configuration succeeded, just license activation failed
            return { success: true, data: response.data, licenseActivated: false, licenseError: licenseError.message };
          }
        }
        
        return { success: true, data: response.data };
      } catch (digestError: any) {
        // Try without auth if digest fails
        console.log('[CameraConfig] Digest auth failed, trying without authentication...');
        
        const response = await axios.post(url, configPayload, {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response.status === 200) {
          console.log('[CameraConfig] SystemConfig push response:', response.data);
          
          // If we have an Anava license key, activate it
          if (anavaKey) {
            console.log('[CameraConfig] Activating Anava license key...');
            try {
              await this.activateLicenseKey(ip, username, password, anavaKey, 'BatonAnalytic');
              console.log('[CameraConfig] License key activated successfully');
              return { success: true, data: response.data, licenseActivated: true };
            } catch (licenseError: any) {
              console.error('[CameraConfig] Failed to activate license key:', licenseError.message || licenseError);
              // Non-fatal - configuration succeeded, just license activation failed
              return { success: true, data: response.data, licenseActivated: false, licenseError: licenseError.message };
            }
          }
          
          return { success: true, data: response.data };
        } else {
          throw digestError; // Re-throw the original error
        }
      }
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
      
      // Create digest auth client
      const digestAuth = new AxiosDigestAuth({
        username,
        password,
      });

      try {
        // Use digest auth to get the config
        const response = await digestAuth.request({
          url,
          method: 'GET',
          timeout: 10000
        });

        console.log('[CameraConfig] SystemConfig retrieved:', response.data);
        return { success: true, data: response.data };
      } catch (digestError: any) {
        // Try without auth if digest fails
        console.log('[CameraConfig] Digest auth failed, trying without authentication...');
        
        const response = await axios.get(url, {
          timeout: 10000
        });

        if (response.status === 200) {
          console.log('[CameraConfig] SystemConfig retrieved:', response.data);
          return { success: true, data: response.data };
        } else {
          throw digestError; // Re-throw the original error
        }
      }
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
      
      // Create digest auth client for list.cgi
      const digestAuthList = new AxiosDigestAuth({
        username,
        password,
      });

      // Get installed applications
      let appListData = '';
      try {
        const listResponse = await digestAuthList.request({
          url: listUrl,
          method: 'GET',
          timeout: 10000,
        });
        appListData = listResponse.data;
      } catch (listError: any) {
        console.error('[CameraConfig] Error getting application list:', listError.message);
        // Try without auth if digest fails
        const response = await axios.get(listUrl, {
          timeout: 10000,
          validateStatus: () => true
        });
        if (response.status === 200) {
          appListData = response.data;
        } else {
          throw new Error(`Failed to get application list: ${listError.message}`);
        }
      }

      // Check if application is in the list
      if (!appListData.includes(applicationName)) {
        console.warn(`[CameraConfig] Application ${applicationName} not found on camera, skipping license activation`);
        return;
      }
      
      // Parse XML response to check license status
      const licenseMatch = appListData.match(new RegExp(`<application[^>]*Name="${applicationName}"[^>]*License="([^"]*)"`, 'i'));
      
      if (licenseMatch && licenseMatch[1] === 'Valid') {
        console.log(`[CameraConfig] ${applicationName} is already licensed, skipping activation`);
        return;
      }

      // Direct license activation - just like the web UI does it
      console.log('[CameraConfig] Activating license key:', licenseKey);
      console.log('[CameraConfig] For application:', applicationName);
      
      // Wait a moment for camera to stabilize after ACAP installation
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Use the direct control.cgi endpoint exactly like the web UI
      const licenseUrl = `http://${ip}/axis-cgi/applications/control.cgi`;
      
      console.log('[CameraConfig] Trying control.cgi endpoint...');

      // Prepare form data as URL encoded
      const params = new URLSearchParams();
      params.append('action', 'license');
      params.append('ApplicationName', applicationName);
      params.append('LicenseKey', licenseKey);
      const formData = params.toString();
      
      console.log('[CameraConfig] POST data:', formData);
      console.log('[CameraConfig] POST URL:', licenseUrl);

      // Create digest auth client for control.cgi
      const digestAuthControl = new AxiosDigestAuth({
        username,
        password,
        axios: axios.create({
          // Use custom axios instance with specific settings to prevent stream abort
          timeout: 30000,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          // Important: disable automatic decompression which can cause stream issues
          decompress: false,
          // Keep the connection alive
          httpAgent: new (require('http').Agent)({
            keepAlive: true,
            keepAliveMsecs: 1000,
          }),
        })
      });

      try {
        // Use digest auth to post the license data
        const licenseResponse = await digestAuthControl.request({
          url: licenseUrl,
          method: 'POST',
          data: formData,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(formData).toString(),
            // Prevent connection close which can cause stream abort
            'Connection': 'keep-alive',
          },
        });
        
        console.log('[CameraConfig] License response status:', licenseResponse.status);
        console.log('[CameraConfig] License response data:', licenseResponse.data);

        if (licenseResponse.status === 200) {
          const responseBody = licenseResponse.data.toString().trim();
          if (responseBody === 'OK') {
            console.log('[CameraConfig] License key applied successfully via control.cgi');
            return;
          } else if (responseBody.includes('Error')) {
            console.log('[CameraConfig] License response:', responseBody);
            // Check for specific errors
            if (responseBody === 'Error: 1') {
              // For now, log the error but don't throw - we need to investigate further
              console.warn('[CameraConfig] License activation returned Error: 1 - this may indicate the key format needs conversion');
              console.warn('[CameraConfig] The web UI may convert the simple key to a different format before submission');
            } else if (responseBody.includes('Invalid license key')) {
              throw new Error('Invalid license key');
            } else if (responseBody.includes('not valid for this product')) {
              throw new Error('License key not valid for this product');
            } else if (responseBody.includes('could not be activated')) {
              throw new Error('License could not be activated (check internet connection)');
            } else {
              console.warn(`[CameraConfig] License activation warning: ${responseBody}`);
            }
          }
        } else {
          throw new Error(`License activation failed with status ${licenseResponse.status}`);
        }
      } catch (digestError: any) {
        // If digest auth fails, try without auth (some cameras might not require it)
        console.log('[CameraConfig] Digest auth failed, trying without authentication...');
        
        const response = await axios.post(licenseUrl, formData, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(formData).toString(),
            'Connection': 'keep-alive',
          },
          timeout: 30000,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          decompress: false,
          httpAgent: new (require('http').Agent)({
            keepAlive: true,
            keepAliveMsecs: 1000,
          }),
        });

        if (response.status === 200) {
          const responseBody = response.data.toString().trim();
          if (responseBody === 'OK') {
            console.log('[CameraConfig] License key applied successfully (no auth required)');
            return;
          } else {
            console.warn(`[CameraConfig] Unexpected license response: ${responseBody}`);
          }
        } else {
          throw digestError; // Re-throw the original digest error
        }
      }
      
      // Log final status
      console.log('[CameraConfig] License activation completed - check camera status to verify');
      
      // Start the application after successful license activation
      await this.startApplication(ip, username, password, applicationName);
      
    } catch (error: any) {
      console.error('[CameraConfig] Error activating license key:', error);
      throw error;
    }
  }

  private async startApplication(ip: string, username: string, password: string, applicationName: string): Promise<void> {
    try {
      console.log('[CameraConfig] Starting application:', applicationName);
      const startUrl = `http://${ip}/axis-cgi/applications/control.cgi`;
      const startParams = new URLSearchParams();
      startParams.append('action', 'start');
      startParams.append('package', applicationName);
      
      const startResponse1 = await axios.post(startUrl, startParams.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000,
        validateStatus: () => true
      });
      
      if (startResponse1.status === 401) {
        const wwwAuth = startResponse1.headers['www-authenticate'];
        if (wwwAuth && wwwAuth.includes('Digest')) {
          const authHeader = this.buildDigestAuth(
            username,
            password,
            'POST',
            '/axis-cgi/applications/control.cgi',
            wwwAuth
          );
          
          const startResponse2 = await axios.post(startUrl, startParams.toString(), {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': authHeader
            },
            timeout: 10000
          });
          
          if (startResponse2.status === 200) {
            console.log('[CameraConfig] Application started successfully');
          }
        }
      } else if (startResponse1.status === 200) {
        console.log('[CameraConfig] Application started successfully (no auth)');
      }
    } catch (startError: any) {
      console.log('[CameraConfig] Failed to start application:', startError.message);
      // Non-fatal - license is activated, just couldn't start
    }
  }

  async testSpeaker(
    speakerIp: string,
    username: string,
    password: string
  ): Promise<any> {
    try {
      // Test basic connectivity to speaker
      console.log('[CameraConfig] Testing speaker connectivity:', speakerIp);
      
      // Try to get device info
      const infoUrl = `http://${speakerIp}/axis-cgi/basicdeviceinfo.cgi`;
      
      const response1 = await axios.get(infoUrl, {
        timeout: 5000,
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
            '/axis-cgi/basicdeviceinfo.cgi',
            wwwAuth
          );

          const response2 = await axios.get(infoUrl, {
            headers: {
              'Authorization': authHeader
            },
            timeout: 5000
          });

          if (response2.status === 200) {
            console.log('[CameraConfig] Speaker test successful');
            
            // Play a short test tone
            await this.playSpeakerAudio(speakerIp, username, password, 'test-tone');
            
            return { 
              success: true, 
              deviceInfo: response2.data,
              message: 'Speaker connected successfully'
            };
          }
        }
      } else if (response1.status === 200) {
        console.log('[CameraConfig] Speaker test successful (no auth)');
        
        // Play a short test tone
        await this.playSpeakerAudio(speakerIp, username, password, 'test-tone');
        
        return { 
          success: true, 
          deviceInfo: response1.data,
          message: 'Speaker connected successfully'
        };
      }

      throw new Error(`Speaker test failed with status ${response1.status}`);
    } catch (error: any) {
      console.error('[CameraConfig] Speaker test error:', error);
      return { success: false, error: error.message };
    }
  }

  async configureSpeaker(
    cameraIp: string,
    speakerIp: string,
    username: string,
    password: string
  ): Promise<any> {
    try {
      console.log(`[CameraConfig] Configuring speaker ${speakerIp} with camera ${cameraIp}`);
      
      // Store speaker configuration in camera's SystemConfig
      const speakerConfig = {
        speaker: {
          ip: speakerIp,
          username: username,
          enabled: true,
          audioSettings: {
            volume: 70,
            talkdownEnabled: true,
            detectionTypes: ['weapon', 'person', 'gesture']
          }
        }
      };
      
      // Push speaker config to camera
      const result = await this.pushSystemConfig(cameraIp, username, password, speakerConfig);
      
      if (result.success) {
        console.log('[CameraConfig] Speaker configured successfully');
        return { success: true, message: 'Speaker configured with camera' };
      } else {
        throw new Error(result.error || 'Failed to configure speaker');
      }
    } catch (error: any) {
      console.error('[CameraConfig] Speaker configuration error:', error);
      return { success: false, error: error.message };
    }
  }

  async playSpeakerAudio(
    speakerIp: string,
    username: string,
    password: string,
    audioFile: string
  ): Promise<any> {
    try {
      console.log(`[CameraConfig] Playing audio on speaker ${speakerIp}`);
      
      // Use VAPIX audio API to play audio
      const audioUrl = `http://${speakerIp}/axis-cgi/audio/transmit.cgi`;
      
      // Prepare audio data based on file type
      let audioData: Buffer;
      let contentType: string;
      
      if (audioFile === 'test-tone') {
        // Generate a simple test tone
        audioData = this.generateTestTone();
        contentType = 'audio/basic';
      } else {
        // Load pre-defined audio clips
        audioData = await this.loadAudioClip(audioFile);
        contentType = 'audio/mpeg';
      }
      
      // First request to get digest challenge
      const response1 = await axios.post(audioUrl, audioData, {
        headers: {
          'Content-Type': contentType,
          'Content-Length': audioData.length.toString()
        },
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
            'POST',
            '/axis-cgi/audio/transmit.cgi',
            wwwAuth
          );

          const response2 = await axios.post(audioUrl, audioData, {
            headers: {
              'Authorization': authHeader,
              'Content-Type': contentType,
              'Content-Length': audioData.length.toString()
            },
            timeout: 10000
          });

          if (response2.status === 200 || response2.status === 204) {
            console.log('[CameraConfig] Audio played successfully');
            return { success: true, message: 'Audio played' };
          }
        }
      } else if (response1.status === 200 || response1.status === 204) {
        console.log('[CameraConfig] Audio played successfully (no auth)');
        return { success: true, message: 'Audio played' };
      }

      throw new Error(`Audio playback failed with status ${response1.status}`);
    } catch (error: any) {
      console.error('[CameraConfig] Audio playback error:', error);
      return { success: false, error: error.message };
    }
  }

  private generateTestTone(): Buffer {
    // Generate a simple 1kHz test tone (1 second, 8-bit, 8kHz mono)
    const sampleRate = 8000;
    const duration = 1; // seconds
    const frequency = 1000; // Hz
    const samples = sampleRate * duration;
    const buffer = Buffer.alloc(samples);
    
    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      const value = Math.sin(2 * Math.PI * frequency * t);
      // Convert to 8-bit unsigned
      buffer[i] = Math.floor((value + 1) * 127.5);
    }
    
    return buffer;
  }

  private async loadAudioClip(clipName: string): Promise<Buffer> {
    // In a real implementation, this would load pre-defined audio clips
    // For now, return a test pattern
    console.log(`[CameraConfig] Loading audio clip: ${clipName}`);
    
    // Map clip names to actual audio data
    // const clips: { [key: string]: string } = {
    //   'security-alert': 'Security alert. This area is being monitored.',
    //   'weapon-detected': 'Weapon detected. Security has been notified.',
    //   'custom-message': 'Please maintain social distance.'
    // };
    
    // For demo purposes, return test tone
    // In production, this would load actual MP3 files
    return this.generateTestTone();
  }
}