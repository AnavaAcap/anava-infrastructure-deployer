import { app, ipcMain, WebContents } from 'electron';
import axios, { AxiosInstance } from 'axios';
import { spawn } from 'child_process';
import os from 'os';
import crypto from 'crypto';
import net from 'net';
import https from 'https';
import { macOSNetworkPermission } from '../macOSNetworkPermission';
import { safeConsole } from '../../utils/safeConsole';

// Enhanced logging for debugging network issues
const log = {
  info: (msg: string, ...args: any[]) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] INFO: ${msg}`, ...args);
    safeConsole.log(msg, ...args);
  },
  warn: (msg: string, ...args: any[]) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] WARN: ${msg}`, ...args);
    safeConsole.warn(msg, ...args);
  },
  error: (msg: string, ...args: any[]) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ERROR: ${msg}`, ...args);
    safeConsole.error(msg, ...args);
  },
  debug: (msg: string, ...args: any[]) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] DEBUG: ${msg}`, ...args);
  }
};
import { getCameraBaseUrl } from './cameraProtocolUtils';

// Dynamic imports for ESM modules
let PQueue: any;
let Bonjour: any;

// Initialize ESM modules
async function initializeModules() {
  try {
    const pQueueModule = await import('p-queue');
    PQueue = pQueueModule.default;
  } catch (err) {
    // Fallback to older version if available
    PQueue = require('p-queue').default || require('p-queue');
  }
  
  Bonjour = require('bonjour-service').Bonjour || require('bonjour-service');
}

export interface Camera {
  id: string;
  ip: string;
  port: number;
  protocol: 'http' | 'https';
  type: string;
  model: string;
  manufacturer: string;
  mac: string | null;
  capabilities: string[];
  discoveredAt: string;
  discoveryMethod: 'scan' | 'mdns' | 'ssdp' | 'manual';
  status: 'accessible' | 'requires_auth' | 'error';
  credentials?: {
    username: string;
    password: string;
  };
  rtspUrl?: string;
  httpUrl: string;
  httpsUrl?: string;
  authenticated?: boolean;
  error?: string;
  speaker?: {
    ip: string;
    username: string;
    password: string;
    authenticated: boolean;
  };
}

interface DiscoveryOptions {
  networkRange?: string;
  concurrent?: number;
  timeout?: number;
  ports?: number[];
  useServiceDiscovery?: boolean;
  credentials?: Array<{ username: string; password: string }>;
}

const DEFAULT_CAMERA_PORTS = {
  priority: [443, 80],        // Check first (90% of cameras)
  common: [8080, 8000],       // Then these (8% of cameras)  
  extended: [8443, 81, 8081]  // Finally these (2% of cameras)
};

// Credentials should be provided by the user, not hardcoded

export class OptimizedCameraDiscoveryService {
  private axiosInstance: AxiosInstance;
  private preDiscoveredCameras: Camera[] = [];
  private preDiscoveredSpeakers: Array<{ ip: string; username: string; password: string; authenticated: boolean }> = [];
  private preDiscoveredAxisDevices: string[] = []; // Just store IPs of confirmed Axis devices
  private isPreDiscovering = false;
  private preDiscoveryComplete = false;
  private hasShownNetworkPermissionDialog = false;
  private networkPermissionDenied = false;
  private modulesInitialized = false;

  private async initializeDiscovery() {
    // Initialize modules first
    if (!this.modulesInitialized) {
      await initializeModules();
      this.modulesInitialized = true;
    }
    
    // Platform-specific permission handling
    if (process.platform === 'darwin') {
      // macOS 15+ permission handling
      const version = process.getSystemVersion?.() || '0.0.0';
      const majorVersion = parseInt(version.split('.')[0]);
      
      if (majorVersion >= 15) {
        // Wait a bit for permission to be granted
        setTimeout(() => {
          this.startPreDiscovery();
        }, 3000);
        return;
      }
    } else if (process.platform === 'win32') {
      // Windows-specific initialization
      // Log Windows version for debugging
      const os = require('os');
      log.info(`[Windows] Running on ${os.release()} - ${os.version()}`);
      
      // CRITICAL: Windows Firewall WILL block network scanning until allowed
      log.warn('[Windows] IMPORTANT: When Windows Firewall prompts, click "Allow access" or scanning will fail!');
      log.info('[Windows] If scanning fails, try running as Administrator');
    }
    
    // Start discovery immediately on all platforms
    this.startPreDiscovery();
  }

  constructor() {
    // Create axios instance that accepts self-signed certificates
    this.axiosInstance = axios.create({
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    });
    
    this.setupIPC();
    
    // Initialize modules and start discovery asynchronously
    this.initializeDiscovery().catch(err => {
      safeConsole.error('Failed to initialize discovery:', err);
    });
  }

