import { dialog } from 'electron';
import { Bonjour } from 'bonjour-service';
import { getLogger } from '../utils/logger';

const logger = getLogger();

export class NetworkPermissionManager {
  private static instance: NetworkPermissionManager;
  private permissionGranted: boolean = false;
  private permissionChecked: boolean = false;

  private constructor() {}

  static getInstance(): NetworkPermissionManager {
    if (!NetworkPermissionManager.instance) {
      NetworkPermissionManager.instance = new NetworkPermissionManager();
    }
    return NetworkPermissionManager.instance;
  }

  /**
   * Request network permission using Bonjour as a trigger
   * This should be called BEFORE any network operations that need local network access
   */
  async requestNetworkPermission(): Promise<boolean> {
    if (this.permissionChecked) {
      return this.permissionGranted;
    }

    // Only needed on macOS 15+
    if (process.platform !== 'darwin') {
      this.permissionGranted = true;
      this.permissionChecked = true;
      return true;
    }

    logger.info('Requesting local network permission for macOS 15 Sequoia...');

    try {
      // Show a dialog explaining what's about to happen
      const result = await dialog.showMessageBox({
        type: 'info',
        title: 'Network Permission Required',
        message: 'Anava Vision needs permission to access your local network',
        detail: 'macOS will ask for permission to find and connect to cameras on your network. Please click "Allow" when prompted.',
        buttons: ['Request Permission', 'Cancel'],
        defaultId: 0,
        cancelId: 1
      });

      if (result.response === 1) {
        logger.info('User cancelled network permission request');
        this.permissionChecked = true;
        this.permissionGranted = false;
        return false;
      }

      // Use Bonjour to trigger the system permission dialog
      // This is a workaround for macOS 15 Sequoia's new network permission system
      return new Promise((resolve) => {
        logger.info('Triggering network permission dialog using Bonjour...');
        
        try {
          const bonjour = new Bonjour();
          
          // Start browsing for Axis cameras (this triggers the permission dialog)
          const browser = bonjour.find({ type: 'axis-video' });
          
          // Add error handler to prevent crashes
          browser.on('error', (err: any) => {
            logger.debug('Bonjour browser error (expected):', err);
          });
          
          // Keep browser alive for a few seconds to ensure dialog appears
          setTimeout(() => {
            try {
              browser.stop();
              bonjour.destroy();
              logger.info('Bonjour permission trigger completed');
              
              // Assume permission was granted if we got this far without crashing
              this.permissionGranted = true;
              this.permissionChecked = true;
              resolve(true);
            } catch (err) {
              logger.error('Error stopping Bonjour:', err);
              this.permissionChecked = true;
              resolve(false);
            }
          }, 3000);
        } catch (err) {
          logger.error('Failed to initialize Bonjour:', err);
          this.permissionChecked = true;
          resolve(false);
        }
      });
    } catch (error) {
      logger.error('Error requesting network permission:', error);
      this.permissionChecked = true;
      return false;
    }
  }

  /**
   * Check if network permission has been granted
   */
  isPermissionGranted(): boolean {
    return this.permissionGranted;
  }

  /**
   * Reset permission state (useful for testing)
   */
  resetPermissionState(): void {
    this.permissionGranted = false;
    this.permissionChecked = false;
  }
}

export const networkPermissionManager = NetworkPermissionManager.getInstance();