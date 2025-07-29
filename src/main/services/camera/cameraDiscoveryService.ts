import { ipcMain, WebContents } from 'electron';
import ping from 'ping';
import axios from 'axios';
import { spawn } from 'child_process';
import os from 'os';
import crypto from 'crypto';

export interface Camera {
  id: string;
  ip: string;
  port: number;
  type: string;
  model: string;
  manufacturer: string;
  mac: string | null;
  capabilities: string[];
  discoveredAt: string;
  status: 'accessible' | 'requires_auth';
  credentials?: {
    username: string;
    password: string;
  };
  rtspUrl?: string;
  httpUrl: string;
  authenticated?: boolean;
}

export class CameraDiscoveryService {
  constructor() {
    this.setupIPC();
  }

  private setupIPC() {
    ipcMain.handle('scan-network-cameras', async (event, options?: { networkRange?: string }) => {
      return this.scanNetworkForCameras(event.sender, options);
    });
    
    ipcMain.handle('quick-scan-camera', async (_event, ip: string, username = 'root', password = 'pass') => {
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
              result.push({
                interface: name,
                address: address.address,
                netmask: address.netmask,
                family: address.family,
                internal: address.internal
              });
            }
          }
        }
      }
      
      return result;
    });
  }

  async quickScanSpecificCamera(ip: string, username = 'root', password = 'pass'): Promise<Camera[]> {
    try {
      console.log(`=== Quick scanning camera at ${ip} with credentials ${username}:${password} ===`);
      
      // First check if the IP is reachable
      console.log(`Step 1: Checking if ${ip} is reachable...`);
      const pingResult = await ping.promise.probe(ip, {
        timeout: 5,
        min_reply: 1
      });
      
      console.log(`Ping result for ${ip}:`, pingResult);
      
      if (!pingResult.alive) {
        console.log(`❌ ${ip} is not reachable via ping`);
        return [];
      }
      
      console.log(`✅ ${ip} is reachable`);
      console.log(`Step 2: Checking for camera with digest auth...`);
      
      // Try to connect to the specific camera with digest auth
      const camera = await this.checkAxisCamera(ip, username, password);
      if (camera) {
        console.log(`✅ Found camera at ${ip}:`, camera);
        return [camera];
      }
      
      console.log(`❌ No camera found at ${ip}`);
      return [];
    } catch (error) {
      console.error(`❌ Error quick scanning camera at ${ip}:`, error);
      return [];
    }
  }

  async testCameraCredentials(ip: string, username: string, password: string) {
    try {
      console.log(`Testing credentials ${username}:${password} for ${ip}`);
      
      // Test with digest auth on a simple endpoint
      const result = await this.digestAuth(ip, username, password, '/axis-cgi/param.cgi?action=list&group=Brand');
      
      if (result && result.includes('Brand=AXIS')) {
        console.log(`✅ Credentials work for ${ip}`);
        return {
          success: true,
          authenticated: true,
          message: 'Authentication successful'
        };
      } else {
        console.log(`❌ Credentials failed for ${ip}`);
        return {
          success: false,
          authenticated: false,
          message: 'Authentication failed'
        };
      }
    } catch (error: any) {
      console.error(`Error testing credentials for ${ip}:`, error.message);
      return {
        success: false,
        authenticated: false,
        message: `Error: ${error.message}`
      };
    }
  }

  async scanNetworkForCameras(sender?: WebContents, options?: { networkRange?: string }): Promise<Camera[]> {
    try {
      const networks = [];
      
      if (options?.networkRange) {
        // Use custom network range if provided
        const [baseIp, subnet] = options.networkRange.split('/');
        networks.push({
          interface: 'custom',
          address: baseIp,
          netmask: this.subnetToNetmask(parseInt(subnet)),
          network: options.networkRange
        });
      } else {
        // Use all network interfaces
        const networkInterfaces = os.networkInterfaces();
        
        for (const [name, addresses] of Object.entries(networkInterfaces)) {
          if (addresses) {
            for (const address of addresses) {
              if (address.family === 'IPv4' && !address.internal) {
                networks.push({
                  interface: name,
                  address: address.address,
                  netmask: address.netmask,
                  network: this.getNetworkAddress(address.address, address.netmask)
                });
              }
            }
          }
        }
      }

      const cameras: Camera[] = [];
      
      for (const network of networks) {
        const networkCameras = await this.scanNetwork(network, sender);
        cameras.push(...networkCameras);
      }

      return cameras;
    } catch (error) {
      console.error('Error scanning for cameras:', error);
      throw error;
    }
  }

  private async scanNetwork(network: any, sender?: WebContents): Promise<Camera[]> {
    const cameras: Camera[] = [];
    const networkParts = network.network.split('/');
    const baseIp = networkParts[0];
    const subnet = parseInt(networkParts[1]);
    
    // Calculate IP range
    const ipRange = this.calculateIPRange(baseIp, subnet);
    
    console.log(`Scanning network ${network.network} (${ipRange.start} - ${ipRange.end})`);
    
    // Send initial progress
    if (sender) {
      sender.send('camera-scan-progress', { ip: network.network, status: 'scanning' });
    }
    
    const scanPromises = [];
    
    for (let i = ipRange.startNum; i <= ipRange.endNum; i++) {
      const ip = this.numberToIP(i);
      scanPromises.push(this.checkForCamera(ip, sender));
    }
    
    // Process in batches to avoid overwhelming the network
    const batchSize = 20;
    let scannedCount = 0;
    const totalIPs = scanPromises.length;
    
    for (let i = 0; i < scanPromises.length; i += batchSize) {
      const batch = scanPromises.slice(i, i + batchSize);
      const results = await Promise.allSettled(batch);
      
      scannedCount += batch.length;
      
      // Send progress update every batch
      if (sender) {
        const currentIP = this.numberToIP(ipRange.startNum + Math.min(i + batchSize, totalIPs - 1));
        sender.send('camera-scan-progress', { 
          ip: `${currentIP} (${scannedCount}/${totalIPs})`, 
          status: 'scanning' 
        });
      }
      
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          cameras.push(result.value);
        }
      }
    }
    
    return cameras;
  }

  private async checkForCamera(ip: string, sender?: WebContents): Promise<Camera | null> {
    try {
      // First, ping the IP to see if it's alive
      const pingResult = await ping.promise.probe(ip, {
        timeout: 2,
        min_reply: 1
      });
      
      if (!pingResult.alive) {
        return null;
      }
      
      console.log(`Checking device at ${ip}...`);
      
      // Send progress update
      if (sender) {
        sender.send('camera-scan-progress', { ip, status: 'checking' });
      }
      
      // Check for Axis-specific endpoints
      try {
        const axisCheck = await axios.get(`http://${ip}/axis-cgi/param.cgi`, {
          timeout: 1000,
          validateStatus: () => true
        });
        
        if (axisCheck.status === 401 || axisCheck.status === 200) {
          // This is likely an Axis device, validate it
          console.log(`  ✓ Found Axis device at ${ip}`);
          return await this.checkAxisCamera(ip, 'root', 'pass');
        }
      } catch (e) {
        // Not an Axis device
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  private async checkAxisCamera(ip: string, username: string, password: string): Promise<Camera | null> {
    try {
      console.log(`=== Checking Axis camera at ${ip} with credentials ${username}:${password} ===`);
      
      // Try to get device info with digest auth
      const response = await this.digestAuth(ip, username, password, '/axis-cgi/param.cgi?action=list&group=Brand');
      
      if (response && response.includes('Brand=AXIS')) {
        console.log(`  ✅ Confirmed Axis device via VAPIX`);
        const modelMatch = response.match(/ProdNbr=([^\r\n]+)/);
        const typeMatch = response.match(/ProdType=([^\r\n]+)/);
        const productType = typeMatch ? typeMatch[1] : '';
        
        // Filter out non-camera Axis devices
        if (productType.toLowerCase().includes('speaker') || 
            productType.toLowerCase().includes('audio') ||
            productType.toLowerCase().includes('sound')) {
          console.log(`  ❌ Axis device is not a camera (${productType})`);
          return null;
        }
        
        const camera: Camera = {
          id: `camera-${ip.replace(/\./g, '-')}`,
          ip: ip,
          port: 80,
          type: 'Axis Camera',
          model: modelMatch ? modelMatch[1] : 'Unknown Model',
          manufacturer: 'Axis Communications',
          mac: await this.getMACAddress(ip),
          capabilities: ['HTTP', 'ACAP', 'VAPIX', 'RTSP'],
          discoveredAt: new Date().toISOString(),
          status: 'accessible',
          credentials: { username, password },
          rtspUrl: `rtsp://${username}:${password}@${ip}:554/axis-media/media.amp`,
          httpUrl: `http://${ip}`,
          authenticated: true
        };
        
        console.log('✅ Camera validated and created:', camera);
        return camera;
      }
      
      console.log(`❌ Device at ${ip} is not an Axis camera`);
      return null;
    } catch (error: any) {
      console.error(`❌ Error checking camera at ${ip}:`, error.message);
      return null;
    }
  }

  private async digestAuth(ip: string, username: string, password: string, path: string): Promise<string | null> {
    try {
      // First request to get the digest challenge
      const response1 = await axios.get(`http://${ip}${path}`, {
        timeout: 3000,
        validateStatus: () => true
      });

      if (response1.status === 401) {
        const wwwAuth = response1.headers['www-authenticate'];
        if (wwwAuth && wwwAuth.includes('Digest')) {
          const digestData = this.parseDigestAuth(wwwAuth);
          const authHeader = this.buildDigestHeader(username, password, 'GET', path, digestData);
          
          const response2 = await axios.get(`http://${ip}${path}`, {
            headers: { 'Authorization': authHeader },
            timeout: 3000
          });

          if (response2.status === 200) {
            return response2.data;
          }
        }
      }
    } catch (error: any) {
      console.log('Digest auth error:', error.message);
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

  private async getMACAddress(ip: string): Promise<string | null> {
    try {
      const arp = spawn('arp', ['-n', ip]);
      
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
    
    // Calculate subnet bits
    const subnetBits = maskParts.reduce((bits, part) => {
      return bits + part.toString(2).split('1').length - 1;
    }, 0);
    
    return networkParts.join('.') + '/' + subnetBits;
  }

  private calculateIPRange(baseIp: string, subnet: number): any {
    const hostBits = 32 - subnet;
    const numHosts = Math.pow(2, hostBits);
    
    const startNum = this.ipToNumber(baseIp);
    const endNum = startNum + numHosts - 1;
    
    return {
      start: baseIp,
      end: this.numberToIP(endNum),
      startNum: startNum + 1, // Skip network address
      endNum: endNum - 1      // Skip broadcast address
    };
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

  private subnetToNetmask(subnet: number): string {
    const mask = (0xffffffff << (32 - subnet)) >>> 0;
    return [
      (mask >>> 24) & 255,
      (mask >>> 16) & 255,
      (mask >>> 8) & 255,
      mask & 255
    ].join('.');
  }
}