  private setupIPC() {
    // Get pre-discovered cameras if available
    ipcMain.handle('get-pre-discovered-cameras', async () => {
      console.log('[Pre-Discovery] Returning pre-discovered cameras:', this.preDiscoveredCameras.length);
      console.log('[Pre-Discovery] Returning pre-discovered speakers:', this.preDiscoveredSpeakers.length);
      console.log('[Pre-Discovery] Axis devices found (not classified):', this.preDiscoveredAxisDevices.length);
      return {
        cameras: this.preDiscoveredCameras,
        speakers: this.preDiscoveredSpeakers,
        axisDevices: this.preDiscoveredAxisDevices, // Unclassified Axis device IPs
        isComplete: this.preDiscoveryComplete,
        isDiscovering: this.isPreDiscovering
      };
    });
    
    // Clear pre-discovered cache for fresh scans
    ipcMain.handle('clear-pre-discovered-cameras', async () => {
      console.log('[Pre-Discovery] Clearing pre-discovered cache');
      this.preDiscoveredCameras = [];
      this.preDiscoveredSpeakers = [];
      this.preDiscoveredAxisDevices = [];
      this.networkPermissionDenied = false;
      this.hasShownNetworkPermissionDialog = false;
      return { success: true };
    });
    
    ipcMain.handle('get-pre-discovered-speakers', async () => {
      console.log('[Pre-Discovery] Returning pre-discovered speakers:', this.preDiscoveredSpeakers.length);
      return {
        speakers: this.preDiscoveredSpeakers,
        isComplete: this.preDiscoveryComplete,
        isDiscovering: this.isPreDiscovering
      };
    });
    
    // Classify pre-discovered Axis devices with credentials
    ipcMain.handle('classify-axis-devices', async (_event, credentials: { username: string; password: string }) => {
      console.log(`[Classify] Classifying ${this.preDiscoveredAxisDevices.length} Axis devices with provided credentials`);
      
      const cameras: Camera[] = [];
      const speakers: Array<{ ip: string; model?: string; authenticated: boolean }> = [];
      
      for (const ip of this.preDiscoveredAxisDevices) {
        try {
          // Try to authenticate and get device info
          const response = await this.digestAuth(
            ip,
            credentials.username,
            credentials.password,
            '/axis-cgi/param.cgi?action=list&group=Brand',
            80,
            'http'
          );
          
          if (response && (response.includes('Brand=AXIS') || response.includes('root.Brand.Brand=AXIS'))) {
            // Extract product type and model
            const typeMatch = response.match(/(?:root\.Brand\.)?ProdType=([^\r\n]+)/);
            const modelMatch = response.match(/(?:root\.Brand\.)?ProdNbr=([^\r\n]+)/);
            const productType = typeMatch ? typeMatch[1] : '';
            const model = modelMatch ? modelMatch[1] : 'Unknown';
            
            // Check if it's a speaker
            if (productType.toLowerCase().includes('speaker') || 
                productType.toLowerCase().includes('audio') ||
                productType.toLowerCase().includes('sound')) {
              console.log(`  ✓ ${ip} is a speaker: ${model}`);
              speakers.push({
                ip,
                model,
                authenticated: true
              });
              
              // Update global cache
              if (!this.preDiscoveredSpeakers.some(s => s.ip === ip)) {
                this.preDiscoveredSpeakers.push({
                  ip,
                  username: credentials.username,
                  password: credentials.password,
                  authenticated: true
                });
              }
            } else {
              console.log(`  ✓ ${ip} is a camera: ${model}`);
              const camera: Camera = {
                id: `camera-${ip.replace(/\./g, '-')}`,
                ip,
                port: 80,
                protocol: 'http',
                type: 'Axis Camera',
                model,
                manufacturer: 'Axis Communications',
                mac: null,
                capabilities: ['HTTP', 'HTTPS', 'ACAP', 'VAPIX', 'RTSP'],
                discoveredAt: new Date().toISOString(),
                discoveryMethod: 'scan',
                status: 'accessible',
                credentials: { username: credentials.username, password: credentials.password },
                rtspUrl: `rtsp://${credentials.username}:${credentials.password}@${ip}:554/axis-media/media.amp`,
                httpUrl: await getCameraBaseUrl(ip, credentials.username, credentials.password),
                authenticated: true
              };
              cameras.push(camera);
              
              // Update global cache
              const existingIndex = this.preDiscoveredCameras.findIndex(c => c.ip === ip);
              if (existingIndex >= 0) {
                this.preDiscoveredCameras[existingIndex] = camera;
              } else {
                this.preDiscoveredCameras.push(camera);
              }
            }
          }
        } catch (error) {
          console.log(`  ✗ Failed to classify ${ip}: ${error}`);
        }
      }
      
      console.log(`[Classify] Found ${cameras.length} cameras and ${speakers.length} speakers`);
      return { cameras, speakers };
    });
    
    // Standard scan method for backward compatibility
    ipcMain.handle('scan-network-cameras', async (event, options?: { networkRange?: string }) => {
      // Use enhanced scanning by default
      return this.enhancedScanNetwork(event.sender, {
        networkRange: options?.networkRange,
        concurrent: 20,
        useServiceDiscovery: true,
        ports: [443, 80, 8080, 8000, 8443]
      });
    });
    
    ipcMain.handle('enhanced-scan-network', async (event, options?: DiscoveryOptions) => {
      return this.enhancedScanNetwork(event.sender, options);
    });
    
    ipcMain.handle('discover-service-cameras', async (event) => {
      return this.discoverViaServices(event.sender);
    });
    
    ipcMain.handle('quick-scan-camera', async (_event, ip: string, username: string, password: string) => {
      if (!username || !password) {
        throw new Error('Username and password are required');
      }
      return this.quickScanSpecificCamera(ip, username, password);
    });
    
    ipcMain.handle('test-camera-credentials', async (_event, cameraId: string, ip: string, username: string, password: string) => {
      console.log(`=== Testing credentials for camera ${cameraId} at ${ip} ===`);
      return this.testCameraCredentials(ip, username, password);
    });

    ipcMain.handle('get-network-interfaces', async () => {
      const interfaces = os.networkInterfaces();
      const result = [];
      
      for (const [name, addresses] of Object.entries(interfaces)) {
        if (addresses) {
          for (const address of addresses) {
            if (address.family === 'IPv4' && !address.internal) {
              const network = this.getNetworkAddress(address.address, address.netmask);
              result.push({
                interface: name,
                address: address.address,
                netmask: address.netmask,
                network: network,
                family: address.family,
                internal: address.internal
              });
            }
          }
        }
      }
      
      console.log('Network interfaces detected:', result);
      return result;
    });
  }

