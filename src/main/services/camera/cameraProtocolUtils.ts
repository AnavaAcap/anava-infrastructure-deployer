import axios from 'axios';
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
 */
export async function getCameraBaseUrl(
  ip: string, 
  username?: string, 
  password?: string,
  forceProtocol?: 'https' | 'http'
): Promise<string> {
  // Check cache first
  if (!forceProtocol && protocolCache.has(ip)) {
    const protocol = protocolCache.get(ip)!;
    return `${protocol}://${ip}`;
  }

  // If forced, use that
  if (forceProtocol) {
    protocolCache.set(ip, forceProtocol);
    return `${forceProtocol}://${ip}`;
  }

  // Test which protocol works
  const result = await testCameraProtocol(ip, username, password);
  protocolCache.set(ip, result.protocol);
  return result.baseUrl;
}

/**
 * Test which protocol a camera supports, preferring HTTPS
 */
export async function testCameraProtocol(
  ip: string,
  username?: string,
  password?: string
): Promise<ProtocolTestResult> {
  logger.info(`[Protocol] Testing camera protocols for ${ip}`);
  
  // Try HTTPS first (modern cameras prefer this)
  try {
    const httpsUrl = `https://${ip}/axis-cgi/param.cgi?action=list&group=Brand`;
    logger.debug(`[Protocol] Trying HTTPS for ${ip}`);
    
    await axios.get(httpsUrl, {
      timeout: 3000, // Short timeout for protocol test
      auth: username && password ? { username, password } : undefined,
      httpsAgent: new (require('https').Agent)({
        rejectUnauthorized: false // Accept self-signed certificates
      }),
      validateStatus: (status) => status < 500 // Accept any non-server-error
    });
    
    // If we get here without error, HTTPS works
    logger.info(`[Protocol] HTTPS works for ${ip}`);
    return {
      protocol: 'https',
      baseUrl: `https://${ip}`,
      verified: true
    };
  } catch (httpsError: any) {
    // HTTPS failed, log why
    if (httpsError.code === 'ECONNREFUSED') {
      logger.debug(`[Protocol] HTTPS refused for ${ip}`);
    } else if (httpsError.code === 'ETIMEDOUT') {
      logger.debug(`[Protocol] HTTPS timeout for ${ip}`);
    } else {
      logger.debug(`[Protocol] HTTPS error for ${ip}: ${httpsError.message}`);
    }
  }
  
  // Try HTTP as fallback
  try {
    const httpUrl = `http://${ip}/axis-cgi/param.cgi?action=list&group=Brand`;
    logger.debug(`[Protocol] Trying HTTP for ${ip}`);
    
    await axios.get(httpUrl, {
      timeout: 3000, // Short timeout for protocol test
      auth: username && password ? { username, password } : undefined,
      validateStatus: (status) => status < 500 // Accept any non-server-error
    });
    
    // If we get here without error, HTTP works
    logger.info(`[Protocol] HTTP works for ${ip} (HTTPS not available)`);
    return {
      protocol: 'http',
      baseUrl: `http://${ip}`,
      verified: true
    };
  } catch (httpError: any) {
    // Both failed, log error
    logger.warn(`[Protocol] Both HTTPS and HTTP failed for ${ip}`);
    
    // Default to HTTPS for modern cameras
    return {
      protocol: 'https',
      baseUrl: `https://${ip}`,
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
    httpsAgent: isHttps ? new (require('https').Agent)({
      rejectUnauthorized: false // Accept self-signed certificates
    }) : undefined,
    headers: {
      'User-Agent': 'Anava-Installer/1.0'
    }
  });
}