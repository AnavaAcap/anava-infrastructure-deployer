import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { GCPOAuthService } from './gcpOAuthService';

export class GCPApiServiceManager {
  constructor(private gcpOAuthService: GCPOAuthService) {}

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

  async enableApi(projectId: string, apiName: string): Promise<void> {
    try {
      const auth = await this.getAuthClient();
      const serviceUsage = google.serviceusage({
        version: 'v1',
        auth
      });

      // Check if API is already enabled
      const parent = `projects/${projectId}`;
      const { data } = await serviceUsage.services.list({
        parent,
        filter: `state:ENABLED`
      });

      const isEnabled = data.services?.some(
        service => service.name === `${parent}/services/${apiName}`
      );

      if (isEnabled) {
        console.log(`API ${apiName} is already enabled`);
        return;
      }

      // Enable the API
      await serviceUsage.services.enable({
        name: `${parent}/services/${apiName}`
      });

      // Wait a bit for the API to be fully enabled
      await this.sleep(2000);
    } catch (error: any) {
      if (error.message?.includes('billing')) {
        throw new Error(`Billing must be enabled for project ${projectId}. Please enable billing in the GCP Console.`);
      }
      throw new Error(`Failed to enable API ${apiName}: ${error.message}`);
    }
  }

  async createServiceAccount(projectId: string, accountId: string, displayName: string): Promise<string> {
    const email = `${accountId}@${projectId}.iam.gserviceaccount.com`;
    
    try {
      const auth = await this.getAuthClient();
      const iam = google.iam({
        version: 'v1',
        auth
      });

      // Check if service account already exists
      try {
        await iam.projects.serviceAccounts.get({
          name: `projects/${projectId}/serviceAccounts/${email}`
        });
        console.log(`Service account ${email} already exists`);
        return email;
      } catch (error: any) {
        if (error.code !== 404) throw error;
      }

      // Create service account
      const { data } = await iam.projects.serviceAccounts.create({
        name: `projects/${projectId}`,
        requestBody: {
          accountId,
          serviceAccount: {
            displayName
          }
        }
      });

      return data.email || email;
    } catch (error: any) {
      throw new Error(`Failed to create service account ${accountId}: ${error.message}`);
    }
  }

  async assignIamRole(projectId: string, memberEmail: string, role: string): Promise<void> {
    if (!memberEmail) {
      throw new Error(`Cannot assign IAM role ${role}: memberEmail is undefined or null`);
    }
    
    try {
      const auth = await this.getAuthClient();
      const cloudResourceManager = google.cloudresourcemanager({
        version: 'v1',
        auth
      });

      const member = memberEmail.includes('@') ? `serviceAccount:${memberEmail}` : memberEmail;

      // Get current IAM policy
      const { data: policy } = await cloudResourceManager.projects.getIamPolicy({
        resource: projectId,
        requestBody: {}
      });

      // Check if binding already exists
      const binding = policy.bindings?.find(b => b.role === role);
      if (binding && binding.members?.includes(member)) {
        console.log(`IAM binding already exists for ${member} with role ${role}`);
        return;
      }

      // Add new binding
      if (binding) {
        binding.members = binding.members || [];
        binding.members.push(member);
      } else {
        policy.bindings = policy.bindings || [];
        policy.bindings.push({
          role,
          members: [member]
        });
      }

      // Update IAM policy
      await cloudResourceManager.projects.setIamPolicy({
        resource: projectId,
        requestBody: {
          policy
        }
      });
    } catch (error: any) {
      throw new Error(`Failed to assign IAM role ${role} to ${memberEmail}: ${error.message}`);
    }
  }

