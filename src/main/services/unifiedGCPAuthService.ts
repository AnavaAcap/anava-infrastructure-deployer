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
    // Load OAuth config - check multiple locations
    const possiblePaths = [
      // Production: resources folder
      process.resourcesPath ? path.join(process.resourcesPath, 'oauth-config.json') : null,
      // Development: app path
      path.join(app.getAppPath(), 'oauth-config.json'),
      // Alternative paths
      path.join(__dirname, '../../../oauth-config.json'),
      path.join(process.cwd(), 'oauth-config.json')
    ].filter(p => p);

    let configData = null;
    let configPath = null;
    
    for (const testPath of possiblePaths) {
      if (!testPath) continue;
      try {
        configData = require(testPath);
        configPath = testPath;
        console.log('Found OAuth config at:', configPath);
        break;
      } catch (error) {
        // Try next path
      }
    }
    
    if (!configData) {
      console.error('OAuth config not found in any of:', possiblePaths);
      throw new Error('OAuth configuration not found');
    }
    
    try {
      this.config = {
        clientId: configData.installed.client_id,
        clientSecret: configData.installed.client_secret,
        redirectUri: 'http://localhost:8085',
        authUri: configData.installed.auth_uri,
        tokenUri: configData.installed.token_uri
      };
    } catch (error) {
      console.error('Failed to parse OAuth config:', error);
      throw new Error('Invalid OAuth configuration format');
    }
  }
  
  /**
   * Initiate GCP OAuth flow
   * @param mainWindow - The main application window to refocus after authentication
   */
  async authenticate(mainWindow?: BrowserWindow | null): Promise<{ success: boolean; code?: string; error?: string }> {
    return new Promise((resolve) => {
      // Generate state for CSRF protection
      const state = crypto.randomBytes(32).toString('hex');
      
      // Build OAuth URL with all necessary scopes
      const scopes = [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/cloud-platform',
        'https://www.googleapis.com/auth/cloud-billing.readonly',  // CRITICAL: Add billing scope!
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
              <!DOCTYPE html>
              <html>
                <head>
                  <title>Authentication Failed - Anava Vision</title>
                  <style>
                    body {
                      margin: 0;
                      padding: 0;
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                      min-height: 100vh;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                    }
                    .container {
                      background: white;
                      border-radius: 16px;
                      padding: 48px;
                      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                      text-align: center;
                      max-width: 420px;
                    }
                    h1 {
                      color: #1a1a1a;
                      font-size: 28px;
                      font-weight: 700;
                      margin: 0 0 16px;
                    }
                    p {
                      color: #666;
                      font-size: 16px;
                      line-height: 1.6;
                      margin: 0 0 24px;
                    }
                    .error-icon {
                      color: #ef4444;
                      font-size: 64px;
                      margin-bottom: 24px;
                    }
                    .error-details {
                      background: #fef2f2;
                      color: #991b1b;
                      padding: 12px 16px;
                      border-radius: 8px;
                      font-size: 14px;
                      margin-top: 16px;
                    }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="error-icon">✕</div>
                    <h1>Authentication Failed</h1>
                    <p>We couldn't complete the authentication process.</p>
                    <div class="error-details">${error}</div>
                    <p style="color: #999; font-size: 14px; margin-top: 24px;">You can close this window and try again.</p>
                  </div>
                </body>
              </html>
            `);
            this.cleanup();
            resolve({ success: false, error });
            return;
          }
          
          if (code && returnedState === state) {
            res.end(`
              <!DOCTYPE html>
              <html>
                <head>
                  <title>Authentication Successful - Anava Vision</title>
                  <style>
                    body {
                      margin: 0;
                      padding: 0;
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                      min-height: 100vh;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                    }
                    .container {
                      background: white;
                      border-radius: 16px;
                      padding: 48px;
                      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                      text-align: center;
                      max-width: 420px;
                    }
                    .logo {
                      width: 80px;
                      height: 80px;
                      margin: 0 auto 24px;
                      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                      border-radius: 20px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 40px;
                    }
                    h1 {
                      color: #1a1a1a;
                      font-size: 28px;
                      font-weight: 700;
                      margin: 0 0 16px;
                    }
                    p {
                      color: #666;
                      font-size: 16px;
                      line-height: 1.6;
                      margin: 0 0 24px;
                    }
                    .success-icon {
                      color: #4ade80;
                      font-size: 64px;
                      margin-bottom: 24px;
                    }
                    .closing-text {
                      color: #999;
                      font-size: 14px;
                      margin-top: 16px;
                    }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="success-icon">✓</div>
                    <h1>Authentication Successful!</h1>
                    <p>You've been successfully authenticated with Google Cloud Platform.</p>
                    <p class="closing-text">This window will close automatically...</p>
                  </div>
                  <script>
                    // Try to close the window after a short delay
                    setTimeout(() => {
                      window.close();
                    }, 2000);
                  </script>
                </body>
              </html>
            `);
            
            // Focus back to the main window
            if (mainWindow && !mainWindow.isDestroyed()) {
              setTimeout(() => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.show();
                  mainWindow.focus();
                }
              }, 1500);
            }
            
            this.cleanup();
            resolve({ success: true, code });
          } else {
            res.end(`
              <html>
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