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
                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                  <h2>✅ Authentication Successful!</h2>
                  <p>You can close this window and return to Anava Vision.</p>
                  <script>window.close();</script>
                </body>
              </html>
            `);
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