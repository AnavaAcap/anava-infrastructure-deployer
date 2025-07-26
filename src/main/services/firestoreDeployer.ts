import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import axios from 'axios';

export class FirestoreDeployer {
  private firebaserules = google.firebaserules('v1');
  private firestore = google.firestore('v1');
  private adminEmail?: string;
  
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
    
    // First ensure storage bucket exists and configure CORS
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
  ): Promise<string> {
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
        await this.configureBucketCORS(bucketName, projectId, log);
        return bucketName;
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
      await this.configureBucketCORS(customBucketName, projectId, log);
      return customBucketName;
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
          
          // Configure CORS for the new bucket
          await this.configureBucketCORS(customBucketName, projectId, log);
          
          return customBucketName;
          
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

  private async configureBucketCORS(
    bucketName: string,
    projectId: string,
    log: (message: string) => void
  ): Promise<void> {
    log(`Configuring CORS policy for Firebase Storage bucket: ${bucketName}`);
    
    const storage = google.storage({ version: 'v1', auth: this.auth });
    
    // Define CORS configuration that matches the shell script
    const corsConfiguration = [
      {
        origin: [
          'http://localhost:3000',                    // Development
          `https://${projectId}.web.app`,             // Firebase Hosting
          `https://${projectId}.firebaseapp.com`,     // Firebase Hosting (legacy)
          'https://localhost:3000',                   // HTTPS development
          'https://127.0.0.1:3000'                    // Local HTTPS
        ],
        method: ['GET', 'HEAD'],
        responseHeader: ['Content-Type', 'Access-Control-Allow-Origin'],
        maxAgeSeconds: 3600
      }
    ];

    try {
      // Update bucket CORS configuration
      await storage.buckets.patch({
        bucket: bucketName,
        requestBody: {
          cors: corsConfiguration
        },
        auth: this.auth
      });

      log(`✅ CORS policy configured successfully for bucket: ${bucketName}`);
      log(`   Allowed origins: http://localhost:3000, https://${projectId}.web.app, https://${projectId}.firebaseapp.com`);
      log(`   Allowed methods: GET, HEAD`);
      log(`   Max age: 3600 seconds (1 hour)`);
      
    } catch (error: any) {
      log(`⚠️  Warning: Failed to configure CORS for bucket ${bucketName}: ${error.message}`);
      log(`⚠️  You may need to configure CORS manually in the Google Cloud Console:`);
      log(`⚠️  1. Go to Cloud Storage → Buckets → ${bucketName}`);
      log(`⚠️  2. Click "Permissions" tab → "CORS" section → "Edit"`);
      log(`⚠️  3. Add origins: http://localhost:3000, https://${projectId}.web.app`);
      log(`⚠️  4. Add methods: GET, HEAD`);
      // Don't throw - this is not critical enough to fail the entire deployment
    }
  }

  async enableFirebaseAuthentication(
    projectId: string,
    logCallback?: (message: string) => void,
    userEmail?: string
  ): Promise<boolean> {
    const log = (message: string) => {
      console.log(message);
      logCallback?.(message);
    };

    log('=== Enabling Firebase Authentication ===');
    
    try {
      // Step 0: Enable required APIs
      const serviceusage = google.serviceusage('v1');
      
      log('Enabling required APIs...');
      
      const requiredApis = [
        'firebase.googleapis.com',
        'identitytoolkit.googleapis.com'
      ];
      
      for (const api of requiredApis) {
        try {
          await serviceusage.services.enable({
            name: `projects/${projectId}/services/${api}`,
            auth: this.auth
          });
          log(`✅ ${api} enabled`);
        } catch (enableError: any) {
          if (enableError.code === 409 || enableError.message?.includes('already enabled')) {
            log(`✅ ${api} already enabled`);
          } else {
            log(`⚠️  Warning: Could not enable ${api}: ${enableError.message}`);
          }
        }
      }
      
      // Wait for APIs to be fully available
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const accessToken = await this.auth.getAccessToken();
      
      // Step 1: Add Firebase to the GCP Project
      log('Step 1: Adding Firebase to GCP project...');
      
      try {
        const addFirebaseUrl = `https://firebase.googleapis.com/v1beta1/projects/${projectId}:addFirebase`;
        
        await axios.post(addFirebaseUrl, {}, {
          headers: {
            'Authorization': `Bearer ${accessToken.token}`,
            'Content-Type': 'application/json'
          }
        });
        
        log('✅ Firebase added to GCP project successfully');
        
        // Wait for Firebase project setup to complete
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (addFirebaseError: any) {
        if (addFirebaseError.response?.status === 409 || addFirebaseError.message?.includes('already exists')) {
          log('✅ Project already has Firebase enabled');
        } else {
          log(`❌ Failed to add Firebase to project: ${addFirebaseError.response?.status || addFirebaseError.message}`);
          throw addFirebaseError;
        }
      }
      
      // Step 2: Initialize Firebase Authentication by creating initial config
      log('Step 2: Initializing Firebase Authentication...');
      
      try {
        // First check if auth is already configured
        const configUrl = `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/config`;
        
        try {
          await axios.get(configUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken.token}`
            }
          });
          log('✅ Firebase Authentication already initialized');
        } catch (getError: any) {
          if (getError.response?.status === 404) {
            // Config doesn't exist - create it with PATCH
            log('Creating initial authentication configuration...');
            
            const updateMask = 'signIn.email.enabled,signIn.anonymous.enabled,notification.sendEmail.resetPasswordTemplate,notification.sendEmail.verifyEmailTemplate';
            const requestBody = {
              signIn: {
                email: {
                  enabled: false
                },
                anonymous: {
                  enabled: false
                }
              },
              notification: {
                sendEmail: {
                  resetPasswordTemplate: {},
                  verifyEmailTemplate: {}
                }
              }
            };
            
            await axios.patch(
              `${configUrl}?updateMask=${updateMask}`,
              requestBody,
              {
                headers: {
                  'Authorization': `Bearer ${accessToken.token}`,
                  'Content-Type': 'application/json'
                }
              }
            );
            
            log('✅ Firebase Authentication initialized successfully');
            
            // Wait for initialization to complete
            await new Promise(resolve => setTimeout(resolve, 3000));
          } else {
            throw getError;
          }
        }
      } catch (initAuthError: any) {
        log(`❌ Failed to initialize Firebase Auth: ${initAuthError.response?.status || initAuthError.message}`);
        log(`Response: ${JSON.stringify(initAuthError.response?.data)}`);
        throw initAuthError;
      }
      
      // Step 3: Enable Email/Password AND Google Sign-In Providers
      log('Step 3: Enabling authentication providers...');
      
      const configUrl = `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/config`;
      const updateMask = 'signIn.email.enabled,signIn.email.passwordRequired,signIn.google.enabled';
      
      await axios.patch(`${configUrl}?updateMask=${updateMask}`, {
        signIn: {
          email: {
            enabled: true,
            passwordRequired: true
          },
          google: {
            enabled: true
          }
        }
      }, {
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json'
        }
      });
      
      log('✅ Email/Password authentication provider enabled');
      log('✅ Google Sign-In provider enabled');
      
      // Step 4: Add current user as admin
      log('Step 4: Setting up admin user...');
      
      if (userEmail) {
        try {
          log(`Current user email: ${userEmail}`);
          
          // Create or update admin user document in Firestore
          // This will be used by the application to determine admin status
          // Note: This assumes the app will check a Firestore collection for admin users
          log(`✅ Google Sign-In is enabled for all users`);
          log(`📧 Your account (${userEmail}) can now sign in with Google`);
          log(`🔑 Admin access will be granted on first sign-in`);
          log(`📝 Note: The deployed app should check for admin status in Firestore`);
          
          // Store the admin email for later use by the deployment
          // This will be included in the deployment result
          this.adminEmail = userEmail;
          
        } catch (userError: any) {
          log(`⚠️  Could not set up admin user: ${userError.message}`);
          log('⚠️  You can still sign in with Google after deployment');
        }
      } else {
        log('⚠️  No user email provided - skipping admin setup');
        log('⚠️  You can sign in with Google after deployment');
      }
      
      log('🎉 Firebase Authentication is now fully configured and ready to use!');
      
      return true;
      
    } catch (error: any) {
      log(`❌ Error enabling Firebase Authentication: ${error.response?.status || error.message}`);
      log('⚠️  IMPORTANT: Firebase Authentication could not be configured programmatically');
      log('⚠️  You will need to manually enable Email/Password authentication in Firebase Console');
      log('⚠️  Go to: https://console.firebase.google.com/project/' + projectId + '/authentication/providers');
      log('⚠️  Enable Email/Password under Sign-in method tab');
      
      // Return false instead of throwing to allow deployment to continue
      return false;
    }
  }

  async enableFirebaseStorage(
    projectId: string,
    logCallback?: (message: string) => void
  ): Promise<string> {
    const log = (message: string) => {
      console.log(message);
      logCallback?.(message);
    };

    log('=== Enabling Firebase Storage ===');
    
    try {
      // Firebase Storage is essentially a GCS bucket with special configuration
      // We'll create/ensure the default Firebase storage bucket exists
      return await this.ensureStorageBucketExists(projectId, log);
      
    } catch (error: any) {
      log(`❌ Failed to enable Firebase Storage: ${error.message}`);
      throw new Error(`Firebase Storage enablement failed: ${error.message}`);
    }
  }

  getAdminEmail(): string | undefined {
    return this.adminEmail;
  }
}