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
  authRequired?: boolean;
  model?: string;
  manufacturer?: string;
  deviceType?: 'camera' | 'speaker';
  mac?: string;
}

/**
 * FAST parallel network scanner - scans port 443 on all local IPs in parallel
 */
export async function fastNetworkScan(
  credentials: { username: string; password: string },
  onProgress?: (ip: string, status: 'scanning' | 'found' | 'not_found' | 'total', total?: number) => void
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
  
  // Report the total number of IPs to scan
  if (onProgress) {
    onProgress('', 'total', ipsToScan.length);
  }
  
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
        
        if ((cameraInfo.accessible || cameraInfo.authRequired) && cameraInfo.manufacturer === 'Axis') {
          console.log(`✓ Found Axis device at ${ip}`);
          if (onProgress) onProgress(ip, 'found');
          
          return {
            ip,
            accessible: cameraInfo.accessible || false,
            authRequired: cameraInfo.authRequired,
            model: cameraInfo.model,
            manufacturer: 'Axis',
            deviceType: cameraInfo.deviceType,
            mac: cameraInfo.mac
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
export async function identifyCamera(
  ip: string, 
  credentials: { username: string; password: string }
): Promise<{ accessible: boolean; authRequired?: boolean; model?: string; manufacturer?: string; deviceType?: 'camera' | 'speaker'; mac?: string }> {
  try {
    // Try GET first (older devices)
    let response = await axiosInstance.get(`https://${ip}/axis-cgi/basicdeviceinfo.cgi`, {
      auth: {
        username: credentials.username,
        password: credentials.password
      },
      timeout: 3000,
      validateStatus: () => true
    });
    
    // If we get 401, it's an Axis device but wrong credentials
    if (response.status === 401) {
      console.log(`Axis device at ${ip} requires correct authentication`);
      
      // Try to determine if it's a speaker by checking audio endpoint
      try {
        const speakerCheck = await axiosInstance.get(`https://${ip}/axis-cgi/audio/transmit.cgi`, {
          auth: { username: credentials.username, password: credentials.password },
          validateStatus: () => true,
          timeout: 1000
        });
        
        if (speakerCheck.status === 401 || speakerCheck.status === 200) {
          console.log(`Audio endpoint exists - likely a SPEAKER`);
          return {
            accessible: false,  // NOT accessible without correct credentials!
            authRequired: true,
            model: 'Axis Speaker (Authentication Required)',
            manufacturer: 'Axis',
            deviceType: 'speaker'
          };
        }
      } catch (e) {
        // Audio endpoint doesn't exist, probably a camera
      }
      
      // Default to camera if can't determine
      return { 
        accessible: false,  // NOT accessible without correct credentials!
        authRequired: true,
        model: 'Axis Camera (Authentication Required)',
        manufacturer: 'Axis',
        deviceType: 'camera'
      };
    }
    
    // Check if it's a newer device that requires POST
    if (response.status === 200 && response.data?.error?.message?.includes('POST supported')) {
      console.log(`Device at ${ip} requires POST method (newer Axis device)`);
      
      // Try POST with JSON-RPC format for newer devices
      // Include all properties we want to retrieve
      const propertyList = [
        'Brand', 'BuildDate', 'HardwareID', 'ProdFullName',
        'ProdNbr', 'ProdShortName', 'ProdType', 'ProdVariant',
        'SerialNumber', 'Soc', 'SocSerialNumber', 'Version', 'WebURL'
      ];
      
      response = await axiosInstance.post(`https://${ip}/axis-cgi/basicdeviceinfo.cgi`, 
        {
          "apiVersion": "1.0",
          "method": "getProperties",
          "params": {
            "propertyList": propertyList
          }
        },
        {
          auth: {
            username: credentials.username,
            password: credentials.password
          },
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 3000,
          validateStatus: () => true
        }
      );
    }
    
    // If not 200 at this point, it's not an Axis device
    if (response.status !== 200) {
      return { accessible: false };
    }
    
    // Parse the response - could be JSON or key=value format
    let model = '';
    let serialNumber = '';
    let macAddress = '';
    let deviceType: 'camera' | 'speaker' = 'camera';
    
    // Check if response is JSON (newer devices)
    if (typeof response.data === 'object' && response.data.data?.propertyList) {
      const properties = response.data.data.propertyList;
      
      model = properties.ProdNbr || properties.ProdFullName || '';
      serialNumber = properties.SerialNumber || '';
      macAddress = serialNumber.toUpperCase();
      
      const prodType = (properties.ProdType || '').toLowerCase();
      console.log(`Product Type: ${properties.ProdType}`);
      
      // Check device type - be more specific
      if (prodType.includes('speaker') || prodType.includes('audio') || prodType.includes('horn')) {
        deviceType = 'speaker';
      } else if (prodType.includes('camera') || prodType.includes('dome') || prodType.includes('bullet')) {
        deviceType = 'camera';
      }
      
      console.log(`✓ Found Axis ${deviceType} at ${ip}: ${model} (${properties.ProdType})`);
      
      return {
        accessible: true,
        model: model || `Axis ${deviceType}`,
        manufacturer: 'Axis',
        deviceType,
        mac: macAddress || undefined
      };
    } else {
      // Old key=value format
      const data = response.data.toString();
      
      // If it doesn't have Axis-specific fields, it's not an Axis device
      if (!data.includes('ProdNbr=') && !data.includes('Brand=') && !data.includes('SerialNumber=')) {
        console.log(`Device at ${ip} responded but is not an Axis device`);
        return { accessible: false };
      }
      
      const lines = data.split('\n');
      for (const line of lines) {
        if (line.startsWith('ProdNbr=')) {
          model = line.split('=')[1].trim();
        } else if (line.startsWith('SerialNumber=')) {
          serialNumber = line.split('=')[1].trim();
          macAddress = serialNumber.toUpperCase();
          console.log(`Found SerialNumber/MAC: ${macAddress}`);
        } else if (line.startsWith('ProdType=')) {
          const prodType = line.split('=')[1].trim().toLowerCase();
          if (prodType.includes('speaker') || prodType.includes('audio')) {
            deviceType = 'speaker';
          }
        }
      }
    }
    
    console.log(`✓ Found Axis ${deviceType} at ${ip}: ${model} (MAC: ${macAddress})`);
    
    return {
      accessible: true,
      model: model || `Axis ${deviceType}`,
      manufacturer: 'Axis',
      deviceType,
      mac: macAddress || undefined
    };
    
  } catch (error) {
    // Not an Axis device or network error
    return { accessible: false };
  }
}