  async assignServiceAccountUser(projectId: string, serviceAccountEmail: string, memberEmail: string): Promise<void> {
    try {
      const auth = await this.getAuthClient();
      const iam = google.iam({
        version: 'v1',
        auth
      });

      // Get current IAM policy for the service account
      const resource = `projects/${projectId}/serviceAccounts/${serviceAccountEmail}`;
      const { data: policy } = await iam.projects.serviceAccounts.getIamPolicy({
        resource
      });

      const role = 'roles/iam.serviceAccountUser';
      const member = `serviceAccount:${memberEmail}`;

      // Check if binding already exists
      const binding = policy.bindings?.find(b => b.role === role);
      if (binding && binding.members?.includes(member)) {
        console.log(`Service account user binding already exists for ${memberEmail} on ${serviceAccountEmail}`);
        return;
      }

      // Add new binding
      if (binding) {
        binding.members = binding.members || [];
        binding.members.push(member);
      } else {
        policy.bindings = policy.bindings || [];
        policy.bindings.push({
          role,
          members: [member]
        });
      }

      // Update IAM policy
      await iam.projects.serviceAccounts.setIamPolicy({
        resource,
        requestBody: {
          policy
        }
      });

      console.log(`Granted ${memberEmail} permission to act as ${serviceAccountEmail}`);
    } catch (error: any) {
      throw new Error(`Failed to assign service account user permission: ${error.message}`);
    }
  }

  async waitForComputeServiceAccount(projectId: string, projectNumber: string): Promise<string> {
    const computeSA = `${projectNumber}-compute@developer.gserviceaccount.com`;
    
    try {
      const auth = await this.getAuthClient();
      const iam = google.iam({
        version: 'v1',
        auth
      });

      // Try to get the service account to see if it exists
      const resource = `projects/${projectId}/serviceAccounts/${computeSA}`;
      
      for (let i = 0; i < 30; i++) { // Wait up to 5 minutes
        try {
          await iam.projects.serviceAccounts.get({
            name: resource
          });
          console.log(`Compute service account ${computeSA} is now available`);
          return computeSA;
        } catch (error: any) {
          if (error.code === 404) {
            console.log(`Waiting for compute service account to be created... (attempt ${i + 1}/30)`);
            await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
            continue;
          } else {
            throw error;
          }
        }
      }
      
      throw new Error(`Compute service account ${computeSA} was not created after 5 minutes`);
    } catch (error: any) {
      throw new Error(`Failed to wait for compute service account: ${error.message}`);
    }
  }

  async createStorageBucket(projectId: string, bucketName: string, location: string): Promise<void> {
    try {
      const auth = await this.getAuthClient();
      const storage = google.storage({
        version: 'v1',
        auth
      });

      // Check if bucket exists
      try {
        await storage.buckets.get({
          bucket: bucketName
        });
        console.log(`Storage bucket ${bucketName} already exists`);
        return;
      } catch (error: any) {
        if (error.code !== 404) throw error;
      }

      // Create bucket
      await storage.buckets.insert({
        project: projectId,
        requestBody: {
          name: bucketName,
          location,
          iamConfiguration: {
            uniformBucketLevelAccess: {
              enabled: true
            }
          }
        }
      });
    } catch (error: any) {
      throw new Error(`Failed to create storage bucket ${bucketName}: ${error.message}`);
    }
  }

  async deployCloudFunction(
    _projectId: string,
    _functionName: string,
    _sourceDir: string,
    _entryPoint: string,
    _runtime: string,
    _serviceAccount: string,
    _envVars: Record<string, string>,
    _region: string
  ): Promise<string> {
    // For now, throw an error as Cloud Functions v2 deployment via API is complex
    // This would need to upload source to GCS, create Cloud Build, etc.
    throw new Error('Cloud Function deployment via API not yet implemented. Use gcloud CLI for now.');
  }

  async verifyComputeServiceAccountPermissions(projectId: string, projectNumber: string): Promise<boolean> {
    try {
      const auth = await this.getAuthClient();
      const cloudResourceManager = google.cloudresourcemanager({
        version: 'v1',
        auth
      });

      const computeSA = `serviceAccount:${projectNumber}-compute@developer.gserviceaccount.com`;

      // Get current IAM policy
      const { data: policy } = await cloudResourceManager.projects.getIamPolicy({
        resource: projectId,
        requestBody: {}
      });

      // Check if compute SA has storage.objectViewer role
      const storageViewerBinding = policy.bindings?.find(b => b.role === 'roles/storage.objectViewer');
      const hasPermission = storageViewerBinding?.members?.includes(computeSA) || false;

      console.log(`Compute service account ${computeSA} has Storage Object Viewer permission: ${hasPermission}`);
      return hasPermission;
    } catch (error: any) {
      console.warn(`Failed to verify compute service account permissions: ${error.message}`);
      return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}