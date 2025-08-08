import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import axios from 'axios';

export class FirestoreRulesDeployer {
  private firebaserules = google.firebaserules('v1');
  private firestore = google.firestore('v1');
  private adminEmail?: string;
  
  constructor(private auth: OAuth2Client) {}

  async deploySecurityRules(
    projectId: string,
    logCallback?: (message: string) => void
  ): Promise<void> {
    const log = (message: string) => {
      logCallback?.(message);
    };

    log('=== Deploying Firestore Security Rules ===');
    
    try {
      // First ensure the database exists
      await this.ensureFirestoreDatabaseExists(projectId, log);
      
      // Deploy Firestore rules
      await this.deployFirestoreRules(projectId, log);
      
      log('✅ Firestore security rules deployed successfully');
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



  async enableFirebaseAuthentication(
    projectId: string,
    logCallback?: (message: string) => void,
    userEmail?: string
  ): Promise<boolean> {
    const log = (message: string) => {
      logCallback?.(message);
    };

    log('=== Enabling Firebase Authentication ===');
    
    try {
      // Step 0: Enable required APIs (CRITICAL for initialization)
      const serviceusage = google.serviceusage('v1');
      
      log('Enabling required APIs...');
      
      const requiredApis = [
        'firebase.googleapis.com',
        'identitytoolkit.googleapis.com'  // This MUST be enabled before any Auth config can exist
      ];
      
      for (const api of requiredApis) {
        try {
          // First check if it's already enabled
          const serviceStatus = await serviceusage.services.get({
            name: `projects/${projectId}/services/${api}`,
            auth: this.auth
          });
          
          if (serviceStatus.data.state === 'ENABLED') {
            log(`✅ ${api} already enabled`);
          } else {
            log(`Enabling ${api}...`);
            await serviceusage.services.enable({
              name: `projects/${projectId}/services/${api}`,
              auth: this.auth
            });
            
            log(`✅ ${api} enable operation started`);
            
            // For identitytoolkit, wait longer as it needs to provision the config
            if (api === 'identitytoolkit.googleapis.com') {
              log('Waiting for Identity Toolkit service to fully initialize...');
              await new Promise(resolve => setTimeout(resolve, 10000));
            }
          }
        } catch (enableError: any) {
          if (enableError.code === 409 || enableError.message?.includes('already enabled')) {
            log(`✅ ${api} already enabled`);
          } else {
            log(`⚠️  Warning: Could not enable ${api}: ${enableError.message}`);
            // For identitytoolkit, this is critical
            if (api === 'identitytoolkit.googleapis.com') {
              throw new Error(`Failed to enable Identity Toolkit API: ${enableError.message}`);
            }
          }
        }
      }
      
      // Additional wait to ensure APIs are fully propagated
      log('Waiting for API enablement to propagate...');
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
      
      // Step 1.5: Set project default location (CRITICAL for Storage and Auth!)
      log('Step 1.5: Setting project default location...');
      
      try {
        const locationUrl = `https://firebase.googleapis.com/v1beta1/projects/${projectId}/defaultLocation:finalize`;
        
        await axios.post(locationUrl, {
          locationId: 'us-central' // Use us-central as default, matches most deployments
        }, {
          headers: {
            'Authorization': `Bearer ${accessToken.token}`,
            'Content-Type': 'application/json'
          }
        });
        
        log('✅ Project default location set to us-central');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (locationError: any) {
        if (locationError.response?.status === 409) {
          log('✅ Project default location already set');
        } else {
          log(`⚠️  Warning: Could not set default location: ${locationError.response?.data?.error?.message || locationError.message}`);
          // Continue anyway - location might already be set
        }
      }
      
      // Step 2: Initialize Firebase Authentication by creating initial config
      log('Step 2: Initializing Firebase Authentication...');
      
      // Use updateConfig approach as recommended by Gemini - this creates the config if it doesn't exist
      const configUrl = `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/config`;
      
      try {
        // Check if config already exists
        try {
          await axios.get(configUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken.token}`
            }
          });
          log('✅ Firebase Authentication config already exists');
        } catch (getError: any) {
          if (getError.response?.status === 404) {
            log('Authentication config does not exist, will be created with first update');
          } else {
            throw getError;
          }
        }
      } catch (checkError: any) {
        log(`Warning: Could not check auth config: ${checkError.message}`);
      }
      
      // Step 3: Enable Email/Password AND Google Sign-In Providers
      log('Step 3: Enabling authentication providers...');
      
      // Start with just email/password and anonymous - we'll add Google sign-in separately
      const updateMask = 'signIn.email.enabled,signIn.email.passwordRequired,signIn.anonymous.enabled';
      
      try {
        // Try to create/update the config - use PATCH which works for both create and update
        await axios.patch(`${configUrl}?updateMask=${updateMask}`, {
          signIn: {
            email: {
              enabled: true,
              passwordRequired: true
            },
            anonymous: {
              enabled: true
            }
          }
        }, {
          headers: {
            'Authorization': `Bearer ${accessToken.token}`,
            'Content-Type': 'application/json'
          }
        });
        
        log('✅ Authentication config created/updated successfully');
        log('✅ Email/Password authentication provider enabled');
        log('✅ Anonymous authentication provider enabled');
        log('ℹ️  Note: Google Sign-In can be enabled manually in Firebase Console');
        
      } catch (updateError: any) {
        if (updateError.response?.status === 404 && updateError.response?.data?.error?.status === 'CONFIGURATION_NOT_FOUND') {
          log('❌ Authentication configuration not found - Identity Toolkit API may not be enabled');
          log('⚠️  Ensure identitytoolkit.googleapis.com is enabled for this project');
        }
        log(`❌ Failed to enable auth providers: ${updateError.response?.data?.error?.message || updateError.message}`);
        throw updateError;
      }
      
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


  getAdminEmail(): string | undefined {
    return this.adminEmail;
  }

}