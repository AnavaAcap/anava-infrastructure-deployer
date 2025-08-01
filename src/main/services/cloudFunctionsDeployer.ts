import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import os from 'os';

export class CloudFunctionsDeployer {
  private storage = google.storage('v1');
  private cloudfunctions = google.cloudfunctions('v2');

  constructor(private auth: OAuth2Client) {}

  async deployFunction(
    projectId: string,
    functionName: string,
    sourceDir: string,
    entryPoint: string,
    runtime: string,
    serviceAccount: string,
    envVars: Record<string, string>,
    region: string
  ): Promise<string> {
    console.log(`Deploying function ${functionName}:`);
    console.log(`  Source directory: ${sourceDir}`);
    console.log(`  Entry point: ${entryPoint}`);
    console.log(`  Runtime: ${runtime}`);
    
    // Check if source directory exists
    const fs = await import('fs');
    if (!fs.existsSync(sourceDir)) {
      throw new Error(`Source directory not found: ${sourceDir}`);
    }
    
    // Step 1: Create deployment bucket if it doesn't exist
    const bucketName = `${projectId}-gcf-deployments`;
    await this.ensureDeploymentBucket(projectId, bucketName, region);

    // Step 2: Upload source code to GCS
    const sourcePath = await this.uploadSourceCode(bucketName, functionName, sourceDir);

    // Step 3: Deploy the function
    const functionUrl = await this.createOrUpdateFunction(
      projectId,
      functionName,
      sourcePath,
      entryPoint,
      runtime,
      serviceAccount,
      envVars,
      region
    );

    return functionUrl;
  }

  private async ensureDeploymentBucket(projectId: string, bucketName: string, location: string): Promise<void> {
    try {
      await this.storage.buckets.get({
        bucket: bucketName,
        auth: this.auth
      });
    } catch (error: any) {
      if (error.code === 404) {
        // Create bucket
        await this.storage.buckets.insert({
          project: projectId,
          auth: this.auth,
          requestBody: {
            name: bucketName,
            location: location.toUpperCase(),
            storageClass: 'STANDARD',
            iamConfiguration: {
              uniformBucketLevelAccess: {
                enabled: true
              }
            }
          }
        });
      } else {
        throw error;
      }
    }
  }

  private async uploadSourceCode(bucketName: string, functionName: string, sourceDir: string): Promise<string> {
    const timestamp = Date.now();
    const zipFileName = `${functionName}-${timestamp}.zip`;
    const zipFilePath = path.join(os.tmpdir(), zipFileName);

    // Create a zip archive of the source directory
    await this.createZipArchive(sourceDir, zipFilePath);

    // Upload to GCS
    const objectName = `source/${zipFileName}`;
    await this.storage.objects.insert({
      bucket: bucketName,
      auth: this.auth,
      name: objectName,
      media: {
        mimeType: 'application/zip',
        body: fs.createReadStream(zipFilePath)
      }
    });

    // Clean up temp file
    fs.unlinkSync(zipFilePath);

    return `gs://${bucketName}/${objectName}`;
  }

  private async createZipArchive(sourceDir: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      archive.on('error', (err) => reject(err));

      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  }

  private async createOrUpdateFunction(
    projectId: string,
    functionName: string,
    sourcePath: string,
    entryPoint: string,
    runtime: string,
    serviceAccount: string,
    envVars: Record<string, string>,
    region: string
  ): Promise<string> {
    const parent = `projects/${projectId}/locations/${region}`;
    const functionId = `projects/${projectId}/locations/${region}/functions/${functionName}`;

    const functionConfig = {
      name: functionId,
      buildConfig: {
        runtime: runtime,
        entryPoint: entryPoint,
        source: {
          storageSource: {
            bucket: sourcePath.split('/')[2],
            object: sourcePath.split('/').slice(3).join('/')
          }
        }
      },
      serviceConfig: {
        serviceAccountEmail: serviceAccount,
        environmentVariables: envVars,
        maxInstanceCount: 1000,
        availableMemory: '256M',
        timeoutSeconds: 60,
        ingressSettings: 'ALLOW_ALL'
      }
    };

    try {
      // Try to get existing function
      await this.cloudfunctions.projects.locations.functions.get({
        name: functionId,
        auth: this.auth
      });

      // Update existing function
      const { data: operation } = await this.cloudfunctions.projects.locations.functions.patch({
        name: functionId,
        auth: this.auth,
        requestBody: functionConfig
      });

      await this.waitForOperation(operation.name!);
    } catch (error: any) {
      if (error.code === 404) {
        // Create new function
        const { data: operation } = await this.cloudfunctions.projects.locations.functions.create({
          parent: parent,
          functionId: functionName,
          auth: this.auth,
          requestBody: functionConfig
        });

        await this.waitForOperation(operation.name!);
      } else {
        throw error;
      }
    }

    // Get the function to retrieve its URL
    const { data: func } = await this.cloudfunctions.projects.locations.functions.get({
      name: functionId,
      auth: this.auth
    });

    return func.serviceConfig?.uri || '';
  }

  private async waitForOperation(operationName: string): Promise<void> {
    let done = false;
    let retries = 0;
    const maxRetries = 120; // 10 minutes with 5 second intervals

    while (!done && retries < maxRetries) {
      const { data: operation } = await this.cloudfunctions.projects.locations.operations.get({
        name: operationName,
        auth: this.auth
      });

      if (operation.done) {
        done = true;
        if (operation.error) {
          console.error('Cloud Functions deployment failed:', operation.error);
          console.error('Build logs URL:', operation.metadata?.buildConfig?.build);
          throw new Error(`Operation failed: ${JSON.stringify(operation.error)}`);
        }
      } else {
        // Wait 5 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 5000));
        retries++;
      }
    }

    if (!done) {
      throw new Error('Operation timed out');
    }
  }
}