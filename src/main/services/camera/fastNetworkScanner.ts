import axios from 'axios';
import https from 'https';
import os from 'os';
import net from 'net';

const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  }),
  timeout: 2000
});

interface ScanResult {
  ip: string;
  accessible: boolean;
  model?: string;
  manufacturer?: string;
  deviceType?: 'camera' | 'speaker';
}

/**
 * FAST parallel network scanner - scans port 443 on all local IPs in parallel
 */
export async function fastNetworkScan(
  credentials: { username: string; password: string },
  onProgress?: (ip: string, status: 'scanning' | 'found' | 'not_found') => void
): Promise<ScanResult[]> {
  console.log('🚀 Starting FAST parallel network scan...');
  
  // Get local network range
  const interfaces = os.networkInterfaces();
  const localRanges: string[] = [];
  
  for (const addresses of Object.values(interfaces)) {
    if (addresses) {
      for (const addr of addresses) {
        if (addr.family === 'IPv4' && !addr.internal) {
          // Extract network range (e.g., 192.168.1.x)
          const parts = addr.address.split('.');
          const baseNetwork = `${parts[0]}.${parts[1]}.${parts[2]}`;
          if (!localRanges.includes(baseNetwork)) {
            localRanges.push(baseNetwork);
          }
        }
      }
    }
  }
  
  if (localRanges.length === 0) {
    console.error('No local network found');
    return [];
  }
  
  console.log(`Scanning network(s): ${localRanges.join(', ')}`);
  
  // Generate all IPs to scan (1-254 for each range)
  const ipsToScan: string[] = [];
  for (const range of localRanges) {
    for (let i = 1; i <= 254; i++) {
      ipsToScan.push(`${range}.${i}`);
    }
  }
  
  console.log(`Scanning ${ipsToScan.length} IPs on port 443...`);
  
  // Scan all IPs in parallel with a reasonable concurrency limit
  const results: ScanResult[] = [];
  const BATCH_SIZE = 50; // Scan 50 IPs at a time
  
  for (let i = 0; i < ipsToScan.length; i += BATCH_SIZE) {
    const batch = ipsToScan.slice(i, i + BATCH_SIZE);
    
    // Scan this batch in parallel
    const batchPromises = batch.map(async (ip) => {
      if (onProgress) onProgress(ip, 'scanning');
      
      // Quick port check on 443
      const isOpen = await checkPort(ip, 443, 500);
      
      if (isOpen) {
        // Port is open, but need to verify it's actually an Axis device
        const cameraInfo = await identifyCamera(ip, credentials);
        
        if (cameraInfo.accessible && cameraInfo.manufacturer === 'Axis') {
          console.log(`✓ Found Axis device at ${ip}`);
          if (onProgress) onProgress(ip, 'found');
          
          return {
            ip,
            accessible: true,
            model: cameraInfo.model,
            manufacturer: 'Axis',
            deviceType: cameraInfo.deviceType
          };
        } else {
          // Port 443 is open but it's not an Axis device
          if (onProgress) onProgress(ip, 'not_found');
          return null;
        }
      } else {
        if (onProgress) onProgress(ip, 'not_found');
        return null;
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.filter(r => r !== null) as ScanResult[]);
  }
  
  console.log(`✅ Scan complete. Found ${results.length} devices`);
  return results;
}

/**
 * Fast port check using raw sockets
 */
function checkPort(ip: string, port: number, timeout: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;
    
    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
      }
    };
    
    socket.setTimeout(timeout);
    
    socket.on('connect', () => {
      cleanup();
      resolve(true);
    });
    
    socket.on('timeout', () => {
      cleanup();
      resolve(false);
    });
    
    socket.on('error', () => {
      cleanup();
      resolve(false);
    });
    
    try {
      socket.connect({ port, host: ip });
    } catch {
      cleanup();
      resolve(false);
    }
  });
}

/**
 * Properly identify if device is an Axis camera or speaker
 */
async function identifyCamera(
  ip: string, 
  credentials: { username: string; password: string }
): Promise<{ accessible: boolean; model?: string; manufacturer?: string; deviceType?: 'camera' | 'speaker' }> {
  try {
    // First try the basicdeviceinfo endpoint with proper auth
    const response = await axiosInstance.get(`https://${ip}/axis-cgi/basicdeviceinfo.cgi`, {
      auth: {
        username: credentials.username,
        password: credentials.password
      },
      timeout: 3000,
      validateStatus: () => true
    });
    
    // If we get 401, it might be an Axis device but wrong credentials
    if (response.status === 401) {
      console.log(`Device at ${ip} requires authentication (likely Axis)`);
      return { accessible: false };
    }
    
    // If not 200, it's not an Axis device
    if (response.status !== 200) {
      return { accessible: false };
    }
    
    // Parse the response to get device info
    const data = response.data.toString();
    const lines = data.split('\n');
    let model = '';
    let deviceType: 'camera' | 'speaker' = 'camera';
    
    for (const line of lines) {
      if (line.startsWith('ProdNbr=')) {
        model = line.split('=')[1].trim();
      } else if (line.startsWith('ProdType=')) {
        const prodType = line.split('=')[1].trim().toLowerCase();
        // Check if it's a speaker (Audio devices)
        if (prodType.includes('speaker') || prodType.includes('audio')) {
          deviceType = 'speaker';
        }
      }
    }
    
    // Double-check by trying to access camera-specific endpoint
    if (deviceType === 'camera') {
      try {
        const cameraCheck = await axiosInstance.get(`https://${ip}/axis-cgi/param.cgi?action=list&group=Image`, {
          auth: {
            username: credentials.username,
            password: credentials.password
          },
          timeout: 2000,
          validateStatus: () => true
        });
        
        if (cameraCheck.status !== 200) {
          // Might be a speaker if this camera endpoint fails
          deviceType = 'speaker';
        }
      } catch {
        // Ignore, already identified as Axis device
      }
    }
    
    console.log(`✓ Found Axis ${deviceType} at ${ip}: ${model}`);
    
    return {
      accessible: true,
      model: model || `Axis ${deviceType}`,
      manufacturer: 'Axis',
      deviceType
    };
    
  } catch (error) {
    // Not an Axis device or network error
    return { accessible: false };
  }
}