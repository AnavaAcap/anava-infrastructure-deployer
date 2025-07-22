import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export class FirestoreDeployer {
  private firestore = google.firestore('v1');

  constructor(private auth: OAuth2Client) {}

  async setupFirestore(projectId: string, region: string): Promise<void> {
    // Step 1: Create Firestore database if it doesn't exist
    await this.createFirestoreDatabase(projectId, region);

    // Step 2: Create collections and set up security rules
    await this.setupSecurityRules(projectId);

    // Step 3: Create indexes if needed
    await this.createIndexes(projectId);
  }

  private async createFirestoreDatabase(projectId: string, region: string): Promise<void> {
    const parent = `projects/${projectId}`;
    const databaseId = '(default)';
    const databaseName = `${parent}/databases/${databaseId}`;

    try {
      // Check if database exists
      await this.firestore.projects.databases.get({
        name: databaseName,
        auth: this.auth
      });
      
      console.log('Firestore database already exists');
    } catch (error: any) {
      if (error.code === 404) {
        // Create the database
        const { data: operation } = await this.firestore.projects.databases.create({
          parent: parent,
          databaseId: databaseId,
          auth: this.auth,
          requestBody: {
            name: databaseName,
            locationId: region,
            type: 'FIRESTORE_NATIVE',
            concurrencyMode: 'OPTIMISTIC',
            appEngineIntegrationMode: 'DISABLED'
          }
        });

        await this.waitForOperation(operation.name!);
        console.log('Firestore database created successfully');
      } else {
        throw error;
      }
    }
  }

  private async setupSecurityRules(_projectId: string): Promise<void> {
    /*const rulesContent = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Devices collection - only authenticated service accounts can read/write
    match /devices/{deviceId} {
      allow read, write: if request.auth != null && 
        request.auth.token.email_verified == true;
    }
    
    // Sessions collection - only authenticated service accounts can read/write
    match /sessions/{sessionId} {
      allow read, write: if request.auth != null && 
        request.auth.token.email_verified == true;
    }
    
    // Tokens collection - only authenticated service accounts can read/write
    match /tokens/{tokenId} {
      allow read, write: if request.auth != null && 
        request.auth.token.email_verified == true;
    }
    
    // Default rule - deny all
    match /{document=**} {
      allow read, write: if false;
    }
  }
}`;*/

    //const parent = `projects/${projectId}/databases/(default)/rulesets`;
    
    try {
      // Create new ruleset - Note: This API is not directly available, would need Cloud Firestore Security Rules API
      // For now, skip rules update as it requires different API
      console.log('Firestore security rules update skipped - requires manual configuration');
      return;
      
      /* Would need to use:
      const { data: ruleset } = await this.firestore.projects.rulesets.create({
        parent: parent,
        auth: this.auth,
        requestBody: {
          source: {
            files: [{
              name: 'firestore.rules',
              content: rulesContent
            }]
          }
        }
      });

      */

      console.log('Firestore security rules updated');
    } catch (error: any) {
      console.error('Failed to update security rules:', error);
      // Non-critical error - continue
    }
  }

  private async createIndexes(projectId: string): Promise<void> {
    const parent = `projects/${projectId}/databases/(default)/collectionGroups/devices`;
    
    const indexes = [
      {
        fields: [
          { fieldPath: 'device_id', order: 'ASCENDING' },
          { fieldPath: 'created_at', order: 'DESCENDING' }
        ]
      },
      {
        fields: [
          { fieldPath: 'status', order: 'ASCENDING' },
          { fieldPath: 'last_seen', order: 'DESCENDING' }
        ]
      }
    ];

    for (const indexConfig of indexes) {
      try {
        await this.firestore.projects.databases.collectionGroups.indexes.create({
          parent: parent,
          auth: this.auth,
          requestBody: {
            fields: indexConfig.fields,
            queryScope: 'COLLECTION'
          }
        });

        console.log(`Creating index: ${JSON.stringify(indexConfig.fields)}`);
        // Don't wait for indexes - they can take a while
      } catch (error: any) {
        if (error.code === 409) {
          console.log('Index already exists');
        } else {
          console.error('Failed to create index:', error);
          // Non-critical - continue
        }
      }
    }
  }

  private async waitForOperation(operationName: string): Promise<void> {
    let done = false;
    let retries = 0;
    const maxRetries = 60;

    while (!done && retries < maxRetries) {
      const { data: operation } = await this.firestore.projects.databases.operations.get({
        name: operationName,
        auth: this.auth
      });

      if (operation.done) {
        done = true;
        if (operation.error) {
          throw new Error(`Operation failed: ${JSON.stringify(operation.error)}`);
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 5000));
        retries++;
      }
    }

    if (!done) {
      throw new Error('Operation timed out');
    }
  }
}