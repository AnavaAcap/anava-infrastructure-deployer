import { 
  initializeApp, 
  FirebaseApp,
  getApps
} from 'firebase/app';
import { 
  getAuth, 
  Auth,
  signInWithCredential,
  GoogleAuthProvider,
  User
} from 'firebase/auth';
import { 
  getFunctions, 
  Functions,
  httpsCallable,
  HttpsCallableResult
} from 'firebase/functions';
import Store from 'electron-store';

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

interface LicenseKeyResult {
  key: string;
  email: string;
  alreadyAssigned?: boolean;
}

export class FirebaseAuthService {
  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;
  private functions: Functions | null = null;
  private store: Store;

  constructor() {
    this.store = new Store();
  }

  /**
   * Initialize Firebase with the given config
   */
  async initialize(config: FirebaseConfig): Promise<void> {
    try {
      console.log('Initializing Firebase Auth Service');
      
      // Check if app already exists
      const existingApps = getApps();
      const existingApp = existingApps.find(app => app.name === 'license-app');
      
      if (existingApp) {
        this.app = existingApp;
      } else {
        this.app = initializeApp(config, 'license-app');
      }
      
      this.auth = getAuth(this.app);
      this.functions = getFunctions(this.app);
      
      console.log('Firebase Auth Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Firebase:', error);
      throw error;
    }
  }

  /**
   * Sign in with Google OAuth tokens
   */
  async signInWithGoogleTokens(idToken: string, accessToken: string): Promise<User> {
    if (!this.auth) {
      throw new Error('Firebase not initialized');
    }

    try {
      console.log('Signing in with Google tokens');
      console.log('ID token:', idToken ? `${idToken.substring(0, 50)}...` : 'MISSING');
      console.log('Access token:', accessToken ? `${accessToken.substring(0, 50)}...` : 'MISSING');
      
      // GoogleAuthProvider.credential() expects just the ID token
      const credential = GoogleAuthProvider.credential(idToken);
      
      console.log('Created credential, attempting Firebase sign in...');
      
      // Sign in to Firebase with the Google credential
      const userCredential = await signInWithCredential(this.auth, credential);
      
      console.log(`Successfully authenticated with Firebase: ${userCredential.user.email}`);
      return userCredential.user;
    } catch (error: any) {
      console.error('Failed to sign in with Google tokens:', error);
      console.error('Full error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      // Log what we're actually passing
      console.error('Debug - ID token provided:', !!idToken);
      console.error('Debug - Access token provided:', !!accessToken);
      
      throw new Error(`Firebase authentication failed: ${error.message}`);
    }
  }

  /**
   * Request license key assignment from Firebase function
   */
  async requestLicenseKey(): Promise<LicenseKeyResult> {
    // First check cached key
    const cached = await this.getCachedLicenseKey();
    if (cached && cached.key && cached.email) {
      console.log('Returning cached license key');
      return {
        key: cached.key,
        email: cached.email,
        alreadyAssigned: true
      };
    }

    if (!this.functions || !this.auth?.currentUser) {
      throw new Error('Must be authenticated to request license key');
    }

    try {
      console.log('Calling Firebase function to assign/retrieve license key');
      
      const assignKey = httpsCallable<{}, LicenseKeyResult>(
        this.functions,
        'assignAxisKey'
      );
      
      const result: HttpsCallableResult<LicenseKeyResult> = await assignKey({});
      
      console.log('License key result:', {
        email: result.data.email,
        alreadyAssigned: result.data.alreadyAssigned,
        keyLength: result.data.key?.length
      });
      
      // Cache the key
      await this.cacheLicenseKey(result.data.key, result.data.email);
      
      return result.data;
    } catch (error: any) {
      console.error('Failed to get license key:', error);
      
      if (error.code === 'functions/resource-exhausted') {
        throw new Error('No trial licenses available. Please contact sales@anava.com');
      } else if (error.code === 'functions/unauthenticated') {
        throw new Error('Authentication required');
      }
      
      throw new Error(`License assignment failed: ${error.message}`);
    }
  }

  /**
   * Cache license key locally
   */
  private async cacheLicenseKey(key: string, email: string): Promise<void> {
    this.store.set('licenseKey', { key, email });
    console.log(`Cached license key for ${email}`);
  }

  /**
   * Get cached license key
   */
  private async getCachedLicenseKey(): Promise<{ key: string; email: string } | null> {
    const cached = this.store.get('licenseKey') as { key: string; email: string } | undefined;
    return cached || null;
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    if (this.auth) {
      await this.auth.signOut();
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.app = null;
    this.auth = null;
    this.functions = null;
  }
}