  async enhancedScanNetwork(sender?: WebContents, options?: DiscoveryOptions): Promise<Camera[]> {
    const startTime = Date.now();
    log.info('=== Starting enhanced network scan ===');
    log.info('Platform:', process.platform);
    log.info('Options:', JSON.stringify(options));
    
    // Critical: Check if we have network interfaces
    const testInterfaces = os.networkInterfaces();
    const hasValidInterface = Object.values(testInterfaces).some(ifaces => 
      ifaces?.some(i => i.family === 'IPv4' && !i.internal)
    );
    
    if (!hasValidInterface) {
      log.error('CRITICAL: No valid IPv4 network interfaces found!');
      log.error('Cannot perform network scan without network connection');
      return [];
    }
    
    // Check if we've already detected network permission issues
    // But allow retry after user might have granted permission
    if (this.networkPermissionDenied && process.platform === 'darwin') {
      console.log('Network permission was previously denied - retrying in case user granted it...');
      // Reset the flag to allow this scan attempt
      this.networkPermissionDenied = false;
      this.hasShownNetworkPermissionDialog = false;
    }
    
    const cameras: Camera[] = [];
    const discoveredIPs = new Set<string>();
    
    // Start with service discovery if enabled
    if (options?.useServiceDiscovery !== false) {
      console.log('Starting service discovery...');
      const serviceCameras = await this.discoverViaServices(sender);
      for (const camera of serviceCameras) {
        cameras.push(camera);
        discoveredIPs.add(camera.ip);
      }
      console.log(`Service discovery found ${serviceCameras.length} cameras`);
    }
    
    // Then do active scanning with unified camera/speaker detection
    const networks = this.getNetworksToScan(options?.networkRange);
    
    if (networks.length === 0) {
      log.error('No networks available for scanning!');
      return cameras;
    }
    
    log.info(`Active scanning ${networks.length} network(s)...`);
    const ports = options?.ports || [...DEFAULT_CAMERA_PORTS.priority, ...DEFAULT_CAMERA_PORTS.common];
    log.info(`Will scan ports: ${ports.join(', ')}`);
    
    for (const network of networks) {
      log.info(`\n--- Scanning network: ${network.network} (${network.interface}) ---`);
      const ips = this.getIPsInRange(network.network);
      log.info(`Generated ${ips.length} IPs to scan`);
      
      if (ips.length === 0) {
        log.warn(`No IPs generated for network ${network.network} - skipping`);
        continue;
      }
      
      // Log first few IPs for debugging
      log.debug(`First 5 IPs: ${ips.slice(0, 5).join(', ')}`);
      
      // Track what we've found on this network
      let networkCamera: Camera | null = null;
      let networkSpeaker: { ip: string; username: string; password: string; authenticated: boolean } | null = null;
      
      // Sequential scan for this network to find camera + speaker efficiently
      for (const ip of ips) {
        // Skip already discovered IPs
        if (discoveredIPs.has(ip)) continue;
        
        // If we already have both camera and speaker for this network, stop
        if (networkCamera && networkSpeaker) {
          console.log(`Found both camera and speaker on network ${network.network}, stopping scan`);
          break;
        }
        
        const credentials = options?.credentials || [];
        if (credentials.length === 0) {
          // Still check if port is open even without credentials
          log.debug(`No credentials for ${ip}, checking if Axis device...`);
          
          // Quick check if it's an Axis device
          for (const port of ports) {
            const isOpen = await this.checkTCPConnection(ip, port, 1000);
            if (isOpen) {
              log.info(`✓ Found open port ${port} on ${ip} - may be a camera`);
              discoveredIPs.add(ip);
              
              // Store as potential Axis device for later classification
              if (!this.preDiscoveredAxisDevices.includes(ip)) {
                this.preDiscoveredAxisDevices.push(ip);
              }
              break;
            }
          }
          continue;
        }
        const result = await this.scanIP(ip, ports, credentials, sender, networkSpeaker || undefined);
        
        if (result.camera) {
          networkCamera = result.camera;
          cameras.push(result.camera);
          discoveredIPs.add(ip);
          
          // If we already had a speaker, it's been attached to the camera
          if (networkSpeaker) {
            console.log(`Camera ${result.camera.ip} paired with previously found speaker ${networkSpeaker.ip}`);
          }
          
          // Send real-time update
          if (sender) {
            console.log(`[Camera Discovery] Sending camera-discovered event for ${result.camera.ip}, status: ${result.camera.status}, manufacturer: ${result.camera.manufacturer}`);
            sender.send('camera-discovered', result.camera);
          }
        } else if (result.speaker && !networkSpeaker) {
          networkSpeaker = result.speaker;
          console.log(`Found speaker ${result.speaker.ip}, continuing to look for camera on network ${network.network}`);
          
          // If we already have a camera on this network, attach the speaker
          if (networkCamera && !networkCamera.speaker) {
            networkCamera.speaker = networkSpeaker;
            console.log(`Attached speaker ${networkSpeaker.ip} to existing camera ${networkCamera.ip}`);
            
            // Send update
            if (sender) {
              sender.send('camera-discovered', networkCamera);
            }
          }
        }
      }
      
      if (!networkCamera) {
        console.log(`No camera found on network ${network.network}`);
      }
      if (!networkSpeaker) {
        console.log(`No speaker found on network ${network.network}`);
      }
    }
    
    const endTime = Date.now();
    console.log(`=== Scan complete in ${(endTime - startTime) / 1000}s. Total cameras: ${cameras.length} ===`);
    
    return cameras;
  }

  private async discoverViaServices(_sender?: WebContents): Promise<Camera[]> {
    const cameras: Camera[] = [];
    
    try {
      // Use mDNS/Bonjour discovery only (SSDP removed due to security vulnerability)
      const mdnsCameras = await this.discoverViaMDNS();
      cameras.push(...mdnsCameras);
      
      // De-duplicate by IP (in case multiple services advertise same camera)
      const uniqueCameras = new Map<string, Camera>();
      for (const camera of cameras) {
        uniqueCameras.set(camera.ip, camera);
      }
      
      return Array.from(uniqueCameras.values());
    } catch (error) {
      console.error('Service discovery error:', error);
      return cameras;
    }
  }

