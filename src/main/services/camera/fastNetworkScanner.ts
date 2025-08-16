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
  port?: number;
  accessible: boolean;
  authRequired?: boolean;
  model?: string;
  manufacturer?: string;
  deviceType?: 'camera' | 'speaker';
  mac?: string;
}

/**
 * FAST parallel network scanner - scans specified port on all local IPs in parallel
 */
export async function fastNetworkScan(
  credentials: { username: string; password: string },
  onProgress?: (ip: string, status: 'scanning' | 'found' | 'not_found' | 'total', total?: number) => void,
  port: number = 443
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
  
  console.log(`Scanning ${ipsToScan.length} IPs on port ${port}...`);
  
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
      
      // Quick port check on specified port
      const isOpen = await checkPort(ip, port, 500);
      
      if (isOpen) {
        // Port is open, but need to verify it's actually an Axis device
        const cameraInfo = await identifyCamera(ip, credentials, port);
        
        if ((cameraInfo.accessible || cameraInfo.authRequired) && cameraInfo.manufacturer === 'Axis') {
          console.log(`✓ Found Axis device at ${ip}:${port}`);
          if (onProgress) onProgress(ip, 'found');
          
          return {
            ip,
            port,
            accessible: cameraInfo.accessible || false,
            authRequired: cameraInfo.authRequired,
            model: cameraInfo.model,
            manufacturer: 'Axis',
            deviceType: cameraInfo.deviceType,
            mac: cameraInfo.mac
          };
        } else {
          // Port is open but it's not an Axis device
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
  credentials: { username: string; password: string },
  port: number = 443
): Promise<{ accessible: boolean; authRequired?: boolean; model?: string; manufacturer?: string; deviceType?: 'camera' | 'speaker'; mac?: string; error?: string }> {
  try {
    const protocol = port === 80 ? 'http' : 'https';
    const baseUrl = `${protocol}://${ip}:${port}`;
    
    console.log(`[identifyCamera] Testing ${ip}:${port} with ${protocol.toUpperCase()}`);
    console.log(`[identifyCamera] Credentials: ${credentials.username}/${credentials.password ? '***' : 'EMPTY'}`);
    
    // Try Basic Auth first (most common for both HTTP and HTTPS)
    console.log(`[identifyCamera] Trying Basic Auth first`);
    let result = await tryBasicAuthenticationMethod(baseUrl, credentials);
    
    if (result.accessible) {
      console.log(`[identifyCamera] ✅ Basic Auth successful`);
      return result;
    }
    
    // If Basic Auth failed and we got a proper auth challenge, try Digest Auth
    if (result.authRequired && result.error === 'Invalid username or password') {
      console.log(`[identifyCamera] Basic Auth failed, trying Digest Auth as fallback`);
      result = await tryDigestAuthenticationMethod(baseUrl, credentials);
      
      if (result.accessible) {
        console.log(`[identifyCamera] ✅ Digest Auth successful`);
        return result;
      }
    }
    
    console.log(`[identifyCamera] ❌ All authentication methods failed: ${result.error}`);
    return result;
    
  } catch (error: any) {
    console.error(`[identifyCamera] Error:`, error.message);
    return { 
      accessible: false, 
      error: error.code === 'ETIMEDOUT' ? 'Connection timeout' : 
             error.code === 'ECONNREFUSED' ? 'Connection refused' :
             error.message || 'Network error'
    };
  }
}

/**
 * Try Basic Authentication with both GET and POST methods
 */
async function tryBasicAuthenticationMethod(
  baseUrl: string, 
  credentials: { username: string; password: string }
): Promise<{ accessible: boolean; authRequired?: boolean; model?: string; manufacturer?: string; deviceType?: 'camera' | 'speaker'; mac?: string; error?: string }> {
  try {
    console.log(`[tryBasicAuth] Attempting Basic Auth for ${baseUrl}`);
    
    // Try GET first (older devices)
    let response = await axiosInstance.get(`${baseUrl}/axis-cgi/basicdeviceinfo.cgi`, {
      auth: {
        username: credentials.username,
        password: credentials.password
      },
      timeout: 3000,
      validateStatus: () => true
    });
    
    console.log(`[tryBasicAuth] GET response status: ${response.status}`);
    
    // Handle 401 - authentication failed
    if (response.status === 401) {
      console.log(`[tryBasicAuth] 401 - Invalid credentials`);
      return { 
        accessible: false, 
        authRequired: true,
        error: 'Invalid username or password',
        manufacturer: 'Axis',
        deviceType: 'camera'
      };
    }
    
    // Check if device requires POST (newer devices)
    if (response.status === 200 && response.data?.error?.message?.includes('POST supported')) {
      console.log(`[tryBasicAuth] Device requires POST method, trying POST...`);
      
      response = await axiosInstance.post(`${baseUrl}/axis-cgi/basicdeviceinfo.cgi`, 
        {
          "apiVersion": "1.0",
          "method": "getProperties",
          "params": {
            "propertyList": ["Brand", "ProdNbr", "ProdFullName", "ProdType", "SerialNumber"]
          }
        },
        {
          auth: {
            username: credentials.username,
            password: credentials.password
          },
          headers: { 'Content-Type': 'application/json' },
          timeout: 3000,
          validateStatus: () => true
        }
      );
      
      console.log(`[tryBasicAuth] POST response status: ${response.status}`);
      
      // Handle 401 on POST
      if (response.status === 401) {
        console.log(`[tryBasicAuth] POST 401 - Invalid credentials`);
        return { 
          accessible: false, 
          authRequired: true,
          error: 'Invalid username or password',
          manufacturer: 'Axis',
          deviceType: 'camera'
        };
      }
    }
    
    // Success case
    if (response.status === 200) {
      console.log(`[tryBasicAuth] ✅ Success - parsing device info`);
      return parseDeviceInfo(response);
    }
    
    // Other status codes
    console.log(`[tryBasicAuth] Unexpected status: ${response.status}`);
    return { 
      accessible: false, 
      error: `HTTP ${response.status}` 
    };
    
  } catch (error: any) {
    console.error(`[tryBasicAuth] Error:`, error.message);
    return { 
      accessible: false, 
      error: error.message || 'Authentication failed' 
    };
  }
}

/**
 * Try Digest Authentication 
 */
async function tryDigestAuthenticationMethod(
  baseUrl: string, 
  credentials: { username: string; password: string }
): Promise<{ accessible: boolean; authRequired?: boolean; model?: string; manufacturer?: string; deviceType?: 'camera' | 'speaker'; mac?: string; error?: string }> {
  try {
    console.log(`[tryDigestAuth] Attempting Digest Auth for ${baseUrl}`);
    
    // First request to get authentication challenge
    const challengeResponse = await axiosInstance.get(`${baseUrl}/axis-cgi/basicdeviceinfo.cgi`, {
      timeout: 3000,
      validateStatus: () => true
    });
    
    console.log(`[tryDigestAuth] Challenge response status: ${challengeResponse.status}`);
    
    if (challengeResponse.status !== 401) {
      console.log(`[tryDigestAuth] No 401 challenge - digest not supported`);
      return { 
        accessible: false, 
        error: 'Device does not support digest authentication' 
      };
    }
    
    // Parse WWW-Authenticate header for digest challenge
    const authHeader = challengeResponse.headers['www-authenticate'];
    console.log(`[tryDigestAuth] Auth header: ${authHeader}`);
    
    if (!authHeader || !authHeader.toLowerCase().includes('digest')) {
      console.log(`[tryDigestAuth] No digest challenge in header`);
      return { 
        accessible: false, 
        error: 'Device does not support digest authentication' 
      };
    }
    
    // Extract digest parameters
    const digestParams: any = {};
    const regex = /(\w+)="([^"]+)"/g;
    let match;
    
    while ((match = regex.exec(authHeader)) !== null) {
      digestParams[match[1]] = match[2];
    }
    
    if (!digestParams.realm || !digestParams.nonce) {
      console.log(`[tryDigestAuth] Missing realm or nonce in challenge`);
      return { 
        accessible: false, 
        error: 'Invalid digest challenge' 
      };
    }
    
    console.log(`[tryDigestAuth] Creating digest response...`);
    
    // Create digest response
    const crypto = require('crypto');
    const ha1 = crypto.createHash('md5').update(`${credentials.username}:${digestParams.realm}:${credentials.password}`).digest('hex');
    const ha2 = crypto.createHash('md5').update(`GET:/axis-cgi/basicdeviceinfo.cgi`).digest('hex');
    const response = crypto.createHash('md5').update(`${ha1}:${digestParams.nonce}:${ha2}`).digest('hex');
    
    const digestAuth = `Digest username="${credentials.username}", realm="${digestParams.realm}", nonce="${digestParams.nonce}", uri="/axis-cgi/basicdeviceinfo.cgi", response="${response}"`;
    
    // Make authenticated request
    const authResponse = await axiosInstance.get(`${baseUrl}/axis-cgi/basicdeviceinfo.cgi`, {
      headers: {
        'Authorization': digestAuth
      },
      timeout: 3000,
      validateStatus: () => true
    });
    
    console.log(`[tryDigestAuth] Auth response status: ${authResponse.status}`);
    
    if (authResponse.status === 200) {
      console.log(`[tryDigestAuth] ✅ Success - parsing device info`);
      return parseDeviceInfo(authResponse);
    } else if (authResponse.status === 401) {
      console.log(`[tryDigestAuth] 401 - Invalid credentials`);
      return { 
        accessible: false, 
        authRequired: true,
        error: 'Invalid username or password',
        manufacturer: 'Axis',
        deviceType: 'camera'
      };
    } else {
      console.log(`[tryDigestAuth] Unexpected status: ${authResponse.status}`);
      return { 
        accessible: false, 
        error: `HTTP ${authResponse.status}` 
      };
    }
    
  } catch (error: any) {
    console.error(`[tryDigestAuth] Error:`, error.message);
    return { 
      accessible: false, 
      error: error.message || 'Digest authentication failed' 
    };
  }
}

