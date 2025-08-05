import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { shell, app } from 'electron';
import path from 'path';
import http from 'http';
import fs from 'fs/promises';
import crypto from 'crypto';
import os from 'os';
import Store from 'electron-store';

const log = console;

export class GCPOAuthService {
  private store: any;
  public oauth2Client: OAuth2Client | null = null;
  private server: http.Server | null = null;
  private authConfig: any = null;
  private codeVerifier: string | null = null;

  constructor() {
    this.store = new Store();
    // Initialize asynchronously after construction
    this.initialize().catch(error => {
      console.error('Failed to initialize GCPOAuthService:', error);
    });
  }

  async initialize() {
    try {
      await this.loadOAuthConfig();
      await this.restoreTokens();
    } catch (error) {
      console.error('Failed to initialize GCPOAuthService:', error);
    }
  }

  async loadOAuthConfig() {
    try {
      let configPath: string | undefined;
      
      const possiblePaths = [
        path.join(process.resourcesPath, 'oauth-config.json'),
        path.join(app.getAppPath(), 'oauth-config.json'),
        path.join(__dirname, '../../../oauth-config.json'),
        path.join(process.cwd(), 'oauth-config.json')
      ];
      
      console.log('Searching for OAuth config in multiple locations...');
      
      for (const testPath of possiblePaths) {
        console.log('Checking:', testPath);
        if (await this.fileExists(testPath)) {
          configPath = testPath;
          console.log('Found OAuth config at:', configPath);
          break;
        }
      }
      
      if (!configPath) {
        throw new Error('OAuth config not found in any expected location');
      }
      
      const configData = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(configData);
      
      if (!config.installed) {
        throw new Error('Invalid OAuth config: missing "installed" section');
      }
      
      this.authConfig = config.installed;
      
      this.oauth2Client = new OAuth2Client(
        this.authConfig.client_id,
        this.authConfig.client_secret,
        this.authConfig.redirect_uris[0]
      );
      
      console.log('OAuth configuration loaded successfully');
      console.log('Client ID:', this.authConfig.client_id.substring(0, 20) + '...');
    } catch (error) {
      console.error('Failed to load OAuth config:', error);
      throw new Error('OAuth configuration not found. Please ensure oauth-config.json exists.');
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async restoreTokens() {
    try {
      const tokens = this.store.get('gcpTokens') as any;
      if (tokens && tokens.refresh_token) {
        this.oauth2Client!.setCredentials(tokens);
        
        if (this.isTokenExpired(tokens)) {
          console.log('Access token expired, refreshing...');
          await this.refreshAccessToken();
        } else {
          console.log('Restored valid tokens from storage');
        }
      }
    } catch (error) {
      console.log('No valid stored tokens found');
    }
  }

  isTokenExpired(tokens: any): boolean {
    if (!tokens.expiry_date) return true;
    return Date.now() >= tokens.expiry_date;
  }

  async refreshAccessToken() {
    try {
      if (!this.oauth2Client) throw new Error('OAuth client not initialized');
      
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      await this.saveTokens(credentials);
      console.log('Access token refreshed successfully');
      return credentials;
    } catch (error: any) {
      console.error('Failed to refresh access token:', error);
      
      if (error.message && (
        error.message.includes('invalid_rapt') ||
        error.message.includes('rapt_required') ||
        error.message.includes('invalid_grant')
      )) {
        console.log('RAPT reauth required - need to perform full authentication');
        throw new Error('REAUTH_REQUIRED');
      }
      
      this.store.delete('gcpTokens');
      this.store.delete('gcpUser');
      throw error;
    }
  }

  async saveTokens(tokens: any) {
    this.store.set('gcpTokens', tokens);
    this.oauth2Client!.setCredentials(tokens);
    
    await this.setupApplicationDefaultCredentials(tokens);
  }

  async setupApplicationDefaultCredentials(tokens: any) {
    try {
      const adcPath = path.join(os.homedir(), '.config', 'gcloud', 'application_default_credentials.json');
      const adcDir = path.dirname(adcPath);
      
      await fs.mkdir(adcDir, { recursive: true });
      
      const adcCredentials = {
        client_id: this.authConfig.client_id,
        client_secret: this.authConfig.client_secret,
        refresh_token: tokens.refresh_token,
        type: 'authorized_user'
      };
      
      await fs.writeFile(adcPath, JSON.stringify(adcCredentials, null, 2));
      
      process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;
      
      console.log('Application Default Credentials configured successfully');
    } catch (error) {
      console.error('Failed to set up ADC:', error);
    }
  }

  async authenticate() {
    log.info('GCPOAuthService.authenticate() called');
    
    if (!this.oauth2Client) {
      const error = 'OAuth client not initialized. Check oauth-config.json';
      log.error(error);
      throw new Error(error);
    }

    log.info('Checking for valid stored tokens...');
    const isValid = await this.validateStoredTokens();
    if (isValid) {
      log.info('Valid tokens found, getting current user...');
      const user = await this.getCurrentUser();
      return {
        success: true,
        tokens: this.oauth2Client.credentials,
        user
      };
    }

    log.info('No valid tokens, starting new authentication flow...');
    return this.startAuthFlow();
  }

  async validateStoredTokens(): Promise<boolean> {
    try {
      const tokens = this.store.get('gcpTokens') as any;
      if (!tokens || !tokens.refresh_token) {
        return false;
      }

      this.oauth2Client!.setCredentials(tokens);

      if (this.isTokenExpired(tokens)) {
        try {
          await this.refreshAccessToken();
        } catch (error: any) {
          if (error.message === 'REAUTH_REQUIRED') {
            console.log('Full reauthentication required');
            return false;
          }
          throw error;
        }
      }

      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client! });
      await oauth2.userinfo.get();
      
      return true;
    } catch (error: any) {
      console.log('Token validation failed:', error.message);
      this.store.delete('gcpTokens');
      this.store.delete('gcpUser');
      return false;
    }
  }

  generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  generateCodeChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
  }

  async startAuthFlow() {
    log.info('Starting OAuth authentication flow...');
    
    return new Promise((resolve, reject) => {
      this.codeVerifier = this.generateCodeVerifier();
      const codeChallenge = this.generateCodeChallenge(this.codeVerifier);
      log.info('Generated PKCE parameters');

      this.server = http.createServer(async (req, res) => {
        const url = new URL(req.url!, `http://localhost:${this.getPort()}`);
        
        if (url.pathname === '/' && url.searchParams.has('code')) {
          const code = url.searchParams.get('code')!;
          
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(this.getSuccessHTML());
          
          this.server!.close();
          
          try {
            const { tokens } = await this.oauth2Client!.getToken({
              code,
              codeVerifier: this.codeVerifier!
            });
            
            await this.saveTokens(tokens);
            
            const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client! });
            const { data: user } = await oauth2.userinfo.get();
            
            this.store.set('gcpUser', user);
            
            resolve({
              success: true,
              tokens,
              user: {
                email: user.email,
                name: user.name,
                picture: user.picture
              }
            });
          } catch (error) {
            console.error('Token exchange failed:', error);
            reject(error);
          }
        } else if (url.searchParams.has('error')) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(this.getErrorHTML(url.searchParams.get('error')!));
          this.server!.close();
          reject(new Error(`Authentication failed: ${url.searchParams.get('error')}`));
        }
      });

      const port = this.getPort();
      this.server.listen(port, () => {
        log.info(`Auth server listening on port ${port}`);
        
        const authUrl = this.oauth2Client!.generateAuthUrl({
          access_type: 'offline',
          scope: [
            'https://www.googleapis.com/auth/cloud-platform',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile'
          ],
          prompt: 'consent',
          code_challenge_method: 'S256' as any,
          code_challenge: codeChallenge,
          max_age: 0
        } as any);
        
        log.info('Opening authentication URL in browser:', authUrl);
        console.log('=== OAUTH DEBUG ===');
        console.log('Auth URL:', authUrl);
        console.log('Redirect URI:', this.authConfig.redirect_uris[0]);
        console.log('Port:', port);
        console.log('App path:', app.getPath('userData'));
        console.log('Logs path:', app.getPath('logs'));
        
        // Try to open the URL
        shell.openExternal(authUrl)
          .then(() => {
            log.info('Browser opened successfully');
            console.log('Browser opened successfully for OAuth');
          })
          .catch(error => {
            log.error('Failed to open browser:', error);
            console.error('Failed to open browser:', error);
            console.error('Error details:', JSON.stringify(error, null, 2));
            
            // Try alternative method on macOS
            if (process.platform === 'darwin') {
              console.log('Trying macOS-specific open command...');
              const { exec } = require('child_process');
              exec(`open "${authUrl}"`, (err: any) => {
                if (err) {
                  console.error('macOS open command failed:', err);
                  reject(new Error('Failed to open authentication URL in browser'));
                } else {
                  console.log('macOS open command succeeded');
                }
              });
            } else {
              reject(new Error('Failed to open authentication URL in browser'));
            }
          });
      });

      setTimeout(() => {
        if (this.server && this.server.listening) {
          this.server.close();
          reject(new Error('Authentication timeout'));
        }
      }, 5 * 60 * 1000);
    });
  }

  getPort(): number {
    const redirectUri = this.authConfig?.redirect_uris?.[0] || 'http://localhost:8085';
    const url = new URL(redirectUri);
    return parseInt(url.port) || 8085;
  }

  getSuccessHTML(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Authentication Successful</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: #f5f5f5;
          }
          .container {
            text-align: center;
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          h1 { color: #1a73e8; }
          p { color: #5f6368; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Authentication Successful</h1>
          <p>You can close this window and return to the Anava app.</p>
          <p>This window will close automatically in 1 second...</p>
        </div>
        <script>
          setTimeout(() => window.close(), 1000);
        </script>
      </body>
      </html>
    `;
  }

  getErrorHTML(error: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Failed</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: #f5f5f5;
          }
          .container {
            text-align: center;
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          h1 { color: #d93025; }
          p { color: #5f6368; margin: 20px 0; }
          .error { font-family: monospace; background: #f8f8f8; padding: 10px; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>✗ Authentication Failed</h1>
          <p>There was an error during authentication:</p>
          <p class="error">${error}</p>
          <p>Please close this window and try again.</p>
        </div>
      </body>
      </html>
    `;
  }

  async getCurrentUser() {
    try {
      if (!this.oauth2Client) throw new Error('OAuth client not initialized');
      
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const { data } = await oauth2.userinfo.get();
      return {
        email: data.email,
        name: data.name,
        picture: data.picture
      };
    } catch (error) {
      console.error('Failed to get user info:', error);
      return null;
    }
  }

  async listProjects() {
    if (!this.oauth2Client || !this.oauth2Client.credentials) {
      throw new Error('Not authenticated');
    }

    try {
      log.info('Listing GCP projects...');
      const cloudResourceManager = google.cloudresourcemanager('v1');
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Project listing timed out after 10 seconds')), 10000);
      });
      
      const listPromise = cloudResourceManager.projects.list({
        auth: this.oauth2Client as any,
        pageSize: 100,
        filter: 'lifecycleState:ACTIVE'
      });
      
      const response = await Promise.race([listPromise, timeoutPromise]) as any;
      
      const rawProjects = response.data.projects || [];
      log.info(`Found ${rawProjects.length} projects`);
      
      // Map the API response to our GCPProject interface
      const projects = rawProjects.map((project: any) => ({
        projectId: project.projectId || '',
        projectNumber: project.projectNumber || '',
        displayName: project.name || project.projectId || '', // API returns 'name', we need 'displayName'
        state: project.lifecycleState || 'ACTIVE'
      }));
      
      return projects;
    } catch (error: any) {
      log.error('Failed to list projects:', error.message);
      
      if (error.code === 401 || error.message?.includes('invalid_grant')) {
        try {
          await this.refreshAccessToken();
          const cloudResourceManager = google.cloudresourcemanager('v1');
          const response = await cloudResourceManager.projects.list({
            auth: this.oauth2Client as any,
            pageSize: 100,
            filter: 'lifecycleState:ACTIVE'
          });
          
          // Map the API response to our GCPProject interface
          const rawProjects = response.data.projects || [];
          return rawProjects.map((project: any) => ({
            projectId: project.projectId || '',
            projectNumber: project.projectNumber || '',
            displayName: project.name || project.projectId || '', // API returns 'name', we need 'displayName'
            state: project.lifecycleState || 'ACTIVE'
          }));
        } catch (refreshError) {
          log.error('Failed to refresh token and retry:', refreshError);
          throw new Error('Authentication expired. Please sign in again.');
        }
      }
      
      throw error;
    }
  }

  async logout() {
    this.store.delete('gcpTokens');
    this.store.delete('gcpUser');
    
    if (this.oauth2Client) {
      this.oauth2Client.setCredentials({});
    }
    
    console.log('Logged out successfully');
  }

  isAuthenticated(): boolean {
    return !!(this.oauth2Client && 
             this.oauth2Client.credentials && 
             this.oauth2Client.credentials.refresh_token);
  }

  getCredentials() {
    return this.oauth2Client?.credentials || null;
  }

  async setProject(projectId: string) {
    this.store.set('gcpProjectId', projectId);
    return { projectId };
  }

  async getServiceAccountKey(): Promise<any> {
    // For Terraform, we'll use the Application Default Credentials
    // that we've already set up
    if (!this.oauth2Client || !this.oauth2Client.credentials.refresh_token) {
      throw new Error('Not authenticated');
    }
    
    // Return the ADC-formatted credentials that Terraform can use
    return {
      type: 'authorized_user',
      client_id: this.authConfig.client_id,
      client_secret: this.authConfig.client_secret,
      refresh_token: this.oauth2Client.credentials.refresh_token
    };
  }
}