  private async discoverViaMDNS(): Promise<Camera[]> {
    return new Promise((resolve) => {
      const cameras: Camera[] = [];
      
      // Check if Bonjour is available (especially important on Windows)
      if (!Bonjour) {
        console.log('[mDNS] Bonjour service not available - skipping mDNS discovery');
        resolve([]);
        return;
      }
      
      let bonjour: any;
      try {
        bonjour = new Bonjour();
      } catch (error: any) {
        console.log(`[mDNS] Failed to initialize Bonjour: ${error.message}`);
        if (process.platform === 'win32') {
          console.log('[mDNS] Note: On Windows, Apple Bonjour service must be installed for mDNS discovery');
        }
        resolve([]);
        return;
      }
      
      // Common camera service types
      const serviceTypes = ['_axis-video._tcp', '_http._tcp', '_rtsp._tcp'];
      let servicesChecked = 0;
      
      const checkComplete = () => {
        servicesChecked++;
        if (servicesChecked === serviceTypes.length) {
          setTimeout(() => {
            bonjour.destroy();
            resolve(cameras);
          }, 2000); // Wait 2s for late responses
        }
      };
      
      for (const serviceType of serviceTypes) {
        const browser = bonjour.find({ type: serviceType });
        
        browser.on('up', async (service: any) => {
          console.log(`mDNS: Found service ${service.name} at ${service.host}:${service.port}`);
          
          // Check if it's an Axis camera
          if (service.txt?.manufacturer?.includes('Axis') || 
              service.name.toLowerCase().includes('axis') ||
              service.type === '_axis-video._tcp') {
            
            const camera = await this.checkAxisCamera(
              service.host || service.addresses?.[0],
              'root',
              'pass',
              service.port || 80,
              service.protocol || 'http'
            );
            
            if (camera) {
              camera.discoveryMethod = 'mdns';
              cameras.push(camera);
            }
          }
        });
        
        // Stop browsing after 3 seconds
        setTimeout(() => {
          browser.stop();
          checkComplete();
        }, 3000);
      }
    });
  }


  private async checkIfAxisDevice(ip: string, port: number = 80, protocol: 'http' | 'https' = 'http'): Promise<boolean> {
    try {
      const url = `${protocol}://${ip}:${port}/axis-cgi/param.cgi?action=list&group=Brand`;
      
      // Just check if the endpoint exists - 401 means it's an Axis device that needs auth
      const response = await this.axiosInstance.get(url, {
        timeout: 2000,
        validateStatus: () => true // Accept any status
      });
      
      // If we get 401 with Digest auth or 200 response, it's an Axis device
      if (response.status === 401) {
        const wwwAuth = response.headers['www-authenticate'];
        if (wwwAuth && wwwAuth.includes('Digest')) {
          console.log(`  ✓ Found Axis device at ${ip}:${port} (requires auth)`);
          return true;
        }
      } else if (response.status === 200) {
        // Somehow no auth required
        const data = response.data?.toString() || '';
        if (data.includes('Brand=AXIS') || data.includes('root.Brand.Brand=AXIS')) {
          console.log(`  ✓ Found Axis device at ${ip}:${port} (no auth required)`);
          return true;
        }
      }
    } catch (error) {
      // Connection failed - not an Axis device or not reachable
    }
    return false;
  }

  private async scanIP(
    ip: string,
    ports: number[],
    credentials: Array<{ username: string; password: string }>,
    sender?: WebContents,
    existingSpeaker?: { ip: string; username: string; password: string; authenticated: boolean }
  ): Promise<{ 
    camera?: Camera; 
    speaker?: { ip: string; username: string; password: string; authenticated: boolean } 
  }> {
    console.log(`Scanning ${ip}...`);
    
    // Send progress update
    if (sender) {
      sender.send('camera-scan-progress', { ip, status: 'scanning' });
    }
    
    // Check each port
    for (const port of ports) {
      const protocol = port === 443 || port === 8443 ? 'https' : 'http';
      
      if (await this.checkTCPConnection(ip, port, 1000)) {
        console.log(`  Found open port ${port} on ${ip}`);
        
        // Try each credential to identify what type of device this is
        for (const cred of credentials) {
          try {
            // First, try to get basic device info
            const response = await this.digestAuth(
              ip,
              cred.username,
              cred.password,
              '/axis-cgi/param.cgi?action=list&group=Brand',
              port,
              protocol
            );
            
            if (response && (response.includes('Brand=AXIS') || response.includes('root.Brand.Brand=AXIS'))) {
              // Handle both old and new response formats
              const typeMatch = response.match(/(?:root\.Brand\.)?ProdType=([^\r\n]+)/);
              const productType = typeMatch ? typeMatch[1] : '';
              
              // Check if it's a speaker
              if (productType.toLowerCase().includes('speaker') || 
                  productType.toLowerCase().includes('audio') ||
                  productType.toLowerCase().includes('sound')) {
                console.log(`  ✓ Found Axis speaker (${productType}) at ${ip}`);
                return {
                  speaker: {
                    ip,
                    username: cred.username,
                    password: cred.password,
                    authenticated: true
                  }
                };
              } else {
                // It's a camera
                const camera = await this.checkAxisCamera(ip, cred.username, cred.password, port, protocol);
                if (camera) {
                  console.log(`  ✓ Found camera at ${ip}:${port} with ${cred.username}:******`);
                  // If we already found a speaker, attach it to the camera
                  if (existingSpeaker) {
                    camera.speaker = existingSpeaker;
                  }
                  return { camera };
                }
              }
            }
          } catch (error) {
            // Try next credential
          }
        }
      }
    }
    
    return {};
  }

