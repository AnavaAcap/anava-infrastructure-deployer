import { ipcMain } from 'electron';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import { Camera } from './cameraDiscoveryService';

export interface DeploymentResult {
  success: boolean;
  cameraId: string;
  ip: string;
  message: string;
  error?: string;
  firmwareVersion?: string;
  osVersion?: 'OS11' | 'OS12';
  selectedFile?: string;
  detectionMethod?: string;
  architectureDetected?: string;
  wasUncertain?: boolean;
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
    
    ipcMain.handle('deploy-acap-auto', async (_event, camera: Camera, availableAcaps: any[]) => {
      return this.deployACAPAuto(camera, availableAcaps);
    });
    
    ipcMain.handle('uninstall-acap', async (_event, camera: Camera, appName: string) => {
      return this.uninstallACAP(camera, appName);
    });
    
    ipcMain.handle('list-installed-acaps', async (_event, camera: Camera) => {
      return this.listInstalledACAPs(camera);
    });
    
    ipcMain.handle('get-camera-firmware', async (_event, camera: Camera) => {
      return this.getCameraFirmwareInfo(camera);
    });
  }

  async getCameraFirmwareInfo(camera: Camera): Promise<{ firmwareVersion: string; osVersion: 'OS11' | 'OS12'; architecture?: string; detectionMethod?: string }> {
    try {
      const credentials = camera.credentials;
      if (!credentials || !credentials.username || !credentials.password) {
        throw new Error('Camera credentials are required');
      }
      
      const firmwareVersion = await this.getFirmwareVersion(camera.ip, credentials.username, credentials.password);
      const isOS12 = this.isOS12Firmware(firmwareVersion);
      
      // Try multiple methods to detect architecture
      let architecture: string | undefined;
      let detectionMethod = 'Unknown';
      
      try {
        // Method 1: Try the specific Architecture property
        console.log(`[getCameraFirmwareInfo] Attempting to detect architecture for camera ${camera.ip}...`);
        const archResponse = await this.digestAuth(
          camera.ip,
          credentials.username,
          credentials.password,
          'GET',
          '/axis-cgi/param.cgi?action=list&group=Properties.System.Architecture'
        );
        
        if (archResponse && archResponse.data) {
          const data = String(archResponse.data);
          const archMatch = data.match(/Properties\.System\.Architecture=([^\r\n]+)/);
          if (archMatch) {
            const detectedArch = archMatch[1].toLowerCase().trim();
            // Normalize architecture names
            architecture = this.normalizeArchitecture(detectedArch);
            detectionMethod = 'Properties.System.Architecture';
            console.log(`[getCameraFirmwareInfo] ✓ Architecture detected via direct property: ${architecture} (raw: ${detectedArch})`);
          }
        }
      } catch (error) {
        console.log('[getCameraFirmwareInfo] Architecture property not available, trying alternative methods...');
      }
      
      // Method 2: Try to get from full system properties
      if (!architecture) {
        try {
          const response = await this.digestAuth(
            camera.ip,
            credentials.username,
            credentials.password,
            'GET',
            '/axis-cgi/param.cgi?action=list&group=Properties.System'
          );
          
          if (response && response.data) {
            const data = String(response.data);
            
            // Check for Architecture in system properties
            const archMatch = data.match(/Properties\.System\.Architecture=([^\r\n]+)/);
            if (archMatch) {
              const detectedArch = archMatch[1].toLowerCase().trim();
              architecture = this.normalizeArchitecture(detectedArch);
              detectionMethod = 'Properties.System';
              console.log(`[getCameraFirmwareInfo] ✓ Architecture detected via system properties: ${architecture} (raw: ${detectedArch})`);
            }
            
            // Method 3: Infer from SOC if architecture still not found
            if (!architecture) {
              const socMatch = data.match(/Properties\.System\.Soc=([^\r\n]+)/);
              if (socMatch) {
                const soc = socMatch[1].toUpperCase();
                console.log(`[getCameraFirmwareInfo] System on Chip detected: ${soc}`);
                
                // Comprehensive SOC to architecture mapping
                if (soc.includes('CV25') || soc.includes('ARTPEC-8') || soc.includes('ARTPEC8')) {
                  architecture = 'aarch64';
                  detectionMethod = `Inferred from SOC (${soc})`;
                } else if (soc.includes('ARTPEC-7') || soc.includes('ARTPEC7')) {
                  architecture = 'armv7hf';
                  detectionMethod = `Inferred from SOC (${soc})`;
                } else if (soc.includes('ARTPEC-6') || soc.includes('ARTPEC6')) {
                  architecture = 'armv7hf';
                  detectionMethod = `Inferred from SOC (${soc})`;
                } else if (soc.includes('AMBARELLA') || soc.includes('S5L')) {
                  architecture = 'aarch64';
                  detectionMethod = `Inferred from SOC (${soc})`;
                } else if (soc.includes('HI3516') || soc.includes('HI3519')) {
                  architecture = 'armv7hf';
                  detectionMethod = `Inferred from SOC (${soc})`;
                }
                
                if (architecture) {
                  console.log(`[getCameraFirmwareInfo] ✓ Architecture inferred from SOC: ${architecture}`);
                }
              }
            }
          }
        } catch (error) {
          console.log('[getCameraFirmwareInfo] Could not access system properties');
        }
      }
      
      // Method 4: Try to infer from model number if available
      if (!architecture) {
        try {
          const brandResponse = await this.digestAuth(
            camera.ip,
            credentials.username,
            credentials.password,
            'GET',
            '/axis-cgi/param.cgi?action=list&group=Brand'
          );
          
          if (brandResponse && brandResponse.data) {
            const data = String(brandResponse.data);
            const modelMatch = data.match(/Brand\.ProdNbr=([^\r\n]+)/);
            if (modelMatch) {
              const model = modelMatch[1].trim();
              console.log(`[getCameraFirmwareInfo] Camera model: ${model}`);
              
              // Model-based architecture inference
              // Newer models (2020+) typically use aarch64
              // Older models typically use armv7hf
              const modelYear = this.inferModelYear(model);
              if (modelYear >= 2020) {
                architecture = 'aarch64';
                detectionMethod = `Inferred from model ${model} (year ${modelYear})`;
              } else if (modelYear > 0) {
                architecture = 'armv7hf';
                detectionMethod = `Inferred from model ${model} (year ${modelYear})`;
              }
              
              if (architecture) {
                console.log(`[getCameraFirmwareInfo] ✓ Architecture inferred from model: ${architecture}`);
              }
            }
          }
        } catch (error) {
          console.log('[getCameraFirmwareInfo] Could not get model information');
        }
      }
      
      // Final fallback with warning
      if (!architecture) {
        architecture = 'aarch64';
        detectionMethod = 'Default (detection failed)';
        console.warn(`[getCameraFirmwareInfo] ⚠ WARNING: Could not detect architecture for camera ${camera.ip}, defaulting to ${architecture}`);
        console.warn(`[getCameraFirmwareInfo] ⚠ This may cause ACAP deployment to fail if incorrect`);
      }
      
      console.log(`[getCameraFirmwareInfo] Final detection result: architecture=${architecture}, method=${detectionMethod}`);
      
      return {
        firmwareVersion,
        osVersion: isOS12 ? 'OS12' : 'OS11',
        architecture,
        detectionMethod
      };
    } catch (error: any) {
      throw new Error(`Failed to get firmware info: ${error.message}`);
    }
  }

  private normalizeArchitecture(arch: string): string {
    const normalized = arch.toLowerCase().trim();
    
    // Map various architecture names to standard ones
    const archMap: { [key: string]: string } = {
      'aarch64': 'aarch64',
      'arm64': 'aarch64',
      'arm64-v8': 'aarch64',
      'armv8': 'aarch64',
      'armv8-a': 'aarch64',
      'armv7hf': 'armv7hf',
      'armv7l': 'armv7hf',
      'armv7': 'armv7hf',
      'armhf': 'armv7hf',
      'arm': 'armv7hf',
      'x86_64': 'x86_64',
      'x64': 'x86_64',
      'amd64': 'x86_64',
      'i386': 'i386',
      'i686': 'i386',
      'x86': 'i386'
    };
    
    return archMap[normalized] || normalized;
  }

  private inferModelYear(model: string): number {
    // Extract potential year from model number
    // Many Axis models include year indicators
    const yearPatterns = [
      /P(\d{2})(\d{2})/, // PXX2X format (e.g., P3245 = 2020)
      /M(\d{2})(\d{2})/, // MXX2X format
      /Q(\d{2})(\d{2})/, // QXX2X format
    ];
    
    for (const pattern of yearPatterns) {
      const match = model.match(pattern);
      if (match) {
        const series = parseInt(match[1], 10);
        const yearIndicator = parseInt(match[2], 10);
        
        // Rough estimation based on series and year indicator
        if (series >= 32) { // 3200+ series
          if (yearIndicator >= 40) return 2020;
          if (yearIndicator >= 30) return 2018;
          if (yearIndicator >= 20) return 2016;
        }
      }
    }
    
    // Check for specific known model ranges
    const modelNum = parseInt(model.replace(/\D/g, ''), 10);
    if (modelNum >= 3245) return 2020;
    if (modelNum >= 3225) return 2018;
    if (modelNum >= 3215) return 2016;
    
    return 0; // Unknown year
  }

  async deployACAPAuto(camera: Camera, availableAcaps: any[]): Promise<DeploymentResult> {
    try {
      console.log(`[deployACAPAuto] ========== AUTO DEPLOYMENT STARTING ==========`);
      console.log(`[deployACAPAuto] Available ACAPs:`, availableAcaps.map(a => a.filename));
      
      // Get camera firmware info with enhanced detection
      const firmwareInfo = await this.getCameraFirmwareInfo(camera);
      console.log(`[deployACAPAuto] Camera firmware: ${firmwareInfo.firmwareVersion} (${firmwareInfo.osVersion})`);
      console.log(`[deployACAPAuto] Camera architecture: ${firmwareInfo.architecture}`);
      console.log(`[deployACAPAuto] Detection method: ${firmwareInfo.detectionMethod}`);
      
      // Check if architecture detection was uncertain
      const isUncertainDetection = firmwareInfo.detectionMethod?.includes('Default') || 
                                   firmwareInfo.detectionMethod?.includes('Inferred');
      
      // Find matching ACAP for this camera
      const osVersionLower = firmwareInfo.osVersion.toLowerCase();
      const architecture = firmwareInfo.architecture || 'aarch64';
      
      // First try exact match with flexible patterns
      let matchingAcap = availableAcaps.find(acap => {
        const filename = acap.filename.toLowerCase();
        
        // Handle different naming patterns:
        // - signed_Anava_-_Analyze_3_8_1_aarch64_os12.eap
        // - anava-baton-os12-aarch64.eap
        // - BatonAnalytic_os12_aarch64.eap
        
        // Check for OS version (os11, os12)
        const hasCorrectOS = filename.includes(osVersionLower) || 
                            filename.includes(osVersionLower.replace('os', 'os_')) ||
                            filename.includes(osVersionLower.replace('os', '_os'));
        
        // Check for architecture
        const hasCorrectArch = filename.includes(architecture.toLowerCase()) ||
                              filename.includes(`_${architecture.toLowerCase()}_`) ||
                              filename.includes(`_${architecture.toLowerCase()}.`) ||
                              filename.includes(`-${architecture.toLowerCase()}-`) ||
                              filename.includes(`-${architecture.toLowerCase()}.`);
        
        console.log(`[deployACAPAuto] Checking ${acap.filename}: OS match=${hasCorrectOS}, Arch match=${hasCorrectArch}`);
        return hasCorrectOS && hasCorrectArch && acap.isDownloaded;
      });
      
      // If no exact match and detection was uncertain, show warning
      if (!matchingAcap && isUncertainDetection) {
        console.warn(`[deployACAPAuto] ⚠ No exact match found and architecture detection was uncertain`);
        
        // Try to find any ACAP with matching OS version
        const osMatchingAcaps = availableAcaps.filter(acap => {
          const filename = acap.filename.toLowerCase();
          return filename.includes(osVersionLower) && acap.isDownloaded;
        });
        
        if (osMatchingAcaps.length > 0) {
          // Create error message with available options
          const availableArchitectures = osMatchingAcaps.map(a => {
            const match = a.filename.match(/(aarch64|armv7hf|x86_64|i386)/i);
            return match ? match[1] : 'unknown';
          }).filter((v, i, a) => a.indexOf(v) === i); // unique values
          
          const errorMsg = `Camera architecture could not be reliably detected.\n` +
                          `Detected: ${architecture} (${firmwareInfo.detectionMethod})\n` +
                          `Available architectures for ${firmwareInfo.osVersion}: ${availableArchitectures.join(', ')}\n\n` +
                          `Please verify your camera's architecture and manually select the correct ACAP file.\n` +
                          `You can check the architecture by:\n` +
                          `1. Looking up your camera model specifications\n` +
                          `2. Checking the camera's web interface system information\n` +
                          `3. Running the test script: node test-camera-architecture-detection.js ${camera.ip} <username> <password>`;
          
          throw new Error(errorMsg);
        }
      }
      
      if (!matchingAcap) {
        // Try fallback patterns
        const fallbackPatterns = [
          // Try without strict architecture match for common cases
          { os: osVersionLower, arch: 'aarch64' },
          { os: osVersionLower, arch: 'armv7hf' }
        ];
        
        for (const pattern of fallbackPatterns) {
          matchingAcap = availableAcaps.find(acap => {
            const filename = acap.filename.toLowerCase();
            return filename.includes(pattern.os) && 
                   filename.includes(pattern.arch) && 
                   acap.isDownloaded;
          });
          
          if (matchingAcap) {
            console.warn(`[deployACAPAuto] ⚠ Using fallback match: ${matchingAcap.filename}`);
            break;
          }
        }
      }
      
      if (!matchingAcap) {
        const errorMsg = `No suitable ACAP found for camera:\n` +
                        `- Firmware: ${firmwareInfo.firmwareVersion}\n` +
                        `- OS Version: ${firmwareInfo.osVersion}\n` +
                        `- Architecture: ${architecture} (${firmwareInfo.detectionMethod})\n\n` +
                        `Available ACAPs:\n${availableAcaps.map(a => `  - ${a.filename} (${a.isDownloaded ? 'downloaded' : 'not downloaded'})`).join('\n')}\n\n` +
                        `Please download the correct ACAP version for your camera.`;
        throw new Error(errorMsg);
      }
      
      // If detection was uncertain, add warning to result
      if (isUncertainDetection) {
        console.warn(`[deployACAPAuto] ⚠ Proceeding with ${matchingAcap.filename} but architecture detection was uncertain`);
      }
      
      console.log(`[deployACAPAuto] Selected ACAP: ${matchingAcap.filename}`);
      
      // Get the local path and deploy
      const acapPath = path.join(os.tmpdir(), 'anava-acaps', matchingAcap.filename);
      const deployResult = await this.deployACAP(camera, acapPath);
      
      // Add the selected filename and detection info to the result
      if (deployResult.success) {
        return {
          ...deployResult,
          selectedFile: matchingAcap.filename,
          detectionMethod: firmwareInfo.detectionMethod,
          architectureDetected: architecture,
          wasUncertain: isUncertainDetection
        };
      }
      return deployResult;
      
    } catch (error: any) {
      console.error(`[deployACAPAuto] ========== AUTO DEPLOYMENT FAILED ==========`);
      console.error(`[deployACAPAuto] Error:`, error);
      return {
        success: false,
        cameraId: camera.id,
        ip: camera.ip,
        message: 'Auto deployment failed',
        error: error.message
      };
    }
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

      // Detect firmware version to determine OS11 vs OS12
      const firmwareVersion = await this.getFirmwareVersion(camera.ip, credentials.username, credentials.password);
      console.log(`[ACAPDeployment] Camera firmware version: ${firmwareVersion}`);
      
      // Determine if this is OS12 (firmware 11.x or higher) or OS11 (firmware 10.x or lower)
      const isOS12 = this.isOS12Firmware(firmwareVersion);
      console.log(`[ACAPDeployment] Camera is running ${isOS12 ? 'OS12' : 'OS11'} based on firmware ${firmwareVersion}`);

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
          message: 'ACAP deployed successfully',
          firmwareVersion,
          osVersion: isOS12 ? 'OS12' : 'OS11'
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

  private async getFirmwareVersion(ip: string, username: string, password: string): Promise<string> {
    try {
      console.log('[getFirmwareVersion] Fetching firmware version from camera...');
      const response = await this.digestAuth(
        ip,
        username,
        password,
        'GET',
        '/axis-cgi/param.cgi?action=list&group=Properties.Firmware.Version'
      );

      if (response && response.data) {
        const data = String(response.data);
        console.log('[getFirmwareVersion] Raw response:', data);
        
        // Parse firmware version from response
        // Format is typically: Properties.Firmware.Version=11.10.69
        const versionMatch = data.match(/Properties\.Firmware\.Version=([^\r\n]+)/);
        if (versionMatch) {
          const version = versionMatch[1].trim();
          console.log('[getFirmwareVersion] Extracted version:', version);
          return version;
        }
      }
      
      console.log('[getFirmwareVersion] Could not extract firmware version, defaulting to 10.0.0');
      return '10.0.0'; // Default to OS11 if we can't determine
    } catch (error: any) {
      console.error('[getFirmwareVersion] Error fetching firmware version:', error.message);
      return '10.0.0'; // Default to OS11 on error
    }
  }

  private isOS12Firmware(firmwareVersion: string): boolean {
    try {
      // Parse the major version number
      const parts = firmwareVersion.split('.');
      if (parts.length > 0) {
        const majorVersion = parseInt(parts[0], 10);
        // OS12 is firmware 11.x and higher
        // OS11 is firmware 10.x and lower
        const isOS12 = majorVersion >= 11;
        console.log(`[isOS12Firmware] Firmware ${firmwareVersion} major version ${majorVersion} -> ${isOS12 ? 'OS12' : 'OS11'}`);
        return isOS12;
      }
    } catch (error) {
      console.error('[isOS12Firmware] Error parsing firmware version:', error);
    }
    return false; // Default to OS11 if parsing fails
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
      // Always use HTTPS with Basic auth for security
      const url = `https://${ip}${uri}`;
      const httpsAgent = new https.Agent({ rejectUnauthorized: false });
      
      // Use Basic auth directly
      const auth = Buffer.from(`${username}:${password}`).toString('base64');
      const form = formFactory();
      const config: any = {
        method,
        url,
        httpsAgent,
        timeout: options.timeout || 300000,
        data: form,
        headers: {
          ...form.getHeaders(),
          'Authorization': `Basic ${auth}`,
          ...options.headers
        },
        ...options
      };

      console.log(`[digestAuthWithFormFactory] ${method} ${url}`);
      console.log('[digestAuthWithFormFactory] Making request with Basic auth...');
      const response = await axios(config);
      
      if (response.status === 200 || response.status === 204) {
        console.log('[digestAuthWithFormFactory] Basic auth successful');
        return response;
      } else {
        throw new Error(`Request failed with status ${response.status}`);
      }
    } catch (error: any) {
      console.error('[digestAuthWithFormFactory] Error:', error.message);
      if (error.code) {
        console.error('[digestAuthWithFormFactory] Error code:', error.code);
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
      // Always use HTTPS with Basic auth for security
      const url = `https://${ip}${uri}`;
      const httpsAgent = new https.Agent({ rejectUnauthorized: false });
      
      // Use Basic auth directly
      const auth = Buffer.from(`${username}:${password}`).toString('base64');
      
      const config: any = {
        method,
        url,
        httpsAgent,
        timeout: options.timeout || 300000, // 5 minutes for large file uploads
        headers: {
          'Authorization': `Basic ${auth}`,
          ...options.headers
        },
        ...options
      };

      if (data) {
        config.data = data;
      }

      console.log(`[basicAuth] ${method} ${url}`);
      console.log('[basicAuth] Making request with Basic auth...');
      const response = await axios(config);
      
      if (response.status === 200 || response.status === 204) {
        console.log('[basicAuth] Response status:', response.status);
        return response;
      } else {
        throw new Error(`Request failed with status ${response.status}`);
      }
    } catch (error: any) {
      console.error('[basicAuth] Error:', error.message);
      if (error.code) {
        console.error('[basicAuth] Error code:', error.code);
      }
      throw error;
    }
  }
}
