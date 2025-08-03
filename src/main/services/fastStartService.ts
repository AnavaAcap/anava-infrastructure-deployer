/**
 * Fast Start Service
 * Orchestrates the magical installer experience with parallel operations
 */

import { EventEmitter } from 'events';
import { getLogger } from '../utils/logger';
import { magicalProxyService } from './magicalProxyService';
import { CameraInfo } from '../../types';
import axios from 'axios';
import crypto from 'crypto';

const logger = getLogger();

interface MagicalResult {
  success: boolean;
  camera?: CameraInfo;
  firstInsight?: string;
  error?: string;
  deviceStatus?: any;
}

interface MagicalProgress {
  stage: 'discovering' | 'configuring' | 'awakening' | 'analyzing' | 'complete' | 'error';
  message: string;
  progress: number; // 0-100
  detail?: string;
}

export class FastStartService extends EventEmitter {
  private abortController?: AbortController;
  private configTimeout = 5000; // 5 seconds for configuration

  constructor() {
    super();
  }

  /**
   * Start the magical experience
   */
  async startMagicalExperience(): Promise<MagicalResult> {
    logger.info('Starting magical experience...');
    this.abortController = new AbortController();

    try {
      // Check if device can use magical demo
      this.updateProgress('discovering', 'Checking demo availability...', 5);
      const { allowed, reason } = await magicalProxyService.canUseMagicalDemo();
      if (!allowed) {
        throw new Error(reason || 'Demo not available');
      }

      // Start parallel operations
      this.updateProgress('discovering', 'Searching for intelligent cameras...', 10);
      
      const [camera, deviceStatus] = await Promise.all([
        this.findFirstCamera(),
        magicalProxyService.checkDeviceStatus()
      ]);

      if (!camera) {
        throw new Error('No compatible cameras found on your network');
      }

      this.updateProgress('configuring', `Found camera at ${camera.ip}`, 40);

      // Configure camera with magical settings
      await this.configureCameraForMagic(camera);
      
      this.updateProgress('awakening', 'AI is learning to see...', 60);

      // Deploy ACAP (simulated for now - in production would actually deploy)
      await this.deployACAPQuickly(camera);

      this.updateProgress('analyzing', 'Capturing first glimpse...', 80);

      // Get first frame and analyze
      const firstInsight = await this.captureAndAnalyzeFirstFrame(camera);

      this.updateProgress('complete', 'Magic complete!', 100);

      return {
        success: true,
        camera,
        firstInsight,
        deviceStatus
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
   * Find first camera with anava/baton credentials
   */
  private async findFirstCamera(): Promise<CameraInfo | null> {
    const commonIPs = this.generateCommonCameraIPs();
    const credentials = { username: 'anava', password: 'baton' };
    
    // Try common IPs in parallel batches
    const batchSize = 10;
    for (let i = 0; i < commonIPs.length; i += batchSize) {
      if (this.abortController?.signal.aborted) break;

      const batch = commonIPs.slice(i, i + batchSize);
      const promises = batch.map(ip => this.tryCamera(ip, credentials));
      
      try {
        const results = await Promise.allSettled(promises);
        const success = results.find(r => r.status === 'fulfilled' && r.value);
        if (success && success.status === 'fulfilled' && success.value) {
          return success.value;
        }
      } catch (error) {
        // Continue to next batch
      }

      // Update progress
      const searchProgress = Math.min(30, (i / commonIPs.length) * 30);
      this.updateProgress('discovering', 'Scanning network...', 10 + searchProgress, `Checked ${i + batchSize} addresses`);
    }

    return null;
  }

  /**
   * Generate list of common camera IP addresses
   */
  private generateCommonCameraIPs(): string[] {
    const ips: string[] = [];
    
    // Common camera ranges
    const ranges = [
      { subnet: '192.168.1', start: 100, end: 110 },
      { subnet: '192.168.1', start: 200, end: 210 },
      { subnet: '192.168.0', start: 100, end: 110 },
      { subnet: '192.168.0', start: 200, end: 210 },
      { subnet: '10.0.0', start: 100, end: 110 },
    ];

    // Add common specific IPs first
    ips.push('192.168.1.100', '192.168.1.101', '192.168.1.200', '192.168.1.201');

    // Then add ranges
    ranges.forEach(range => {
      for (let i = range.start; i <= range.end; i++) {
        const ip = `${range.subnet}.${i}`;
        if (!ips.includes(ip)) {
          ips.push(ip);
        }
      }
    });

    return ips;
  }

  /**
   * Try to connect to a camera at given IP
   */
  private async tryCamera(ip: string, credentials: { username: string; password: string }): Promise<CameraInfo | null> {
    try {
      // Try HTTPS first, then HTTP
      for (const protocol of ['https', 'http']) {
        for (const port of [443, 80]) {
          if (this.abortController?.signal.aborted) return null;

          const baseURL = `${protocol}://${ip}:${port}`;
          
          try {
            // Try to get device info using VAPIX
            const response = await axios.get(`${baseURL}/axis-cgi/param.cgi?action=list&group=Brand`, {
              auth: credentials,
              timeout: 500,
              validateStatus: () => true,
              signal: this.abortController?.signal
            });

            if (response.status === 200) {
              // Parse camera info
              const model = this.parseVAPIXResponse(response.data, 'Brand.ProdNbr');
              const brand = this.parseVAPIXResponse(response.data, 'Brand.Brand');
              
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
            }
          } catch (error) {
            // Try next combination
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
   * Configure camera with magical proxy settings
   */
  private async configureCameraForMagic(camera: CameraInfo): Promise<void> {
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
        magicalProxyUrl: process.env.AI_PROXY_URL || "https://ai-proxy-anava-magical-backend.cloudfunctions.net/ai-proxy",
        magicalProxyKey: "demo-mode",
        vertexGcpProjectId: "anava-magical-backend",
        vertexGcpRegion: "us-central1",
        vertexGcsBucketName: "anava-magical-analytics"
      },
      anavaKey: `demo-${crypto.randomBytes(8).toString('hex')}`,
      customerId: "magical-demo"
    };

    const url = `${camera.protocol}://${camera.ip}:${camera.port}/local/BatonAnalytic/baton_analytic.cgi?command=setInstallerConfig`;
    
    try {
      await axios.post(url, config, {
        auth: {
          username: camera.username!,
          password: camera.password!
        },
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: this.configTimeout
      });

      logger.info('Camera configured with magical settings');
    } catch (error) {
      logger.error('Failed to configure camera:', error);
      throw new Error('Failed to configure camera');
    }
  }

  /**
   * Deploy ACAP quickly (simulated for demo)
   */
  private async deployACAPQuickly(_camera: CameraInfo): Promise<void> {
    // In production, this would actually deploy the ACAP
    // For demo, we simulate the deployment time
    await new Promise(resolve => setTimeout(resolve, 2000));
    logger.info('ACAP deployment simulated');
  }

  /**
   * Capture first frame and get AI analysis
   */
  private async captureAndAnalyzeFirstFrame(camera: CameraInfo): Promise<string> {
    try {
      // Capture snapshot from camera
      const snapshotUrl = `${camera.protocol}://${camera.ip}:${camera.port}/axis-cgi/jpg/image.cgi`;
      
      const response = await axios.get(snapshotUrl, {
        auth: {
          username: camera.username!,
          password: camera.password!
        },
        responseType: 'arraybuffer',
        timeout: 5000
      });

      // Convert to base64
      const base64 = Buffer.from(response.data).toString('base64');
      
      // Get magical first insight
      const insight = await magicalProxyService.generateFirstInsight(base64);
      
      return insight;
      
    } catch (error) {
      logger.error('Failed to capture/analyze first frame:', error);
      // Return a fallback insight
      return "I have awakened and can see your world through new eyes.";
    }
  }

  /**
   * Process user's analysis request
   */
  async processUserQuery(query: string, camera: CameraInfo): Promise<string> {
    try {
      // Capture current frame
      const snapshotUrl = `${camera.protocol}://${camera.ip}:${camera.port}/axis-cgi/jpg/image.cgi`;
      
      const response = await axios.get(snapshotUrl, {
        auth: {
          username: camera.username!,
          password: camera.password!
        },
        responseType: 'arraybuffer',
        timeout: 5000
      });

      const base64 = Buffer.from(response.data).toString('base64');
      
      // Analyze with user's prompt
      return await magicalProxyService.analyzeWithUserPrompt(base64, query);
      
    } catch (error) {
      logger.error('Failed to process user query:', error);
      throw new Error('Failed to analyze scene');
    }
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