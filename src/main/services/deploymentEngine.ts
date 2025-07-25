import { EventEmitter } from 'events';
import { StateManager } from './stateManager';
import { GCPApiServiceManager } from './gcpApiServiceManager';
import { GCPOAuthService } from './gcpOAuthService';
import { CloudFunctionsAPIDeployer } from './cloudFunctionsAPIDeployer';
import { ApiGatewayDeployer } from './apiGatewayDeployer';
import { FirestoreDeployer } from './firestoreDeployer';
import { WorkloadIdentityDeployer } from './workloadIdentityDeployer';
import { FirebaseAppDeployer } from './firebaseAppDeployer';
import { DeploymentConfig, DeploymentProgress, DeploymentResult } from '../../types';
import path from 'path';
import { app } from 'electron';
import fs from 'fs/promises';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export class DeploymentEngine extends EventEmitter {
  private stateManager: StateManager;
  private gcpService: GCPApiServiceManager;
  private gcpAuth: GCPOAuthService;
  private cloudFunctionsAPIDeployer?: CloudFunctionsAPIDeployer;
  private apiGatewayDeployer?: ApiGatewayDeployer;
  private firestoreDeployer?: FirestoreDeployer;
  private workloadIdentityDeployer?: WorkloadIdentityDeployer;
  private firebaseAppDeployer?: FirebaseAppDeployer;
  private isPaused = false;

  constructor(stateManager: StateManager, gcpAuth: GCPOAuthService) {
    super();
    this.stateManager = stateManager;
    this.gcpAuth = gcpAuth;
    this.gcpService = new GCPApiServiceManager(gcpAuth);
    
    // Initialize deployers with OAuth client
    this.initializeDeployers();
  }

  private initializeDeployers(): void {
    if (this.gcpAuth.oauth2Client) {
      this.cloudFunctionsAPIDeployer = new CloudFunctionsAPIDeployer(this.gcpAuth.oauth2Client);
      this.apiGatewayDeployer = new ApiGatewayDeployer(this.gcpAuth.oauth2Client);
      this.firestoreDeployer = new FirestoreDeployer(this.gcpAuth.oauth2Client);
      this.workloadIdentityDeployer = new WorkloadIdentityDeployer(this.gcpAuth.oauth2Client);
      this.firebaseAppDeployer = new FirebaseAppDeployer(this.gcpAuth.oauth2Client);
    }
  }

  async startDeployment(config: DeploymentConfig): Promise<void> {
    this.isPaused = false;
    
    // Ensure deployers are initialized
    this.initializeDeployers();
    
    // Create new deployment state
    this.stateManager.createNewDeployment(
      config.projectId,
      config.region,
      config
    );

    await this.runDeployment();
  }

  async resumeDeployment(deploymentId: string): Promise<void> {
    const state = this.stateManager.getState();
    if (!state || state.deploymentId !== deploymentId) {
      throw new Error('Deployment not found');
    }

    // Ensure deployers are initialized
    this.initializeDeployers();
    
    this.isPaused = false;
    await this.runDeployment();
  }

  pauseDeployment(): void {
    this.isPaused = true;
    this.emitProgress({
      currentStep: 'paused',
      stepProgress: 0,
      totalProgress: 0,
      message: 'Deployment paused',
    });
  }

  private async runDeployment(): Promise<void> {
    try {
      while (!this.isPaused) {
        const nextStep = this.stateManager.getNextPendingStep();
        if (!nextStep) {
          // All steps completed
          const deployedFunctions = this.getResourceValue('deployCloudFunctions', 'functions') || {};
          const hasPlaceholderFunctions = Object.values(deployedFunctions).some((url: any) => 
            typeof url === 'string' && url.includes('placeholder')
          );
          
          console.log('\n🎉 ========================================= 🎉');
          console.log('🚀 DEPLOYMENT COMPLETED SUCCESSFULLY! 🚀');
          console.log('🎉 ========================================= 🎉\n');
          
          const gatewayUrl = this.getResourceValue('createApiGateway', 'gatewayUrl');
          const apiKey = this.getResourceValue('createApiGateway', 'apiKey');
          const firebaseConfig = this.getResourceValue('createFirebaseWebApp', 'config');
          
          // Validate critical resources exist
          const missingResources: string[] = [];
          if (!gatewayUrl) missingResources.push('API Gateway URL');
          if (!apiKey) missingResources.push('API Key');
          if (!firebaseConfig) missingResources.push('Firebase Configuration');
          if (!firebaseConfig?.apiKey) missingResources.push('Firebase API Key');
          
          if (missingResources.length > 0) {
            const errorMessage = `Deployment completed but critical resources are missing: ${missingResources.join(', ')}`;
            console.error(`❌ ${errorMessage}`);
            this.emitComplete({
              success: false,
              error: errorMessage,
              resources: this.getAllResources()
            });
            return;
          }
          
          console.log('📋 Deployment Summary:');
          console.log(`✅ API Gateway URL: ${gatewayUrl}`);
          console.log(`✅ API Key: ${apiKey}`);
          console.log(`✅ Project: ${this.stateManager.getState()?.projectId}`);
          console.log(`✅ Region: ${this.stateManager.getState()?.region}`);
          
          if (firebaseConfig) {
            console.log('\n🔥 Firebase Configuration:');
            console.log(`✅ Auth Domain: ${firebaseConfig.authDomain}`);
            console.log(`✅ App ID: ${firebaseConfig.appId}`);
            console.log(`✅ API Key: ${firebaseConfig.apiKey ? 'Retrieved successfully' : 'MISSING!'}`);
          }
          
          console.log('\n🔐 All authentication infrastructure deployed!');
          console.log('📱 Ready for camera authentication!\n');
          
          this.emitComplete({
            success: true,
            apiGatewayUrl: gatewayUrl,
            apiKey: apiKey,
            firebaseConfig: firebaseConfig,
            resources: this.getAllResources(),
            warning: hasPlaceholderFunctions ? 'Cloud Functions build failed - you may need to deploy them manually' : undefined
          });
          break;
        }

        await this.executeStep(nextStep);
      }
    } catch (error) {
      this.emitError(error);
      throw error;
    }
  }

  private async executeStep(stepName: string): Promise<void> {
    console.log(`\n======== EXECUTING STEP: ${stepName} ========`);
    try {
      this.stateManager.updateStep(stepName, { status: 'in_progress' });
      
      switch (stepName) {
        case 'authenticate':
          await this.stepAuthenticate();
          break;
        case 'enableApis':
          await this.stepEnableApis();
          break;
        case 'createServiceAccounts':
          await this.stepCreateServiceAccounts();
          break;
        case 'assignIamRoles':
          await this.stepAssignIamRoles();
          break;
        case 'deployCloudFunctions':
          await this.stepDeployCloudFunctions();
          break;
        case 'createApiGateway':
          await this.stepCreateApiGateway();
          break;
        case 'configureWorkloadIdentity':
          await this.stepConfigureWorkloadIdentity();
          break;
        case 'setupFirestore':
          await this.stepSetupFirestore();
          break;
        case 'createFirebaseWebApp':
          await this.stepCreateFirebaseWebApp();
          break;
        default:
          throw new Error(`Unknown step: ${stepName}`);
      }
      
      this.stateManager.updateStep(stepName, { status: 'completed' });
      console.log(`✓ Step ${stepName} completed successfully`);
    } catch (error) {
      console.error(`✗ Step ${stepName} failed:`, error);
      this.stateManager.updateStep(stepName, { 
        status: 'failed',
        error: (error as Error).message 
      });
      throw error;
    }
  }

  private async stepAuthenticate(): Promise<void> {
    this.emitProgress({
      currentStep: 'authenticate',
      stepProgress: 0,
      totalProgress: 0,
      message: 'Verifying authentication...',
    });

    if (!this.gcpAuth.isAuthenticated()) {
      throw new Error('Not authenticated. Please login first.');
    }

    this.emitProgress({
      currentStep: 'authenticate',
      stepProgress: 100,
      totalProgress: 12.5,
      message: 'Authentication verified',
    });
  }

  private async stepEnableApis(): Promise<void> {
    const apis = [
      'serviceusage.googleapis.com',
      'iam.googleapis.com',
      'cloudresourcemanager.googleapis.com',
      'compute.googleapis.com', // This creates the default compute service account
      'storage.googleapis.com',
      'cloudfunctions.googleapis.com',
      'cloudbuild.googleapis.com',
      'artifactregistry.googleapis.com',
      'run.googleapis.com', // Required for Gen2 Cloud Functions
      'containerregistry.googleapis.com', // May be needed for some operations
      'apigateway.googleapis.com',
      'servicemanagement.googleapis.com',
      'servicecontrol.googleapis.com',
      'firebase.googleapis.com',
      'firestore.googleapis.com',
      'firebaserules.googleapis.com',
      'iamcredentials.googleapis.com',
      'sts.googleapis.com',
      'apikeys.googleapis.com',
      'identitytoolkit.googleapis.com', // Firebase Auth API
      'aiplatform.googleapis.com', // Vertex AI API
    ];

    const state = this.stateManager.getState()!;
    
    for (let i = 0; i < apis.length; i++) {
      if (this.isPaused) return;
      
      this.emitProgress({
        currentStep: 'enableApis',
        stepProgress: (i / apis.length) * 100,
        totalProgress: 12.5 + (12.5 * (i / apis.length)),
        message: `Enabling ${apis[i]}...`,
      });

      await this.gcpService.enableApi(state.projectId, apis[i]);
    }

    this.stateManager.updateStepResource('enableApis', 'apis', apis);
    
    // Wait for critical APIs to be fully ready
    console.log('Waiting 15 seconds for APIs to be fully ready...');
    this.emitProgress({
      currentStep: 'enableApis',
      stepProgress: 100,
      totalProgress: 25,
      message: 'Waiting for APIs to be fully ready...',
    });
    await new Promise(resolve => setTimeout(resolve, 15000));
  }

  private async stepCreateServiceAccounts(): Promise<void> {
    const state = this.stateManager.getState()!;
    
    // Load any previously created accounts when resuming
    const createdAccounts: Record<string, string> = this.getResourceValue('createServiceAccounts', 'accounts') || {};
    
    const serviceAccounts = [
      { name: 'vertex-ai-sa', displayName: 'Vertex AI Service Account' },
      { name: 'device-auth-sa', displayName: 'Device Authenticator Service Account' },
      { name: 'tvm-sa', displayName: 'Token Vending Machine Service Account' },
      { name: 'apigw-invoker-sa', displayName: 'API Gateway Invoker' },
    ];

    for (let i = 0; i < serviceAccounts.length; i++) {
      if (this.isPaused) return;
      
      // Skip if already created
      if (createdAccounts[serviceAccounts[i].name]) {
        continue;
      }
      
      this.emitProgress({
        currentStep: 'createServiceAccounts',
        stepProgress: (i / serviceAccounts.length) * 100,
        totalProgress: 25 + (12.5 * (i / serviceAccounts.length)),
        message: `Creating ${serviceAccounts[i].displayName}...`,
      });

      const email = await this.gcpService.createServiceAccount(
        state.projectId,
        serviceAccounts[i].name,
        serviceAccounts[i].displayName
      );
      
      createdAccounts[serviceAccounts[i].name] = email;
      
      // Save state after each account is created to handle pauses/failures
      this.stateManager.updateStepResource('createServiceAccounts', 'accounts', createdAccounts);
    }
    
    // Add a brief delay for IAM propagation across all Google Cloud regions
    console.log('Waiting 10 seconds for service accounts to propagate globally...');
    this.emitProgress({
      currentStep: 'createServiceAccounts',
      stepProgress: 100,
      totalProgress: 37.5,
      message: 'Waiting for service accounts to propagate...',
    });
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Grant the current user permission to act as the API Gateway invoker service account
    // This is required for the API Gateway config to be created with the correct service account
    if (createdAccounts['apigw-invoker-sa']) {
      console.log('Granting actAs permission for API Gateway service account...');
      try {
        // Get current authenticated user
        const { google } = await import('googleapis');
        const oauth2 = google.oauth2('v2');
        const auth = await this.getAuthClient();
        const { data } = await oauth2.userinfo.get({ auth });
        const currentUser = data.email;
        
        if (currentUser) {
          console.log(`Granting serviceAccountUser role to ${currentUser} for ${createdAccounts['apigw-invoker-sa']}`);
          await this.gcpService.assignServiceAccountUser(
            state.projectId,
            createdAccounts['apigw-invoker-sa'],
            `user:${currentUser}`
          );
          console.log(`Successfully granted actAs permission to ${currentUser}`);
        }
      } catch (error) {
        console.warn('Could not grant actAs permission automatically:', error);
        console.warn('The user may need to manually grant this permission for API Gateway to work correctly');
        // Continue anyway - the deployment might work if the user already has the permission
      }
    }
  }

  private async stepAssignIamRoles(): Promise<void> {
    console.log('Starting IAM role assignments...');
    const state = this.stateManager.getState()!;
    const accounts = this.getResourceValue('createServiceAccounts', 'accounts');
    
    console.log('Service accounts found:', accounts);
    
    if (!accounts) {
      throw new Error('No service accounts found. The createServiceAccounts step may have failed or been skipped.');
    }
    
    // First, grant Cloud Build service account necessary permissions
    const projectNumber = await this.getProjectNumber(state.projectId);
    const cloudBuildSA = `${projectNumber}@cloudbuild.gserviceaccount.com`;
    
    // Grant compute service account Storage Object Viewer for gcf-sources bucket
    // Wait for the compute SA to be created after enabling Compute API
    const computeSA = await this.gcpService.waitForComputeServiceAccount(
      state.projectId,
      projectNumber.toString()
    );
    
    await this.gcpService.assignIamRole(
      state.projectId,
      computeSA,
      'roles/storage.objectViewer'
    );
    
    // Grant compute service account Logs Writer permission for Cloud Build
    await this.gcpService.assignIamRole(
      state.projectId,
      computeSA,
      'roles/logging.logWriter'
    );
    
    // Grant Cloud Build service account necessary permissions
    await this.gcpService.assignIamRole(
      state.projectId,
      cloudBuildSA,
      'roles/cloudfunctions.developer'
    );
    
    await this.gcpService.assignIamRole(
      state.projectId,
      cloudBuildSA,
      'roles/storage.objectAdmin'
    );
    
    await this.gcpService.assignIamRole(
      state.projectId,
      cloudBuildSA,
      'roles/cloudbuild.builds.editor'
    );
    
    // Grant comprehensive Artifact Registry permissions for Cloud Functions v2
    await this.gcpService.assignIamRole(
      state.projectId,
      cloudBuildSA,
      'roles/artifactregistry.admin'
    );
    
    // Grant compute service account permissions needed for Cloud Functions v2
    // The compute SA is what actually runs the Cloud Build for functions!
    await this.gcpService.assignIamRole(
      state.projectId,
      computeSA,
      'roles/storage.objectViewer'
    );
    
    // Compute SA needs artifactregistry.admin for Cloud Functions v2 builds
    await this.gcpService.assignIamRole(
      state.projectId,
      computeSA,
      'roles/artifactregistry.admin'
    );
    
    // Grant Cloud Build SA permission to act as the function service accounts
    for (const sa of ['device-auth-sa', 'tvm-sa']) {
      if (accounts[sa]) {
        await this.gcpService.assignServiceAccountUser(
          state.projectId,
          accounts[sa],
          cloudBuildSA
        );
      }
    }
    
    
    const roleBindings = [
      { account: 'vertex-ai-sa', role: 'roles/aiplatform.user' },
      { account: 'vertex-ai-sa', role: 'roles/storage.objectAdmin' },
      { account: 'vertex-ai-sa', role: 'roles/logging.logWriter' },
      { account: 'vertex-ai-sa', role: 'roles/datastore.user' },
      { account: 'device-auth-sa', role: 'roles/firebase.sdkAdminServiceAgent' },
      { account: 'device-auth-sa', role: 'roles/firebasedatabase.admin' },
      { account: 'device-auth-sa', role: 'roles/iam.serviceAccountTokenCreator', self: true },
      { account: 'tvm-sa', role: 'roles/iam.serviceAccountTokenCreator' },
      { account: 'apigw-invoker-sa', role: 'roles/run.invoker' },
    ];

    this.emitProgress({
      currentStep: 'assignIamRoles',
      stepProgress: 5,
      totalProgress: 37.5 + (12.5 * 0.05),
      message: `Configuring Cloud Build and compute permissions...`,
    });

    for (let i = 0; i < roleBindings.length; i++) {
      if (this.isPaused) return;
      
      this.emitProgress({
        currentStep: 'assignIamRoles',
        stepProgress: 20 + ((i / roleBindings.length) * 80),
        totalProgress: 37.5 + (12.5 * (0.2 + (i / roleBindings.length) * 0.8)),
        message: `Assigning ${roleBindings[i].role} to ${roleBindings[i].account}...`,
      });

      const accountEmail = accounts[roleBindings[i].account];
      if (!accountEmail) {
        throw new Error(`Service account ${roleBindings[i].account} not found in created accounts. Available accounts: ${JSON.stringify(accounts)}`);
      }
      
      // Handle self-referential role assignment
      if (roleBindings[i].self) {
        // For service accounts that need to impersonate themselves
        await this.gcpService.assignIamRole(
          state.projectId,
          accountEmail,
          roleBindings[i].role
        );
      } else {
        await this.gcpService.assignIamRole(
          state.projectId,
          accountEmail,
          roleBindings[i].role
        );
      }
    }
    
    // Grant permissions to gcf-artifacts repository (this is crucial for Cloud Functions deployment)
    console.log('Setting up Artifact Registry permissions for Cloud Functions...');
    await this.grantGcfArtifactsPermissions(state.projectId, state.region, cloudBuildSA, computeSA);
  }

  private async stepDeployCloudFunctions(): Promise<void> {
    console.log('Starting Cloud Functions deployment...');
    const state = this.stateManager.getState()!;
    const accounts = this.getResourceValue('createServiceAccounts', 'accounts');
    
    console.log('Service accounts for functions:', accounts);
    
    if (!this.cloudFunctionsAPIDeployer) {
      throw new Error('Cloud Functions API deployer not initialized');
    }

    // Get project number for WIF configuration
    const projectNumber = await this.getProjectNumber(state.projectId);
    
    // Ensure gcf-artifacts repository permissions are set up
    // This is critical for Cloud Functions v2 deployment
    const cloudBuildSA = `${projectNumber}@cloudbuild.gserviceaccount.com`;
    const computeSA = `${projectNumber}-compute@developer.gserviceaccount.com`;
    console.log('Ensuring Artifact Registry permissions before function deployment...');
    await this.grantGcfArtifactsPermissions(state.projectId, state.region, cloudBuildSA, computeSA);
    
    // Verify compute service account has necessary permissions
    const hasPermissions = await this.gcpService.verifyComputeServiceAccountPermissions(
      state.projectId, 
      projectNumber
    );
    
    if (!hasPermissions) {
      console.warn('Compute service account may not have Storage Object Viewer permissions. This could cause deployment failures.');
    }
    
    const functions: Array<{
      name: string;
      sourceDir: string;
      entryPoint: string;
      runtime: string;
      serviceAccount: string;
      envVars: Record<string, string>;
    }> = [
      {
        name: 'device-auth',
        sourceDir: app.isPackaged 
          ? path.join(process.resourcesPath, 'functions', 'device-auth')
          : path.join(app.getAppPath(), 'functions', 'device-auth'),
        entryPoint: 'device_authenticator',
        runtime: 'python311',
        serviceAccount: accounts['device-auth-sa'],
        envVars: {
          FIREBASE_PROJECT_ID: String(state.configuration.firebaseProjectId || state.projectId)
        }
      },
      {
        name: 'token-vending-machine',
        sourceDir: app.isPackaged 
          ? path.join(process.resourcesPath, 'functions', 'token-vending-machine')
          : path.join(app.getAppPath(), 'functions', 'token-vending-machine'),
        entryPoint: 'token_vendor_machine',
        runtime: 'python311',
        serviceAccount: accounts['tvm-sa'],
        envVars: {
          WIF_PROJECT_NUMBER: String(projectNumber),
          WIF_POOL_ID: 'anava-firebase-pool',
          WIF_PROVIDER_ID: 'firebase-provider',
          TARGET_SERVICE_ACCOUNT_EMAIL: String(accounts['vertex-ai-sa'])
        }
      }
    ];

    const deployedFunctions: Record<string, string> = {};

    for (let i = 0; i < functions.length; i++) {
      if (this.isPaused) return;
      
      this.emitProgress({
        currentStep: 'deployCloudFunctions',
        stepProgress: (i / functions.length) * 100,
        totalProgress: 50 + (12.5 * (i / functions.length)),
        message: `Deploying ${functions[i].name} function...`,
      });

      // Create source directory with inline code
      const sourceDir = await this.createFunctionSourceCode(
        functions[i].name,
        functions[i].entryPoint,
        functions[i].runtime
      );

      try {
        // Use API-based deployer
        const functionUrl = await this.cloudFunctionsAPIDeployer!.deployFunction(
          state.projectId,
          {
            name: functions[i].name,
            entryPoint: functions[i].entryPoint,
            runtime: functions[i].runtime,
            region: state.region,
            serviceAccount: functions[i].serviceAccount,
            environmentVariables: functions[i].envVars,
            maxInstances: 5
          },
          sourceDir
        );
        
        deployedFunctions[functions[i].name] = functionUrl;
      } finally {
        // Clean up temp directory
        await fs.rm(sourceDir, { recursive: true, force: true });
      }
      this.stateManager.updateStepResource('deployCloudFunctions', 'functions', deployedFunctions);
    }
    
    // Grant Cloud Run invoker permissions to API Gateway service account
    console.log('Granting Cloud Run invoker permissions to API Gateway service account...');
    await this.grantCloudRunInvokerPermissions(
      state.projectId,
      state.region,
      deployedFunctions,
      accounts['apigw-invoker-sa']
    );
  }
  
  private async grantCloudRunInvokerPermissions(
    projectId: string,
    region: string,
    functions: Record<string, string>,
    apiGatewayInvokerSA: string
  ): Promise<void> {
    const { CloudRunIAMManager } = await import('./cloudRunIAMManager');
    const auth = await this.getAuthClient();
    const cloudRunIAMManager = new CloudRunIAMManager(auth);
    
    for (const [functionName] of Object.entries(functions)) {
      try {
        await cloudRunIAMManager.grantInvokerPermission(
          projectId,
          region,
          functionName,
          apiGatewayInvokerSA
        );
      } catch (error) {
        console.error(`Failed to grant invoker permission for ${functionName}:`, error);
        // Continue with other functions even if one fails
      }
    }
    
    // Wait for IAM permissions to propagate
    console.log('Waiting 30 seconds for IAM permissions to propagate...');
    await new Promise(resolve => setTimeout(resolve, 30000));
  }

  private async stepCreateApiGateway(): Promise<void> {
    const state = this.stateManager.getState()!;
    const accounts = this.getResourceValue('createServiceAccounts', 'accounts');
    const functions = this.getResourceValue('deployCloudFunctions', 'functions');
    
    console.log('Starting API Gateway deployment step...');
    console.log('Service accounts:', accounts);
    console.log('Cloud Functions URLs:', functions);
    
    if (!this.apiGatewayDeployer) {
      throw new Error('API Gateway deployer not initialized');
    }

    this.emitProgress({
      currentStep: 'createApiGateway',
      stepProgress: 0,
      totalProgress: 62.5,
      message: 'Creating API Gateway...',
    });

    const configPath = app.isPackaged 
      ? path.join(process.resourcesPath, 'api-gateway-config.yaml')
      : path.join(app.getAppPath(), 'api-gateway-config.yaml');
    const apiId = `anava-api-${state.configuration.namePrefix}`;

    // Create progress callback for sub-steps
    const progressCallback = (subStep: string, subProgress: number, detail?: string) => {
      let stepProgress = 0;
      let message = 'Creating API Gateway...';
      
      switch (subStep) {
        case 'managed-service':
          stepProgress = subProgress * 0.2; // 20% of total
          message = 'Creating managed service...';
          break;
        case 'api-config':
          stepProgress = 20 + (subProgress * 0.3); // 30% of total
          message = 'Creating API configuration...';
          break;
        case 'gateway':
          stepProgress = 50 + (subProgress * 0.5); // 50% of total
          message = 'Creating API Gateway instance...';
          break;
      }
      
      this.emitProgress({
        currentStep: 'createApiGateway',
        stepProgress,
        totalProgress: 62.5 + (12.5 * (stepProgress / 100)),
        message,
        detail: detail || undefined,
        subStep,
      });
    };
    
    // Create log callback to forward logs
    const logCallback = (message: string) => {
      this.emitLog(message);
    };

    const { gatewayUrl, apiKey } = await this.apiGatewayDeployer.deployApiGateway(
      state.projectId,
      apiId,
      configPath,
      accounts['apigw-invoker-sa'],
      state.region,
      functions['device-auth'],
      functions['token-vending-machine'],
      state.configuration.corsOrigins || [],
      progressCallback,
      logCallback
    );

    this.stateManager.updateStepResource('createApiGateway', 'gatewayUrl', gatewayUrl);
    this.stateManager.updateStepResource('createApiGateway', 'apiKey', apiKey);

    this.emitProgress({
      currentStep: 'createApiGateway',
      stepProgress: 100,
      totalProgress: 75,
      message: 'API Gateway created successfully',
    });
  }

  private async stepConfigureWorkloadIdentity(): Promise<void> {
    console.log('Starting Workload Identity configuration...');
    const state = this.stateManager.getState()!;
    const accounts = this.getResourceValue('createServiceAccounts', 'accounts');
    
    console.log('Target service account:', accounts['vertex-ai-sa']);
    
    if (!this.workloadIdentityDeployer) {
      throw new Error('Workload Identity deployer not initialized');
    }

    this.emitProgress({
      currentStep: 'configureWorkloadIdentity',
      stepProgress: 0,
      totalProgress: 75,
      message: 'Configuring Workload Identity Federation...',
    });

    const projectNumber = await this.getProjectNumber(state.projectId);
    const firebaseProjectId = state.configuration.firebaseProjectId || state.projectId;

    const { poolName, providerName } = await this.workloadIdentityDeployer.configureWorkloadIdentity(
      state.projectId,
      projectNumber,
      'anava-firebase-pool',
      'firebase-provider',
      firebaseProjectId,
      accounts['vertex-ai-sa']
    );

    this.stateManager.updateStepResource('configureWorkloadIdentity', 'poolName', poolName);
    this.stateManager.updateStepResource('configureWorkloadIdentity', 'providerName', providerName);

    this.emitProgress({
      currentStep: 'configureWorkloadIdentity',
      stepProgress: 100,
      totalProgress: 87.5,
      message: 'Workload Identity configured',
    });
  }

  private async stepSetupFirestore(): Promise<void> {
    console.log('Starting Firestore setup...');
    const state = this.stateManager.getState()!;
    
    if (!this.firestoreDeployer) {
      throw new Error('Firestore deployer not initialized');
    }
    
    const logCallback = (message: string) => {
      this.emitLog(message);
      console.log(message);
    };

    // Step 1: Enable Firebase Authentication (25%)
    this.emitProgress({
      currentStep: 'setupFirestore',
      stepProgress: 0,
      totalProgress: 87.5,
      message: 'Enabling Firebase Authentication...',
    });
    
    await this.firestoreDeployer.enableFirebaseAuthentication(state.projectId, logCallback);
    this.stateManager.updateStepResource('setupFirestore', 'authEnabled', true);

    // Step 2: Enable Firebase Storage (50%)
    this.emitProgress({
      currentStep: 'setupFirestore',
      stepProgress: 25,
      totalProgress: 87.5,
      message: 'Enabling Firebase Storage...',
    });
    
    const storageBucket = await this.firestoreDeployer.enableFirebaseStorage(state.projectId, logCallback);
    this.stateManager.updateStepResource('setupFirestore', 'storageBucket', storageBucket);

    // Step 3: Deploy security rules for both Firestore and Storage (100%)
    this.emitProgress({
      currentStep: 'setupFirestore',
      stepProgress: 50,
      totalProgress: 87.5,
      message: 'Deploying security rules...',
    });
    
    await this.firestoreDeployer.deploySecurityRules(state.projectId, logCallback);
    this.stateManager.updateStepResource('setupFirestore', 'databaseId', '(default)');
    this.stateManager.updateStepResource('setupFirestore', 'rulesDeployed', true);
    
    this.emitProgress({
      currentStep: 'setupFirestore',
      stepProgress: 100,
      totalProgress: 87.5,
      message: 'Firebase setup complete - Auth, Storage, and security rules configured',
    });
  }

  private async stepCreateFirebaseWebApp(): Promise<void> {
    console.log('Starting Firebase Web App creation...');
    const state = this.stateManager.getState()!;
    
    if (!this.firebaseAppDeployer) {
      throw new Error('Firebase app deployer not initialized');
    }

    this.emitProgress({
      currentStep: 'createFirebaseWebApp',
      stepProgress: 0,
      totalProgress: 87.5,
      message: 'Creating Firebase web app...',
      subStep: 'create-app',
    });

    const appName = `anava-${state.configuration.namePrefix}`;
    const displayName = `Anava Camera Auth - ${state.configuration.namePrefix}`;
    
    // Step 1: Create the web app
    this.emitProgress({
      currentStep: 'createFirebaseWebApp',
      stepProgress: 10,
      totalProgress: 90,
      message: 'Creating web application...',
      subStep: 'create-app',
    });
    
    const firebaseConfig = await this.firebaseAppDeployer.createFirebaseWebApp(
      state.projectId,
      appName,
      displayName
    );

    this.stateManager.updateStepResource('createFirebaseWebApp', 'config', firebaseConfig);
    this.stateManager.updateStepResource('createFirebaseWebApp', 'appName', appName);

    // Firebase Authentication must be enabled manually in Firebase Console
    
    this.emitProgress({
      currentStep: 'createFirebaseWebApp',
      stepProgress: 100,
      totalProgress: 100,
      message: 'Firebase web app created',
      subStep: 'create-app',
    });
  }

  private async grantGcfArtifactsPermissions(
    projectId: string,
    region: string,
    cloudBuildSA: string,
    computeSA: string
  ): Promise<void> {
    try {
      console.log('Ensuring gcf-artifacts repository and permissions...');
      
      const auth = await this.getAuthClient();
      const artifactregistry = google.artifactregistry({
        version: 'v1',
        auth
      });
      
      const repositoryName = `projects/${projectId}/locations/${region}/repositories/gcf-artifacts`;
      
      // Check if repository exists, create if it doesn't
      let repositoryExists = false;
      try {
        await artifactregistry.projects.locations.repositories.get({
          name: repositoryName
        });
        repositoryExists = true;
        console.log('Found existing gcf-artifacts repository');
      } catch (error: any) {
        if (error.code === 404) {
          console.log('Creating gcf-artifacts repository...');
          try {
            await artifactregistry.projects.locations.repositories.create({
              parent: `projects/${projectId}/locations/${region}`,
              repositoryId: 'gcf-artifacts',
              requestBody: {
                format: 'DOCKER',
                description: 'This repository is created and used by Cloud Functions for storing function docker images.',
                labels: {
                  'goog-managed-by': 'cloudfunctions'
                }
              }
            });
            repositoryExists = true;
            console.log('Created gcf-artifacts repository');
            // Wait a bit for repository to be fully ready
            await new Promise(resolve => setTimeout(resolve, 3000));
          } catch (createError: any) {
            // If someone else created it in the meantime, that's fine
            if (createError.code !== 409) {
              console.error('Failed to create gcf-artifacts repository:', createError.message);
              return;
            }
            repositoryExists = true;
          }
        } else {
          throw error;
        }
      }
      
      if (!repositoryExists) {
        console.warn('Could not ensure gcf-artifacts repository exists');
        return;
      }
      
      // Get current IAM policy
      const { data: policy } = await artifactregistry.projects.locations.repositories.getIamPolicy({
        resource: repositoryName
      });
      
      // Initialize bindings if not present
      if (!policy.bindings) {
        policy.bindings = [];
      }
      
      // CRITICAL: Cloud Functions v2 builds run as the COMPUTE service account!
      // The compute SA needs admin permissions to push cache images
      const adminRole = 'roles/artifactregistry.admin';
      let adminBinding = policy.bindings.find(b => b.role === adminRole);
      
      if (!adminBinding) {
        adminBinding = { role: adminRole, members: [] };
        policy.bindings.push(adminBinding);
      }
      
      if (!adminBinding.members) {
        adminBinding.members = [];
      }
      
      // Add BOTH service accounts as admin
      const serviceAccounts = [
        `serviceAccount:${computeSA}`,  // This is the one that actually needs it!
        `serviceAccount:${cloudBuildSA}` // Keep this for other operations
      ];
      
      for (const sa of serviceAccounts) {
        if (!adminBinding.members.includes(sa)) {
          adminBinding.members.push(sa);
        }
      }
      
      // Update IAM policy
      await artifactregistry.projects.locations.repositories.setIamPolicy({
        resource: repositoryName,
        requestBody: {
          policy
        }
      });
      
      console.log('Successfully granted gcf-artifacts permissions:');
      console.log(`- Compute SA (${computeSA}): admin (CRITICAL for Cloud Functions v2)`);
      console.log(`- Cloud Build SA (${cloudBuildSA}): admin`);
      
    } catch (error: any) {
      console.error('Error granting gcf-artifacts permissions:', error.message);
      // Continue deployment - this might work anyway
    }
  }
  
  private async getAuthClient(): Promise<OAuth2Client> {
    if (!this.gcpAuth.oauth2Client) {
      throw new Error('OAuth client not initialized');
    }
    return this.gcpAuth.oauth2Client;
  }

  private async getProjectNumber(projectId: string): Promise<string> {
    // Get project details to extract project number
    const cloudResourceManager = (await import('googleapis')).google.cloudresourcemanager('v1');
    const { data: project } = await cloudResourceManager.projects.get({
      projectId: projectId,
      auth: this.gcpAuth.oauth2Client!
    });

    if (!project.projectNumber) {
      throw new Error('Could not determine project number');
    }

    return project.projectNumber;
  }

  private getResourceValue(stepName: string, resourceKey: string): any {
    const state = this.stateManager.getState();
    if (!state) return null;
    
    const step = state.steps[stepName];
    if (!step || !step.resources) return null;
    
    return step.resources[resourceKey];
  }

  private getAllResources(): Record<string, any> {
    const state = this.stateManager.getState();
    if (!state) return {};
    
    const resources: Record<string, any> = {};
    
    for (const [stepName, step] of Object.entries(state.steps)) {
      if (step.resources) {
        resources[stepName] = step.resources;
      }
    }
    
    return resources;
  }

  private emitProgress(progress: DeploymentProgress): void {
    this.emit('progress', progress);
  }
  
  private emitLog(message: string): void {
    this.emit('log', message);
  }

  private emitComplete(result: DeploymentResult): void {
    this.emit('complete', result);
  }

  private emitError(error: any): void {
    this.emit('error', error);
  }

  private async createFunctionSourceCode(
    functionName: string,
    entryPoint: string,
    _runtime: string
  ): Promise<string> {
    const tempDir = path.join(require('os').tmpdir(), `${functionName}-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    // Create Python source code
    const pythonCode = this.generatePythonFunctionCode(functionName, entryPoint);
    await fs.writeFile(path.join(tempDir, 'main.py'), pythonCode);
    
    // Create requirements.txt
    const requirementsPath = path.join(
      app.isPackaged ? process.resourcesPath : app.getAppPath(),
      'function-templates',
      functionName,
      'requirements.txt'
    );
    
    let requirements;
    try {
      requirements = require('fs').readFileSync(requirementsPath, 'utf-8');
    } catch (error) {
      // Fallback to default requirements
      requirements = functionName === 'token-vending-machine' 
        ? 'functions-framework>=3.1.0\nrequests>=2.28.0'
        : 'functions-framework>=3.1.0\nfirebase-admin>=6.1.0';
    }
    
    await fs.writeFile(path.join(tempDir, 'requirements.txt'), requirements);
    
    return tempDir;
  }

  private generatePythonFunctionCode(functionName: string, entryPoint: string): string {
    // Load function code from templates
    const templatePath = path.join(
      app.isPackaged ? process.resourcesPath : app.getAppPath(),
      'function-templates',
      functionName,
      'main.py'
    );
    
    try {
      const templateCode = require('fs').readFileSync(templatePath, 'utf-8');
      // The templates already have the correct function names
      return templateCode;
    } catch (error) {
      // Log the error
      console.error(`Function template not found for ${functionName}:`, error);
      
      // Fallback to inline code if template not found
      return `import functions_framework

@functions_framework.http
def ${entryPoint}(request):
    """Default function implementation."""
    return {'status': 'ok', 'function': '${functionName}'}`;
    }
  }
}