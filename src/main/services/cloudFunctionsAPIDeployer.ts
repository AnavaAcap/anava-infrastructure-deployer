import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { ParallelExecutor } from './utils/parallelExecutor';

export interface CloudFunctionConfig {
  name: string;
  entryPoint: string;
  runtime: string;
  region: string;
  serviceAccount: string;
  environmentVariables?: Record<string, string>;
  maxInstances?: number;
}

export class CloudFunctionsAPIDeployer {
  private functions = google.cloudfunctions('v2');
  private storage = google.storage('v1');
  private cloudresourcemanager = google.cloudresourcemanager('v1');
  private auth: OAuth2Client;
  private projectNumberCache: { [projectId: string]: string } = {};

  constructor(auth: OAuth2Client) {
    this.auth = auth;
  }

  async deployFunctions(
    projectId: string,
    configs: Array<{ config: CloudFunctionConfig; sourceDir: string }>,
    onProgress?: (completed: number, total: number) => void
  ): Promise<Record<string, string>> {
    console.log(`Deploying ${configs.length} Cloud Functions in parallel...`);
    const startTime = Date.now();
    const results: Record<string, string> = {};
    
    // Get project number once for all functions (used inside deployFunction)
    
    const tasks = configs.map(({ config, sourceDir }) => ({
      name: config.name,
      fn: async () => {
        const url = await this.deployFunction(projectId, config, sourceDir);
        results[config.name] = url;
        return url;
      },
      critical: true // All functions are critical
    }));

    const parallelResults = await ParallelExecutor.executeBatch(tasks, {
      maxConcurrency: 2, // Deploy up to 2 functions simultaneously
      stopOnError: true,
      onProgress
    });

    // Check for failures
    const failures = parallelResults.filter(r => !r.success);
    if (failures.length > 0) {
      throw new Error(`Failed to deploy functions: ${failures.map(f => f.name).join(', ')}`);
    }

    const elapsed = Date.now() - startTime;
    console.log(`Deployed ${configs.length} functions in ${elapsed}ms`);
    
    return results;
  }

  async deployFunction(
    projectId: string,
    config: CloudFunctionConfig,
    sourceDir: string
  ): Promise<string> {
    console.log(`Deploying cloud function ${config.name} using Google Cloud APIs...`);

    try {
      // Get project number for bucket name
      const projectNumber = await this.getProjectNumber(projectId);
      // Check if function exists and its state
      const functionName = `projects/${projectId}/locations/${config.region}/functions/${config.name}`;
      let functionExists = false;
      let needsRecreation = false;

      try {
        const { data: existingFunction } = await this.functions.projects.locations.functions.get({
          name: functionName,
          auth: this.auth
        });
        functionExists = true;
        
        // Check function state
        const state = existingFunction.state;
        console.log(`Function ${config.name} exists in state: ${state}`);
        
        if (state === 'FAILED' || state === 'DELETE_IN_PROGRESS') {
          console.log(`Function is in ${state} state, will delete and recreate`);
          needsRecreation = true;
        } else if (state === 'DEPLOYING') {
          console.log('Function is currently deploying, waiting for completion...');
          // Wait for the current deployment to finish
          await this.waitForFunctionReady(functionName);
        }
      } catch (error: any) {
        if (error.code !== 404) {
          throw error;
        }
        console.log(`Function ${config.name} does not exist, will create it`);
      }
      
      // Delete and recreate if needed
      if (needsRecreation) {
        try {
          console.log(`Deleting failed function ${config.name}...`);
          const { data: deleteOp } = await this.functions.projects.locations.functions.delete({
            name: functionName,
            auth: this.auth
          });
          
          if (deleteOp.name) {
            await this.waitForOperation(deleteOp.name);
          }
          functionExists = false;
        } catch (error: any) {
          console.log(`Warning: Failed to delete function: ${error.message}`);
        }
      }

      // Upload source code to Cloud Storage
      const sourceArchiveUrl = await this.uploadSourceCode(projectId, projectNumber, config.name, sourceDir, config.region);
      console.log(`Uploaded source to: ${sourceArchiveUrl}`);
      const objectPath = sourceArchiveUrl.split('/').pop();
      console.log(`Using object path: ${objectPath}`);

      // Prepare function configuration
      const functionConfig: any = {
        name: functionName,
        buildConfig: {
          runtime: config.runtime,
          entryPoint: config.entryPoint,
          source: {
            storageSource: {
              bucket: `gcf-v2-sources-${projectNumber}-${config.region}`,
              object: sourceArchiveUrl.split('/').pop() // Just the filename
            }
          }
        },
        serviceConfig: {
          serviceAccountEmail: config.serviceAccount,
          maxInstanceCount: config.maxInstances || 100,
          environmentVariables: config.environmentVariables || {},
          ingressSettings: 'ALLOW_ALL',
          allTrafficOnLatestRevision: true,
          availableMemory: '256M',
          timeoutSeconds: 60
        }
      };

      // Create or update function
      let operation;
      if (functionExists) {
        // Update existing function
        const { data } = await this.functions.projects.locations.functions.patch({
          name: functionName,
          updateMask: 'buildConfig,serviceConfig',
          requestBody: functionConfig,
          auth: this.auth
        });
        operation = data;
      } else {
        // Create new function
        const { data } = await this.functions.projects.locations.functions.create({
          parent: `projects/${projectId}/locations/${config.region}`,
          functionId: config.name,
          requestBody: functionConfig,
          auth: this.auth
        });
        operation = data;
      }

      // Wait for operation to complete
      if (operation.name) {
        console.log('Waiting for function deployment to complete...');
        await this.waitForOperation(operation.name);
        console.log(`Function ${config.name} deployed successfully`);
      }

      // Get the function details to return the URL
      const { data: functionData } = await this.functions.projects.locations.functions.get({
        name: functionName,
        auth: this.auth
      });

      return functionData.serviceConfig?.uri || '';
    } catch (error: any) {
      console.error('Failed to deploy cloud function:', error);
      throw new Error(`Failed to deploy function ${config.name}: ${error.message}`);
    }
  }

