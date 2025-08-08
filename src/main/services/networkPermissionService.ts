import { spawn } from 'child_process';
import path from 'path';
import { app } from 'electron';
import { getLogger } from '../utils/logger';
import net from 'net';

const logger = getLogger();

export class NetworkPermissionService {
  private helperPath: string;
  
  constructor() {
    // Path to the helper script
    this.helperPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app', 'src', 'main', 'helpers', 'network-connect-helper.js')
      : path.join(__dirname, '../helpers/network-connect-helper.js');
  }

  /**
   * Test if we can connect directly, or if we need to use the helper
   */
  async canConnectDirectly(host: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const client = new net.Socket();
      const timeout = setTimeout(() => {
        client.destroy();
        resolve(false);
      }, 2000);

      client.connect(port, host, () => {
        clearTimeout(timeout);
        client.end();
        resolve(true);
      });

      client.on('error', (err: any) => {
        clearTimeout(timeout);
        if (err.code === 'EHOSTUNREACH') {
          logger.warn(`Direct connection blocked by macOS firewall to ${host}:${port}`);
        }
        resolve(false);
      });
    });
  }

  /**
   * Test connection using the helper script
   */
  async testConnectionViaHelper(host: string, port: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const nodePath = process.execPath;
      const child = spawn(nodePath, [this.helperPath, 'test-tcp', host, port.toString()]);
      
      let output = '';
      let error = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        error += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0 && output) {
          try {
            const result = JSON.parse(output);
            resolve(result);
          } catch (e) {
            reject(new Error(`Failed to parse helper output: ${output}`));
          }
        } else {
          reject(new Error(error || `Helper process exited with code ${code}`));
        }
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Make HTTP request using the helper script
   */
  async httpRequestViaHelper(url: string, method: string = 'GET'): Promise<any> {
    return new Promise((resolve, reject) => {
      const nodePath = process.execPath;
      const child = spawn(nodePath, [this.helperPath, 'http-request', url, method]);
      
      let output = '';
      let error = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        error += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0 && output) {
          try {
            const result = JSON.parse(output);
            resolve(result);
          } catch (e) {
            reject(new Error(`Failed to parse helper output: ${output}`));
          }
        } else {
          reject(new Error(error || `Helper process exited with code ${code}`));
        }
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Discover cameras using the helper script
   */
  async discoverCamerasViaHelper(): Promise<any> {
    return new Promise((resolve, reject) => {
      const nodePath = process.execPath;
      const child = spawn(nodePath, [this.helperPath, 'discover-cameras']);
      
      let output = '';
      let error = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        error += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0 && output) {
          try {
            const result = JSON.parse(output);
            resolve(result);
          } catch (e) {
            reject(new Error(`Failed to parse helper output: ${output}`));
          }
        } else {
          reject(new Error(error || `Helper process exited with code ${code}`));
        }
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Smart connect that tries direct connection first, then falls back to helper
   */
  async smartConnect(host: string, port: number): Promise<{ method: string; success: boolean; result?: any }> {
    // First try direct connection
    const canConnectDirectly = await this.canConnectDirectly(host, port);
    
    if (canConnectDirectly) {
      logger.info(`Direct connection successful to ${host}:${port}`);
      return { method: 'direct', success: true };
    }

    // If direct connection fails, try via helper
    logger.info(`Direct connection failed, trying via helper for ${host}:${port}`);
    try {
      const result = await this.testConnectionViaHelper(host, port);
      if (result.status === 'connected') {
        logger.info(`Helper connection successful to ${host}:${port}`);
        return { method: 'helper', success: true, result };
      } else {
        logger.error(`Helper connection failed to ${host}:${port}:`, result);
        return { method: 'helper', success: false, result };
      }
    } catch (error) {
      logger.error(`Helper process failed for ${host}:${port}:`, error);
      return { method: 'helper', success: false, result: error };
    }
  }

  /**
   * Show user instructions for manual firewall configuration
   */
  getManualInstructions(): string {
    return `To allow Anava Vision to access your local network on macOS 15:

1. Open System Settings
2. Go to Privacy & Security > Firewall
3. Click "Options..."
4. Click the "+" button to add an application
5. Navigate to Applications and select "Anava Vision"
6. Make sure it's set to "Allow incoming connections"
7. Click "OK" to save

Alternatively, run this command in Terminal:
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add "/Applications/Anava Vision.app"
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp "/Applications/Anava Vision.app"`;
  }
}

// Export singleton instance
export const networkPermissionService = new NetworkPermissionService();