  async quickScanSpecificCamera(ip: string, username: string, password: string): Promise<Camera[]> {
    try {
      console.log(`=== Quick scanning camera at ${ip} ===`);
      console.log(`Environment: ${app.isPackaged ? 'PACKAGED' : 'DEVELOPMENT'}`);
      console.log(`NODE_TLS_REJECT_UNAUTHORIZED: ${process.env.NODE_TLS_REJECT_UNAUTHORIZED}`);
      
      // Try all common ports
      const ports = [...DEFAULT_CAMERA_PORTS.priority, ...DEFAULT_CAMERA_PORTS.common];
      let lastAuthError: string | null = null;
      let foundOpenPort = false;
      let connectionErrors: string[] = [];
      
      for (const port of ports) {
        // First check if port is open
        console.log(`  Checking port ${port}...`);
        const isOpen = await this.checkTCPConnection(ip, port, 2000);
        
        if (isOpen) {
          foundOpenPort = true;
          const protocol = port === 443 || port === 8443 ? 'https' : 'http';
          console.log(`  Port ${port} is open, trying ${protocol} protocol`);
          
          // Try to authenticate and get camera info
          const authResult = await this.checkAxisCameraWithError(ip, username, password, port, protocol);
          
          if (authResult.camera) {
            console.log(`✓ Found camera at ${ip}:${port}`);
            return [authResult.camera];
          } else if (authResult.error) {
            lastAuthError = authResult.error;
            console.log(`✗ Authentication failed on port ${port}: ${authResult.error}`);
          }
        } else {
          connectionErrors.push(`Port ${port} closed/timeout`);
        }
      }
      
      // Return a camera object with error status
      if (foundOpenPort && lastAuthError) {
        console.log(`✗ Camera found but authentication failed at ${ip}`);
        return [{
          id: `camera-${ip.replace(/\./g, '-')}`,
          ip: ip,
          port: 80,
          protocol: 'http',
          type: 'Unknown',
          model: 'Authentication Failed',
          manufacturer: 'Unknown',
          mac: null,
          capabilities: [],
          discoveredAt: new Date().toISOString(),
          discoveryMethod: 'manual',
          status: 'requires_auth',
          httpUrl: await getCameraBaseUrl(ip),  // Try HTTPS first
          authenticated: false,
          error: lastAuthError
        }];
      }
      
      console.log(`✗ No camera found at ${ip}`);
      console.log(`  Connection errors: ${connectionErrors.join(', ')}`);
      return [];
    } catch (error: any) {
      console.error(`Error scanning ${ip}:`, error.message);
      console.error(`  Stack: ${error.stack}`);
      return [{
        id: `camera-${ip.replace(/\./g, '-')}`,
        ip: ip,
        port: 80,
        protocol: 'http',
        type: 'Unknown',
        model: 'Connection Error',
        manufacturer: 'Unknown',
        mac: null,
        capabilities: [],
        discoveredAt: new Date().toISOString(),
        discoveryMethod: 'manual',
        status: 'error',
        httpUrl: await getCameraBaseUrl(ip),  // Try HTTPS first
        authenticated: false,
        error: error.message || 'Connection failed'
      }];
    }
  }

  async testCameraCredentials(ip: string, username: string, password: string) {
    try {
      console.log(`Testing credentials ${username}:****** for ${ip}`);
      
      // Find which port the camera is on
      const ports = [...DEFAULT_CAMERA_PORTS.priority, ...DEFAULT_CAMERA_PORTS.common];
      
      for (const port of ports) {
        if (await this.checkTCPConnection(ip, port, 1000)) {
          const protocol = port === 443 || port === 8443 ? 'https' : 'http';
          const result = await this.digestAuth(ip, username, password, '/axis-cgi/param.cgi?action=list&group=Brand', port, protocol);
          
          if (result && (result.includes('Brand=AXIS') || result.includes('root.Brand.Brand=AXIS'))) {
            console.log(`✓ Credentials work on port ${port}`);
            return {
              success: true,
              authenticated: true,
              message: 'Authentication successful',
              port,
              protocol
            };
          }
        }
      }
      
      return {
        success: false,
        authenticated: false,
        message: 'Authentication failed on all ports'
      };
    } catch (error: any) {
      console.error(`Error testing credentials:`, error.message);
      return {
        success: false,
        authenticated: false,
        message: `Error: ${error.message}`
      };
    }
  }

  private async checkAxisCameraWithError(
    ip: string,
    username: string,
    password: string,
    port = 80,
    protocol: 'http' | 'https' = 'http'
  ): Promise<{ camera: Camera | null; error: string | null }> {
    try {
      console.log(`  Checking Axis camera at ${protocol}://${ip}:${port}`);
      
      // Try to get device info with digest auth
      const authResult = await this.digestAuthWithError(
        ip,
        username,
        password,
        '/axis-cgi/param.cgi?action=list&group=Brand',
        port,
        protocol
      );
      
      if (authResult.data && (authResult.data.includes('Brand=AXIS') || authResult.data.includes('root.Brand.Brand=AXIS'))) {
        console.log(`  ✓ Confirmed Axis device at ${ip}`);
        // Handle both old and new response formats
        const modelMatch = authResult.data.match(/(?:root\.Brand\.)?ProdNbr=([^\r\n]+)/);
        const typeMatch = authResult.data.match(/(?:root\.Brand\.)?ProdType=([^\r\n]+)/);
        const productType = typeMatch ? typeMatch[1] : '';
        
        // Filter out non-camera devices
        if (productType.toLowerCase().includes('speaker') || 
            productType.toLowerCase().includes('audio') ||
            productType.toLowerCase().includes('sound')) {
          console.log(`  ✗ Not a camera - Found speaker device: ${productType} at ${ip}`);
          return { camera: null, error: 'Device is a speaker, not a camera' };
        }
        
        const camera: Camera = {
          id: `camera-${ip.replace(/\./g, '-')}-${port}`,
          ip: ip,
          port: port,
          protocol: protocol,
          type: 'Axis Camera',
          model: modelMatch ? modelMatch[1] : 'Unknown Model',
          manufacturer: 'Axis Communications',
          mac: await this.getMACAddress(ip),
          capabilities: ['HTTP', 'HTTPS', 'ACAP', 'VAPIX', 'RTSP'],
          discoveredAt: new Date().toISOString(),
          discoveryMethod: 'scan',
          status: 'accessible',
          credentials: { username, password },
          rtspUrl: `rtsp://${username}:${password}@${ip}:554/axis-media/media.amp`,
          httpUrl: `http://${ip}:${port === 80 ? '' : port}`,
          httpsUrl: protocol === 'https' ? `https://${ip}:${port === 443 ? '' : port}` : undefined,
          authenticated: true
        };
        
        return { camera, error: null };
      } else if (authResult.error) {
        return { camera: null, error: authResult.error };
      }
      
      return { camera: null, error: 'Not an Axis device' };
    } catch (error: any) {
      console.error(`  ✗ Error checking camera:`, error.message);
      return { camera: null, error: error.message || 'Connection failed' };
    }
  }

