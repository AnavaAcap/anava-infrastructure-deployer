import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { GCPOAuthService } from './gcpOAuthService';
import { ipcMain } from 'electron';

export class ProjectCreatorService {
  constructor(private gcpOAuthService: GCPOAuthService) {
    this.setupIPC();
  }

  private setupIPC() {
    ipcMain.handle('create-project', async (_event, projectName: string) => {
      return this.createProject(projectName);
    });
  }

  private async getAuthClient(): Promise<OAuth2Client> {
    // Wait a bit for OAuth to initialize if needed
    let retries = 0;
    while (!this.gcpOAuthService.oauth2Client && retries < 5) {
      await this.sleep(100);
      retries++;
    }
    
    if (!this.gcpOAuthService.oauth2Client) {
      throw new Error('OAuth client not initialized. Please login first.');
    }
    
    return this.gcpOAuthService.oauth2Client;
  }

  async createProject(projectName: string): Promise<{ success: boolean; projectId?: string; error?: string }> {
    try {
      const auth = await this.getAuthClient();
      const cloudResourceManager = google.cloudresourcemanager({
        version: 'v3',
        auth
      });

      // Generate a unique project ID from the name
      const projectId = this.generateProjectId(projectName);

      console.log(`Creating project: ${projectName} with ID: ${projectId}`);

      // Create the project
      const { data: operation } = await cloudResourceManager.projects.create({
        requestBody: {
          projectId,
          displayName: projectName
          // Omit parent to create without organization
        }
      });

      // Wait for the operation to complete
      const projectCreated = await this.waitForOperation(cloudResourceManager, operation.name!);

      if (projectCreated) {
        console.log(`Project ${projectId} created successfully`);
        
        // Enable billing if available (optional - will silently fail if no billing account)
        try {
          await this.enableBilling(projectId);
        } catch (error) {
          console.log('Could not enable billing (no billing account or permissions)');
        }

        return { success: true, projectId };
      } else {
        throw new Error('Project creation operation failed');
      }

    } catch (error: any) {
      console.error('Error creating project:', error);
      
      // Handle specific errors
      if (error.message?.includes('quota')) {
        return { 
          success: false, 
          error: 'Project quota exceeded. Please delete unused projects or request a quota increase.' 
        };
      }
      
      if (error.message?.includes('already exists')) {
        return { 
          success: false, 
          error: 'A project with this ID already exists. Please choose a different name.' 
        };
      }
      
      if (error.message?.includes('permission')) {
        return { 
          success: false, 
          error: 'You do not have permission to create projects. Please check your account permissions.' 
        };
      }
      
      return { 
        success: false, 
        error: error.message || 'Failed to create project' 
      };
    }
  }

  private generateProjectId(projectName: string): string {
    // Convert to lowercase, replace spaces with hyphens, remove special chars
    const base = projectName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    // Add timestamp to ensure uniqueness
    const timestamp = Date.now().toString(36).slice(-4);
    
    // Project IDs must be 6-30 characters
    const projectId = `${base}-${timestamp}`.slice(0, 30);
    
    return projectId;
  }

  private async waitForOperation(
    cloudResourceManager: any, 
    operationName: string,
    maxAttempts = 30
  ): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const { data } = await cloudResourceManager.operations.get({
          name: operationName
        });

        if (data.done) {
          if (data.error) {
            throw new Error(data.error.message);
          }
          return true;
        }

        // Wait 2 seconds before checking again
        await this.sleep(2000);
      } catch (error) {
        console.error('Error checking operation status:', error);
        throw error;
      }
    }

    throw new Error('Operation timed out');
  }

  private async enableBilling(projectId: string): Promise<void> {
    try {
      const auth = await this.getAuthClient();
      const cloudBilling = google.cloudbilling({
        version: 'v1',
        auth
      });

      // List billing accounts
      const { data } = await cloudBilling.billingAccounts.list();
      
      if (!data.billingAccounts || data.billingAccounts.length === 0) {
        console.log('No billing accounts available');
        return;
      }

      // Use the first open billing account
      const billingAccount = data.billingAccounts.find(
        account => account.open && account.name
      );

      if (!billingAccount) {
        console.log('No open billing accounts found');
        return;
      }

      // Link the billing account to the project
      await cloudBilling.projects.updateBillingInfo({
        name: `projects/${projectId}`,
        requestBody: {
          billingAccountName: billingAccount.name
        }
      });

      console.log(`Billing enabled for project ${projectId}`);
    } catch (error) {
      console.error('Error enabling billing:', error);
      // Silently fail - billing is optional
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}