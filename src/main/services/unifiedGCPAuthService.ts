import { BrowserWindow, app, shell } from 'electron';
import * as path from 'path';
import * as crypto from 'crypto';
import * as http from 'http';
import { URL } from 'url';

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authUri: string;
  tokenUri: string;
}

export class UnifiedGCPAuthService {
  private config: OAuthConfig;
  private server: http.Server | null = null;
  private authWindow: BrowserWindow | null = null;
  
  constructor() {
    // Load OAuth config
    const configPath = path.join(app.getAppPath(), 'oauth-config.json');
    try {
      const configData = require(configPath);
      this.config = {
        clientId: configData.installed.client_id,
        clientSecret: configData.installed.client_secret,
        redirectUri: 'http://localhost:8085',
        authUri: configData.installed.auth_uri,
        tokenUri: configData.installed.token_uri
      };
    } catch (error) {
      console.error('Failed to load OAuth config:', error);
      throw new Error('OAuth configuration not found');
    }
  }
  
  /**
   * Initiate GCP OAuth flow
   */
  async authenticate(): Promise<{ success: boolean; code?: string; error?: string }> {
    return new Promise((resolve) => {
      // Generate state for CSRF protection
      const state = crypto.randomBytes(32).toString('hex');
      
      // Build OAuth URL with all necessary scopes
      const scopes = [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/cloud-platform',
        'https://www.googleapis.com/auth/generative-language.retriever'
      ];
      
      const authUrl = new URL(this.config.authUri);
      authUrl.searchParams.append('client_id', this.config.clientId);
      authUrl.searchParams.append('redirect_uri', this.config.redirectUri);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('scope', scopes.join(' '));
      authUrl.searchParams.append('state', state);
      authUrl.searchParams.append('access_type', 'offline');
      authUrl.searchParams.append('prompt', 'consent');
      
      // Start local server to handle redirect
      this.server = http.createServer((req, res) => {
        const url = new URL(req.url!, `http://localhost:8085`);
        
        if (url.pathname === '/') {
          // Handle OAuth callback
          const code = url.searchParams.get('code');
          const returnedState = url.searchParams.get('state');
          const error = url.searchParams.get('error');
          
          // Send response to browser
          res.writeHead(200, { 'Content-Type': 'text/html' });
          
          if (error) {
            res.end(`
              <html>
                <head>
                  <meta charset="UTF-8">
                  <title>Authentication Failed</title>
                </head>
                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                  <h2>Authentication Failed</h2>
                  <p>${error}</p>
                  <p>You can close this window.</p>
                </body>
              </html>
            `);
            this.cleanup();
            resolve({ success: false, error });
            return;
          }
          
          if (code && returnedState === state) {
            res.end(`
              <html>
                <head>
                  <meta charset="UTF-8">
                  <title>Authentication Successful</title>
                </head>
                <body style="font-family: system-ui; padding: 40px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; margin: 0; height: 100vh; display: flex; align-items: center; justify-content: center;">
                  <div>
                    <div style="font-size: 72px; margin-bottom: 20px;">✓</div>
                    <h2 style="margin: 0 0 10px 0;">Authentication Successful!</h2>
                    <p style="margin: 0; opacity: 0.9;">Returning to Anava Vision...</p>
                    <script>
                      // Auto-close after a brief moment
                      setTimeout(() => {
                        window.close();
                      }, 1500);
                    </script>
                  </div>
                </body>
              </html>
            `);
            
            // Bring the Electron app back to focus
            if (this.authWindow && !this.authWindow.isDestroyed()) {
              this.authWindow.focus();
            }
            
            // Also try to bring the main window to focus
            const { BrowserWindow } = require('electron');
            const mainWindow = BrowserWindow.getAllWindows()[0];
            if (mainWindow) {
              mainWindow.show();
              mainWindow.focus();
              // On macOS, we need to explicitly activate the app
              if (process.platform === 'darwin' && app.dock) {
                app.dock.show();
                app.focus({ steal: true });
              }
            }
            
            this.cleanup();
            resolve({ success: true, code });
          } else {
            res.end(`
              <html>
                <head>
                  <meta charset="UTF-8">
                  <title>Authentication Error</title>
                </head>
                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                  <h2>Authentication Error</h2>
                  <p>Invalid response. Please try again.</p>
                </body>
              </html>
            `);
            this.cleanup();
            resolve({ success: false, error: 'Invalid state or missing code' });
          }
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });
      
      this.server.listen(8085, () => {
        console.log('OAuth redirect server listening on http://localhost:8085');
        
        // Open browser for authentication
        shell.openExternal(authUrl.toString());
        
        // Set timeout for auth flow
        setTimeout(() => {
          if (this.server) {
            this.cleanup();
            resolve({ success: false, error: 'Authentication timeout' });
          }
        }, 120000); // 2 minute timeout
      });
      
      this.server.on('error', (error) => {
        console.error('OAuth server error:', error);
        this.cleanup();
        resolve({ success: false, error: 'Failed to start OAuth server' });
      });
    });
  }
  
  /**
   * Clean up resources
   */
  private cleanup() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    
    if (this.authWindow && !this.authWindow.isDestroyed()) {
      this.authWindow.close();
      this.authWindow = null;
    }
  }
}

// Singleton instance
let instance: UnifiedGCPAuthService | null = null;

export function getUnifiedGCPAuthService(): UnifiedGCPAuthService {
  if (!instance) {
    instance = new UnifiedGCPAuthService();
  }
  return instance;
}