/**
 * Parse device response to extract model, type, and MAC
 */
function parseDeviceInfo(response: any): { accessible: boolean; model?: string; manufacturer?: string; deviceType?: 'camera' | 'speaker'; mac?: string } {
  let model = '';
  let serialNumber = '';
  let macAddress = '';
  let deviceType: 'camera' | 'speaker' = 'camera';
  
  console.log(`[parseDeviceInfo] Parsing response...`);
  
  // Check if response is JSON (newer devices)
  if (typeof response.data === 'object' && response.data.data?.propertyList) {
    const properties = response.data.data.propertyList;
    
    model = properties.ProdNbr || properties.ProdFullName || '';
    serialNumber = properties.SerialNumber || '';
    macAddress = serialNumber.toUpperCase();
    
    const prodType = (properties.ProdType || '').toLowerCase();
    console.log(`[parseDeviceInfo] Product Type: ${properties.ProdType}`);
    
    // Check device type
    if (prodType.includes('speaker') || prodType.includes('audio') || prodType.includes('horn')) {
      deviceType = 'speaker';
    } else if (prodType.includes('camera') || prodType.includes('dome') || prodType.includes('bullet')) {
      deviceType = 'camera';
    }
    
    console.log(`[parseDeviceInfo] ✅ Found Axis ${deviceType}: ${model} (${properties.ProdType})`);
    
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
      console.log(`[parseDeviceInfo] Device responded but is not an Axis device`);
      return { accessible: false };
    }
    
    const lines = data.split('\n');
    for (const line of lines) {
      if (line.startsWith('ProdNbr=')) {
        model = line.split('=')[1].trim();
      } else if (line.startsWith('SerialNumber=')) {
        serialNumber = line.split('=')[1].trim();
        macAddress = serialNumber.toUpperCase();
        console.log(`[parseDeviceInfo] Found SerialNumber/MAC: ${macAddress}`);
      } else if (line.startsWith('ProdType=')) {
        const prodType = line.split('=')[1].trim().toLowerCase();
        if (prodType.includes('speaker') || prodType.includes('audio')) {
          deviceType = 'speaker';
        }
      }
    }
  }
  
  console.log(`[parseDeviceInfo] ✅ Found Axis ${deviceType}: ${model} (MAC: ${macAddress})`);
  
  return {
    accessible: true,
    model: model || `Axis ${deviceType}`,
    manufacturer: 'Axis',
    deviceType,
    mac: macAddress || undefined
  };
}



