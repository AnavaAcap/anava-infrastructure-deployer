import { spawn } from 'child_process';
import os from 'os';
import net from 'net';
import { logger } from './logger';

/**
 * Platform-specific network utilities
 * Handles differences between Windows, macOS, and Linux
 */

/**
 * Check if a host is reachable using platform-appropriate methods
 * Falls back to TCP socket check if ping fails (Windows admin rights issue)
 */
export async function isHostReachable(ip: string, timeout = 2000): Promise<boolean> {
  const platform = os.platform();
  
  // Try TCP socket first (works without admin rights)
  try {
    const socketReachable = await checkTCPSocket(ip, [443, 80, 8080], timeout);
    if (socketReachable) {
      logger.debug(`[Network] Host ${ip} reachable via TCP socket`);
      return true;
    }
  } catch (error) {
    logger.debug(`[Network] TCP socket check failed for ${ip}:`, error);
  }

  // Fall back to ping if TCP fails
  if (platform === 'win32') {
    // Windows ping might require admin rights
    try {
      return await windowsPing(ip, timeout);
    } catch (error) {
      logger.warn(`[Network] Windows ping failed for ${ip}, may need admin rights:`, error);
      return false;
    }
  } else {
    // macOS and Linux
    return await unixPing(ip, timeout);
  }
}

/**
 * Check if any TCP port is open on the host
 */
async function checkTCPSocket(ip: string, ports: number[], timeout: number): Promise<boolean> {
  for (const port of ports) {
    try {
      const result = await new Promise<boolean>((resolve) => {
        const socket = new net.Socket();

        socket.setTimeout(timeout);
        
        socket.on('connect', () => {
          socket.destroy();
          resolve(true);
        });

        socket.on('timeout', () => {
          socket.destroy();
          resolve(false);
        });

        socket.on('error', () => {
          socket.destroy();
          resolve(false);
        });

        socket.connect(port, ip);
      });

      if (result) return true;
    } catch (error) {
      // Continue to next port
    }
  }
  return false;
}

/**
 * Windows-specific ping implementation
 */
async function windowsPing(ip: string, timeout: number): Promise<boolean> {
  return new Promise((resolve) => {
    const ping = spawn('ping', ['-n', '1', '-w', String(timeout), ip], {
      windowsHide: true // Hide console window on Windows
    });
    
    let output = '';
    
    ping.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    ping.on('close', (code) => {
      // Windows ping returns 0 on success
      if (code === 0 && output.includes('Reply from')) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    
    ping.on('error', (error) => {
      logger.error(`[Network] Windows ping spawn error:`, error);
      resolve(false);
    });
    
    // Kill process after timeout
    setTimeout(() => {
      try {
        ping.kill();
      } catch (e) {
        // Process already ended
      }
      resolve(false);
    }, timeout + 1000);
  });
}

/**
 * Unix-based (macOS/Linux) ping implementation
 */
async function unixPing(ip: string, timeout: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timeoutSec = Math.ceil(timeout / 1000);
    const ping = spawn('ping', ['-c', '1', '-W', String(timeoutSec), ip]);
    
    let output = '';
    
    ping.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    ping.on('close', (code) => {
      // Unix ping returns 0 on success
      if (code === 0) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    
    ping.on('error', (error) => {
      logger.error(`[Network] Unix ping spawn error:`, error);
      resolve(false);
    });
    
    // Kill process after timeout
    setTimeout(() => {
      try {
        ping.kill();
      } catch (e) {
        // Process already ended
      }
      resolve(false);
    }, timeout + 1000);
  });
}

/**
 * Get network interfaces with proper filtering for platform
 */
export function getNetworkInterfaces(): Array<{address: string, netmask: string, family: string}> {
  const interfaces = os.networkInterfaces();
  const results = [];
  
  for (const [name, addresses] of Object.entries(interfaces)) {
    if (!addresses) continue;
    
    for (const addr of addresses) {
      // Skip internal/loopback interfaces
      if (addr.internal) continue;
      
      // Only IPv4
      if (addr.family !== 'IPv4') continue;
      
      // Platform-specific filtering
      const platform = os.platform();
      if (platform === 'darwin') {
        // macOS: Skip bridges and virtual interfaces
        if (name.startsWith('bridge') || name.startsWith('vbox') || name.startsWith('vmnet')) {
          continue;
        }
      } else if (platform === 'win32') {
        // Windows: Skip virtual adapters
        if (name.includes('VirtualBox') || name.includes('VMware') || name.includes('Hyper-V')) {
          continue;
        }
      }
      
      results.push({
        address: addr.address,
        netmask: addr.netmask,
        family: addr.family
      });
    }
  }
  
  return results;
}

/**
 * Calculate network range from IP and netmask
 */
export function getNetworkRange(ip: string, netmask: string): string {
  const ipParts = ip.split('.').map(Number);
  const maskParts = netmask.split('.').map(Number);
  
  const networkParts = ipParts.map((part, i) => part & maskParts[i]);
  
  // Return base network (e.g., "192.168.1" for /24 network)
  if (maskParts[3] === 0) {
    return networkParts.slice(0, 3).join('.');
  }
  
  return networkParts.join('.');
}