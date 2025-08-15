import axios from 'axios';
import https from 'https';
import { getLogger } from '../../utils/logger';

const logger = getLogger();

export interface ProtocolTestResult {
  protocol: 'https' | 'http';
  baseUrl: string;
  verified: boolean;
}

// Cache protocol preferences for each camera IP
const protocolCache = new Map<string, 'https' | 'http'>();

/**
 * Get the base URL for a camera, preferring HTTPS but falling back to HTTP if needed
 * @param ip The camera IP address
 * @param username Optional username for authenticated check
 * @param password Optional password for authenticated check
 * @param forceProtocol Force a specific protocol without testing
 * @param port Optional port number (defaults to 443 for https, 80 for http)
 */
export async function getCameraBaseUrl(
  ip: string, 
  username?: string, 
  password?: string,
  forceProtocol?: 'https' | 'http',
  port?: number
): Promise<string> {
  // Determine default port based on protocol
  const cacheKey = `${ip}:${port || 'default'}`;
  
  // Check cache first
  if (!forceProtocol && protocolCache.has(cacheKey)) {
    const protocol = protocolCache.get(cacheKey)!;
    const finalPort = port || (protocol === 'https' ? 443 : 80);
    return `${protocol}://${ip}:${finalPort}`;
  }

  // If forced, use that
  if (forceProtocol) {
    protocolCache.set(cacheKey, forceProtocol);
    const finalPort = port || (forceProtocol === 'https' ? 443 : 80);
    return `${forceProtocol}://${ip}:${finalPort}`;
  }

  // Test which protocol works
  const result = await testCameraProtocol(ip, username, password, port);
  protocolCache.set(cacheKey, result.protocol);
  return result.baseUrl;
}

/**
 * Test which protocol a camera supports, preferring HTTPS
 */
export async function testCameraProtocol(
  ip: string,
  username?: string,
  password?: string,
  port?: number
): Promise<ProtocolTestResult> {
  // Determine ports to test
  let httpsPort: number;
  let httpPort: number;
  
  if (port) {
    // Custom port specified - use same port for both protocols
    httpsPort = port;
    httpPort = port;
  } else {
    // No port specified - use standard ports
    httpsPort = 443;
    httpPort = 80;
  }
  
  logger.info(`[Protocol] Testing camera protocols for ${ip}:${httpsPort}/${httpPort}`);
  
  // Try HTTPS first (modern cameras prefer this)
  try {
    const httpsUrl = `https://${ip}:${httpsPort}/axis-cgi/param.cgi?action=list&group=Brand`;
    logger.debug(`[Protocol] Trying HTTPS for ${ip}:${httpsPort}`);
    
    await axios.get(httpsUrl, {
      timeout: 3000, // Short timeout for protocol test
      auth: username && password ? { username, password } : undefined,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false // Accept self-signed certificates
      }),
      validateStatus: (status) => status < 500 // Accept any non-server-error
    });
    
    // If we get here without error, HTTPS works
    logger.info(`[Protocol] HTTPS works for ${ip}:${httpsPort}`);
    return {
      protocol: 'https',
      baseUrl: `https://${ip}:${httpsPort}`,
      verified: true
    };
  } catch (httpsError: any) {
    // HTTPS failed, log why
    if (httpsError.code === 'ECONNREFUSED') {
      logger.debug(`[Protocol] HTTPS refused for ${ip}:${httpsPort}`);
    } else if (httpsError.code === 'ETIMEDOUT') {
      logger.debug(`[Protocol] HTTPS timeout for ${ip}:${httpsPort}`);
    } else {
      logger.debug(`[Protocol] HTTPS error for ${ip}:${httpsPort}: ${httpsError.message}`);
    }
  }
  
  // Try HTTP if HTTPS failed
  try {
    const httpUrl = `http://${ip}:${httpPort}/axis-cgi/param.cgi?action=list&group=Brand`;
    logger.debug(`[Protocol] Trying HTTP for ${ip}:${httpPort}`);
    
    await axios.get(httpUrl, {
      timeout: 3000, // Short timeout for protocol test
      auth: username && password ? { username, password } : undefined,
      validateStatus: (status) => status < 500 // Accept any non-server-error
    });
    
    // If we get here without error, HTTP works
    logger.info(`[Protocol] HTTP works for ${ip}:${httpPort}`);
    return {
      protocol: 'http',
      baseUrl: `http://${ip}:${httpPort}`,
      verified: true
    };
  } catch (httpError: any) {
    // Both failed, log error
    logger.warn(`[Protocol] Both HTTPS and HTTP failed for ${ip}:${httpsPort}/${httpPort}`);
    
    // For non-standard ports, make an educated guess based on port number
    if (port && port !== 443 && port !== 80) {
      // For non-standard ports, prefer HTTP unless it's a common HTTPS port
      const httpsLikePorts = [443, 8443, 9443];
      const protocol = httpsLikePorts.includes(port) ? 'https' : 'http';
      const finalPort = port;
      
      logger.info(`[Protocol] Using ${protocol} for non-standard port ${port}`);
      return {
        protocol,
        baseUrl: `${protocol}://${ip}:${finalPort}`,
        verified: false
      };
    }
    
    // Default to HTTPS for standard ports
    return {
      protocol: 'https',
      baseUrl: `https://${ip}:${httpsPort}`,
      verified: false
    };
  }
}

/**
 * Clear the protocol cache for a specific IP or all IPs
 */
export function clearProtocolCache(ip?: string) {
  if (ip) {
    protocolCache.delete(ip);
  } else {
    protocolCache.clear();
  }
}

/**
 * Create an axios instance configured for camera communication
 */
export function createCameraAxiosInstance(baseUrl: string, username?: string, password?: string) {
  const isHttps = baseUrl.startsWith('https');
  
  return axios.create({
    baseURL: baseUrl,
    timeout: 10000, // 10 second timeout for actual operations
    auth: username && password ? { username, password } : undefined,
    httpsAgent: isHttps ? new https.Agent({
      rejectUnauthorized: false // Accept self-signed certificates
    }) : undefined,
    headers: {
      'User-Agent': 'Anava-Installer/1.0'
    }
  });
}