  private async uploadSourceCode(
    projectId: string,
    projectNumber: string,
    functionName: string,
    sourceDir: string,
    region: string
  ): Promise<string> {
    const bucketName = `gcf-v2-sources-${projectNumber}-${region}`;
    
    // Ensure bucket exists
    await this.ensureBucketExists(projectId, bucketName, region);

    // Create zip archive
    const zipFileName = `${functionName}-${Date.now()}.zip`;
    const zipFilePath = path.join(require('os').tmpdir(), zipFileName);
    
    await this.createZipArchive(sourceDir, zipFilePath);

    // Upload to Cloud Storage - unique filename at root
    const objectName = zipFileName;
    
    await this.storage.objects.insert({
      bucket: bucketName,
      name: objectName,
      uploadType: 'media',
      media: {
        body: fs.createReadStream(zipFilePath)
      },
      auth: this.auth
    });

    // Clean up temp file
    fs.unlinkSync(zipFilePath);

    return `gs://${bucketName}/${objectName}`;
  }

  private async ensureBucketExists(projectId: string, bucketName: string, region: string): Promise<void> {
    try {
      await this.storage.buckets.get({
        bucket: bucketName,
        auth: this.auth
      });
      return; // Bucket exists
    } catch (error: any) {
      if (error.code !== 404) {
        throw error; // Unexpected error
      }
      // Bucket doesn't exist, try to create it
    }
    
    // Try to create the bucket, handling race conditions
    try {
      const location = this.mapRegionToGCSLocation(region);
      await this.storage.buckets.insert({
        project: projectId,
        requestBody: {
          name: bucketName,
          location: location
        },
        auth: this.auth
      });
      console.log(`Created bucket ${bucketName}`);
    } catch (error: any) {
      // Handle race condition where another process created the bucket
      if (error.code === 409 && error.message?.includes('you already own it')) {
        console.log(`Bucket ${bucketName} already exists (created by parallel process)`);
        return; // That's fine, bucket exists now
      }
      throw error; // Some other error
    }
  }

  private async createZipArchive(sourceDir: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      archive.on('error', reject);

      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  }