  private async checkAxisCamera(
    ip: string,
    username: string,
    password: string,
    port = 80,
    protocol: 'http' | 'https' = 'http'
  ): Promise<Camera | null> {
    try {
      console.log(`  Checking Axis camera at ${protocol}://${ip}:${port}`);
      
      // Try to get device info with digest auth
      const response = await this.digestAuth(
        ip,
        username,
        password,
        '/axis-cgi/param.cgi?action=list&group=Brand',
        port,
        protocol
      );
      
      if (response && (response.includes('Brand=AXIS') || response.includes('root.Brand.Brand=AXIS'))) {
        console.log(`  ✓ Confirmed Axis device at ${ip}`);
        // Handle both old and new response formats
        const modelMatch = response.match(/(?:root\.Brand\.)?ProdNbr=([^\r\n]+)/);
        const typeMatch = response.match(/(?:root\.Brand\.)?ProdType=([^\r\n]+)/);
        const productType = typeMatch ? typeMatch[1] : '';
        
        // Filter out non-camera devices
        if (productType.toLowerCase().includes('speaker') || 
            productType.toLowerCase().includes('audio') ||
            productType.toLowerCase().includes('sound')) {
          console.log(`  ✗ Not a camera - Found speaker device: ${productType} at ${ip}`);
          return null;
        }
        
        const camera: Camera = {
          id: `camera-${ip.replace(/\./g, '-')}-${port}`,
          ip: ip,
          port: port,
          protocol: protocol,
          type: 'Axis Camera',
          model: modelMatch ? modelMatch[1] : 'Unknown Model',
          manufacturer: 'Axis Communications',
          mac: await this.getMACAddress(ip),
          capabilities: ['HTTP', 'HTTPS', 'ACAP', 'VAPIX', 'RTSP'],
          discoveredAt: new Date().toISOString(),
          discoveryMethod: 'scan',
          status: 'accessible',
          credentials: { username, password },
          rtspUrl: `rtsp://${username}:${password}@${ip}:554/axis-media/media.amp`,
          httpUrl: `http://${ip}:${port === 80 ? '' : port}`,
          httpsUrl: protocol === 'https' ? `https://${ip}:${port === 443 ? '' : port}` : undefined,
          authenticated: true
        };
        
        return camera;
      }
      
      return null;
    } catch (error: any) {
      console.error(`  ✗ Error checking camera:`, error.message);
      return null;
    }
  }



  private async digestAuthWithError(
    ip: string,
    username: string,
    password: string,
    path: string,
    port = 80,
    protocol: 'http' | 'https' = 'http'
  ): Promise<{ data: string | null; error: string | null }> {
    try {
      const url = `${protocol}://${ip}:${port}${path}`;
      console.log(`    Attempting digest auth to ${url}`);
      
      // First request to get the digest challenge
      const response1 = await this.axiosInstance.get(url, {
        timeout: 5000,
        validateStatus: () => true
      });

      console.log(`    Initial response: ${response1.status}`);
      
      if (response1.status === 401) {
        const wwwAuth = response1.headers['www-authenticate'];
        
        if (wwwAuth && wwwAuth.includes('Digest')) {
          const digestData = this.parseDigestAuth(wwwAuth);
          const authHeader = this.buildDigestHeader(username, password, 'GET', path, digestData);
          
          const response2 = await this.axiosInstance.get(url, {
            headers: { 'Authorization': authHeader },
            timeout: 5000,
            validateStatus: () => true
          });

          console.log(`    Auth response: ${response2.status}`);
          
          if (response2.status === 200) {
            return { data: response2.data, error: null };
          } else if (response2.status === 401) {
            return { data: null, error: 'Invalid username or password' };
          } else {
            return { data: null, error: `HTTP ${response2.status}: ${response2.statusText}` };
          }
        } else {
          return { data: null, error: 'Device does not support digest authentication' };
        }
      } else if (response1.status === 200) {
        return { data: response1.data, error: null };
      } else {
        return { data: null, error: `HTTP ${response1.status}: ${response1.statusText}` };
      }
    } catch (error: any) {
      console.log(`    Auth error: ${error.message}`);
      if (error.code === 'ECONNREFUSED') {
        return { data: null, error: `Cannot connect to ${ip}:${port}` };
      } else if (error.code === 'ETIMEDOUT') {
        return { data: null, error: `Connection timeout to ${ip}:${port}` };
      } else if (process.platform === 'win32') {
        // Windows-specific error messages
        if (error.code === 'EACCES' || error.code === 'EPERM') {
          return { data: null, error: `Access denied to ${ip}:${port} - check Windows Firewall settings` };
        } else if (error.code === 'WSAEACCES') {
          return { data: null, error: `Windows socket access denied - firewall or antivirus may be blocking` };
        } else if (error.code === 'ENETUNREACH' || error.code === 'WSAENETUNREACH') {
          return { data: null, error: `Network unreachable to ${ip}:${port} - check network connection` };
        }
      }
      return { data: null, error: error.message || 'Connection failed' };
    }
  }

  private async digestAuth(
    ip: string,
    username: string,
    password: string,
    path: string,
    port = 80,
    protocol: 'http' | 'https' = 'http'
  ): Promise<string | null> {
    try {
      const url = `${protocol}://${ip}:${port}${path}`;
      console.log(`    Attempting digest auth to ${url}`);
      
      // First request to get the digest challenge
      const response1 = await this.axiosInstance.get(url, {
        timeout: 5000,
        validateStatus: () => true
      });

      console.log(`    Initial response: ${response1.status}`);
      
      if (response1.status === 401) {
        const wwwAuth = response1.headers['www-authenticate'];
        
        if (wwwAuth && wwwAuth.includes('Digest')) {
          const digestData = this.parseDigestAuth(wwwAuth);
          const authHeader = this.buildDigestHeader(username, password, 'GET', path, digestData);
          
          const response2 = await this.axiosInstance.get(url, {
            headers: { 'Authorization': authHeader },
            timeout: 5000
          });

          if (response2.status === 200) {
            return response2.data;
          }
        }
      } else if (response1.status === 200) {
        return response1.data;
      }
    } catch (error: any) {
      console.log(`    Auth error: ${error.message}`);
    }
    return null;
  }

  private parseDigestAuth(authHeader: string): any {
    const data: any = {};
    const regex = /(\w+)=(?:"([^"]+)"|([^,]+))/g;
    let match;
    
    while ((match = regex.exec(authHeader)) !== null) {
      data[match[1]] = match[2] || match[3];
    }
    
