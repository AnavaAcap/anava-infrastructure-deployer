import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface BillingCheckResult {
  enabled: boolean;
  billingAccountName?: string;
  error?: string;
}

export class BillingService {
  private async getAuthClient(): Promise<OAuth2Client> {
    const auth = new google.auth.GoogleAuth({
      scopes: [
        'https://www.googleapis.com/auth/cloud-platform',
        'https://www.googleapis.com/auth/cloud-billing',
        'https://www.googleapis.com/auth/cloud-billing.readonly'
      ]
    });
    return auth.getClient() as Promise<OAuth2Client>;
  }

  async checkProjectBilling(projectId: string): Promise<BillingCheckResult> {
    try {
      console.log(`Checking billing status for project: ${projectId}`);
      
      const auth = await this.getAuthClient();
      const cloudbilling = google.cloudbilling({
        version: 'v1',
        auth
      });

      // Get billing info for the project
      const response = await cloudbilling.projects.getBillingInfo({
        name: `projects/${projectId}`
      });

      const billingEnabled = !!response.data.billingEnabled;
      const billingAccountName = response.data.billingAccountName;

      console.log(`Billing status for ${projectId}: ${billingEnabled ? 'ENABLED' : 'DISABLED'}`);
      
      return {
        enabled: billingEnabled,
        billingAccountName: billingAccountName || undefined
      };
    } catch (error: any) {
      console.error('Error checking billing status:', error);
      
      // Handle specific permission errors
      if (error.code === 403 || error.message?.includes('Permission')) {
        return {
          enabled: false,
          error: 'Permission denied. Please ensure you have the "Billing Account Viewer" role.'
        };
      }
      
      // Handle network errors
      if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
        return {
          enabled: false,
          error: 'Network error. Please check your internet connection.'
        };
      }
      
      // Generic error
      return {
        enabled: false,
        error: error.message || 'Failed to check billing status'
      };
    }
  }

  async listBillingAccounts(): Promise<Array<{ name: string; displayName: string; open: boolean }>> {
    try {
      const auth = await this.getAuthClient();
      const cloudbilling = google.cloudbilling({
        version: 'v1',
        auth
      });

      const response = await cloudbilling.billingAccounts.list();
      
      // Filter and map to ensure all required fields are present
      return (response.data.billingAccounts || [])
        .filter(account => account.name && account.displayName)
        .map(account => ({
          name: account.name!,
          displayName: account.displayName!,
          open: account.open || false
        }));
    } catch (error) {
      console.error('Error listing billing accounts:', error);
      return [];
    }
  }

  async linkBillingAccount(projectId: string, billingAccountName: string): Promise<boolean> {
    try {
      const auth = await this.getAuthClient();
      const cloudbilling = google.cloudbilling({
        version: 'v1',
        auth
      });

      await cloudbilling.projects.updateBillingInfo({
        name: `projects/${projectId}`,
        requestBody: {
          billingAccountName
        }
      });

      console.log(`Successfully linked billing account ${billingAccountName} to project ${projectId}`);
      return true;
    } catch (error) {
      console.error('Error linking billing account:', error);
      return false;
    }
  }
}

export const billingService = new BillingService();