import { BrowserWindow, session } from 'electron';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import Store from 'electron-store';

interface AuthResult {
  success: boolean;
  user?: {
    email: string;
    name: string;
    picture: string;
    idToken: string;
  };
  error?: string;
}

export class UnifiedAuthService {
  private store: Store;
  private oauth2Client: OAuth2Client;
  private authWindow: BrowserWindow | null = null;
  
  // Use the same OAuth client for consistency
  private readonly CLIENT_ID = '392865621461-3332mfpeb245vp56raok2mmp4aqssv15.apps.googleusercontent.com';
  private readonly CLIENT_SECRET = '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';
  private readonly REDIRECT_URI = 'http://localhost:8085/auth/callback';
  
  constructor() {
    this.store = new Store();
    this.oauth2Client = new OAuth2Client(
      this.CLIENT_ID,
      this.CLIENT_SECRET,
      this.REDIRECT_URI
    );
  }

  /**
   * Authenticate user using embedded secure webview
   */
  async authenticate(parentWindow: BrowserWindow): Promise<AuthResult> {
    return new Promise((resolve, reject) => {
      // Generate PKCE parameters for enhanced security
      const codeVerifier = this.generateCodeVerifier();
      const codeChallenge = this.generateCodeChallenge(codeVerifier);
      
      // Create auth window
      this.authWindow = new BrowserWindow({
        width: 500,
        height: 600,
        parent: parentWindow,
        modal: true,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          // Use a separate session for auth to ensure clean state
          partition: 'auth-session'
        }
      });

      // Clear session data to ensure fresh login
      const authSession = session.fromPartition('auth-session');
      authSession.clearStorageData();

      // Generate auth URL with proper scopes
      const authUrl = this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'openid',
          'email',
          'profile',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile'
        ],
        prompt: 'select_account',
        code_challenge_method: 'S256' as any,
        code_challenge: codeChallenge
      });

      // Handle auth window events
      this.authWindow.once('ready-to-show', () => {
        this.authWindow!.show();
      });

      this.authWindow.on('closed', () => {
        this.authWindow = null;
        reject(new Error('Authentication cancelled'));
      });

      // Intercept navigation to capture auth code
      this.authWindow.webContents.on('will-redirect', async (event, url) => {
        if (url.startsWith(this.REDIRECT_URI)) {
          event.preventDefault();
          
          const urlParams = new URL(url);
          const code = urlParams.searchParams.get('code');
          const error = urlParams.searchParams.get('error');

          if (error) {
            this.closeAuthWindow();
            resolve({
              success: false,
              error: `Authentication failed: ${error}`
            });
            return;
          }

          if (code) {
            try {
              // Exchange code for tokens
              const { tokens } = await this.oauth2Client.getToken({
                code,
                codeVerifier: codeVerifier
              });

              this.oauth2Client.setCredentials(tokens);

              // Get user info
              const ticket = await this.oauth2Client.verifyIdToken({
                idToken: tokens.id_token!,
                audience: this.CLIENT_ID
              });

              const payload = ticket.getPayload();
              if (!payload) {
                throw new Error('Failed to get user info');
              }

              // Store tokens securely
              this.store.set('authTokens', {
                ...tokens,
                timestamp: Date.now()
              });

              this.closeAuthWindow();

              resolve({
                success: true,
                user: {
                  email: payload.email!,
                  name: payload.name || '',
                  picture: payload.picture || '',
                  idToken: tokens.id_token!
                }
              });
            } catch (error) {
              this.closeAuthWindow();
              resolve({
                success: false,
                error: `Token exchange failed: ${error}`
              });
            }
          }
        }
      });

      // Load auth URL
      this.authWindow.loadURL(authUrl);
    });
  }

  /**
   * Get stored authentication if valid
   */
  async getStoredAuth(): Promise<AuthResult | null> {
    const stored = this.store.get('authTokens') as any;
    
    if (!stored || !stored.id_token) {
      return null;
    }

    // Check if token is expired (tokens typically last 1 hour)
    const tokenAge = Date.now() - stored.timestamp;
    if (tokenAge > 50 * 60 * 1000) { // 50 minutes
      // Try to refresh
      if (stored.refresh_token) {
        try {
          this.oauth2Client.setCredentials(stored);
          const { credentials } = await this.oauth2Client.refreshAccessToken();
          
          // Update stored tokens
          this.store.set('authTokens', {
            ...credentials,
            timestamp: Date.now()
          });

          // Verify and return user info
          const ticket = await this.oauth2Client.verifyIdToken({
            idToken: credentials.id_token!,
            audience: this.CLIENT_ID
          });

          const payload = ticket.getPayload();
          if (payload) {
            return {
              success: true,
              user: {
                email: payload.email!,
                name: payload.name || '',
                picture: payload.picture || '',
                idToken: credentials.id_token!
              }
            };
          }
        } catch (error) {
          console.error('Failed to refresh token:', error);
          this.store.delete('authTokens');
        }
      }
      return null;
    }

    // Token still valid, verify and return
    try {
      const ticket = await this.oauth2Client.verifyIdToken({
        idToken: stored.id_token,
        audience: this.CLIENT_ID
      });

      const payload = ticket.getPayload();
      if (payload) {
        return {
          success: true,
          user: {
            email: payload.email!,
            name: payload.name || '',
            picture: payload.picture || '',
            idToken: stored.id_token
          }
        };
      }
    } catch (error) {
      console.error('Stored token validation failed:', error);
      this.store.delete('authTokens');
    }

    return null;
  }

  /**
   * Sign out and clear stored credentials
   */
  async signOut(): Promise<void> {
    this.store.delete('authTokens');
    this.oauth2Client.revokeCredentials();
    
    // Clear auth session
    const authSession = session.fromPartition('auth-session');
    await authSession.clearStorageData();
  }

  private closeAuthWindow(): void {
    if (this.authWindow && !this.authWindow.isDestroyed()) {
      this.authWindow.close();
    }
    this.authWindow = null;
  }

  private generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  private generateCodeChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
  }
}