    return data;
  }

  private buildDigestHeader(username: string, password: string, method: string, uri: string, digestData: any): string {
    const nc = '00000001';
    const cnonce = crypto.randomBytes(8).toString('hex');
    
    const ha1 = crypto.createHash('md5').update(`${username}:${digestData.realm}:${password}`).digest('hex');
    const ha2 = crypto.createHash('md5').update(`${method}:${uri}`).digest('hex');
    const response = crypto.createHash('md5').update(`${ha1}:${digestData.nonce}:${nc}:${cnonce}:${digestData.qop}:${ha2}`).digest('hex');
    
    return `Digest username="${username}", realm="${digestData.realm}", nonce="${digestData.nonce}", uri="${uri}", qop=${digestData.qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"`;
  }

  private async checkTCPConnection(ip: string, port: number, timeout: number = 3000): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let resolved = false;
      let connected = false;

      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
        }
      };

      // CRITICAL FIX: Set socket-level timeout to prevent Windows Firewall hang
      // This ensures the socket will emit a 'timeout' event even if firewall blocks it
      socket.setTimeout(timeout);

      // Backup timer in case socket timeout doesn't fire
      const timer = setTimeout(() => {
        if (!resolved) {
          console.log(`    [FORCED] TCP timeout on ${ip}:${port} after ${timeout}ms (firewall may be blocking)`);
          cleanup();
          resolve(false);
        }
      }, timeout + 500); // Give socket timeout a chance to fire first

      socket.on('connect', () => {
        connected = true;
        console.log(`    ✓ TCP connected to ${ip}:${port}`);
        clearTimeout(timer);
        cleanup();
        resolve(true);
      });

      socket.on('error', async (err: any) => {
        console.log(`    ✗ TCP error on ${ip}:${port}: ${err.code || err.message}`);
        
        // Platform-specific error handling
        if (process.platform === 'darwin') {
          // Handle macOS 15 network permission issue
          if (err.code === 'EHOSTUNREACH' && !this.hasShownNetworkPermissionDialog) {
            console.log('EHOSTUNREACH detected - macOS 15 network permission may be needed');
            this.hasShownNetworkPermissionDialog = true;
            
            // Trigger the permission dialog
            await macOSNetworkPermission.showManualInstructions();
            
            // Mark that we need permission
            this.networkPermissionDenied = true;
          }
        } else if (process.platform === 'win32') {
          // Handle Windows-specific network errors
          // Let Windows Firewall handle prompts automatically
          if (err.code === 'EACCES' || err.code === 'EPERM') {
            console.log('[Windows] Access denied - Windows Firewall will prompt automatically');
          } else if (err.code === 'WSAEACCES') {
            console.log('[Windows] Socket access denied - check Windows Firewall');
          } else if (err.code === 'ENETUNREACH' || err.code === 'WSAENETUNREACH') {
            console.log('[Windows] Network unreachable');
          }
        }
        
        clearTimeout(timer);
        cleanup();
        resolve(false);
      });

      socket.on('timeout', () => {
        if (!resolved) {
          console.log(`    ⏱ TCP socket timeout on ${ip}:${port} (likely firewall blocking)`);
          clearTimeout(timer);
          cleanup();
          resolve(false);
        }
      });

      // Add 'close' event handler as additional safeguard
      socket.on('close', () => {
        if (!resolved && !connected) {
          console.log(`    Socket closed unexpectedly for ${ip}:${port}`);
          clearTimeout(timer);
          cleanup();
          resolve(false);
        }
      });

      try {
        console.log(`    → Attempting TCP connection to ${ip}:${port} (timeout: ${timeout}ms)`);
        
        // Use the options form of connect with explicit timeout
        socket.connect({
          port: port,
          host: ip,
          timeout: timeout // Redundant but explicit
        });
      } catch (e: any) {
        console.log(`    ✗ TCP connect exception: ${e.message}`);
        clearTimeout(timer);
        cleanup();
        resolve(false);
      }
    });
  }

  private async getMACAddress(ip: string): Promise<string | null> {
    try {
      const isWindows = process.platform === 'win32';
      const arpCommand = 'arp';
      const arpArgs = isWindows ? ['-a', ip] : ['-n', ip];
      
      const arp = spawn(arpCommand, arpArgs);
      
      return new Promise((resolve) => {
        let output = '';
        
        arp.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        arp.on('close', () => {
          const macMatch = output.match(/([0-9a-f]{2}[:-]){5}([0-9a-f]{2})/i);
          resolve(macMatch ? macMatch[0] : null);
        });
        
        setTimeout(() => {
          arp.kill();
          resolve(null);
        }, 2000);
      });
    } catch (error) {
      return null;
    }
  }

  private getNetworkAddress(ip: string, netmask: string): string {
    const ipParts = ip.split('.').map(Number);
    const maskParts = netmask.split('.').map(Number);
    
    const networkParts = ipParts.map((part, index) => part & maskParts[index]);
    
    // Calculate subnet bits correctly
    let subnetBits = 0;
    for (const part of maskParts) {
      if (part === 255) {
        subnetBits += 8;
      } else if (part > 0) {
        // Count the 1s in the partial octet
        let val = part;
        while (val > 0) {
          if (val & 0x80) {
            subnetBits++;
            val = (val << 1) & 0xFF;
          } else {
            break;
          }
        }
        break;
      } else {
        break;
      }
    }
    
    return networkParts.join('.') + '/' + subnetBits;
  }

  private getNetworksToScan(customRange?: string): any[] {
    const networks = [];
    
    if (customRange) {
      customRange.split('/');
      networks.push({
        interface: 'custom',
        network: customRange
      });
    } else {
      const networkInterfaces = os.networkInterfaces();
      const physicalFirst: any[] = [];
      const virtualLast: any[] = [];
      
      for (const [name, addresses] of Object.entries(networkInterfaces)) {
        if (addresses) {
          for (const address of addresses) {
            if (address.family === 'IPv4' && !address.internal) {
              const network = this.getNetworkAddress(address.address, address.netmask);
              const networkInfo = {
                interface: name,
                network: network,
                address: address.address
              };
              
              // Prioritize physical interfaces over virtual ones
              // Windows: 'Ethernet', 'Wi-Fi', 'Local Area Connection'
              // macOS/Linux: 'en0', 'eth0', 'wlan0'
              const isPhysical = 
                name.startsWith('en') || 
                name.startsWith('eth') || 
                name.startsWith('wlan') ||
                name.includes('Ethernet') ||
                name.includes('Wi-Fi') ||
                name.includes('Local Area Connection') ||
                name.includes('Wireless');
              
              // Exclude known virtual interfaces
              const isVirtual = 
                name.includes('VirtualBox') ||
                name.includes('VMware') ||
                name.includes('vEthernet') ||
                name.includes('Hyper-V') ||
                name.includes('Docker') ||
                name.includes('WSL') ||
                name.includes('Loopback');
              
              if (!isVirtual && isPhysical) {
                physicalFirst.push(networkInfo);
              } else if (!isVirtual) {
                virtualLast.push(networkInfo);
              }
              // Skip virtual interfaces entirely unless no physical found
            }
          }
        }
      }
      
      // Return physical interfaces first, then virtual ones
      networks.push(...physicalFirst, ...virtualLast);
      
      // Critical debugging info
      if (networks.length === 0) {
        log.error('NO NETWORK INTERFACES FOUND! Cannot scan.');
        log.error('Available interfaces:', JSON.stringify(networkInterfaces, null, 2));
      } else {
        log.info(`Found ${networks.length} network(s) to scan:`);
        networks.forEach(n => {
          log.info(`  - ${n.interface}: ${n.network} (IP: ${n.address})`);
        });
      }
    }
    
    return networks;
  }

  private getIPsInRange(networkCIDR: string): string[] {
    const [baseIp, subnetStr] = networkCIDR.split('/');
    const subnet = parseInt(subnetStr);
    const hostBits = 32 - subnet;
    const numHosts = Math.pow(2, hostBits);
    
    const startNum = this.ipToNumber(baseIp);
    const ips: string[] = [];
    
    // Skip network address and broadcast address
    for (let i = 1; i < numHosts - 1; i++) {
      ips.push(this.numberToIP(startNum + i));
    }
    
    return ips;
  }

  private ipToNumber(ip: string): number {
    return ip.split('.').reduce((num, octet) => {
      return (num << 8) + parseInt(octet);
    }, 0) >>> 0;
  }

  private numberToIP(num: number): string {
    return [
      (num >>> 24) & 255,
      (num >>> 16) & 255,
      (num >>> 8) & 255,
      num & 255
    ].join('.');
  }

  private shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Start pre-emptive camera discovery on app startup
   * This runs in the background and caches results for instant access
   */
  private async startPreDiscovery() {
    console.log('[Pre-Discovery] Starting pre-emptive camera discovery...');
    this.isPreDiscovering = true;
    let foundCamera = false;

    try {
      // First try service discovery (mDNS/SSDP) - this is often fastest
      console.log('[Pre-Discovery] Trying service discovery first...');
      const serviceTimeout = new Promise(resolve => setTimeout(() => resolve([]), 3000));
      const serviceCameras = await Promise.race([
        this.discoverViaServices(),
        serviceTimeout
      ]) as Camera[];

      for (const camera of serviceCameras) {
        if (camera.manufacturer?.toLowerCase().includes('axis')) {
          console.log(`[Pre-Discovery] Found Axis camera via service discovery at ${camera.ip}`);
          this.preDiscoveredCameras = [camera];
          foundCamera = true;
          return;
        }
      }

      // If no camera found via services, do targeted scanning
      const networks = this.getNetworksToScan();
      if (networks.length === 0) {
        console.log('[Pre-Discovery] No networks available for pre-discovery');
        return;
      }

      const primaryNetwork = networks[0];
      console.log(`[Pre-Discovery] Scanning primary network: ${primaryNetwork.network}`);

      // Check common camera IPs first (often cameras have predictable IPs)
      const ips = this.getIPsInRange(primaryNetwork.network);
      const commonCameraIPs = ips.filter(ip => {
        const lastOctet = parseInt(ip.split('.').pop() || '0');
        // Common camera IP patterns: .100-.200, .64, .88, .156
        return (lastOctet >= 100 && lastOctet <= 200) || 
               lastOctet === 64 || lastOctet === 88 || lastOctet === 156;
      });
      
      // Prioritize common IPs, then shuffle the rest
      const otherIPs = this.shuffle(ips.filter(ip => !commonCameraIPs.includes(ip)));
      const orderedIPs = [...commonCameraIPs, ...otherIPs];

      const ports = [80, 443];
      // No credentials for initial scan - just detect Axis devices

      // Use higher concurrency for faster discovery
      if (!PQueue) {
        safeConsole.error('PQueue not initialized, skipping network scan');
        return;
      }
      const queue = new PQueue({ concurrency: 30 });
      const scanPromises: Promise<void>[] = [];

      for (const ip of orderedIPs) {
        if (foundCamera) break;

        const promise = queue.add(async () => {
          // Just check if it's an Axis device - no credentials needed
          for (const port of ports) {
            const protocol = port === 443 ? 'https' : 'http';
            const isAxis = await this.checkIfAxisDevice(ip, port, protocol);
            
            if (isAxis) {
              // Store this IP as an Axis device
              if (!this.preDiscoveredAxisDevices.includes(ip)) {
                this.preDiscoveredAxisDevices.push(ip);
                console.log(`[Pre-Discovery] Found Axis device at ${ip} - total found: ${this.preDiscoveredAxisDevices.length}`);
              }
              break; // No need to check other ports
            }
          }
        });

        scanPromises.push(promise);
      }

      // Wait for first camera or timeout
      await Promise.race([
        Promise.all(scanPromises),
        new Promise(resolve => {
          const checkInterval = setInterval(() => {
            if (foundCamera) {
              clearInterval(checkInterval);
              resolve(true);
            }
          }, 100);
          
          setTimeout(() => {
            clearInterval(checkInterval);
            resolve(false);
          }, 10000); // 10 second timeout
        })
      ]);

      console.log(`[Pre-Discovery] Found ${this.preDiscoveredCameras.length} accessible Axis cameras`);
      this.preDiscoveredCameras.forEach(camera => {
        console.log(`[Pre-Discovery] - ${camera.model} at ${camera.ip}`);
      });

    } catch (error) {
      console.error('[Pre-Discovery] Error during pre-discovery:', error);
    } finally {
      this.isPreDiscovering = false;
      this.preDiscoveryComplete = true;
      console.log('[Pre-Discovery] Pre-emptive discovery complete');
    }
  }
}