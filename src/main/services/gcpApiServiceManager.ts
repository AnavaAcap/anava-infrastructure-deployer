import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { GCPOAuthService } from './gcpOAuthService';
import { ParallelExecutor } from './utils/parallelExecutor';

export class GCPApiServiceManager {
  private billingRequired = new Set([
    'compute.googleapis.com',
    'cloudfunctions.googleapis.com',
    'apigateway.googleapis.com',
    'servicemanagement.googleapis.com',
    'servicecontrol.googleapis.com',
    'artifactregistry.googleapis.com',
    'cloudbuild.googleapis.com',
    'run.googleapis.com',
    'aiplatform.googleapis.com'
  ]);

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

      // Check if this API requires billing
      if (this.billingRequired.has(apiName)) {
        const billingStatus = await this.checkProjectBilling(projectId);
        if (!billingStatus.enabled) {
          throw new Error(
            `Billing is required to enable ${apiName}. Please enable billing for project ${projectId} in the Google Cloud Console.\n\n` +
            `To enable billing:\n` +
            `1. Go to https://console.cloud.google.com/billing\n` +
            `2. Select or create a billing account\n` +
            `3. Link it to project ${projectId}\n` +
            `4. Try the deployment again`
          );
        }
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

  async enableApis(projectId: string, apis: string[]): Promise<void> {
    console.log(`Enabling ${apis.length} APIs in parallel...`);
    const startTime = Date.now();
    
    try {
      const auth = await this.getAuthClient();
      const serviceUsage = google.serviceusage({
        version: 'v1',
        auth
      });

      // Check which APIs are already enabled
      const parent = `projects/${projectId}`;
      const { data } = await serviceUsage.services.list({
        parent,
        filter: `state:ENABLED`,
        pageSize: 200
      });

      const enabledApis = new Set(
        data.services?.map(service => service.name?.split('/').pop()) || []
      );

      const apisToEnable = apis.filter(api => !enabledApis.has(api));
      
      if (apisToEnable.length === 0) {
        console.log('All APIs are already enabled');
        return;
      }

      console.log(`Need to enable ${apisToEnable.length} APIs: ${apisToEnable.join(', ')}`);

      // Check billing for APIs that require it
      const billingRequiredApis = apisToEnable.filter(api => this.billingRequired.has(api));
      if (billingRequiredApis.length > 0) {
        const billingStatus = await this.checkProjectBilling(projectId);
        if (!billingStatus.enabled) {
          throw new Error(
            `Billing is required to enable these APIs: ${billingRequiredApis.join(', ')}.\n` +
            `Please enable billing for project ${projectId} in the Google Cloud Console.`
          );
        }
      }

      // Enable APIs in parallel with controlled concurrency
      const tasks = apisToEnable.map(api => ({
        name: api,
        fn: async () => {
          await serviceUsage.services.enable({
            name: `${parent}/services/${api}`
          });
          console.log(`Enabled API: ${api}`);
        },
        critical: false // Continue even if one fails
      }));

      const results = await ParallelExecutor.executeBatch(tasks, {
        maxConcurrency: 5, // Limit concurrent API calls
        stopOnError: false
      });

      // Check for failures
      const failures = results.filter(r => !r.success);
      if (failures.length > 0) {
        console.error(`Failed to enable ${failures.length} APIs:`, failures.map(f => f.name));
        throw new Error(`Failed to enable APIs: ${failures.map(f => f.name).join(', ')}`);
      }

      const elapsed = Date.now() - startTime;
      console.log(`Successfully enabled ${apisToEnable.length} APIs in ${elapsed}ms`);
      
      // Brief wait for APIs to propagate
      console.log('Waiting for APIs to propagate...');
      await this.sleep(3000);
    } catch (error: any) {
      if (error.message?.includes('billing')) {
        throw new Error(`Billing must be enabled for project ${projectId}. Please enable billing in the GCP Console.`);
      }
      throw error;
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

      const createdEmail = data.email || email;
      
      // Verify the service account exists before returning (handle eventual consistency)
      await this.verifyServiceAccountExists(projectId, createdEmail);
      
      return createdEmail;
    } catch (error: any) {
      throw new Error(`Failed to create service account ${accountId}: ${error.message}`);
    }
  }

  async createServiceAccounts(
    projectId: string, 
    accounts: Array<{ name: string; displayName: string }>
  ): Promise<Record<string, string>> {
    console.log(`Creating ${accounts.length} service accounts in parallel...`);
    const startTime = Date.now();
    const results: Record<string, string> = {};
    
    const tasks = accounts.map(account => ({
      name: account.name,
      fn: async () => {
        const email = await this.createServiceAccount(projectId, account.name, account.displayName);
        results[account.name] = email;
        return email;
      },
      critical: true // Service accounts are critical
    }));

    const parallelResults = await ParallelExecutor.executeBatch(tasks, {
      maxConcurrency: 4, // Create up to 4 accounts simultaneously
      stopOnError: true
    });

    // Check for failures
    const failures = parallelResults.filter(r => !r.success);
    if (failures.length > 0) {
      throw new Error(`Failed to create service accounts: ${failures.map(f => f.name).join(', ')}`);
    }

    const elapsed = Date.now() - startTime;
    console.log(`Created ${accounts.length} service accounts in ${elapsed}ms`);
    
    return results;
  }

  async verifyServiceAccountExists(projectId: string, email: string, maxRetries: number = 10): Promise<void> {
    const auth = await this.getAuthClient();
    const iam = google.iam({ version: 'v1', auth });
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        await iam.projects.serviceAccounts.get({
          name: `projects/${projectId}/serviceAccounts/${email}`
        });
        console.log(`Service account ${email} verified as existing`);
        return; // Success, account exists
      } catch (error: any) {
        if (error.code === 404 && i < maxRetries - 1) {
          console.log(`Service account ${email} not yet available, waiting... (${i + 1}/${maxRetries})`);
          await this.sleep(2000); // 2 second delay
          continue;
        }
        throw error;
      }
    }
    throw new Error(`Service account ${email} was not available after ${maxRetries} attempts`);
  }

  async assignIamRole(projectId: string, memberEmail: string, role: string, maxRetries: number = 5): Promise<void> {
    if (!memberEmail) {
      throw new Error(`Cannot assign IAM role ${role}: memberEmail is undefined or null`);
    }
    
    const auth = await this.getAuthClient();
    const cloudResourceManager = google.cloudresourcemanager({
      version: 'v1',
      auth
    });

    const member = memberEmail.includes('@') ? `serviceAccount:${memberEmail}` : memberEmail;

    // Retry logic for eventual consistency
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
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
        
        console.log(`Successfully assigned IAM role ${role} to ${memberEmail}`);
        return; // Success
        
      } catch (error: any) {
        const isServiceAccountNotExist = error.message?.includes('does not exist') || 
                                       error.message?.includes('not found') ||
                                       error.code === 404;
        
        if (isServiceAccountNotExist && attempt < maxRetries - 1) {
          const waitTime = Math.pow(2, attempt) * 2000; // Exponential backoff: 2s, 4s, 8s, 16s
          console.log(`Service account not yet available for IAM role assignment, retrying in ${waitTime/1000}s... (${attempt + 1}/${maxRetries})`);
          await this.sleep(waitTime);
          continue;
        }
        
        // Final attempt failed or non-retryable error
        throw new Error(`Failed to assign IAM role ${role} to ${memberEmail}: ${error.message}`);
      }
    }
  }

  async assignIamRoles(
    projectId: string,
    roleAssignments: Array<{ memberEmail: string; role: string }>
  ): Promise<void> {
    console.log(`Assigning ${roleAssignments.length} IAM roles in parallel...`);
    const startTime = Date.now();
    
    const tasks = roleAssignments.map(({ memberEmail, role }) => ({
      name: `${memberEmail} -> ${role}`,
      fn: () => this.assignIamRole(projectId, memberEmail, role),
      critical: true // IAM roles are critical
    }));

    const results = await ParallelExecutor.executeBatch(tasks, {
      maxConcurrency: 5, // Limit concurrent IAM operations
      stopOnError: true
    });

    // Check for failures
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      throw new Error(`Failed to assign IAM roles: ${failures.map(f => f.name).join(', ')}`);
    }

    const elapsed = Date.now() - startTime;
    console.log(`Assigned ${roleAssignments.length} IAM roles in ${elapsed}ms`);
  }

  async assignServiceAccountUser(projectId: string, serviceAccountEmail: string, memberEmail: string, maxRetries: number = 5): Promise<void> {
    const auth = await this.getAuthClient();
    const iam = google.iam({
      version: 'v1',
      auth
    });

    const resource = `projects/${projectId}/serviceAccounts/${serviceAccountEmail}`;
    const role = 'roles/iam.serviceAccountUser';
    const member = `serviceAccount:${memberEmail}`;

    // Retry logic for eventual consistency
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Get current IAM policy for the service account
        const { data: policy } = await iam.projects.serviceAccounts.getIamPolicy({
          resource
        });

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
        return; // Success
        
      } catch (error: any) {
        const isServiceAccountNotExist = error.message?.includes('does not exist') || 
                                       error.message?.includes('not found') ||
                                       error.code === 404;
        
        if (isServiceAccountNotExist && attempt < maxRetries - 1) {
          const waitTime = Math.pow(2, attempt) * 2000; // Exponential backoff: 2s, 4s, 8s, 16s
          console.log(`Service account not yet available for user permission, retrying in ${waitTime/1000}s... (${attempt + 1}/${maxRetries})`);
          await this.sleep(waitTime);
          continue;
        }
        
        // Final attempt failed or non-retryable error
        throw new Error(`Failed to assign service account user permission: ${error.message}`);
      }
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

  async checkProjectBilling(projectId: string): Promise<{ enabled: boolean; accountName?: string }> {
    try {
      const auth = await this.getAuthClient();
      const cloudBilling = google.cloudbilling({
        version: 'v1',
        auth
      });

      const { data } = await cloudBilling.projects.getBillingInfo({
        name: `projects/${projectId}`
      });

      return {
        enabled: !!data.billingEnabled,
        accountName: data.billingAccountName || undefined
      };
    } catch (error) {
      console.error('Error checking billing:', error);
      return { enabled: false };
    }
  }
}