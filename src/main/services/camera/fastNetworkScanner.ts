import { WebContents } from 'electron';
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
  
  for (const [name, addresses] of Object.entries(interfaces)) {
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
        console.log(`✓ Found device at ${ip}:443`);
        if (onProgress) onProgress(ip, 'found');
        
        // Try to identify if it's an Axis camera
        const cameraInfo = await identifyCamera(ip, credentials);
        return {
          ip,
          accessible: cameraInfo.accessible,
          model: cameraInfo.model,
          manufacturer: cameraInfo.manufacturer
        };
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
 * Quick camera identification
 */
async function identifyCamera(
  ip: string, 
  credentials: { username: string; password: string }
): Promise<{ accessible: boolean; model?: string; manufacturer?: string }> {
  try {
    // Try Axis-specific endpoint
    const response = await axiosInstance.get(`https://${ip}/axis-cgi/basicdeviceinfo.cgi`, {
      auth: {
        username: credentials.username,
        password: credentials.password
      },
      validateStatus: () => true
    });
    
    if (response.status === 200) {
      // Parse Axis device info
      const lines = response.data.split('\n');
      let model = '';
      
      for (const line of lines) {
        if (line.startsWith('ProdNbr=')) {
          model = line.split('=')[1].trim();
        }
      }
      
      return {
        accessible: true,
        model: model || 'Axis Camera',
        manufacturer: 'Axis'
      };
    }
    
    return { accessible: false };
  } catch {
    return { accessible: false };
  }
}