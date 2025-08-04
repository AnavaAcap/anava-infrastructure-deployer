/**
 * Fast Start Service
 * Orchestrates the magical installer experience with parallel operations
 */

import { EventEmitter } from 'events';
import { getLogger } from '../utils/logger';
import { MagicalAIService } from './magicalAIService';
import { CameraInfo } from '../../types';
import axios from 'axios';
import crypto from 'crypto';
import os from 'os';

const logger = getLogger();

interface MagicalResult {
  success: boolean;
  camera?: CameraInfo;
  firstInsight?: string;
  firstImage?: string;  // Base64 encoded image
  error?: string;
  apiKey?: string;
}

interface MagicalProgress {
  stage: 'discovering' | 'configuring' | 'awakening' | 'analyzing' | 'complete' | 'error';
  message: string;
  progress: number; // 0-100
  detail?: string;
}

export class FastStartService extends EventEmitter {
  private abortController?: AbortController;
  private aiService?: MagicalAIService;

  constructor() {
    super();
  }

  /**
   * Start the magical experience with user's API key
   */
  async startMagicalExperience(apiKey: string): Promise<MagicalResult> {
    logger.info('Starting magical experience...');
    this.abortController = new AbortController();
    this.aiService = new MagicalAIService(apiKey);

    try {
      // Start parallel operations
      this.updateProgress('discovering', 'Searching for intelligent cameras...', 10);
      
      const camera = await this.findFirstCamera();

      if (!camera) {
        throw new Error('No compatible cameras found on your network');
      }

      this.updateProgress('configuring', `Found camera at ${camera.ip}`, 40);

      // Configure camera with magical settings
      await this.configureCameraForMagic(camera);
      
      this.updateProgress('awakening', 'Installing AI vision capabilities...', 50);

      // Deploy ACAP
      await this.deployACAPQuickly(camera);
      
      this.updateProgress('awakening', 'AI is learning to see...', 70);

      this.updateProgress('analyzing', 'Capturing first glimpse...', 80);

      // Get first frame and analyze
      const result = await this.captureAndAnalyzeFirstFrame(camera);

      this.updateProgress('complete', 'Magic complete!', 100);

      return {
        success: true,
        camera,
        firstInsight: result.description,
        firstImage: result.imageBase64 ? `data:image/jpeg;base64,${result.imageBase64}` : undefined,
        apiKey
      };

    } catch (error) {
      logger.error('Magical experience failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Something went wrong';
      this.updateProgress('error', errorMessage, 0);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Update progress and emit events
   */
  private updateProgress(stage: MagicalProgress['stage'], message: string, progress: number, detail?: string) {
    const update: MagicalProgress = { stage, message, progress, detail };
    logger.info(`Magical progress: ${stage} - ${message} (${progress}%)`);
    this.emit('progress', update);
  }

  /**
   * Find first camera with anava/baton or axis/baton credentials
   */
  private async findFirstCamera(): Promise<CameraInfo | null> {
    // Try common credentials
    const credentialsList = [
      { username: 'anava', password: 'baton' },
      { username: 'axis', password: 'baton' },
      { username: 'root', password: 'pass' },
      { username: 'root', password: 'root' },
      { username: 'admin', password: 'admin' },
      { username: 'root', password: '' }  // Some cameras have no password
    ];
    
    // First, try recently connected IPs from ARP/netstat
    const recentIPs = await this.getRecentlyConnectedIPs();
    if (recentIPs.length > 0) {
      logger.info(`Found ${recentIPs.length} recently connected IPs, checking those first`);
      
      // Process recent IPs in parallel batches
      const recentBatchSize = 10;
      for (let i = 0; i < recentIPs.length; i += recentBatchSize) {
        if (this.abortController?.signal.aborted) break;
        
        const batch = recentIPs.slice(i, i + recentBatchSize);
        logger.info(`Checking recent IPs batch: ${batch.join(', ')}`);
        
        // Test all IPs in parallel
        const promises: Promise<CameraInfo | null>[] = [];
        for (const ip of batch) {
          // Only test port 80 first for speed
          promises.push(this.quickTestCamera(ip, credentialsList));
        }
        
        const results = await Promise.allSettled(promises);
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value) {
            logger.info(`Found camera at: ${result.value.ip} - stopping search`);
            return result.value;
          }
        }
      }
    }
    
    // If no camera found in recent connections, fall back to full scan
    const commonIPs = this.generateCommonCameraIPs();
    logger.info(`Starting full scan across ${commonIPs.length} IPs with credentials: ${credentialsList.map(c => c.username).join(', ')}`);
    
    // Try common IPs in parallel batches
    const batchSize = 20; // Increased batch size for faster scanning
    for (let i = 0; i < commonIPs.length; i += batchSize) {
      if (this.abortController?.signal.aborted) break;

      const batch = commonIPs.slice(i, i + batchSize);
      logger.info(`Testing batch: ${batch.join(', ')}`);
      
      // Try each IP with each credential set
      const promises: Promise<CameraInfo | null>[] = [];
      for (const ip of batch) {
        for (const credentials of credentialsList) {
          promises.push(this.tryCamera(ip, credentials));
        }
      }
      
      try {
        const results = await Promise.allSettled(promises);
        
        // Find first successful result
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value) {
            logger.info(`Found camera at: ${result.value.ip} - stopping all searches`);
            // Cancel any remaining operations
            if (this.abortController) {
              this.abortController.abort();
            }
            return result.value;
          }
        }
      } catch (error) {
        // Continue to next batch
      }

      // Update progress
      const searchProgress = Math.min(30, (i / commonIPs.length) * 30);
      this.updateProgress('discovering', 'Scanning network...', 10 + searchProgress, `Checked ${i + batchSize} addresses`);
    }

