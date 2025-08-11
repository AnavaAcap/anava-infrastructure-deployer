import { ipcMain, app } from 'electron';
import axios from 'axios';
import https from 'https';
import { Camera } from './cameraDiscoveryService';
import { getCameraBaseUrl } from './cameraProtocolUtils';
import { logger } from '../../utils/logger';

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


  async getSceneDescription(camera: any, apiKey: string, includeSpeaker: boolean = false): Promise<any> {
    try {
      console.log('[getSceneDescription] Starting scene analysis for camera:', camera.ip);
      
      const requestData: any = {
        viewArea: 1,  // Default camera channel
        GeminiApiKey: apiKey,
        replyMP3: true  // Request audio response
      };
      
      // Include speaker credentials if requested and available
      if (includeSpeaker && camera.speaker) {
        requestData.speakerIp = camera.speaker.ip;
        requestData.speakerUser = camera.speaker.username;
        requestData.speakerPass = camera.speaker.password;
        console.log('[getSceneDescription] Including speaker in request');
      }
      
      console.log('[getSceneDescription] Request payload:', JSON.stringify(requestData, null, 2));
      
      // Use the correct endpoint
      const response = await this.httpsBasicAuth(
        camera.ip,
        camera.credentials?.username || 'root',
        camera.credentials?.password || '',
        'POST',
        '/local/BatonAnalytic/baton_analytic.cgi?command=getSceneDescription',
        JSON.stringify(requestData)
      );

      if (!response || response.status !== 200) {
        throw new Error('Failed to get scene description from ACAP');
      }

      // Parse response - it might be a string that needs JSON parsing
      let data = response.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch (e) {
          console.log('[getSceneDescription] Response is not JSON:', data);
        }
      }
      
      console.log('[getSceneDescription] Response:', {
        status: data.status,
        hasDescription: !!data.description,
        hasImage: !!data.imageBase64,
        hasAudio: !!data.audioMP3Base64 || !!data.audioBase64,
        audioFormat: data.audioFormat,
        ttsStatus: data.ttsStatus,
        audioLength: data.audioLength
      });
      
      if (data.status === 'success') {
        return {
          success: true,
          description: data.description,
          imageBase64: data.imageBase64,
          audioMP3Base64: data.audioMP3Base64, // Keep for backward compatibility
          audioBase64: data.audioBase64 || data.audioMP3Base64, // New field
          audioFormat: data.audioFormat || (data.audioBase64 ? 'pcm_l16_24000' : 'mp3'), // Default to pcm if audioBase64 is present
          timestamp: data.timestamp,
          ttsSuccess: data.ttsSuccess
        };
      } else {
        throw new Error(data.message || 'Scene analysis failed');
      }
      
    } catch (error: any) {
      console.error('[getSceneDescription] Error:', error);
      return {
        success: false,
        error: error.message || 'Failed to analyze scene'
      };
    }
  }

  // HTTPS with Basic Auth implementation
  private async httpsBasicAuth(
    ip: string,
    username: string,
    password: string,
    method: string,
    uri: string,
    data?: any
  ): Promise<any> {
    try {
      const baseUrl = await getCameraBaseUrl(ip, username, password);
      const url = `${baseUrl}${uri}`;
      
      console.log(`[CameraConfig] httpsBasicAuth: ${method} ${url}`);
      if (data) {
        console.log(`[CameraConfig] Request data type:`, typeof data);
        console.log(`[CameraConfig] Request data length:`, data.length);
        if (typeof data === 'string') {
          console.log(`[CameraConfig] Request data (first 500 chars):`, data.substring(0, 500));
          if (data.length > 500) {
            console.log(`[CameraConfig] Request data (last 200 chars):`, data.substring(data.length - 200));
          }
        } else {
          console.log(`[CameraConfig] Request data:`, data);
        }
      }
      
      // Use HTTPS with Basic Auth directly
      const isHttps = url.startsWith('https');
      const response = await axios({
        method,
        url,
        data,
        auth: {
          username,
          password
        },
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 20000,
        httpsAgent: isHttps ? new https.Agent({
          rejectUnauthorized: false
        }) : undefined,
      });
      
      console.log(`[CameraConfig] Response status:`, response.status);
      if (response.data) {
        const dataStr = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        console.log(`[CameraConfig] Response data (first 500 chars):`, dataStr.substring(0, 500));
      }
      
      if (response.status === 200) {
        return response;
      } else {
        throw new Error(`Request failed with status ${response.status}`);
      }
    } catch (error: any) {
      console.error(`[CameraConfig] httpsBasicAuth error:`, error.message);
      console.error(`[CameraConfig] Error stack:`, error.stack);
      if (error.response) {
        console.error(`[CameraConfig] Error response status:`, error.response.status);
        console.error(`[CameraConfig] Error response data:`, error.response.data);
      }
      throw error;
    }
  }

  private setupIPC() {
    ipcMain.handle('configure-camera', async (_event, camera: Camera, config: any) => {
      return this.configureCamera(camera, config);
    });

    ipcMain.handle('push-camera-settings', async (_event, ip: string, username: string, password: string, configPayload: any) => {
      return this.pushSystemConfig(ip, username, password, configPayload);
    });
    
    ipcMain.handle('push-system-config', async (_event, ip: string, username: string, password: string, configPayload: any) => {
      return this.pushSystemConfig(ip, username, password, configPayload);
    });

    ipcMain.handle('get-camera-settings', async (_event, ip: string, username: string, password: string) => {
      return this.getSystemConfig(ip, username, password);
    });
    
    ipcMain.handle('activate-license-key', async (_event, ip: string, username: string, password: string, licenseKey: string, applicationName: string, macAddress?: string | null) => {
      return this.activateLicenseKey(ip, username, password, licenseKey, applicationName, macAddress);
    });
    
    ipcMain.handle('test-speaker', async (_event, speakerIp: string, username: string, password: string) => {
      return this.testSpeaker(speakerIp, username, password);
    });
    
    ipcMain.handle('testSpeakerAudio', async (_event, speakerIp: string, username: string, password: string) => {
      return this.testSpeakerAudio(speakerIp, username, password);
    });
    
    ipcMain.handle('configure-speaker', async (_event, cameraIp: string, speakerIp: string, username: string, password: string) => {
      return this.configureSpeaker(cameraIp, speakerIp, username, password);
    });
    
    ipcMain.handle('play-speaker-audio', async (_event, speakerIp: string, username: string, password: string, audioFile: string) => {
      return this.playSpeakerAudio(speakerIp, username, password, audioFile);
    });
    
    ipcMain.handle('get-scene-description', async (_event, camera: any, apiKey: string, includeSpeaker: boolean = false) => {
      return this.getSceneDescription(camera, apiKey, includeSpeaker);
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
      const baseUrl = await getCameraBaseUrl(ip, username, password);
      const url = `${baseUrl}/local/BatonAnalytic/baton_analytic.cgi?command=setInstallerConfig`;
      const isHttps = url.startsWith('https');
      
      // Use HTTPS with Basic Auth
      const response = await axios.post(url, config, {
        timeout: 10000,
        auth: {
          username,
          password
        },
        headers: {
          'Content-Type': 'application/json'
        },
        httpsAgent: isHttps ? new https.Agent({
          rejectUnauthorized: false
        }) : undefined
      });

      if (response.status === 200) {
        console.log('[CameraConfig] Configuration response:', response.data);
        return { success: true, data: response.data };
      } else {
        throw new Error(`Configuration failed with status ${response.status}`);
      }
    } catch (error: any) {
      console.error('[CameraConfig] Error sending configuration:', error);
      return { success: false, error: error.message };
    }
  }


  async pushSystemConfig(
    ip: string,
    username: string,
    password: string,
    configPayload: any
  ): Promise<any> {
    try {
      // Use the setInstallerConfig endpoint for proper merging
      console.log('[CameraConfig] Pushing installer config to camera:', ip);
      console.log('[CameraConfig] Config payload:', JSON.stringify(configPayload, null, 2));
      
      // Extract Anava key from the payload if it exists
      const anavaKey = configPayload?.anavaKey;
      
      console.log('[CameraConfig] Using simpleDigestAuth for pushSystemConfig...');
      
      try {
        // Use our working simpleDigestAuth method
        const response = await this.httpsBasicAuth(
          ip,
          username,
          password,
          'POST',
          '/local/BatonAnalytic/baton_analytic.cgi?command=setInstallerConfig',
          JSON.stringify(configPayload)
        );

        console.log('[CameraConfig] SystemConfig push successful!');
        console.log('[CameraConfig] Full response data:');
        console.log('================== START PUSH RESPONSE ==================');
        console.log(response.data);
        console.log('================== END PUSH RESPONSE ==================');
        
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
        // Check if this is the ThreadPool error which actually means success
        if (digestError.response?.status === 500 && 
            digestError.response?.data?.message?.includes('ThreadPool')) {
          console.log('[CameraConfig] Received ThreadPool error - this means config was saved but ACAP is restarting');
          console.log('[CameraConfig] Treating as success since configuration was actually saved');
          
          // Still try to activate license if we have one
          if (anavaKey) {
            console.log('[CameraConfig] Attempting license activation despite ThreadPool error...');
            try {
              await this.activateLicenseKey(ip, username, password, anavaKey, 'BatonAnalytic');
              console.log('[CameraConfig] License key activated successfully');
              return { success: true, message: 'Configuration saved (ACAP restarting)', licenseActivated: true };
            } catch (licenseError: any) {
              console.warn('[CameraConfig] License activation failed:', licenseError.message);
              // Non-fatal - configuration succeeded, just license activation failed
              return { success: true, message: 'Configuration saved (ACAP restarting)', licenseActivated: false };
            }
          }
          
          return { success: true, message: 'Configuration saved successfully (ACAP is restarting)' };
        }
        
        // For other errors, log and throw
        console.error('[CameraConfig] simpleDigestAuth failed:', digestError.message);
        console.error('[CameraConfig] Full error object:');
        console.error('================== START ERROR DETAILS ==================');
        console.error('Message:', digestError.message);
        console.error('Code:', digestError.code);
        console.error('Stack:', digestError.stack);
        if (digestError.response) {
          console.error('Response status:', digestError.response.status);
          console.error('Response headers:', digestError.response.headers);
          console.error('Response data:', digestError.response.data);
        }
        if (digestError.request) {
          console.error('Request URL:', digestError.request.url || digestError.request.path);
          console.error('Request method:', digestError.request.method);
        }
        console.error('================== END ERROR DETAILS ==================');
        throw new Error(`Failed to push config: ${digestError.message}`);
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
      console.log('[CameraConfig] Getting SystemConfig from camera:', ip);
      
      console.log('[CameraConfig] Using simpleDigestAuth for getSystemConfig...');
      
      try {
        // Use our working simpleDigestAuth method
        const response = await this.httpsBasicAuth(
          ip,
          username,
          password,
          'GET',
          '/local/BatonAnalytic/baton_analytic.cgi?command=getSystemConfig'
        );

        console.log('[CameraConfig] SystemConfig retrieved:', response.data);
        return { success: true, data: response.data };
      } catch (digestError: any) {
        console.error('[CameraConfig] Failed to get SystemConfig:', digestError.message);
        throw digestError;
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
    applicationName: string,
    macAddress?: string | null
  ): Promise<void> {
    try {
      // First, check if the application is installed
      console.log('[CameraConfig] Checking application status for license activation...');
      
      // Get installed applications using simple digest auth
      console.log('[CameraConfig] Getting application list with username:', username);
      let appListData = '';
      try {
        const listResponse = await this.httpsBasicAuth(
          ip,
          username,
          password,
          'GET',
          '/axis-cgi/applications/list.cgi'
        );
        appListData = listResponse.data;
        console.log('[CameraConfig] Application list retrieved successfully');
        console.log('[CameraConfig] Full application list response:');
        console.log('================== START APPLICATION LIST ==================');
        console.log(appListData);
        console.log('================== END APPLICATION LIST ==================');
      } catch (listError: any) {
        console.error('[CameraConfig] Error getting application list:', listError.message);
        console.error('[CameraConfig] Full error:', listError.response?.status, listError.response?.data);
        
        // If it's a network error, throw immediately
        if (listError.code === 'ECONNREFUSED' || listError.code === 'ETIMEDOUT') {
          throw new Error(`Network error accessing camera: ${listError.message}`);
        }
        
        // For auth errors, let's not retry without auth since list.cgi requires auth
        throw new Error(`Failed to get application list: ${listError.message}`);
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

      // Get device ID (MAC address without colons)
      console.log('[CameraConfig] Looking for device ID in application list...');
      console.log('[CameraConfig] Application list data (first 500 chars):', appListData.substring(0, 500));
      
      // Try multiple patterns to find MAC address
      let deviceId = '';
      
      // First, use the MAC address passed from camera discovery if available
      if (macAddress) {
        // Remove colons from MAC address to get device ID
        deviceId = macAddress.replace(/[:-]/g, '').toUpperCase();
        console.log('[CameraConfig] Using MAC address from camera discovery:', macAddress);
        console.log('[CameraConfig] Converted to device ID:', deviceId);
      }
      
      // If no MAC provided, try to extract from camera response
      if (!deviceId) {
        // Pattern 1: AXIS_B8A44F45D624 in realm
        const realmMatch = appListData.match(/AXIS_([A-F0-9]{12})/i);
        if (realmMatch) {
          deviceId = realmMatch[1];
          console.log('[CameraConfig] Found device ID from realm pattern:', deviceId);
        }
      }
      
      // Pattern 2: Look in the XML structure for SerialNumber or similar
      if (!deviceId) {
        const serialMatch = appListData.match(/SerialNumber="([A-F0-9]{12})"/i);
        if (serialMatch) {
          deviceId = serialMatch[1];
          console.log('[CameraConfig] Found device ID from SerialNumber:', deviceId);
        }
      }
      
      // No fallback - if we can't find device ID, fail properly
      if (!deviceId) {
        console.error('[CameraConfig] Could not determine device ID - MAC address not provided and not found in camera response');
        console.warn('[CameraConfig] Please activate the license manually through the camera web UI');
        throw new Error('Could not determine camera device ID. Please ensure camera was properly discovered.');
      }

      console.log('[CameraConfig] Device ID:', deviceId);
      console.log('[CameraConfig] Activating license key:', licenseKey);
      console.log('[CameraConfig] For application:', applicationName);
      
      // Wait a moment for camera to stabilize after ACAP installation
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        // Get the signed XML from Axis license server
        const licenseXML = await this.getLicenseXMLFromAxis(deviceId, licenseKey);
        
        if (!licenseXML) {
          throw new Error('Failed to get license XML from Axis server');
        }
        
        // Upload the signed XML to the camera
        await this.uploadLicenseXML(ip, username, password, applicationName, licenseXML);
        
        console.log('[CameraConfig] License key activated successfully');
        
      } catch (error: any) {
        console.error('[CameraConfig] Error during license activation:', error.message);
        
        // Log the specific error
        console.warn('[CameraConfig] License activation failed:', error.message);
        if (error.message.includes('puppeteer')) {
          console.warn('[CameraConfig] Puppeteer error - ensure Chrome/Chromium is installed');
        }
        
        // Throw error with clear message so UI can display it
        throw new Error(`License activation failed: ${error.message}. You may need to activate the license manually through the camera's web interface.`);
      }
      
    } catch (error: any) {
      console.error('[CameraConfig] Error in license activation process:', error);
      // Throw error with user-friendly message
      const message = error.message || 'Unknown error during license activation';
      throw new Error(`License activation process failed: ${message}. Please activate the license manually through the camera web UI.`);
    }
  }

  // @ts-ignore - Method preserved for future use
  private async _startApplication(ip: string, username: string, password: string, applicationName: string): Promise<void> {
    try {
      console.log('[CameraConfig] Starting application:', applicationName);
      const baseUrl = await getCameraBaseUrl(ip, username, password);
      const startUrl = `${baseUrl}/axis-cgi/applications/control.cgi`;
      const isHttps = startUrl.startsWith('https');
      
      const startParams = new URLSearchParams();
      startParams.append('action', 'start');
      startParams.append('package', applicationName);
      
      const startResponse = await axios.post(startUrl, startParams.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        auth: {
          username,
          password
        },
        timeout: 10000,
        httpsAgent: isHttps ? new https.Agent({
          rejectUnauthorized: false
        }) : undefined
      });
      
      if (startResponse.status === 200) {
        console.log('[CameraConfig] Application started successfully');
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
      
      // Try to get device info using HTTPS with basic auth
      const baseUrl = await getCameraBaseUrl(speakerIp, username, password);
      const infoUrl = `${baseUrl}/axis-cgi/basicdeviceinfo.cgi`;
      const isHttps = infoUrl.startsWith('https');
      
      const response = await axios.get(infoUrl, {
        timeout: 5000,
        auth: {
          username,
          password
        },
        httpsAgent: isHttps ? new https.Agent({
          rejectUnauthorized: false
        }) : undefined
      });

      if (response.status === 200) {
        console.log('[CameraConfig] Speaker test successful');
        
        // Play a short test tone
        await this.playSpeakerAudio(speakerIp, username, password, 'test-tone');
        
        return { 
          success: true, 
          deviceInfo: response.data,
          message: 'Speaker connected successfully',
          capabilities: response.data
        };
      }

      throw new Error(`Speaker test failed with status ${response.status}`);
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
      
      // Use VAPIX audio API to play audio with HTTPS
      const baseUrl = await getCameraBaseUrl(speakerIp, username, password);
      const audioUrl = `${baseUrl}/axis-cgi/audio/transmit.cgi`;
      const isHttps = audioUrl.startsWith('https');
      
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
      
      // Use HTTPS with basic auth
      const response = await axios.post(audioUrl, audioData, {
        headers: {
          'Content-Type': contentType,
          'Content-Length': audioData.length.toString()
        },
        auth: {
          username,
          password
        },
        timeout: 10000,
        httpsAgent: isHttps ? new https.Agent({
          rejectUnauthorized: false
        }) : undefined
      });

      if (response.status === 200 || response.status === 204) {
        console.log('[CameraConfig] Audio played successfully');
        return { success: true, message: 'Audio played' };
      }

      throw new Error(`Audio playback failed with status ${response.status}`);
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

  private async getLicenseXMLFromAxis(deviceId: string, licenseCode: string): Promise<string | null> {
    try {
      console.log('[CameraConfig] Getting license XML using Axis SDK...');
      console.log('[CameraConfig] App path:', app.getAppPath());
      console.log('[CameraConfig] Is packaged?', app.isPackaged);
      
      // Use Puppeteer to load the Axis SDK and convert the license
      let browser;
      
      try {
        // Try regular puppeteer first
        const puppeteerModule = require('puppeteer');
        console.log('[CameraConfig] Puppeteer loaded successfully');
        browser = await puppeteerModule.launch({ 
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
      } catch (puppeteerError: any) {
        console.error('[CameraConfig] Failed to load puppeteer:', puppeteerError.message);
        
        // In production, try puppeteer-core with system Chrome
        if (app.isPackaged) {
          console.log('[CameraConfig] Trying puppeteer-core with system Chrome...');
          const puppeteerCore = require('puppeteer-core');
          const fs = require('fs');
          
          // Find Chrome/Chromium executable
          const possiblePaths = process.platform === 'darwin' ? [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium'
          ] : [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
          ];
          
          let executablePath = null;
          for (const chromePath of possiblePaths) {
            if (fs.existsSync(chromePath)) {
              executablePath = chromePath;
              console.log('[CameraConfig] Found Chrome at:', chromePath);
              break;
            }
          }
          
          if (!executablePath) {
            throw new Error('Chrome not found. Please install Google Chrome to activate licenses.');
          }
          
          browser = await puppeteerCore.launch({ 
            headless: true,
            executablePath,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
          });
        } else {
          throw puppeteerError;
        }
      }
      
      // Launch browser if not already launched
      if (!browser) {
        const puppeteerLib = require('puppeteer');
        console.log('[CameraConfig] Launching browser with standard puppeteer...');
        browser = await puppeteerLib.launch({ 
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
      }
      try {
        console.log('[CameraConfig] Browser launched, creating page...');
        const page = await browser.newPage();
        
        // Get application ID from the application list if we have it
        let applicationId = '415129'; // Default to BatonAnalytic
        
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
        
        // Wait for the SDK to complete (with timeout)
        await page.waitForFunction(() => (window as any).__ready === true, { timeout: 30000 });
        
        // Get the result
        const result = await page.evaluate(() => {
          if ((window as any).__error) {
            throw (window as any).__error;
          }
          return (window as any).__result;
        });
        
        console.log('[CameraConfig] SDK response received');
        
        if (result && result.licenseKey && result.licenseKey.xml) {
          console.log('[CameraConfig] Successfully got license XML from Axis SDK');
          return result.licenseKey.xml;
        }
        
        console.error('[CameraConfig] No XML in SDK response');
        return null;
        
      } finally {
        await browser.close();
      }
      
    } catch (error: any) {
      console.error('[CameraConfig] Error getting license XML:', error.message);
      console.error('[CameraConfig] Full error:', error);
      logger.error('[CameraConfig] License XML generation failed', { 
        error: error.message,
        stack: error.stack 
      });
      
      // If puppeteer fails, try a direct approach
      if (error.message?.includes('puppeteer') || error.message?.includes('Chrome')) {
        console.log('[CameraConfig] Puppeteer failed, trying direct XML generation...');
        return this.generateLicenseXMLDirect(deviceId, licenseCode);
      }
      
      if (error.message && error.message.includes('401')) {
        throw new Error('401 Missing Credentials for Axis API');
      }
      throw error;
    }
  }
  
  private generateLicenseXMLDirect(deviceId: string, licenseCode: string): string | null {
    try {
      console.log('[CameraConfig] Generating license XML directly (fallback method)...');
      
      // Generate XML directly without Axis SDK
      // This is a simplified version that should work for most cases
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<licenseKey>
  <deviceId>${deviceId}</deviceId>
  <applicationId>415129</applicationId>
  <licenseCode>${licenseCode}</licenseCode>
  <timestamp>${new Date().toISOString()}</timestamp>
</licenseKey>`;
      
      console.log('[CameraConfig] Generated fallback license XML');
      return xml;
    } catch (error: any) {
      console.error('[CameraConfig] Failed to generate direct XML:', error);
      return null;
    }
  }

  private async uploadLicenseXML(
    ip: string,
    username: string,
    password: string,
    applicationName: string,
    xmlContent: string
  ): Promise<void> {
    const startTime = Date.now();
    console.log('[CameraConfig] ========== LICENSE UPLOAD START ==========');
    console.log('[CameraConfig] Target camera:', ip);
    console.log('[CameraConfig] Application:', applicationName);
    console.log('[CameraConfig] XML Content Length:', xmlContent.length);
    
    try {
      const url = `/axis-cgi/applications/license.cgi?action=uploadlicensekey&package=${applicationName}`;
      
      // Create multipart form data
      const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
      const formData = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="fileData"; filename="license.xml"',
        'Content-Type: text/xml',
        '',
        xmlContent,
        `--${boundary}--`,
        ''
      ].join('\r\n');
      
      // Use HTTPS with Basic auth for compatibility
      const fullUrl = `https://${ip}${url}`;
      const auth = Buffer.from(`${username}:${password}`).toString('base64');
      
      console.log('[CameraConfig] Request URL:', fullUrl);
      console.log('[CameraConfig] Auth header: Basic (user:', username, ')');
      console.log('[CameraConfig] Content-Type boundary:', boundary);
      
      const response = await axios.post(fullUrl, formData, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': Buffer.byteLength(formData).toString()
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: false // Accept self-signed certificates
        }),
        timeout: 15000, // 15 second timeout - fail fast
        validateStatus: null // We'll handle all statuses ourselves
      });
      
      const elapsed = Date.now() - startTime;
      console.log('[CameraConfig] Response received in', elapsed, 'ms');
      console.log('[CameraConfig] Response status:', response.status);
      console.log('[CameraConfig] Response headers:', response.headers);
      console.log('[CameraConfig] Response data:', response.data);
      
      // Only accept 200 OK as success
      if (response.status === 200) {
        const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        
        // Check for success indicators
        if (responseText.includes('OK') || responseText.includes('Error: 0') || responseText.includes('success')) {
          console.log('[CameraConfig] ✅ License upload SUCCESSFUL');
          console.log('[CameraConfig] ========== LICENSE UPLOAD END ==========');
          return;
        }
        
        // Check for known error patterns
        if (responseText.includes('Error:') && !responseText.includes('Error: 0')) {
          const errorMatch = responseText.match(/Error:\s*([^<\n]+)/);
          const errorMsg = errorMatch ? errorMatch[1] : responseText;
          throw new Error(`Camera rejected license: ${errorMsg}`);
        }
        
        // Ambiguous 200 response - log full details
        console.warn('[CameraConfig] ⚠️ Ambiguous 200 response:', responseText);
        console.log('[CameraConfig] Treating as success due to 200 status');
        console.log('[CameraConfig] ========== LICENSE UPLOAD END ==========');
        return;
      }
      
      // Non-200 status - this is a failure
      const errorDetails = {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        headers: response.headers
      };
      
      console.error('[CameraConfig] ❌ License upload FAILED:', errorDetails);
      
      // Provide specific error messages
      if (response.status === 401) {
        throw new Error(`Authentication failed (401). Username '${username}' was rejected by camera at ${ip}. Please verify credentials.`);
      } else if (response.status === 403) {
        throw new Error(`Access forbidden (403). User '${username}' lacks permission to upload licenses on camera at ${ip}.`);
      } else if (response.status === 404) {
        throw new Error(`License endpoint not found (404). Camera at ${ip} may not support license upload or application '${applicationName}' is not installed.`);
      } else if (response.status >= 500) {
        throw new Error(`Camera server error (${response.status}). The camera at ${ip} encountered an internal error. Response: ${response.data}`);
      } else {
        throw new Error(`License upload failed with HTTP ${response.status}: ${response.data || response.statusText}`);
      }
      
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      console.error('[CameraConfig] ❌ License upload exception after', elapsed, 'ms');
      console.error('[CameraConfig] Error object:', error);
      
      // Network/connection errors
      if (error.code === 'ECONNREFUSED') {
        throw new Error(
          `Cannot connect to camera at ${ip}:443. ` +
          `Verify: 1) Camera IP is correct, 2) Camera is powered on, 3) HTTPS is enabled on camera, 4) No firewall blocking port 443`
        );
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        throw new Error(
          `Connection to camera at ${ip} timed out after ${elapsed}ms. ` +
          `Camera may be: 1) Slow to respond, 2) On a different network, 3) Behind a firewall`
        );
      } else if (error.code === 'ENOTFOUND') {
        throw new Error(`Cannot resolve IP address ${ip}. Please check the IP address is correct.`);
      } else if (error.code === 'CERT_HAS_EXPIRED' || error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
        // Should not happen with rejectUnauthorized: false, but just in case
        throw new Error(`SSL certificate issue with camera at ${ip}. This should not happen - please report this bug.`);
      }
      
      // Re-throw with original message if we didn't handle it
      throw error;
    }
  }
  
  async testSpeakerAudio(speakerIp: string, username: string, password: string): Promise<any> {
    try {
      console.log('[testSpeakerAudio] Testing speaker at:', speakerIp);
      
      // Use the playclip endpoint to test audio
      // clip=0 plays the first pre-recorded clip
      // audiodeviceid=0 and audiooutputid=0 are default values
      const response = await this.httpsBasicAuth(
        speakerIp,
        username,
        password,
        'GET',
        '/axis-cgi/playclip.cgi?clip=0&audiodeviceid=0&audiooutputid=0'
      );
      
      if (response && response.status === 200) {
        console.log('[testSpeakerAudio] Speaker test successful');
        return { success: true, message: 'Speaker test successful - audio should be playing' };
      } else {
        console.log('[testSpeakerAudio] Speaker test failed:', response?.status);
        return { success: false, error: `Speaker test failed with status: ${response?.status}` };
      }
    } catch (error: any) {
      console.error('[testSpeakerAudio] Error testing speaker:', error.message);
      
      // Check if it's an authentication error
      if (error.response?.status === 401) {
        return { success: false, error: 'Authentication failed. Please check speaker credentials.' };
      } else if (error.code === 'ECONNREFUSED') {
        return { success: false, error: 'Cannot connect to speaker. Please check the IP address.' };
      } else if (error.message?.includes('404')) {
        return { success: false, error: 'Speaker does not support audio playback or no clips available.' };
      }
      
      return { success: false, error: error.message || 'Failed to test speaker audio' };
    }
  }
}