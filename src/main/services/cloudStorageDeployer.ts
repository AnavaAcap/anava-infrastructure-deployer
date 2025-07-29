import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { getLogger } from '../utils/logger';

const logger = getLogger();

export class CloudStorageDeployer {
  private storage: any;
  private projectId: string;
  private region: string;

  constructor(auth: OAuth2Client, projectId: string, region: string) {
    this.storage = google.storage({ version: 'v1', auth });
    this.projectId = projectId;
    this.region = region;
  }

  async createBucket(bucketName: string): Promise<{ bucketName: string }> {
    logger.info(`[CloudStorage] Creating GCS bucket: ${bucketName}`);
    
    try {
      // Check if bucket already exists
      try {
        await this.storage.buckets.get({
          bucket: bucketName
        });
        logger.info(`[CloudStorage] Bucket ${bucketName} already exists`);
        return { bucketName };
      } catch (error: any) {
        if (error.code !== 404) {
          throw error;
        }
        // Bucket doesn't exist, proceed to create it
      }

      // Map region to storage location
      const storageLocation = this.getStorageLocation(this.region);
      
      // Create the bucket
      await this.storage.buckets.insert({
        project: this.projectId,
        requestBody: {
          name: bucketName,
          location: storageLocation,
          storageClass: 'STANDARD',
          iamConfiguration: {
            uniformBucketLevelAccess: {
              enabled: true
            }
          }
        }
      });

      logger.info(`[CloudStorage] Successfully created bucket: ${bucketName}`);
      
      // Grant the vertex-ai-sa service account access to the bucket
      await this.grantBucketAccess(bucketName);
      
      return { bucketName };
    } catch (error: any) {
      logger.error(`[CloudStorage] Failed to create bucket:`, error);
      throw new Error(`Failed to create storage bucket: ${error.message}`);
    }
  }

  private async grantBucketAccess(bucketName: string) {
    try {
      const serviceAccountEmail = `vertex-ai-sa@${this.projectId}.iam.gserviceaccount.com`;
      
      // Get current IAM policy
      const { data: policy } = await this.storage.buckets.getIamPolicy({
        bucket: bucketName
      });

      // Add the service account as Storage Admin
      const binding = {
        role: 'roles/storage.admin',
        members: [`serviceAccount:${serviceAccountEmail}`]
      };

      if (!policy.bindings) {
        policy.bindings = [];
      }
      
      // Check if binding already exists
      const existingBinding = policy.bindings.find((b: any) => b.role === binding.role);
      if (existingBinding) {
        if (!existingBinding.members.includes(binding.members[0])) {
          existingBinding.members.push(binding.members[0]);
        }
      } else {
        policy.bindings.push(binding);
      }

      // Update IAM policy
      await this.storage.buckets.setIamPolicy({
        bucket: bucketName,
        requestBody: policy
      });

      logger.info(`[CloudStorage] Granted Storage Admin access to ${serviceAccountEmail} on bucket ${bucketName}`);
    } catch (error: any) {
      logger.warn(`[CloudStorage] Failed to grant bucket access:`, error.message);
      // Non-fatal - bucket is created, just permissions might need manual setup
    }
  }

  private getStorageLocation(region: string): string {
    // Map compute regions to storage multi-regions or regions
    const regionMap: { [key: string]: string } = {
      'us-central1': 'US',
      'us-east1': 'US',
      'us-east4': 'US',
      'us-west1': 'US',
      'us-west2': 'US',
      'us-west3': 'US',
      'us-west4': 'US',
      'europe-west1': 'EU',
      'europe-west2': 'EU',
      'europe-west3': 'EU',
      'europe-west4': 'EU',
      'europe-west6': 'EU',
      'europe-north1': 'EU',
      'asia-east1': 'ASIA',
      'asia-east2': 'ASIA',
      'asia-northeast1': 'ASIA',
      'asia-northeast2': 'ASIA',
      'asia-northeast3': 'ASIA',
      'asia-south1': 'ASIA',
      'asia-southeast1': 'ASIA',
      'asia-southeast2': 'ASIA',
    };

    return regionMap[region] || region; // Fallback to the region itself if not in map
  }
}