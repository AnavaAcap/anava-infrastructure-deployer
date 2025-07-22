import { exec } from 'child_process';
import { promisify } from 'util';
import { GCPAuthService } from './gcpAuthService';
import { getGcloudCommand } from '../utils/gcloudPath';

const execAsync = promisify(exec);

export class GCPServiceManager {
  constructor(_gcpAuth: GCPAuthService) {
    // Auth service is available for future use
  }

  async enableApi(projectId: string, apiName: string): Promise<void> {
    try {
      // Check if API is already enabled
      const { stdout } = await execAsync(
        getGcloudCommand(`gcloud services list --project=${projectId} --filter="config.name:${apiName}" --format=json`)
      );
      
      const services = JSON.parse(stdout);
      if (services.length > 0) {
        console.log(`API ${apiName} is already enabled`);
        return;
      }

      // Enable the API
      await execAsync(
        getGcloudCommand(`gcloud services enable ${apiName} --project=${projectId} --quiet`)
      );
      
      // Wait a bit for the API to be fully enabled
      await this.sleep(2000);
    } catch (error) {
      // If the error is about billing, provide a helpful message
      if ((error as any).message?.includes('billing')) {
        throw new Error(`Billing must be enabled for project ${projectId}. Please enable billing in the GCP Console.`);
      }
      throw new Error(`Failed to enable API ${apiName}: ${(error as Error).message}`);
    }
  }

  async createServiceAccount(projectId: string, accountId: string, displayName: string): Promise<string> {
    const email = `${accountId}@${projectId}.iam.gserviceaccount.com`;
    
    try {
      // Check if service account already exists
      const { stdout } = await execAsync(
        `gcloud iam service-accounts list --project=${projectId} --filter="email:${email}" --format=json`
      );
      
      const accounts = JSON.parse(stdout);
      if (accounts.length > 0) {
        console.log(`Service account ${email} already exists`);
        return email;
      }

      // Create service account
      await execAsync(
        `gcloud iam service-accounts create ${accountId} --display-name="${displayName}" --project=${projectId}`
      );
      
      return email;
    } catch (error) {
      throw new Error(`Failed to create service account ${accountId}: ${(error as Error).message}`);
    }
  }

  async assignIamRole(projectId: string, memberEmail: string, role: string): Promise<void> {
    try {
      const member = memberEmail.includes('@') ? `serviceAccount:${memberEmail}` : memberEmail;
      
      // Check if binding already exists
      const { stdout } = await execAsync(
        `gcloud projects get-iam-policy ${projectId} --format=json`
      );
      
      const policy = JSON.parse(stdout);
      const binding = policy.bindings?.find((b: any) => b.role === role);
      
      if (binding && binding.members?.includes(member)) {
        console.log(`IAM binding already exists for ${member} with role ${role}`);
        return;
      }

      // Add IAM policy binding
      await execAsync(
        `gcloud projects add-iam-policy-binding ${projectId} --member="${member}" --role="${role}" --quiet`
      );
    } catch (error) {
      throw new Error(`Failed to assign IAM role ${role} to ${memberEmail}: ${(error as Error).message}`);
    }
  }

  async createStorageBucket(projectId: string, bucketName: string, location: string): Promise<void> {
    try {
      // Check if bucket exists
      const { stdout } = await execAsync(
        `gcloud storage buckets list --project=${projectId} --filter="name:${bucketName}" --format=json`
      );
      
      const buckets = JSON.parse(stdout);
      if (buckets.length > 0) {
        console.log(`Storage bucket ${bucketName} already exists`);
        return;
      }

      // Create bucket
      await execAsync(
        `gcloud storage buckets create gs://${bucketName} --project=${projectId} --location=${location} --uniform-bucket-level-access`
      );
    } catch (error) {
      throw new Error(`Failed to create storage bucket ${bucketName}: ${(error as Error).message}`);
    }
  }

  async deployCloudFunction(
    projectId: string,
    functionName: string,
    sourceDir: string,
    entryPoint: string,
    runtime: string,
    serviceAccount: string,
    envVars: Record<string, string>,
    region: string
  ): Promise<string> {
    // Build environment variables string
    const envVarsStr = Object.entries(envVars)
      .map(([key, value]) => `${key}=${value}`)
      .join(',');
      
    try {

      // Deploy function
      const deployCmd = `gcloud functions deploy ${functionName} \
        --gen2 \
        --runtime=${runtime} \
        --region=${region} \
        --source=${sourceDir} \
        --entry-point=${entryPoint} \
        --trigger-http \
        --allow-unauthenticated \
        --service-account=${serviceAccount} \
        --project=${projectId} \
        ${envVarsStr ? `--set-env-vars="${envVarsStr}"` : ''} \
        --quiet`;

      const { stdout } = await execAsync(deployCmd);
      
      // Extract the function URL from the output
      const urlMatch = stdout.match(/httpsTrigger:\s*url:\s*(.+)/);
      if (urlMatch && urlMatch[1]) {
        return urlMatch[1].trim();
      }

      // If no URL in output, get it separately
      const { stdout: describeOutput } = await execAsync(
        `gcloud functions describe ${functionName} --region=${region} --project=${projectId} --format="value(httpsTrigger.url)"`
      );
      
      return describeOutput.trim();
    } catch (error) {
      // Check if function already exists
      if ((error as any).message?.includes('already exists')) {
        // Update the function instead
        const updateCmd = `gcloud functions deploy ${functionName} \
          --gen2 \
          --runtime=${runtime} \
          --region=${region} \
          --source=${sourceDir} \
          --entry-point=${entryPoint} \
          --service-account=${serviceAccount} \
          --project=${projectId} \
          ${envVarsStr ? `--update-env-vars="${envVarsStr}"` : ''} \
          --quiet`;

        await execAsync(updateCmd);
        
        const { stdout: describeOutput } = await execAsync(
          `gcloud functions describe ${functionName} --region=${region} --project=${projectId} --format="value(httpsTrigger.url)"`
        );
        
        return describeOutput.trim();
      }
      
      throw new Error(`Failed to deploy cloud function ${functionName}: ${(error as Error).message}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}