    logger.warn('No cameras found with known credentials');
    return null;
  }

  /**
   * Get recently connected IPs from ARP cache and active connections
   */
  private async getRecentlyConnectedIPs(): Promise<string[]> {
    const recentIPs = new Set<string>();
    const platform = os.platform();
    
    try {
      // Get IPs from ARP cache
      const arpIPs = await this.getARPCacheIPs(platform);
      arpIPs.forEach(ip => recentIPs.add(ip));
      
      // Get IPs from active connections on ports 80/443
      const connectedIPs = await this.getActiveConnectionIPs(platform);
      connectedIPs.forEach(ip => recentIPs.add(ip));
      
      // Filter to only local subnet IPs
      const subnets = this.getCurrentNetworkInfo();
      const filteredIPs = Array.from(recentIPs).filter(ip => {
        const parts = ip.split('.');
        if (parts.length === 4) {
          const subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
          return subnets.includes(subnet);
        }
        return false;
      });
      
      logger.info(`Found ${filteredIPs.length} IPs from ARP/connections: ${filteredIPs.join(', ')}`);
      return filteredIPs;
    } catch (error) {
      logger.error('Failed to get recent IPs:', error);
      return [];
    }
  }
  
  /**
   * Get IPs from ARP cache
   */
  private async getARPCacheIPs(platform: string): Promise<string[]> {
    try {
      const { execSync } = require('child_process');
      let output: string;
      
      if (platform === 'win32') {
        // Windows: arp -a
        output = execSync('arp -a', { encoding: 'utf8' });
        // Parse Windows ARP output: "192.168.1.1     00-00-00-00-00-00     dynamic"
        const ipRegex = /(\d+\.\d+\.\d+\.\d+)\s+[\da-f-]+\s+dynamic/gi;
        const matches = [...output.matchAll(ipRegex)];
        return matches.map(m => m[1]);
      } else {
        // macOS/Linux: arp -a
        output = execSync('arp -a', { encoding: 'utf8' });
        // Parse macOS ARP output: "? (192.168.1.1) at 00:00:00:00:00:00 on en0"
        const ipRegex = /\((\d+\.\d+\.\d+\.\d+)\)/g;
        const matches = [...output.matchAll(ipRegex)];
        return matches.map(m => m[1]).filter(ip => !ip.startsWith('169.254'));
      }
    } catch (error) {
      logger.debug('Failed to get ARP cache:', error);
      return [];
    }
  }
  
  /**
   * Get IPs from active connections on camera ports
   */
  private async getActiveConnectionIPs(platform: string): Promise<string[]> {
    try {
      const { execSync } = require('child_process');
      let output: string;
      const ips = new Set<string>();
      
      if (platform === 'win32') {
        // Windows: netstat -n | findstr :80 :443
        try {
          output = execSync('netstat -n | findstr ":80 :443"', { encoding: 'utf8' });
        } catch {
          return [];
        }
        // Parse: "TCP    192.168.1.5:54321     192.168.1.100:80      ESTABLISHED"
        const lines = output.split('\n');
        for (const line of lines) {
          const match = line.match(/TCP\s+\S+\s+(\d+\.\d+\.\d+\.\d+):(?:80|443)\s+ESTABLISHED/);
          if (match) {
            ips.add(match[1]);
          }
        }
      } else {
        // macOS/Linux: netstat -n | grep -E ':80 |:443 '
        try {
          output = execSync('netstat -n | grep -E ":80 |:443 " | grep ESTABLISHED', { encoding: 'utf8' });
        } catch {
          return [];
        }
        // Parse: "tcp4  0  0  192.168.1.5.54321  192.168.1.100.80  ESTABLISHED"
        const lines = output.split('\n');
        for (const line of lines) {
          // Extract remote IP from connection
          const match = line.match(/\s(\d+\.\d+\.\d+\.\d+)\.(?:80|443)\s+ESTABLISHED/);
          if (match) {
            ips.add(match[1]);
          }
        }
      }
      
      return Array.from(ips);
    } catch (error) {
      logger.debug('Failed to get active connections:', error);
      return [];
    }
  }

  /**
   * Generate list of common camera IP addresses
   */
  private generateCommonCameraIPs(): string[] {
    const ips: string[] = [];
    
    // Get current network subnets, prioritized by primary interfaces
    const subnets = this.getCurrentNetworkInfo();
    
    // Strategy: Scan detected subnets with prioritization
    // 1. First, scan common camera IPs on primary subnet
    // 2. Then scan full primary subnet  
    // 3. Only scan common IPs on secondary subnets
    
    for (let i = 0; i < subnets.length; i++) {
      const subnet = subnets[i];
      const isPrimary = i === 0;
      
      // For faster discovery, add common camera IPs first
      const commonCameraIPs = [100, 101, 200, 201, 64, 88, 99, 2, 10, 20, 30, 50, 60, 70, 80, 90, 110, 150, 156, 125, 126, 155, 157, 158];
      for (const lastOctet of commonCameraIPs) {
        const ip = `${subnet}.${lastOctet}`;
        if (!ips.includes(ip)) {
          ips.push(ip);
        }
      }
      
      // For primary subnet, scan everything; for secondary, just common ranges
      if (isPrimary) {
        // Scan full primary subnet
        for (let j = 1; j <= 254; j++) {
          const ip = `${subnet}.${j}`;
          if (!ips.includes(ip)) {
            ips.push(ip);
          }
        }
      } else {
        // For secondary subnets, just scan common ranges
        const ranges = [
          { start: 50, end: 70 },   // Common DHCP range
          { start: 100, end: 120 }, // Common static IP range
          { start: 200, end: 210 }  // Another common range
        ];
        
        for (const range of ranges) {
          for (let j = range.start; j <= range.end; j++) {
            const ip = `${subnet}.${j}`;
            if (!ips.includes(ip)) {
              ips.push(ip);
            }
          }
        }
      }
    }
    
    // Only add fallback IPs if we have no detected subnets or very few IPs
    if (ips.length < 50) {
      logger.warn(`Only ${ips.length} IPs found from network detection, adding fallback common camera IPs`);
      const fallbackSubnets = ['192.168.1', '192.168.0'];
      for (const fallback of fallbackSubnets) {
        if (!subnets.includes(fallback)) {
          // Just add the most common camera IPs for fallback subnets
          const commonCameraIPs = [100, 101, 200, 201];
          for (const lastOctet of commonCameraIPs) {
            const ip = `${fallback}.${lastOctet}`;
            if (!ips.includes(ip)) {
              ips.push(ip);
            }
          }
        }
      }
    }

    logger.info(`Generated ${ips.length} IPs to scan (primary subnets: ${subnets.slice(0, 2).join(', ')})`);
    return ips;
  }

  /**
   * Get current network subnets, prioritizing primary interfaces
   */
  private getCurrentNetworkInfo(): string[] {
    const subnets: string[] = [];
    
    try {
      const interfaces = os.networkInterfaces();
      const platform = os.platform();
      
      // Define primary interface names by platform
      const primaryInterfaces = platform === 'win32' 
        ? ['Ethernet', 'Wi-Fi', 'Local Area Connection'] // Windows
        : ['en0', 'eth0', 'en1', 'eth1']; // macOS/Linux
      
      // First, try to get subnets from primary interfaces
      for (const primaryName of primaryInterfaces) {
        // Check both exact match and case-insensitive for Windows
        let ifaces = interfaces[primaryName];
        
        if (!ifaces && platform === 'win32') {
          // On Windows, interface names might have different casing or include numbers
          const lowerPrimary = primaryName.toLowerCase();
          for (const ifaceName of Object.keys(interfaces)) {
            if (ifaceName.toLowerCase().includes(lowerPrimary)) {
              ifaces = interfaces[ifaceName];
              logger.info(`Matched Windows interface: ${ifaceName} for ${primaryName}`);
              break;
            }
          }
        }
        
        if (ifaces) {
          for (const iface of ifaces) {
            if (!iface.internal && iface.family === 'IPv4') {
              const parts = iface.address.split('.');
              if (parts.length === 4) {
                // Skip link-local addresses (169.254.x.x)
                if (parts[0] === '169' && parts[1] === '254') {
                  continue;
                }
                const subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
                if (!subnets.includes(subnet)) {
                  logger.info(`Found primary network ${primaryName}: ${iface.address} (subnet: ${subnet})`);
                  subnets.push(subnet);
                }
              }
            }
          }
        }
      }
      
      // Then add any other interfaces (like VPN, etc)
      for (const name of Object.keys(interfaces)) {
        // Skip if already processed as primary
        if (primaryInterfaces.some(p => p.toLowerCase() === name.toLowerCase())) {
          continue;
        }
        
        for (const iface of interfaces[name] || []) {
          if (!iface.internal && iface.family === 'IPv4') {
            const parts = iface.address.split('.');
            if (parts.length === 4) {
              // Skip link-local addresses (169.254.x.x)
              if (parts[0] === '169' && parts[1] === '254') {
                continue;
              }
              const subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
              if (!subnets.includes(subnet)) {
                logger.info(`Found secondary network ${name}: ${iface.address} (subnet: ${subnet})`);
                subnets.push(subnet);
              }
            }
          }
        }
      }
      
      logger.info(`Network scan order: ${subnets.join(', ')}`);
    } catch (error) {
      logger.error('Failed to get network info:', error);
    }
    
    // If no networks found, return common defaults
    if (subnets.length === 0) {
      logger.warn('No networks detected, using defaults');
      return ['192.168.1', '192.168.0', '10.0.0'];
    }
    
    return subnets;
  }

  /**
   * Try to connect to a camera at given IP
   */
  private async tryCamera(ip: string, credentials: { username: string; password: string }): Promise<CameraInfo | null> {
    try {
      // Try HTTP first (more common), then HTTPS
      for (const protocol of ['http', 'https']) {
        for (const port of protocol === 'https' ? [443, 8443] : [80, 8080]) {
          if (this.abortController?.signal.aborted) return null;

          const baseURL = `${protocol}://${ip}:${port}`;
          
          try {
            // First, check if port is open with a simple request
            const checkResponse = await axios.get(baseURL, {
              timeout: 300, // Reduced timeout for faster scanning
              validateStatus: () => true,
              signal: this.abortController?.signal,
              maxRedirects: 0,
              // Disable SSL verification for self-signed certificates
              httpsAgent: protocol === 'https' ? new (require('https').Agent)({
                rejectUnauthorized: false
              }) : undefined
            });
            
            // If we get any response, try VAPIX with digest auth
            if (checkResponse.status > 0) {
              try {
                const response = await this.digestAuth(
                  `${baseURL}/axis-cgi/param.cgi?action=list&group=Brand`,
                  credentials.username,
                  credentials.password
                );

              if (response.status === 200 && response.data) {
              // Verify it's actually an Axis camera
              const responseData = String(response.data);
              if (!responseData.includes('Brand=AXIS') && !responseData.includes('Brand.Brand=AXIS')) {
                logger.debug(`Not an Axis camera at ${ip} - no AXIS brand found`);
                return null;
              }
              
              // Parse camera info
              const model = this.parseVAPIXResponse(responseData, 'Brand.ProdNbr') || '';
              const brand = this.parseVAPIXResponse(responseData, 'Brand.Brand');
              const productType = this.parseVAPIXResponse(responseData, 'Brand.ProdType') || '';
              const productShortName = this.parseVAPIXResponse(responseData, 'Brand.ProdShortName') || '';
              const webURL = this.parseVAPIXResponse(responseData, 'Brand.WebURL') || '';
              
              logger.info(`DEVICE FOUND at ${ip}: Model=${model}, Type=${productType}, ShortName=${productShortName}`);
              
              // Enhanced filtering for non-camera devices
              // Check multiple indicators to determine if it's a camera
              const isCamera = this.isAxisCamera(model, productType, productShortName, webURL);
              
              if (!isCamera) {
                logger.info(`SKIPPING: Non-camera Axis device at ${ip} - Model: ${model}, Type: ${productType}, ShortName: ${productShortName}`);
                return null;
              }
              
              logger.info(`SUCCESS: Found Axis camera at ${ip} with ${credentials.username}/${credentials.password} - Model: ${model}`);
              
              return {
                ip,
                model: model || 'Unknown Axis Camera',
                manufacturer: brand || 'Axis',
                mac: '',
                hostname: '',
                port,
                protocol: protocol as 'http' | 'https',
                authenticated: true,
                username: credentials.username,
                password: credentials.password
              };
            } else if (response.status === 401) {
              logger.debug(`AUTH FAILED at ${ip} with ${credentials.username} (401)`);
            }
              } catch (digestError: any) {
                // Digest auth failed, only log non-401 errors
                if (!digestError.message?.includes('401')) {
                  logger.debug(`Digest auth error at ${ip} with ${credentials.username}: ${digestError.message}`);
                }
              }
            } // Close the port check if
          } catch (error: any) {
            // Only log connection errors for debugging
            if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
              // Silent - camera not at this address
            } else if (error.message?.includes('certificate')) {
              // Silent - SSL certificate issues are common
            } else {
              logger.debug(`Error testing ${ip}: ${error.message}`);
            }
          }
        }
      }
    } catch (error) {
      // Camera not accessible
    }

    return null;
  }

  /**
   * Parse VAPIX parameter response
   */
  private parseVAPIXResponse(data: string, param: string): string | null {
    const regex = new RegExp(`${param}=(.+)`);
    const match = data.match(regex);
    return match ? match[1].trim() : null;
  }

  /**
   * Determine if the Axis device is a camera based on various parameters
   */
  private isAxisCamera(model: string, productType: string, productShortName: string, webURL: string): boolean {
    // Convert all to lowercase for comparison
    const modelLower = model.toLowerCase();
    const typeLower = productType.toLowerCase();
    const shortNameLower = productShortName.toLowerCase();
    const webURLLower = webURL.toLowerCase();
    
    // Explicit exclusion patterns for non-camera devices
    const nonCameraPatterns = [
      'speaker', 'audio', 'sound', 'horn', 'intercom', 'siren',
      'strobe', 'relay', 'i/o', 'access', 'door', 'controller',
      'encoder', 'decoder', 'switch', 'media converter'
    ];
    
    // Check if any field contains non-camera patterns
    for (const pattern of nonCameraPatterns) {
      if (modelLower.includes(pattern) || typeLower.includes(pattern) || 
          shortNameLower.includes(pattern) || webURLLower.includes(pattern)) {
        return false;
      }
    }
    
    // Explicit inclusion patterns for cameras
    const cameraPatterns = ['camera', 'cam', 'dome', 'bullet', 'ptz', 'thermal'];
    
    // Check if model explicitly indicates it's a camera
    for (const pattern of cameraPatterns) {
      if (modelLower.includes(pattern) || typeLower.includes(pattern) || 
          shortNameLower.includes(pattern)) {
        return true;
      }
    }
    
    // Check common Axis camera model patterns
    // Most Axis cameras have model numbers like M3065, P1435, Q6055 etc
    const cameraModelPattern = /^[MPQF]\d{4}/i;
    if (cameraModelPattern.test(model)) {
      // Additional check - C series are usually speakers
      if (model.toUpperCase().startsWith('C')) {
        return false;
      }
      return true;
    }
    
    // If we can't determine, log details and default to true (camera)
    // This ensures we don't accidentally skip real cameras
    logger.warn(`Unable to definitively categorize Axis device - Model: ${model}, Type: ${productType}, ShortName: ${productShortName}`);
    return true;
  }

  /**
   * Simple digest auth implementation for POST requests
   */
  private async digestAuthPost(
    ip: string, 
    username: string, 
    password: string, 
    path: string, 
    data: any,
    port = 80,
    protocol: 'http' | 'https' = 'http'
  ): Promise<any> {
    try {
      const url = `${protocol}://${ip}:${port}${path}`;
      const isHttps = protocol === 'https';
      
      // First request to get challenge
      const response1 = await axios.post(url, data, {
        validateStatus: () => true,
        timeout: 15000, // 15 seconds for ACAP responses
        signal: this.abortController?.signal,
        headers: {
          'Content-Type': 'application/json'
        },
        httpsAgent: isHttps ? new (require('https').Agent)({
          rejectUnauthorized: false
        }) : undefined
      });
      
      if (response1.status !== 401) {
        return response1;
      }
      
      const wwwAuth = response1.headers['www-authenticate'];
      if (!wwwAuth || !wwwAuth.includes('Digest')) {
        throw new Error('No digest auth challenge');
      }
      
      // Parse digest parameters
      const authParams: any = {};
      const regex = /(\w+)=(?:"([^"]*)"|([^,]*))/g;
      let match;
      while ((match = regex.exec(wwwAuth)) !== null) {
        authParams[match[1]] = match[2] || match[3];
      }
      
      const nc = '00000001';
      const cnonce = crypto.randomBytes(8).toString('hex');
      const uri = new URL(url).pathname + new URL(url).search;
      
      // Calculate response for POST
      const md5 = (str: string) => crypto.createHash('md5').update(str).digest('hex');
      const ha1 = md5(`${username}:${authParams.realm}:${password}`);
      const ha2 = md5(`POST:${uri}`);
      const response = md5(`${ha1}:${authParams.nonce}:${nc}:${cnonce}:${authParams.qop}:${ha2}`);
      
      // Build authorization header
      const authHeader = `Digest username="${username}", realm="${authParams.realm}", nonce="${authParams.nonce}", uri="${uri}", algorithm="${authParams.algorithm || 'MD5'}", response="${response}", qop=${authParams.qop}, nc=${nc}, cnonce="${cnonce}"`;
      
      // Second request with auth
      const response2 = await axios.post(url, data, {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        timeout: 15000, // 15 seconds for ACAP responses
        signal: this.abortController?.signal,
        httpsAgent: isHttps ? new (require('https').Agent)({
          rejectUnauthorized: false
        }) : undefined
      });
      
      return response2;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Simple digest auth implementation
   */
  private async digestAuth(url: string, username: string, password: string): Promise<any> {
    try {
      // First request to get challenge
      const isHttps = url.startsWith('https');
      const response1 = await axios.get(url, {
        validateStatus: () => true,
        timeout: 2000,
        signal: this.abortController?.signal,
        httpsAgent: isHttps ? new (require('https').Agent)({
          rejectUnauthorized: false
        }) : undefined
      });
      
      if (response1.status !== 401) {
        return response1;
      }
      
      const wwwAuth = response1.headers['www-authenticate'];
      if (!wwwAuth || !wwwAuth.includes('Digest')) {
        throw new Error('No digest auth challenge');
      }
      
      // Parse digest parameters
      const authParams: any = {};
      const regex = /(\w+)=(?:"([^"]*)"|([^,]*))/g;
      let match;
      while ((match = regex.exec(wwwAuth)) !== null) {
        authParams[match[1]] = match[2] || match[3];
      }
      
      const nc = '00000001';
      const cnonce = crypto.randomBytes(8).toString('hex');
      const uri = new URL(url).pathname + new URL(url).search;
      
      // Calculate response
      const md5 = (str: string) => crypto.createHash('md5').update(str).digest('hex');
      const ha1 = md5(`${username}:${authParams.realm}:${password}`);
      const ha2 = md5(`GET:${uri}`);
      const response = md5(`${ha1}:${authParams.nonce}:${nc}:${cnonce}:${authParams.qop}:${ha2}`);
      
      // Build authorization header
      const authHeader = `Digest username="${username}", realm="${authParams.realm}", nonce="${authParams.nonce}", uri="${uri}", algorithm="${authParams.algorithm || 'MD5'}", response="${response}", qop=${authParams.qop}, nc=${nc}, cnonce="${cnonce}"`;
      
      // Second request with auth
      const response2 = await axios.get(url, {
        headers: {
          'Authorization': authHeader
        },
        timeout: 2000,
        signal: this.abortController?.signal,
        httpsAgent: isHttps ? new (require('https').Agent)({
          rejectUnauthorized: false
        }) : undefined,
        // Handle binary data for images
        responseType: url.includes('/jpg/') || url.includes('/image') ? 'arraybuffer' : undefined
      });
      
      return response2;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update camera configuration for Vertex AI mode
   */
  async updateCameraForVertexAI(
    camera: CameraInfo, 
    vertexConfig: {
      apiGatewayUrl: string;
      apiGatewayKey: string;
      projectId: string;
      region: string;
      bucketName: string;
    }
  ): Promise<void> {
    const config = {
      firebase: {
        apiKey: '',
        authDomain: '',
        projectId: vertexConfig.projectId,
        storageBucket: vertexConfig.bucketName,
        messagingSenderId: '',
        appId: '',
        databaseId: '(default)'
      },
      gemini: {
        apiKey: '', // Clear AI Studio key
        vertexApiGatewayUrl: vertexConfig.apiGatewayUrl,
        vertexApiGatewayKey: vertexConfig.apiGatewayKey,
        vertexGcpProjectId: vertexConfig.projectId,
        vertexGcpRegion: vertexConfig.region,
        vertexGcsBucketName: vertexConfig.bucketName
      },
      anavaKey: 'NO-KEY',
      customerId: 'magical-installer'
    };

    const path = `/local/BatonAnalytic/baton_analytic.cgi?command=setInstallerConfig`;
    
    try {
      const response = await this.digestAuthPost(
        camera.ip,
        camera.username!,
        camera.password!,
        path,
        config,
        camera.port,
        camera.protocol
      );

      if (response.status !== 200) {
        throw new Error(`Failed to update camera config: ${response.status}`);
      }

      console.log('Successfully updated camera for Vertex AI mode');
    } catch (error) {
      console.error('Failed to update camera configuration:', error);
      throw error;
    }
  }

  /**
   * Configure camera with user's AI Studio settings
   */
  private async configureCameraForMagic(camera: CameraInfo): Promise<void> {
    if (!this.aiService) {
      throw new Error('AI service not initialized');
    }

    // Use minimal config for magical experience with user's API key
    const config = {
      firebase: {
        apiKey: "demo-api-key",
        authDomain: "anava-demo.firebaseapp.com",
        projectId: "anava-magical-demo",
        storageBucket: "anava-magical-demo.appspot.com",
        messagingSenderId: "123456789",
        appId: "1:123456789:web:demo",
        databaseId: "(default)"
      },
      gemini: {
        apiKey: this.aiService.getApiKey(), // Use the user's API key
        vertexApiGatewayUrl: "",
        vertexApiGatewayKey: "",
        vertexGcpProjectId: "anava-magical",
        vertexGcpRegion: "us-central1",
        vertexGcsBucketName: "anava-magical-analytics"
      },
      anavaKey: `magical-${crypto.randomBytes(8).toString('hex')}`,
      customerId: "magical-demo"
    };

    const path = `/local/BatonAnalytic/baton_analytic.cgi?command=setInstallerConfig`;
    
    try {
      // Use digest auth for configuration
      const response = await this.digestAuthPost(
        camera.ip,
        camera.username!,
        camera.password!,
        path,
        config,
        camera.port,
        camera.protocol
      );

      if (!response || response.status !== 200) {
        throw new Error('Failed to configure camera - invalid response');
      }

      logger.info('Camera configured with magical settings');
    } catch (error) {
      logger.error('Failed to configure camera:', error);
      throw new Error('Failed to configure camera');
    }
  }

  /**
   * Deploy ACAP quickly
   */
  private async deployACAPQuickly(camera: CameraInfo): Promise<void> {
    try {
      logger.info('Starting ACAP deployment process...');
      logger.info('Camera details:', {
        ip: camera.ip,
        port: camera.port,
        protocol: camera.protocol,
        model: camera.model,
        hasCredentials: !!(camera.username && camera.password)
      });
      
      logger.info('Checking if BatonAnalytic ACAP is installed...');
      
      // Check if ACAP is already installed
      const { ACAPDeploymentService } = require('./camera/acapDeploymentService');
      logger.info('Creating ACAPDeploymentService instance...');
      const acapDeployService = new ACAPDeploymentService();
      logger.info('ACAPDeploymentService created successfully');
      
      // Convert CameraInfo to Camera format
      const cameraForCheck = {
        id: `camera-${camera.ip.replace(/\./g, '-')}`,
        ip: camera.ip,
        port: camera.port,
        protocol: camera.protocol,
        type: 'network',
        model: camera.model,
        manufacturer: camera.manufacturer,
        mac: camera.mac || null,
        capabilities: [],
        discoveredAt: new Date().toISOString(),
        status: 'accessible' as const,
        credentials: {
          username: camera.username!,
          password: camera.password!
        }
      };
      
      logger.info('Listing installed ACAPs on camera...');
      let installedACAPs;
      try {
        installedACAPs = await acapDeployService.listInstalledACAPs(cameraForCheck);
        logger.info(`Found ${installedACAPs.length} installed ACAPs`);
      } catch (listError) {
        logger.error('Failed to list installed ACAPs:', {
          message: listError instanceof Error ? listError.message : String(listError),
          errorType: listError instanceof Error ? listError.constructor.name : typeof listError
        });
        throw new Error(`Failed to check installed ACAPs: ${listError instanceof Error ? listError.message : 'Unknown error'}`);
      }
      
      const isInstalled = installedACAPs.some((acap: any) => 
        acap.name?.toLowerCase().includes('batonanalytic') ||
        acap.packagename?.toLowerCase().includes('batonanalytic')
      );
      
      if (isInstalled) {
        logger.info('BatonAnalytic ACAP is already installed');
        return;
      }
      
      logger.info('BatonAnalytic ACAP not found, downloading and installing...');
      
      // Get the latest ACAP release
      const { ACAPDownloaderService } = require('./camera/acapDownloaderService');
      logger.info('Creating ACAPDownloaderService instance...');
      const acapService = new ACAPDownloaderService();
      logger.info('ACAPDownloaderService created successfully');
      
      logger.info('Fetching available ACAP releases from GitHub...');
      let releases;
      try {
        releases = await acapService.getAvailableReleases();
        logger.info(`Found ${releases?.length || 0} available releases`);
      } catch (fetchError) {
        logger.error('Failed to fetch ACAP releases:', {
          message: fetchError instanceof Error ? fetchError.message : String(fetchError),
          errorType: fetchError instanceof Error ? fetchError.constructor.name : typeof fetchError
        });
        throw new Error(`Failed to fetch ACAP releases: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
      }
      
      if (!releases || releases.length === 0) {
        throw new Error('No ACAP releases found');
      }
      
      // Find the BatonAnalytic ACAP for the appropriate architecture
      // Prefer armv7hf for most Axis cameras
      const batonRelease = releases.find((r: any) => 
        (r.name.toLowerCase().includes('baton') || r.name.includes('Anava')) && r.name.includes('armv7hf')
      ) || releases.find((r: any) => 
        (r.name.toLowerCase().includes('baton') || r.name.includes('Anava')) && r.name.includes('aarch64')
      );
      
      if (!batonRelease) {
        logger.error('Available releases:', releases.map((r: any) => r.name).join(', '));
        throw new Error('No compatible BatonAnalytic ACAP found in releases');
      }
      
      logger.info(`Found ACAP release: ${batonRelease.name}`);
      logger.info(`Download URL: ${batonRelease.downloadUrl}`);
      logger.info(`Architecture: ${batonRelease.architecture}`);
      logger.info(`Size: ${batonRelease.size} bytes`);
      
      // Download the ACAP
      const downloadResult = await acapService.downloadACAP(batonRelease);
      if (!downloadResult.success) {
        throw new Error(`Failed to download ACAP: ${downloadResult.error}`);
      }
      const acapPath = downloadResult.path!;
      logger.info(`Downloaded ACAP successfully to: ${acapPath}`);
      
      // Deploy to camera
      logger.info('Installing ACAP on camera...');
      // Convert CameraInfo to Camera format expected by ACAPDeploymentService
      const cameraForDeploy = {
        id: `camera-${camera.ip.replace(/\./g, '-')}`,
        ip: camera.ip,
        port: camera.port,
        protocol: camera.protocol,
        type: 'network',
        model: camera.model,
        manufacturer: camera.manufacturer,
        mac: camera.mac || null,
        capabilities: [],
        discoveredAt: new Date().toISOString(),
        status: 'accessible' as const,
        credentials: {
          username: camera.username!,
          password: camera.password!
        }
      };
      const deployResult = await acapDeployService.deployACAP(cameraForDeploy, acapPath);
      
      if (!deployResult.success) {
        throw new Error(`ACAP deployment failed: ${deployResult.error}`);
      }
      
      logger.info('BatonAnalytic ACAP installed successfully');
      
      // Give the ACAP time to start up
      logger.info('Waiting for ACAP to initialize...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
    } catch (error) {
      logger.error('Failed to deploy ACAP:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        details: error
      });
      throw error instanceof Error ? error : new Error('BatonAnalytic ACAP deployment failed');
    }
  }

  /**
   * Capture first frame and get AI analysis
   */
  private async captureAndAnalyzeFirstFrame(camera: CameraInfo): Promise<{description: string; imageBase64?: string}> {
    try {
      // Call the ACAP's scene description endpoint
      const sceneDescPath = '/local/BatonAnalytic/baton_analytic.cgi?command=getSceneDescription';
      
      if (!this.aiService) {
        throw new Error('AI service not initialized');
      }

      const requestData = {
        viewArea: 1,  // Default camera channel
        GeminiApiKey: this.aiService.getApiKey()  // Include the API key
      };
      
      const response = await this.digestAuthPost(
        camera.ip,
        camera.username!,
        camera.password!,
        sceneDescPath,
        requestData,
        camera.port,
        camera.protocol
      );

      if (!response || response.status !== 200) {
        throw new Error('Failed to get scene description from ACAP');
      }

      const data = response.data;
      
      logger.info('Scene description response:', {
        status: data.status,
        hasDescription: !!data.description,
        hasImage: !!data.imageBase64,
        imageLength: data.imageBase64?.length || 0,
        imagePreview: data.imageBase64 ? data.imageBase64.substring(0, 50) + '...' : 'none'
      });
      
      if (data.status === 'success' && data.description) {
        // Return both the description and image
        return {
          description: `I see... ${data.description}`,
          imageBase64: data.imageBase64
        };
      } else {
        throw new Error(data.message || 'Failed to generate description');
      }
      
    } catch (error: any) {
      logger.error('Failed to capture/analyze first frame:', error);
      
      // Check if it's a timeout error
      if (error.message?.includes('timeout')) {
        throw new Error('Camera AI analysis is taking longer than expected. Please ensure the BatonAnalytic ACAP is running on your camera.');
      }
      
      throw new Error('Failed to get AI scene description from camera. Please check that BatonAnalytic ACAP is running.');
    }
  }

  /**
   * Connect to a specific camera with manual IP and credentials
   */
  async connectToSpecificCamera(apiKey: string, ip: string, username: string, password: string): Promise<MagicalResult> {
    logger.info(`Manual connection to camera at ${ip}...`);
    this.abortController = new AbortController();
    this.aiService = new MagicalAIService(apiKey);

    try {
      this.updateProgress('discovering', `Connecting to ${ip}...`, 20);
      
      // Try to connect to the camera with provided credentials
      const camera = await this.tryCamera(ip, { username, password });
      
      if (!camera) {
        throw new Error(`Failed to connect to camera at ${ip}. Please check the IP address and credentials.`);
      }

      this.updateProgress('configuring', `Found camera at ${camera.ip}`, 40);

      // Configure camera with magical settings
      await this.configureCameraForMagic(camera);
      
      this.updateProgress('awakening', 'Installing AI vision capabilities...', 50);

      // Deploy ACAP
      await this.deployACAPQuickly(camera);
      
      this.updateProgress('awakening', 'AI is learning to see...', 70);

      this.updateProgress('analyzing', 'Capturing first glimpse...', 80);

      // Get first frame and analyze
      const result = await this.captureAndAnalyzeFirstFrame(camera);

      this.updateProgress('complete', 'Magic complete!', 100);

      return {
        success: true,
        camera,
        firstInsight: result.description,
        firstImage: result.imageBase64 ? `data:image/jpeg;base64,${result.imageBase64}` : undefined,
        apiKey
      };

    } catch (error) {
      logger.error('Manual connection failed:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        details: error
      });
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      this.updateProgress('error', errorMessage, 0);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Process user's analysis request
   */
  async processUserQuery(query: string, camera: CameraInfo): Promise<string> {
    try {
      // For now, we'll use the same scene description endpoint
      // In the future, this could be enhanced to accept custom prompts
      const sceneDescPath = '/local/BatonAnalytic/baton_analytic.cgi?command=getSceneDescription';
      
      const requestData = {
        viewArea: 1
      };
      
      const response = await this.digestAuthPost(
        camera.ip,
        camera.username!,
        camera.password!,
        sceneDescPath,
        requestData,
        camera.port,
        camera.protocol
      );

      if (!response || response.status !== 200) {
        throw new Error('Failed to analyze scene');
      }

      const data = response.data;
      if (data.status === 'success' && data.description) {
        // For now, return the description with context about the user's query
        return `Based on your question "${query}", here's what I observe: ${data.description}`;
      } else {
        throw new Error(data.message || 'Analysis failed');
      }
      
    } catch (error) {
      logger.error('Failed to process user query:', error);
      throw new Error('Failed to analyze scene');
    }
  }

  /**
   * Quick test camera - optimized for speed
   * Tests only port 80 first, with all credentials in parallel
   */
  private async quickTestCamera(ip: string, credentialsList: { username: string; password: string }[]): Promise<CameraInfo | null> {
    if (this.abortController?.signal.aborted) return null;
    
    try {
      const baseURL = `http://${ip}:80`;
      
      // First, quick TCP check to see if port 80 is even open
      const isOpen = await new Promise<boolean>((resolve) => {
        const net = require('net');
        const socket = new net.Socket();
        const timer = setTimeout(() => {
          socket.destroy();
          resolve(false);
        }, 200); // Very short timeout for TCP check
        
        socket.on('connect', () => {
          clearTimeout(timer);
          socket.destroy();
          resolve(true);
        });
        
        socket.on('error', () => {
          clearTimeout(timer);
          socket.destroy();
          resolve(false);
        });
        
        socket.connect(80, ip);
      });
      
      if (!isOpen) {
        return null;
      }
      
      // Port is open, try all credentials in parallel
      const promises = credentialsList.map(async (creds) => {
        try {
          const response = await this.digestAuth(
            `${baseURL}/axis-cgi/param.cgi?action=list&group=Brand`,
            creds.username,
            creds.password
          );
          
          if (response.status === 200 && response.data) {
            const responseData = String(response.data);
            if (responseData.includes('Brand=AXIS') || responseData.includes('Brand.Brand=AXIS')) {
              // Parse device info to check if it's a camera
              const model = this.parseVAPIXResponse(responseData, 'Brand.ProdNbr') || '';
              const productType = this.parseVAPIXResponse(responseData, 'Brand.ProdType') || '';
              const productShortName = this.parseVAPIXResponse(responseData, 'Brand.ProdShortName') || '';
              const webURL = this.parseVAPIXResponse(responseData, 'Brand.WebURL') || '';
              
              const isCamera = this.isAxisCamera(model, productType, productShortName, webURL);
              
              if (!isCamera) {
                logger.debug(`QUICK SCAN: Skipping non-camera at ${ip} - ${model}`);
                return null;
              }
              
              logger.info(`QUICK HIT: Found Axis camera at ${ip} with ${creds.username}/${creds.password} - Model: ${model}`);
              
              return {
                ip,
                model: model || 'Unknown Axis Camera',
                manufacturer: 'Axis',
                mac: '',
                hostname: '',
                port: 80,
                protocol: 'http' as const,
                authenticated: true,
                username: creds.username,
                password: creds.password
              };
            }
          }
        } catch (error) {
          // Silent fail for this credential
        }
        return null;
      });
      
      // Race all credential attempts
      const results = await Promise.allSettled(promises);
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          return result.value;
        }
      }
    } catch (error) {
      // Silent fail
    }
    
    return null;
  }

  /**
   * Cancel the magical experience
   */
  cancel() {
    this.abortController?.abort();
    this.emit('cancelled');
  }
}

// Export singleton instance
export const fastStartService = new FastStartService();