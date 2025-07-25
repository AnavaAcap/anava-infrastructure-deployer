import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { GCPOAuthService } from './gcpOAuthService';
import { ipcMain } from 'electron';
import path from 'path';
import { app } from 'electron';
import fs from 'fs/promises';

export class ProjectCreatorService {
  constructor(private gcpOAuthService: GCPOAuthService) {
    this.setupIPC();
  }

  private setupIPC() {
    ipcMain.handle('create-project', async (_event, config: {
      projectName: string;
      organizationId?: string;
      billingAccountId?: string;
    }) => {
      return this.createProject(config);
    });
    
    ipcMain.handle('list-organizations', async () => {
      return this.listOrganizations();
    });
    
    ipcMain.handle('list-billing-accounts', async () => {
      return this.listBillingAccounts();
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

  async createProject(config: {
    projectName: string;
    organizationId?: string;
    billingAccountId?: string;
  }): Promise<{ success: boolean; projectId?: string; error?: string }> {
    try {
      const auth = await this.getAuthClient();
      const cloudResourceManager = google.cloudresourcemanager({
        version: 'v3',
        auth
      });

      // Generate a unique project ID from the name
      const projectId = this.generateProjectId(config.projectName);

      console.log(`Creating project: ${config.projectName} with ID: ${projectId}`);

      // Build the request body
      const requestBody: any = {
        projectId,
        displayName: config.projectName
      };

      // Add parent organization if specified
      if (config.organizationId) {
        requestBody.parent = `organizations/${config.organizationId}`;
      }

      // Create the project
      const { data: operation } = await cloudResourceManager.projects.create({
        requestBody
      });

      // Wait for the operation to complete
      const projectCreated = await this.waitForOperation(cloudResourceManager, operation.name!);

      if (projectCreated) {
        console.log(`Project ${projectId} created successfully`);
        
        // Enable billing if billing account was provided
        if (config.billingAccountId) {
          try {
            await this.enableBilling(projectId, config.billingAccountId);
            console.log(`Billing enabled for project ${projectId}`);
          } catch (error) {
            console.error('Warning: Could not enable billing:', error);
            // Continue anyway - user can enable billing manually
          }
        } else {
          console.log('No billing account provided - project created without billing');
        }
        
        // Wait for project to be fully ready
        await this.waitForProjectReady(projectId);

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

  private async enableBilling(projectId: string, billingAccountId: string): Promise<void> {
    const auth = await this.getAuthClient();
    const cloudBilling = google.cloudbilling({
      version: 'v1',
      auth
    });

    // Link the billing account to the project
    await cloudBilling.projects.updateBillingInfo({
      name: `projects/${projectId}`,
      requestBody: {
        billingAccountName: billingAccountId
      }
    });
  }

  private async waitForProjectReady(projectId: string): Promise<void> {
    console.log(`Waiting for project ${projectId} to be fully ready...`);
    
    const auth = await this.getAuthClient();
    const cloudResourceManager = google.cloudresourcemanager({
      version: 'v3',
      auth
    });

    // Wait up to 30 seconds for project to be fully ready
    const maxAttempts = 15;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        // Try to get the project - if successful, it's ready
        const { data } = await cloudResourceManager.projects.get({
          name: `projects/${projectId}`
        });
        
        if (data.state === 'ACTIVE') {
          console.log('Project is active and ready!');
          
          // Additional wait to ensure all systems are ready
          await this.sleep(3000);
          return;
        } else {
          console.log(`Project state: ${data.state}, waiting...`);
        }
      } catch (error: any) {
        console.log(`Project not ready yet (attempt ${i + 1}/${maxAttempts})`);
      }
      
      await this.sleep(2000);
    }
    
    throw new Error('Project creation timed out - project may not be fully ready');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async getOAuthProjectId(): Promise<string | null> {
    try {
      // Try to read the OAuth config to get the project ID
      const possiblePaths = [
        path.join(process.resourcesPath, 'oauth-config.json'),
        path.join(app.getAppPath(), 'oauth-config.json'),
        path.join(__dirname, '../../../oauth-config.json'),
        path.join(process.cwd(), 'oauth-config.json')
      ];
      
      for (const configPath of possiblePaths) {
        try {
          const configData = await fs.readFile(configPath, 'utf8');
          const config = JSON.parse(configData);
          return config.installed?.project_id || null;
        } catch (error) {
          // Continue to next path
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error reading OAuth config:', error);
      return null;
    }
  }

  private async ensureBillingApiEnabled(): Promise<void> {
    try {
      const auth = await this.getAuthClient();
      
      // Try to get quota project from OAuth client, or fall back to OAuth config
      let quotaProjectId = auth.quotaProjectId || await this.getOAuthProjectId();
      
      if (!quotaProjectId) {
        console.log('No quota project ID available, skipping billing API enablement');
        return;
      }

      console.log(`Ensuring Cloud Billing API is enabled in OAuth project: ${quotaProjectId}`);

      const serviceUsage = google.serviceusage({
        version: 'v1',
        auth
      });

      // Check if API is already enabled
      const parent = `projects/${quotaProjectId}`;
      const apiName = 'cloudbilling.googleapis.com';

      try {
        const { data } = await serviceUsage.services.get({
          name: `${parent}/services/${apiName}`
        });

        if (data.state === 'ENABLED') {
          console.log('Cloud Billing API is already enabled');
          return;
        }
      } catch (error) {
        // API not found, continue to enable it
        console.log('Cloud Billing API not found, enabling...');
      }

      // Enable the API
      await serviceUsage.services.enable({
        name: `${parent}/services/${apiName}`
      });

      console.log('Cloud Billing API enabled successfully');
      
      // Wait a bit for the API to be fully available
      await this.sleep(3000);
      
    } catch (error: any) {
      console.error('Error enabling Cloud Billing API:', error);
      // Don't throw - let the billing list attempt proceed and handle the error there
    }
  }

  async listOrganizations(): Promise<{ organizations: any[], error?: string }> {
    try {
      const auth = await this.getAuthClient();
      const cloudResourceManager = google.cloudresourcemanager({
        version: 'v1',
        auth
      });

      const { data } = await cloudResourceManager.organizations.search({});
      
      // Also get the user's email to show "No organization" option
      const oauth2 = google.oauth2({ version: 'v2', auth });
      const { data: userInfo } = await oauth2.userinfo.get();
      
      return {
        organizations: [
          { 
            id: null, 
            displayName: `No organization (${userInfo.email})`,
            isPersonal: true 
          },
          ...(data.organizations || []).map(org => ({
            id: org.name?.replace('organizations/', ''),
            displayName: org.displayName || org.name,
            isPersonal: false
          }))
        ]
      };
    } catch (error: any) {
      console.error('Error listing organizations:', error);
      return { 
        organizations: [{ 
          id: null, 
          displayName: 'No organization (Personal account)',
          isPersonal: true 
        }],
        error: error.message 
      };
    }
  }

  async listBillingAccounts(): Promise<{ accounts: any[], error?: string }> {
    try {
      const auth = await this.getAuthClient();
      
      // First, ensure the Cloud Billing API is enabled
      await this.ensureBillingApiEnabled();
      
      const cloudBilling = google.cloudbilling({
        version: 'v1',
        auth
      });

      const { data } = await cloudBilling.billingAccounts.list();
      
      return {
        accounts: (data.billingAccounts || [])
          .filter(account => account.open)
          .map(account => ({
            id: account.name,
            displayName: account.displayName || account.name,
            name: account.name
          }))
      };
    } catch (error: any) {
      console.error('Error listing billing accounts:', error);
      
      // Handle specific Cloud Billing API errors
      if (error.message?.includes('Cloud Billing API has not been used') || 
          error.message?.includes('disabled')) {
        return { 
          accounts: [], 
          error: 'Failed to automatically enable Cloud Billing API. You can create the project without billing and enable it manually later.'
        };
      }
      
      if (error.code === 403 || error.status === 403) {
        return {
          accounts: [],
          error: 'No permission to access billing accounts. You may need billing administrator role.'
        };
      }
      
      return { accounts: [], error: 'Could not load billing accounts. You can create the project without billing and add it later.' };
    }
  }
}