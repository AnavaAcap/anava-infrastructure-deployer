import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider,
  User,
  Auth
} from 'firebase/auth';
import { initializeApp, FirebaseApp } from 'firebase/app';

export interface GoogleUserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  idToken: string;
  company?: string;
}

export class GoogleAuthService {
  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;
  private provider: GoogleAuthProvider | null = null;

  /**
   * Initialize Firebase and Google Auth
   */
  async initialize(firebaseConfig: any): Promise<void> {
    try {
      // Initialize Firebase app for auth
      this.app = initializeApp(firebaseConfig, 'google-auth-app');
      this.auth = getAuth(this.app);
      
      // Configure Google provider
      this.provider = new GoogleAuthProvider();
      this.provider.addScope('https://www.googleapis.com/auth/userinfo.email');
      this.provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
      
      // Optional: Add custom parameters
      this.provider.setCustomParameters({
        prompt: 'select_account', // Always show account picker
        access_type: 'offline',    // Get refresh token
        include_granted_scopes: 'true'
      });
      
      console.log('Google Auth initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Google Auth:', error);
      throw error;
    }
  }

  /**
   * Sign in with Google popup
   */
  async signInWithGoogle(): Promise<GoogleUserProfile> {
    if (!this.auth || !this.provider) {
      throw new Error('Google Auth not initialized');
    }

    try {
      // Show Google sign-in popup
      const result = await signInWithPopup(this.auth, this.provider);
      
      // Get the signed-in user
      const user = result.user;
      
      // Get the ID token for backend verification
      const idToken = await user.getIdToken();
      
      // Extract company from email domain
      const company = this.extractCompanyFromEmail(user.email || '');
      
      console.log('Google sign-in successful:', {
        email: user.email,
        displayName: user.displayName,
        company
      });
      
      return {
        uid: user.uid,
        email: user.email!,
        displayName: user.displayName || '',
        photoURL: user.photoURL,
        idToken,
        company
      };
    } catch (error: any) {
      console.error('Google sign-in failed:', error);
      
      // Handle specific error cases
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in cancelled');
      } else if (error.code === 'auth/network-request-failed') {
        throw new Error('Network error. Please check your connection.');
      } else if (error.code === 'auth/popup-blocked') {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }
      
      throw new Error(`Sign-in failed: ${error.message}`);
    }
  }

  /**
   * Extract company name from email domain
   */
  private extractCompanyFromEmail(email: string): string | undefined {
    if (!email) return undefined;
    
    const domain = email.split('@')[1];
    if (!domain) return undefined;
    
    // Skip common email providers
    const commonProviders = [
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
      'aol.com', 'icloud.com', 'mail.com', 'protonmail.com'
    ];
    
    if (commonProviders.includes(domain.toLowerCase())) {
      return undefined;
    }
    
    // Extract company name from domain
    const company = domain
      .replace(/\.(com|org|net|io|ai|co|gov|edu|dev|app)$/i, '')
      .replace(/-/g, ' ')
      .split('.')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
      
    return company;
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.auth?.currentUser || null;
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
    this.auth = null;
    this.provider = null;
    this.app = null;
  }
}