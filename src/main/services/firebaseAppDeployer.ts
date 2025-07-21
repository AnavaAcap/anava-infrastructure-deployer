import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export class FirebaseAppDeployer {
  private firebasemanagement = google.firebase('v1beta1');
  
  constructor(private auth: OAuth2Client) {}

  async createFirebaseWebApp(
    projectId: string,
    appName: string,
    displayName: string
  ): Promise<FirebaseConfig> {
    console.log('=== Starting Firebase Web App creation ===');
    console.log(`Project: ${projectId}, App Name: ${appName}`);
    
    try {
      // First, check if Firebase project exists
      const firebaseProject = await this.getOrCreateFirebaseProject(projectId);
      console.log(`Firebase project: ${firebaseProject}`);
      
      // List existing web apps
      const existingApps = await this.listWebApps(projectId);
      console.log(`Found ${existingApps.length} existing web apps`);
      
      // Check if app already exists
      const existingApp = existingApps.find(app => 
        app.displayName === displayName || app.appId?.includes(appName)
      );
      
      if (existingApp) {
        console.log(`Web app "${displayName}" already exists`);
        return await this.getWebAppConfig(existingApp.name!);
      }
      
      // Create new web app
      console.log(`Creating new web app "${displayName}"...`);
      const webApp = await this.createWebApp(projectId, appName, displayName);
      console.log(`Web app created: ${webApp.appId}`);
      
      // Get the config
      const config = await this.getWebAppConfig(webApp.name!);
      console.log('Firebase config retrieved successfully');
      
      return config;
    } catch (error: any) {
      console.error('Failed to create Firebase web app:', error);
      throw error;
    }
  }
  
  private async getOrCreateFirebaseProject(projectId: string): Promise<string> {
    try {
      // Check if Firebase is already enabled
      const { data: project } = await this.firebasemanagement.projects.get({
        name: `projects/${projectId}`,
        auth: this.auth
      });
      
      if (project.resources) {
        console.log('Firebase already enabled for project');
        return project.name!;
      }
    } catch (error: any) {
      if (error.code === 404) {
        // Firebase not enabled, need to enable it
        console.log('Firebase not enabled, adding Firebase to project...');
        
        const { data: operation } = await this.firebasemanagement.projects.addFirebase({
          project: `projects/${projectId}`,
          auth: this.auth
        });
        
        if (operation.name) {
          console.log('Waiting for Firebase to be added to project...');
          await this.waitForOperation(operation.name);
        }
        
        return `projects/${projectId}`;
      }
      throw error;
    }
    
    return `projects/${projectId}`;
  }
  
  private async listWebApps(projectId: string): Promise<any[]> {
    try {
      const { data } = await this.firebasemanagement.projects.webApps.list({
        parent: `projects/${projectId}`,
        auth: this.auth
      });
      
      return data.apps || [];
    } catch (error: any) {
      console.warn('Failed to list web apps:', error.message);
      return [];
    }
  }
  
  private async createWebApp(
    projectId: string,
    appName: string,
    displayName: string
  ): Promise<any> {
    const { data: operation } = await this.firebasemanagement.projects.webApps.create({
      parent: `projects/${projectId}`,
      auth: this.auth,
      requestBody: {
        displayName: displayName,
        appId: `1:${projectId}:web:${appName}`
      }
    });
    
    if (!operation.name) {
      throw new Error('Failed to create web app - no operation returned');
    }
    
    console.log('Waiting for web app creation to complete...');
    const result = await this.waitForOperation(operation.name);
    
    // Extract the web app from the operation result
    if (result.response && result.response.name) {
      const { data: webApp } = await this.firebasemanagement.projects.webApps.get({
        name: result.response.name,
        auth: this.auth
      });
      
      return webApp;
    }
    
    throw new Error('Failed to get created web app details');
  }
  
  private async getWebAppConfig(webAppName: string): Promise<FirebaseConfig> {
    const { data: configData } = await this.firebasemanagement.projects.webApps.getConfig({
      name: webAppName,
      auth: this.auth
    });
    
    // The config data is returned directly in the response
    if (!configData) {
      throw new Error('No config data returned');
    }
    
    // The Firebase config is returned directly in the response
    const config = configData as any;
    
    // Check different possible property names
    const firebaseConfig = config.firebaseConfig || config;
    
    // Return the config in our format
    return {
      apiKey: firebaseConfig.apiKey || config.apiKey,
      authDomain: firebaseConfig.authDomain || config.authDomain,
      projectId: firebaseConfig.projectId || config.projectId,
      storageBucket: firebaseConfig.storageBucket || config.storageBucket,
      messagingSenderId: firebaseConfig.messagingSenderId || config.messagingSenderId,
      appId: firebaseConfig.appId || config.appId,
      measurementId: firebaseConfig.measurementId || config.measurementId
    };
  }
  
  private async waitForOperation(operationName: string): Promise<any> {
    let done = false;
    let retries = 0;
    const maxRetries = 60;
    
    while (!done && retries < maxRetries) {
      const { data: operation } = await this.firebasemanagement.operations.get({
        name: operationName,
        auth: this.auth
      });
      
      if (operation.done) {
        done = true;
        if (operation.error) {
          throw new Error(`Operation failed: ${JSON.stringify(operation.error)}`);
        }
        return operation;
      } else {
        if (retries % 3 === 0) { // Log every 15 seconds
          console.log(`Still waiting for Firebase operation... (${retries * 5}s elapsed)`);
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
        retries++;
      }
    }
    
    if (!done) {
      throw new Error('Firebase operation timed out');
    }
  }
}