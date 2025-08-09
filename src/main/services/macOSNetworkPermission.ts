import { app, dialog } from 'electron';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { getLogger } from '../utils/logger';

const logger = getLogger();

/**
 * Production-ready solution for macOS 15 Sequoia network permissions
 */
export class MacOSNetworkPermission {
  private static instance: MacOSNetworkPermission;
  private hasRequestedPermission = false;
  
  private constructor() {}
  
  static getInstance(): MacOSNetworkPermission {
    if (!MacOSNetworkPermission.instance) {
      MacOSNetworkPermission.instance = new MacOSNetworkPermission();
    }
    return MacOSNetworkPermission.instance;
  }

  /**
   * Check if we're on macOS 15 or later
   */
  private isMacOS15OrLater(): boolean {
    if (process.platform !== 'darwin') return false;
    
    const version = process.getSystemVersion?.() || '0.0.0';
    const majorVersion = parseInt(version.split('.')[0]);
    return majorVersion >= 15;
  }

  /**
   * Request network permission using a minimal network operation
   * This triggers the permission dialog without causing crashes
   */
  async requestPermission(): Promise<boolean> {
    if (!this.isMacOS15OrLater()) {
      return true; // Not needed on older macOS versions
    }

    if (this.hasRequestedPermission) {
      return true; // Already requested
    }

    logger.info('macOS 15+ detected, requesting network permission...');

    // Method 1: Use a helper process to trigger permission
    // This avoids GPU crashes by isolating the network request
    return new Promise((resolve) => {
      const helperPath = path.join(__dirname, '..', 'helpers', 'network-permission-trigger.js');
      
      // Create the helper if it doesn't exist
      if (!fs.existsSync(helperPath)) {
        const helperCode = `
// Network permission trigger for macOS 15 Sequoia
const net = require('net');

// Try to connect to a local address to trigger permission dialog
const socket = new net.Socket();
socket.setTimeout(1000);

socket.on('error', () => {
  process.exit(0); // Expected to fail
});

socket.on('timeout', () => {
  socket.destroy();
  process.exit(0);
});

try {
  // Attempt connection to router/gateway
  socket.connect(80, '192.168.1.1');
} catch (e) {
  process.exit(0);
}

setTimeout(() => {
  socket.destroy();
  process.exit(0);
}, 1000);
`;
        
        const helperDir = path.dirname(helperPath);
        if (!fs.existsSync(helperDir)) {
          fs.mkdirSync(helperDir, { recursive: true });
        }
        fs.writeFileSync(helperPath, helperCode);
      }

      // Run the helper in a subprocess
      const child = spawn(process.execPath, [helperPath], {
        detached: true,
        stdio: 'ignore'
      });

      child.unref();
      
      // Give it time to trigger the permission dialog
      setTimeout(() => {
        this.hasRequestedPermission = true;
        resolve(true);
      }, 2000);
    });
  }

  /**
   * Add the app to the firewall programmatically (requires admin)
   */
  async addToFirewall(): Promise<boolean> {
    if (process.platform !== 'darwin') return true;

    const appPath = app.getPath('exe');
    
    return new Promise((resolve) => {
      // Create a script to add the app to firewall
      const script = `
do shell script "sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add '${appPath}' && sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp '${appPath}'" with administrator privileges
`;
      
      const child = spawn('osascript', ['-e', script]);
      
      child.on('close', (code) => {
        if (code === 0) {
          logger.info('Successfully added app to firewall');
          resolve(true);
        } else {
          logger.warn('Failed to add app to firewall');
          resolve(false);
        }
      });
    });
  }

  /**
   * Show instructions to the user for manual setup
   */
  async showManualInstructions(): Promise<void> {
    // Only show on macOS
    if (process.platform !== 'darwin') {
      return;
    }

    // First, offer automated fix
    const autoResult = await dialog.showMessageBox({
      type: 'info',
      title: 'Network Permission Required',
      message: 'Anava Vision needs permission to access cameras on your local network',
      detail: 'macOS 15 requires explicit permission for network access.\n\n' +
              'We can automatically add Anava Vision to your firewall (requires administrator password).\n\n' +
              'Or you can set it up manually if you prefer.',
      buttons: ['Fix Automatically (Recommended)', 'Show Manual Instructions', 'Cancel'],
      defaultId: 0,
      cancelId: 2
    });

    if (autoResult.response === 0) {
      // Try automated fix first
      const success = await this.addToFirewall();
      if (success) {
        await dialog.showMessageBox({
          type: 'info',
          title: 'Success!',
          message: 'Network permission granted',
          detail: 'Anava Vision has been added to your firewall.\n\nPlease restart camera discovery.',
          buttons: ['OK']
        });
        return;
      } else {
        // If automated fix fails, show manual instructions
        await dialog.showMessageBox({
          type: 'warning',
          title: 'Automated Fix Failed',
          message: 'Could not automatically add to firewall',
          detail: 'The automated fix was cancelled or failed.\n\nShowing manual instructions instead.',
          buttons: ['OK']
        });
      }
    }
    
    if (autoResult.response === 1 || autoResult.response === 0) {
      // Show manual instructions (either they chose it, or auto-fix failed)
      const manualResult = await dialog.showMessageBox({
        type: 'info',
        title: 'Manual Setup Instructions',
        message: 'How to grant network permission manually',
        detail: 'Option 1: System Settings\n' +
                '  1. Open System Settings > Privacy & Security\n' +
                '  2. Click Firewall > Options\n' +
                '  3. Click + and add Anava Vision\n\n' +
                'Option 2: Terminal Command (copy and paste):\n' +
                '  sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add "/Applications/Anava Vision.app"\n' +
                '  sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp "/Applications/Anava Vision.app"\n\n' +
                'Option 3: Launch from Terminal:\n' +
                '  open -a "Anava Vision"',
        buttons: ['Open System Settings', 'Copy Terminal Commands', 'Cancel'],
        defaultId: 0,
        cancelId: 2
      });

      if (manualResult.response === 0) {
        // Open System Settings to Firewall
        spawn('open', ['x-apple.systempreferences:com.apple.preference.security?Firewall']);
      } else if (manualResult.response === 1) {
        // Copy terminal commands to clipboard
        const { clipboard } = await import('electron');
        const commands = 'sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add "/Applications/Anava Vision.app" && sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp "/Applications/Anava Vision.app"';
        clipboard.writeText(commands);
        
        await dialog.showMessageBox({
          type: 'info',
          title: 'Commands Copied',
          message: 'Terminal commands copied to clipboard',
          detail: 'Open Terminal and paste the commands to grant network permission.',
          buttons: ['OK']
        });
      }
    }
  }

  /**
   * Initialize network permission handling
   * This should be called early in app startup
   */
  async initialize(): Promise<void> {
    if (!this.isMacOS15OrLater()) {
      return; // Not needed on older macOS
    }

    // Check if we're running from Terminal (which grants permission automatically)
    const isTerminal = process.env.TERM || process.env.SSH_CLIENT;
    if (isTerminal) {
      logger.info('Running from Terminal, network access should be available');
      return;
    }

    // Check firewall status asynchronously to avoid blocking startup
    const { exec } = require('child_process');
    const appPath = app.getPath('exe');
    
    exec('/usr/libexec/ApplicationFirewall/socketfilterfw --listapps', { encoding: 'utf8' }, (error: any, stdout: any) => {
      if (!error && stdout && stdout.includes(appPath)) {
        logger.info('App is already in firewall, network access should be available');
      } else {
        logger.info('Network permission not detected, will request when needed');
      }
    });
  }
}

export const macOSNetworkPermission = MacOSNetworkPermission.getInstance();