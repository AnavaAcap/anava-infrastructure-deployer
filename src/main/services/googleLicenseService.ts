import { OAuth2Client } from 'google-auth-library';
import { LicenseKeyService } from './licenseKeyService';

export interface GoogleTokenPayload {
  iss: string;
  azp: string;
  aud: string;
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture: string;
  given_name: string;
  family_name: string;
  iat: number;
  exp: number;
  hd?: string; // Hosted domain for Google Workspace
}

export class GoogleLicenseService {
  private oauth2Client: OAuth2Client;
  private licenseService: LicenseKeyService;

  constructor() {
    // Initialize Google OAuth client
    // TODO: Replace with your actual Google OAuth client ID
    this.oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID'
    );
    this.licenseService = new LicenseKeyService();
  }

  /**
   * Verify Google ID token and assign license
   */
  async assignLicenseWithGoogle(params: {
    idToken: string;
    firebaseConfig: any;
  }): Promise<{
    success: boolean;
    key?: string;
    email?: string;
    company?: string;
    error?: string;
  }> {
    try {
      // 1. Verify the Google ID token
      const ticket = await this.oauth2Client.verifyIdToken({
        idToken: params.idToken,
        audience: process.env.GOOGLE_CLIENT_ID
      });

      const payload = ticket.getPayload() as GoogleTokenPayload;
      
      if (!payload || !payload.email_verified) {
        throw new Error('Email not verified');
      }

      console.log('Google token verified for:', payload.email);

      // 2. Extract user information
      const userProfile = {
        googleId: payload.sub,
        email: payload.email,
        displayName: payload.name,
        firstName: payload.given_name,
        lastName: payload.family_name,
        photoURL: payload.picture,
        domain: payload.hd,
        company: this.extractCompanyFromEmail(payload.email)
      };

      // 3. Initialize Firebase for license management
      await this.licenseService.initialize(params.firebaseConfig);

      // 4. Create or sign in Firebase user
      // Since we're using Google auth, we need to create a Firebase custom token
      // const firebaseToken = await this.createFirebaseCustomToken(payload.sub, payload.email);
      
      // Note: In production, you'd use this token to sign in on the client side
      // For now, we'll use the service account to assign the license directly

      // 5. Check if user already has a license
      const existingLicense = await this.checkExistingLicense(payload.email);
      if (existingLicense) {
        return {
          success: true,
          key: existingLicense.key,
          email: payload.email,
          company: userProfile.company
        };
      }

      // 6. Assign new license
      const licenseResult = await this.assignNewLicense(payload.email, userProfile);

      // 7. Queue for HubSpot sync
      await this.queueHubSpotSync(userProfile, licenseResult.key);

      return {
        success: true,
        key: licenseResult.key,
        email: payload.email,
        company: userProfile.company
      };

    } catch (error: any) {
      console.error('Failed to assign license with Google:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      this.licenseService.dispose();
    }
  }

  /**
   * Extract company from email domain
   */
  private extractCompanyFromEmail(email: string): string | undefined {
    const domain = email.split('@')[1];
    if (!domain) return undefined;

    const commonProviders = [
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
      'aol.com', 'icloud.com', 'mail.com', 'protonmail.com'
    ];

    if (commonProviders.includes(domain.toLowerCase())) {
      return undefined;
    }

    const company = domain
      .replace(/\.(com|org|net|io|ai|co|gov|edu|dev|app)$/i, '')
      .replace(/-/g, ' ')
      .split('.')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    return company;
  }


  /**
   * Check if user already has a license
   */
  private async checkExistingLicense(_email: string): Promise<{ key: string } | null> {
    // Check in your license database
    // This is a placeholder implementation
    return null;
  }

  /**
   * Assign new license to user
   */
  private async assignNewLicense(_email: string, _profile: any): Promise<{ key: string }> {
    // This would call your existing license assignment logic
    // For now, using a placeholder
    return { key: 'TRIAL-LICENSE-KEY' };
  }

  /**
   * Queue user for HubSpot sync
   */
  private async queueHubSpotSync(profile: any, _licenseKey: string): Promise<void> {
    // Queue for async processing
    console.log('Queuing HubSpot sync for:', profile.email);
  }
}