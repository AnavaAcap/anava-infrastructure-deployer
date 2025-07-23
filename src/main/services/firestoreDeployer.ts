import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export class FirestoreDeployer {
  private firebaserules = google.firebaserules('v1');
  private firestore = google.firestore('v1');
  
  constructor(private auth: OAuth2Client) {}

  async deploySecurityRules(
    projectId: string,
    logCallback?: (message: string) => void
  ): Promise<void> {
    const log = (message: string) => {
      console.log(message);
      logCallback?.(message);
    };

    log('=== Deploying Firestore and Firebase Storage Security Rules ===');
    
    try {
      // First ensure the database exists
      await this.ensureFirestoreDatabaseExists(projectId, log);
      
      // Deploy Firestore rules
      await this.deployFirestoreRules(projectId, log);
      
      // Try to deploy Storage rules, but don't fail the entire deployment if it fails
      try {
        await this.deployStorageRules(projectId, log);
        log('✅ All security rules deployed successfully');
      } catch (storageError: any) {
        log('⚠️  Warning: Could not deploy Firebase Storage security rules');
        log(`⚠️  ${storageError.message}`);
        log('⚠️  You may need to:');
        log('⚠️  1. Enable Firebase Storage in the Firebase Console');
        log('⚠️  2. Create a default storage bucket');
        log('⚠️  3. Deploy storage rules manually');
        log('');
        log('✅ Firestore security rules deployed successfully');
      }
      
      log('⚠️  IMPORTANT: Verify rules in Firebase Console to ensure they meet your security requirements');
    } catch (error: any) {
      console.error('Failed to deploy security rules:', error);
      throw new Error(`Security rules deployment failed: ${error.message}`);
    }
  }

  private async deployFirestoreRules(
    projectId: string,
    log: (message: string) => void
  ): Promise<void> {
    log('Deploying Firestore security rules...');
    
    // Read Firestore rules template
    const rulesPath = path.join(
      app.isPackaged ? process.resourcesPath : app.getAppPath(),
      'firestore-rules',
      'firestore.rules'
    );
    
    const rulesContent = fs.readFileSync(rulesPath, 'utf-8');
    log('Loaded Firestore security rules from template');

    // Deploy rules to default database
    await this.deployRulesToDatabase(projectId, '(default)', rulesContent, log);
  }

  private async deployStorageRules(
    projectId: string,
    log: (message: string) => void
  ): Promise<void> {
    log('Deploying Firebase Storage security rules...');
    
    // First ensure storage bucket exists
    await this.ensureStorageBucketExists(projectId, log);
    
    // Read Storage rules template
    const rulesPath = path.join(
      app.isPackaged ? process.resourcesPath : app.getAppPath(),
      'firestore-rules',
      'storage.rules'
    );
    
    const rulesContent = fs.readFileSync(rulesPath, 'utf-8');
    log('Loaded Firebase Storage security rules from template');

    // Deploy storage rules
    await this.deployStorageRulesToBucket(projectId, rulesContent, log);
  }

  private async deployRulesToDatabase(
    projectId: string, 
    databaseId: string, 
    rulesContent: string,
    log: (message: string) => void
  ): Promise<void> {
    log(`Deploying rules to Firestore database: ${databaseId}`);
    
    const ruleset = {
      source: {
        files: [{
          name: 'firestore.rules',
          content: rulesContent
        }]
      }
    };

    // Create ruleset
    const { data: createdRuleset } = await this.firebaserules.projects.rulesets.create({
      name: `projects/${projectId}`,
      requestBody: ruleset,
      auth: this.auth
    });

    log(`Created Firestore ruleset: ${createdRuleset.name}`);

    // Update release to use new ruleset
    // For default database, the release name format is: projects/{project}/releases/cloud.firestore
    const releaseName = `projects/${projectId}/releases/cloud.firestore`;
    
    try {
      // First try to get the existing release
      await this.firebaserules.projects.releases.get({
        name: releaseName,
        auth: this.auth
      });
      
      // If it exists, patch it
      await this.firebaserules.projects.releases.patch({
        name: releaseName,
        requestBody: {
          release: {
            name: releaseName,
            rulesetName: createdRuleset.name
          }
        },
        auth: this.auth
      });
    } catch (error: any) {
      if (error.code === 404) {
        // If release doesn't exist, create it
        log('Release not found, creating new release...');
        await this.firebaserules.projects.releases.create({
          name: `projects/${projectId}`,
          requestBody: {
            name: releaseName,
            rulesetName: createdRuleset.name
          },
          auth: this.auth
        });
      } else {
        throw error;
      }
    }

    log(`Updated Firestore database ${databaseId} to use new security rules`);
  }

  private async deployStorageRulesToBucket(
    projectId: string,
    rulesContent: string,
    log: (message: string) => void
  ): Promise<void> {
    log('Deploying rules to Firebase Storage bucket');
    
    const ruleset = {
      source: {
        files: [{
          name: 'storage.rules',
          content: rulesContent
        }]
      }
    };

    // Create ruleset for storage
    const { data: createdRuleset } = await this.firebaserules.projects.rulesets.create({
      name: `projects/${projectId}`,
      requestBody: ruleset,
      auth: this.auth
    });

    log(`Created Storage ruleset: ${createdRuleset.name}`);

    // Try multiple possible storage bucket names
    const storageBuckets = [
      `${projectId}.appspot.com`,
      `${projectId}.firebasestorage.app`,
      `${projectId}-firebase-storage`  // Our custom bucket name
    ];

    let ruleDeployed = false;

    for (const bucket of storageBuckets) {
      try {
        const releaseName = `projects/${projectId}/releases/firebase.storage/${bucket}`;
        
        await this.firebaserules.projects.releases.patch({
          name: releaseName,
          requestBody: {
            release: {
              name: releaseName,
              rulesetName: createdRuleset.name
            }
          },
          auth: this.auth
        });
        
        log(`Updated Firebase Storage bucket ${bucket} to use new security rules`);
        ruleDeployed = true;
        break;
      } catch (error: any) {
        log(`Storage bucket ${bucket} not found or not accessible, trying next...`);
      }
    }

    if (!ruleDeployed) {
      throw new Error('Could not deploy Storage rules to any Firebase Storage bucket. Ensure Firebase Storage is initialized.');
    }
  }

  private async ensureStorageBucketExists(
    projectId: string,
    log: (message: string) => void
  ): Promise<void> {
    log('Checking if Firebase Storage bucket exists...');
    
    const storage = google.storage({ version: 'v1', auth: this.auth });
    
    // Try multiple bucket naming patterns
    const bucketPatterns = [
      `${projectId}.appspot.com`,           // Standard Firebase bucket
      `${projectId}.firebasestorage.app`,   // New Firebase Storage domain
      `${projectId}-firebase-storage`        // Custom bucket name that we can create
    ];
    
    // First, check if any of the standard buckets exist
    for (const bucketName of bucketPatterns.slice(0, 2)) {
      try {
        const { data: bucket } = await storage.buckets.get({
          bucket: bucketName,
          auth: this.auth
        });
        
        log(`Firebase Storage bucket already exists: ${bucket.name}`);
        return; // Bucket exists, we're done
      } catch (error: any) {
        if (error.code !== 404) {
          log(`Error checking bucket ${bucketName}: ${error.message}`);
        }
      }
    }
    
    // If no standard buckets exist, check for our custom bucket
    const customBucketName = bucketPatterns[2];
    try {
      const { data: bucket } = await storage.buckets.get({
        bucket: customBucketName,
        auth: this.auth
      });
      
      log(`Custom Firebase Storage bucket already exists: ${bucket.name}`);
      return;
    } catch (error: any) {
      if (error.code === 404) {
        // Create custom bucket - this doesn't require domain verification
        log(`Creating custom Firebase Storage bucket: ${customBucketName}...`);
        
        try {
          await storage.buckets.insert({
            project: projectId,
            requestBody: {
              name: customBucketName,
              location: 'US', // Multi-region US
              storageClass: 'STANDARD',
              iamConfiguration: {
                uniformBucketLevelAccess: {
                  enabled: true
                }
              },
              labels: {
                'firebase-storage': 'true',
                'created-by': 'anava-installer'
              }
            },
            auth: this.auth
          });
          
          log(`Created custom Firebase Storage bucket: ${customBucketName}`);
          
          // Wait a bit for bucket to be ready
          await new Promise(resolve => setTimeout(resolve, 3000));
          
        } catch (createError: any) {
          log(`Failed to create storage bucket: ${createError.message}`);
          log(`⚠️  You may need to manually create a Firebase Storage bucket in the Firebase Console`);
          throw createError;
        }
      } else {
        throw error;
      }
    }
  }

  private async ensureFirestoreDatabaseExists(
    projectId: string,
    log: (message: string) => void
  ): Promise<void> {
    log('Checking if Firestore database exists...');
    
    const databaseName = `projects/${projectId}/databases/(default)`;
    
    try {
      // Try to get the default database
      const { data: database } = await this.firestore.projects.databases.get({
        name: databaseName,
        auth: this.auth
      });
      
      log(`Firestore database already exists: ${database.name}`);
    } catch (error: any) {
      if (error.code === 404) {
        // Database doesn't exist, create it
        log('Firestore database not found, creating default database...');
        
        try {
          // Create the default database
          const createOperation = await this.firestore.projects.databases.create({
            parent: `projects/${projectId}`,
            databaseId: '(default)',
            requestBody: {
              name: databaseName,
              type: 'FIRESTORE_NATIVE',
              locationId: 'nam5', // Multi-region location (United States)
              concurrencyMode: 'OPTIMISTIC',
              appEngineIntegrationMode: 'DISABLED'
            },
            auth: this.auth
          });
          
          log('Firestore database creation initiated...');
          
          // Wait for the operation to complete
          await this.waitForOperation(createOperation.data, log);
          
          log('✅ Firestore database created successfully');
        } catch (createError: any) {
          console.error('Failed to create Firestore database:', createError);
          throw new Error(`Failed to create Firestore database: ${createError.message}`);
        }
      } else {
        // Some other error occurred
        console.error('Error checking Firestore database:', error);
        throw error;
      }
    }
  }

  private async waitForOperation(
    operation: any,
    log: (message: string) => void,
    maxWaitTime = 300000 // 5 minutes
  ): Promise<void> {
    const startTime = Date.now();
    
    while (!operation.done) {
      if (Date.now() - startTime > maxWaitTime) {
        throw new Error('Operation timed out');
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      // Check operation status
      const { data: updatedOp } = await this.firestore.projects.databases.operations.get({
        name: operation.name,
        auth: this.auth
      });
      
      operation = updatedOp;
      
      if (operation.done) {
        if (operation.error) {
          throw new Error(`Operation failed: ${operation.error.message}`);
        }
        break;
      }
      
      log('Waiting for database creation to complete...');
    }
  }
}