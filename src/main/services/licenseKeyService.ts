import { initializeApp, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  Auth, 
  signInWithEmailAndPassword,
  User
} from 'firebase/auth';
import { 
  getFunctions, 
  httpsCallable, 
  Functions,
  HttpsCallableResult
} from 'firebase/functions';
import { FirebaseConfig } from './firebaseAppDeployer';

export interface LicenseKeyResult {
  key: string;
  email: string;
  alreadyAssigned: boolean;
}

export interface LicenseStats {
  total: number;
  available: number;
}

export class LicenseKeyService {
  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;
  private functions: Functions | null = null;
  private currentUser: User | null = null;

  /**
   * Initialize the Firebase app for license management
   */
  async initialize(config: FirebaseConfig): Promise<void> {
    try {
      console.log('Initializing LicenseKeyService with Firebase config');
      
      // Initialize Firebase app
      this.app = initializeApp(config, 'license-app');
      this.auth = getAuth(this.app);
      this.functions = getFunctions(this.app);
      
      // Listen for auth state changes
      this.auth.onAuthStateChanged((user) => {
        this.currentUser = user;
        console.log('Auth state changed:', user ? user.email : 'signed out');
      });
      
      console.log('LicenseKeyService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize LicenseKeyService:', error);
      throw error;
    }
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<User> {
    if (!this.auth) {
      throw new Error('LicenseKeyService not initialized');
    }

    try {
      console.log(`Signing in user: ${email}`);
      const credential = await signInWithEmailAndPassword(this.auth, email, password);
      this.currentUser = credential.user;
      return credential.user;
    } catch (error: any) {
      console.error('Sign in failed:', error);
      throw new Error(`Sign in failed: ${error.message}`);
    }
  }

  /**
   * Get the currently signed in user
   */
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Request a license key assignment for the current user
   */
  async assignLicenseKey(): Promise<LicenseKeyResult> {
    if (!this.functions || !this.currentUser) {
      throw new Error('User must be signed in to request a license key');
    }

    try {
      console.log('Requesting license key assignment...');
      
      const assignKey = httpsCallable<{}, LicenseKeyResult>(
        this.functions, 
        'assignAxisKey'
      );
      
      const result: HttpsCallableResult<LicenseKeyResult> = await assignKey({});
      
      console.log('License key assignment result:', {
        email: result.data.email,
        alreadyAssigned: result.data.alreadyAssigned,
        keyLength: result.data.key?.length
      });
      
      return result.data;
    } catch (error: any) {
      console.error('Failed to assign license key:', error);
      
      // Handle specific error cases
      if (error.code === 'resource-exhausted') {
        throw new Error('No trial licenses available. Please contact sales@anava.com');
      } else if (error.code === 'unauthenticated') {
        throw new Error('User authentication required');
      }
      
      throw new Error(`License assignment failed: ${error.message}`);
    }
  }

  /**
   * Get license availability statistics
   */
  async getLicenseStats(): Promise<LicenseStats> {
    if (!this.functions || !this.currentUser) {
      throw new Error('User must be signed in to check license stats');
    }

    try {
      const getStats = httpsCallable<{}, LicenseStats>(
        this.functions,
        'getLicenseStats'
      );
      
      const result = await getStats({});
      return result.data;
    } catch (error: any) {
      console.error('Failed to get license stats:', error);
      throw new Error(`Failed to get license stats: ${error.message}`);
    }
  }

  /**
   * Store the assigned license key in local cache
   */
  async cacheLicenseKey(key: string, email: string): Promise<void> {
    try {
      const cacheData = {
        key,
        email,
        assignedAt: new Date().toISOString()
      };
      
      // Store in electron's app data directory
      if (window.electronAPI) {
        await window.electronAPI.setConfigValue('licenseKey', cacheData);
      }
      
      console.log('License key cached successfully');
    } catch (error) {
      console.error('Failed to cache license key:', error);
      // Non-critical error, continue
    }
  }

  /**
   * Retrieve cached license key
   */
  async getCachedLicenseKey(): Promise<{ key: string; email: string } | null> {
    try {
      if (window.electronAPI) {
        const cached = await window.electronAPI.getConfigValue('licenseKey');
        if (cached && cached.key && cached.email) {
          return {
            key: cached.key,
            email: cached.email
          };
        }
      }
    } catch (error) {
      console.error('Failed to get cached license key:', error);
    }
    
    return null;
  }

  /**
   * Sign out the current user
   */
  async signOut(): Promise<void> {
    if (this.auth) {
      await this.auth.signOut();
      this.currentUser = null;
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.currentUser = null;
    this.auth = null;
    this.functions = null;
    this.app = null;
  }
}