  private async waitForOperation(operationName: string): Promise<void> {
    const operations = google.cloudfunctions('v2').projects.locations.operations;
    let done = false;
    let retries = 0;
    const maxRetries = 120; // 10 minutes

    while (!done && retries < maxRetries) {
      const { data: operation } = await operations.get({
        name: operationName,
        auth: this.auth
      });

      if (operation.done) {
        done = true;
        if (operation.error) {
          throw new Error(`Operation failed: ${JSON.stringify(operation.error)}`);
        }
      } else {
        if (retries % 6 === 0) { // Log every 30 seconds
          console.log(`Still waiting for operation... (${retries * 5}s elapsed)`);
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
        retries++;
      }
    }

    if (!done) {
      throw new Error('Operation timed out');
    }
  }

  private async waitForFunctionReady(functionName: string, maxRetries: number = 120): Promise<void> {
    console.log('Waiting for function to be ready...');
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        const { data: func } = await this.functions.projects.locations.functions.get({
          name: functionName,
          auth: this.auth
        });
        
        const state = func.state;
        console.log(`Function state: ${state}`);
        
        if (state === 'ACTIVE') {
          console.log('Function is ready');
          return;
        } else if (state === 'FAILED') {
          throw new Error('Function deployment failed');
        } else if (state === 'DELETING' || state === 'DELETE_IN_PROGRESS') {
          throw new Error('Function is being deleted');
        }
        
        // Still deploying, wait and retry
        await new Promise(resolve => setTimeout(resolve, 5000));
        retries++;
      } catch (error: any) {
        if (error.message && (error.message.includes('failed') || error.message.includes('deleted'))) {
          throw error;
        }
        // Other errors might be transient, retry
        console.log(`Error checking function state: ${error.message}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        retries++;
      }
    }
    
    throw new Error('Timeout waiting for function to be ready');
  }

  private mapRegionToGCSLocation(region: string): string {
    // Map Cloud Functions regions to Cloud Storage locations
    const locationMap: { [key: string]: string } = {
      // US regions
      'us-central1': 'US',
      'us-east1': 'US',
      'us-east4': 'US',
      'us-east5': 'US',
      'us-south1': 'US',
      'us-west1': 'US',
      'us-west2': 'US',
      'us-west3': 'US',
      'us-west4': 'US',
      // Multi-region
      'northamerica-northeast1': 'NORTHAMERICA-NORTHEAST1',
      'northamerica-northeast2': 'NORTHAMERICA-NORTHEAST2',
      'southamerica-east1': 'SOUTHAMERICA-EAST1',
      'southamerica-west1': 'SOUTHAMERICA-WEST1',
      // Europe
      'europe-central2': 'EUROPE-CENTRAL2',
      'europe-north1': 'EUROPE-NORTH1',
      'europe-southwest1': 'EUROPE-SOUTHWEST1',
      'europe-west1': 'EU',
      'europe-west2': 'EUROPE-WEST2',
      'europe-west3': 'EUROPE-WEST3',
      'europe-west4': 'EUROPE-WEST4',
      'europe-west6': 'EUROPE-WEST6',
      'europe-west8': 'EUROPE-WEST8',
      'europe-west9': 'EUROPE-WEST9',
      'europe-west10': 'EUROPE-WEST10',
      'europe-west12': 'EUROPE-WEST12',
      // Asia
      'asia-east1': 'ASIA-EAST1',
      'asia-east2': 'ASIA-EAST2',
      'asia-northeast1': 'ASIA-NORTHEAST1',
      'asia-northeast2': 'ASIA-NORTHEAST2',
      'asia-northeast3': 'ASIA-NORTHEAST3',
      'asia-south1': 'ASIA-SOUTH1',
      'asia-south2': 'ASIA-SOUTH2',
      'asia-southeast1': 'ASIA-SOUTHEAST1',
      'asia-southeast2': 'ASIA-SOUTHEAST2',
      // Australia
      'australia-southeast1': 'AUSTRALIA-SOUTHEAST1',
      'australia-southeast2': 'AUSTRALIA-SOUTHEAST2',
      // Middle East
      'me-central1': 'ME-CENTRAL1',
      'me-central2': 'ME-CENTRAL2',
      'me-west1': 'ME-WEST1',
    };

    return locationMap[region] || region.toUpperCase();
  }

  private async getProjectNumber(projectId: string): Promise<string> {
    // Check cache first
    if (this.projectNumberCache[projectId]) {
      return this.projectNumberCache[projectId];
    }

    try {
      const { data: project } = await this.cloudresourcemanager.projects.get({
        projectId: projectId,
        auth: this.auth
      });

      if (!project.projectNumber) {
        throw new Error('Could not determine project number');
      }

      // Cache for future use
      this.projectNumberCache[projectId] = project.projectNumber;
      return project.projectNumber;
    } catch (error: any) {
      throw new Error(`Failed to get project number: ${error.message}`);
    }
  }
}