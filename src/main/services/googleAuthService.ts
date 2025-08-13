import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

// Cache auth clients by scope to avoid re-authentication
const authClientCache = new Map<string, OAuth2Client>();

/**
 * Gets the correct Application Default Credentials path for the current OS
 */
function getADCPath(): string {
  if (process.platform === 'win32') {
    // Windows: %APPDATA%\gcloud\application_default_credentials.json
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'gcloud', 'application_default_credentials.json');
  } else {
    // Linux/macOS: ~/.config/gcloud/application_default_credentials.json
    return path.join(os.homedir(), '.config', 'gcloud', 'application_default_credentials.json');
  }
}

/**
 * Ensures the GOOGLE_APPLICATION_CREDENTIALS environment variable is set correctly
 * This helps the Google Auth library find credentials on Windows
 */
export function ensureADCEnvironment(): void {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const adcPath = getADCPath();
    if (fs.existsSync(adcPath)) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;
      console.log('[GoogleAuth] Set GOOGLE_APPLICATION_CREDENTIALS to:', adcPath);
    } else {
      console.warn('[GoogleAuth] ADC file not found at:', adcPath);
    }
  }
}

/**
 * Gets a pre-authenticated Google Auth client.
 * Uses Application Default Credentials and handles Windows path issues.
 * @param scopes - The API scopes required for the operation
 */
export async function getGoogleAuthClient(scopes: string | string[]): Promise<OAuth2Client> {
  const scopeKey = Array.isArray(scopes) ? scopes.join(',') : scopes;
  
  // Return cached client if available
  if (authClientCache.has(scopeKey)) {
    return authClientCache.get(scopeKey)!;
  }

  try {
    // Ensure ADC environment is set up correctly for Windows
    ensureADCEnvironment();
    
    console.log('[GoogleAuth] Initializing auth client with scopes:', scopes);
    
    // Let the Google Auth library handle finding credentials
    // It will check in order:
    // 1. GOOGLE_APPLICATION_CREDENTIALS env var
    // 2. Well-known ADC location (which we've ensured is set)
    // 3. GCE metadata server (not applicable for Electron)
    const auth = new google.auth.GoogleAuth({
      scopes: Array.isArray(scopes) ? scopes : [scopes]
    });

    const client = await auth.getClient();
    const oauth2Client = client as OAuth2Client;
    
    // Cache the client for reuse
    authClientCache.set(scopeKey, oauth2Client);
    
    console.log('[GoogleAuth] Successfully authenticated');
    return oauth2Client;
    
  } catch (error: any) {
    console.error('[GoogleAuth] Authentication failed:', error);
    
    // Provide helpful error message
    const adcPath = getADCPath();
    if (!fs.existsSync(adcPath)) {
      throw new Error(
        `Google Cloud credentials not found at ${adcPath}.\n\n` +
        `Please sign in through the Anava Vision app or run:\n` +
        `gcloud auth application-default login\n\n` +
        `Original error: ${error.message}`
      );
    }
    
    throw new Error(`Failed to authenticate with Google Cloud: ${error.message}`);
  }
}

/**
 * Clears the auth client cache
 * Useful when credentials have been updated
 */
export function clearAuthCache(): void {
  authClientCache.clear();
  console.log('[GoogleAuth] Auth cache cleared');
}

/**
 * Saves OAuth tokens as Application Default Credentials
 * This is called after successful OAuth login
 */
export async function saveTokensAsADC(tokens: any, clientId: string, clientSecret: string): Promise<void> {
  try {
    const adcPath = getADCPath();
    const adcDir = path.dirname(adcPath);
    
    // Create directory if it doesn't exist
    await fs.promises.mkdir(adcDir, { recursive: true });
    
    // Format credentials for ADC
    const adcCredentials = {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refresh_token,
      type: 'authorized_user'
    };
    
    // Write credentials file
    await fs.promises.writeFile(adcPath, JSON.stringify(adcCredentials, null, 2));
    
    // Set environment variable
    process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;
    
    // Clear cache so next request uses new credentials
    clearAuthCache();
    
    console.log('[GoogleAuth] ADC saved successfully to:', adcPath);
  } catch (error) {
    console.error('[GoogleAuth] Failed to save ADC:', error);
    throw error;
  }
}