import { initializeApp, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  Auth, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  User
} from 'firebase/auth';
import { 
  getFunctions, 
  httpsCallable, 
  Functions,
  HttpsCallableResult
} from 'firebase/functions';
import { FirebaseConfig } from './firebaseAppDeployer';
import Store from 'electron-store';

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
  private store: Store;

  constructor() {
    this.store = new Store();
  }

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
      this.auth.onAuthStateChanged((user: User | null) => {
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
   * Create a new user or sign in if already exists
   */
  async createOrSignInUser(email: string, password: string): Promise<User> {
    if (!this.auth) {
      throw new Error('LicenseKeyService not initialized');
    }

    try {
      console.log(`Creating user: ${email}`);
      const credential = await createUserWithEmailAndPassword(this.auth, email, password);
      this.currentUser = credential.user;
      console.log(`User created successfully: ${email}`);
      return credential.user;
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        console.log('User already exists, attempting sign in...');
        // Try to sign in with the provided password
        return await this.signIn(email, password);
      }
      console.error('Failed to create user:', error);
      throw new Error(`Failed to create user: ${error.message}`);
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
    // First check if we have a cached license key
    const cached = await this.getCachedLicenseKey();
    if (cached && cached.key && cached.email) {
      console.log('Returning cached license key for user:', cached.email);
      return {
        key: cached.key,
        email: cached.email,
        alreadyAssigned: true
      };
    }

    if (!this.currentUser) {
      throw new Error('User must be signed in to request a license key');
    }

    // Check if this is a returning/existing user (from Google OAuth with existing Firebase user)
    // These are users who exist in Firebase but we couldn't authenticate them
    if (this.currentUser.uid?.startsWith('returning-') || this.currentUser.uid?.startsWith('existing-')) {
      // We already checked the cache above, so if we're here with a returning user
      // it means they don't have a cached key locally
      console.log('Returning/existing user without cached key - cannot retrieve without proper auth');
      // Since we can't authenticate them with Firebase, we can't call the function
      // They need to use their original sign-in method or contact support
      throw new Error('Please sign in with the same method you used initially (Google account) to retrieve your license key.');
    }

    if (!this.functions) {
      throw new Error('Firebase functions not initialized');
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
      this.store.set('licenseKey', cacheData);
      
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
      const cached = this.store.get('licenseKey') as any;
      if (cached && cached.key && cached.email) {
        return {
          key: cached.key,
          email: cached.email
        };
      }
    } catch (error) {
      console.error('Failed to get cached license key:', error);
    }
    
    return null;
  }

  /**
   * Validate and cache a manually entered license key
   */
  async setManualLicenseKey(key: string, userEmail?: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Basic validation - Axis license keys are typically 12-20 characters
      const trimmedKey = key.trim();
      if (!trimmedKey) {
        return { success: false, error: 'License key cannot be empty' };
      }
      
      if (trimmedKey.length < 10 || trimmedKey.length > 30) {
        return { success: false, error: 'Invalid license key format' };
      }
      
      // Use provided email or default to manual entry identifier
      const email = userEmail || 'manual-entry@anava.ai';
      
      // Cache the manual license key
      await this.cacheLicenseKey(trimmedKey, email);
      
      console.log('Manual license key set successfully');
      return { success: true };
    } catch (error: any) {
      console.error('Failed to set manual license key:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear cached license key
   */
  clearCachedLicenseKey(): void {
    try {
      this.store.delete('licenseKey');
      console.log('Cleared cached license key');
    } catch (error) {
      console.error('Failed to clear cached license key:', error);
    }
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