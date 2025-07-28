import { EventEmitter } from 'events';
import { StateManager } from './stateManager';
import { GCPApiServiceManager } from './gcpApiServiceManager';
import { GCPOAuthService } from './gcpOAuthService';
import { CloudFunctionsAPIDeployer, CloudFunctionConfig } from './cloudFunctionsAPIDeployer';
import { ApiGatewayDeployer } from './apiGatewayDeployer';
import { FirestoreDeployer } from './firestoreDeployer';
import { WorkloadIdentityDeployer } from './workloadIdentityDeployer';
import { FirebaseAppDeployer } from './firebaseAppDeployer';
import { TerraformService } from './terraformService';
import { FirebaseAuthSetupService } from './firebaseAuthSetupService';
import { IAPOAuthService } from './iapOAuthService';
import { DeploymentConfig, DeploymentProgress, DeploymentResult } from '../../types';
import { ParallelExecutor } from './utils/parallelExecutor';
import { ResilienceUtils } from './utils/resilienceUtils';
// import { DeploymentTimer } from './utils/deploymentTimer'; // TODO: Implement timing tracking
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
  private terraformService?: TerraformService;
  private firebaseAuthSetupService?: FirebaseAuthSetupService;
  private iapOAuthService?: IAPOAuthService;
  private isPaused = false;
  // private deploymentTimer?: DeploymentTimer; // TODO: Implement timing tracking

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
      this.terraformService = new TerraformService();
      this.firebaseAuthSetupService = new FirebaseAuthSetupService(this.gcpAuth.oauth2Client);
      this.iapOAuthService = new IAPOAuthService(this.gcpAuth.oauth2Client);
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

  private calculateTotalProgress(): number {
    const state = this.stateManager.getState();
    if (!state) return 0;
    
    const steps = state.steps;
    const totalSteps = Object.keys(steps).length;
    const completedSteps = Object.values(steps).filter(s => s.status === 'completed').length;
    
    return Math.round((completedSteps / totalSteps) * 100);
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
          
          // Get admin email if it was set
          const adminEmail = this.firestoreDeployer?.getAdminEmail();
          if (adminEmail) {
            console.log(`👤 Admin user configured: ${adminEmail}`);
          }
          
          this.emitComplete({
            success: true,
            apiGatewayUrl: gatewayUrl,
            apiKey: apiKey,
            firebaseConfig: firebaseConfig,
            resources: this.getAllResources(),
            adminEmail: adminEmail,
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
    
    // Define retry configuration for different step types
    const getRetryOptions = (step: string) => {
      const criticalSteps = ['enableApis', 'createServiceAccounts', 'assignIamRoles'];
      const networkIntensiveSteps = ['deployCloudFunctions', 'createApiGateway'];
      
      if (criticalSteps.includes(step)) {
        return {
          maxAttempts: 5,
          initialDelayMs: 2000,
          maxDelayMs: 30000,
          backoffMultiplier: 2
        };
      } else if (networkIntensiveSteps.includes(step)) {
        return {
          maxAttempts: 3,
          initialDelayMs: 5000,
          maxDelayMs: 60000,
          backoffMultiplier: 2
        };
      } else {
        return {
          maxAttempts: 3,
          initialDelayMs: 1000,
          maxDelayMs: 10000,
          backoffMultiplier: 2
        };
      }
    };
    
    try {
      this.stateManager.updateStep(stepName, { status: 'in_progress' });
      
      // Execute step with retry logic
      await ResilienceUtils.withRetry(async () => {
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
      }, {
        ...getRetryOptions(stepName),
        onRetry: (attempt, error, delayMs) => {
          console.log(`⚠️ Step ${stepName} failed (attempt ${attempt}), retrying in ${delayMs}ms...`);
          console.log(`Error: ${error.message}`);
          this.emitProgress({
            currentStep: stepName,
            stepProgress: 0,
            totalProgress: this.calculateTotalProgress(),
            message: `Retrying ${stepName} (attempt ${attempt})... ${error.message}`
          });
        }
      });
      
      this.stateManager.updateStep(stepName, { status: 'completed' });
      console.log(`✓ Step ${stepName} completed successfully`);
    } catch (error) {
      console.error(`✗ Step ${stepName} failed after all retry attempts:`, error);
      this.stateManager.updateStep(stepName, { 
        status: 'failed',
        error: (error as Error).message 
      });
      
      // For critical steps, provide recovery suggestions
      if (['enableApis', 'createServiceAccounts', 'assignIamRoles'].includes(stepName)) {
        console.error(`\n💡 Recovery suggestion for ${stepName}:`);
        console.error(`1. Check your internet connection`);
        console.error(`2. Verify your GCP permissions`);
        console.error(`3. Try resuming the deployment after fixing any issues`);
      }
      
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
    // Critical APIs that must be enabled first
    const criticalApis = [
      'serviceusage.googleapis.com',
      'iam.googleapis.com',
      'cloudresourcemanager.googleapis.com',
      'compute.googleapis.com', // This creates the default compute service account
    ];
    
    // Other APIs that can be enabled in parallel
    const otherApis = [
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
    const startTime = Date.now();
    
    this.emitProgress({
      currentStep: 'enableApis',
      stepProgress: 0,
      totalProgress: 12.5,
      message: 'Enabling critical APIs...',
    });

    // Enable critical APIs first (these are dependencies)
    console.log('Enabling critical APIs...');
    await this.gcpService.enableApis(state.projectId, criticalApis);
    
    this.emitProgress({
      currentStep: 'enableApis',
      stepProgress: 30,
      totalProgress: 16.25,
      message: 'Enabling remaining APIs in parallel...',
    });

    // Enable other APIs in parallel
    console.log('Enabling remaining APIs in parallel...');
    await this.gcpService.enableApis(state.projectId, otherApis);

    const allApis = [...criticalApis, ...otherApis];
    this.stateManager.updateStepResource('enableApis', 'apis', allApis);
    
    const elapsed = Date.now() - startTime;
    console.log(`All APIs enabled in ${elapsed}ms`);
    
    this.emitProgress({
      currentStep: 'enableApis',
      stepProgress: 100,
      totalProgress: 25,
      message: 'APIs enabled successfully',
    });
  }

  private async stepCreateServiceAccounts(): Promise<void> {
    const state = this.stateManager.getState()!;
    const startTime = Date.now();
    
    // Load any previously created accounts when resuming
    const existingAccounts: Record<string, string> = this.getResourceValue('createServiceAccounts', 'accounts') || {};
    
    const serviceAccounts = [
      { name: 'vertex-ai-sa', displayName: 'Vertex AI Service Account' },
      { name: 'device-auth-sa', displayName: 'Device Authenticator Service Account' },
      { name: 'tvm-sa', displayName: 'Token Vending Machine Service Account' },
      { name: 'apigw-invoker-sa', displayName: 'API Gateway Invoker' },
    ];

    // Filter out already created accounts
    const accountsToCreate = serviceAccounts.filter(sa => !existingAccounts[sa.name]);
    
    if (accountsToCreate.length === 0) {
      console.log('All service accounts already exist');
      return;
    }

    this.emitProgress({
      currentStep: 'createServiceAccounts',
      stepProgress: 0,
      totalProgress: 25,
      message: `Creating ${accountsToCreate.length} service accounts in parallel...`,
    });

    // Create all service accounts in parallel
    const createdAccounts = await this.gcpService.createServiceAccounts(
      state.projectId,
      accountsToCreate
    );
    
    // Merge with existing accounts
    const allAccounts = { ...existingAccounts, ...createdAccounts };
    this.stateManager.updateStepResource('createServiceAccounts', 'accounts', allAccounts);
    
    const elapsed = Date.now() - startTime;
    console.log(`Service accounts created in ${elapsed}ms`);
    
    this.emitProgress({
      currentStep: 'createServiceAccounts',
      stepProgress: 100,
      totalProgress: 37.5,
      message: 'Service accounts created successfully',
    });
    
    // Grant the current user permission to act as the API Gateway invoker service account
    // This is required for the API Gateway config to be created with the correct service account
    if (allAccounts['apigw-invoker-sa']) {
      console.log('Granting actAs permission for API Gateway service account...');
      try {
        // Get current authenticated user
        const { google } = await import('googleapis');
        const oauth2 = google.oauth2('v2');
        const auth = await this.getAuthClient();
        const { data } = await oauth2.userinfo.get({ auth });
        const currentUser = data.email;
        
        if (currentUser) {
          console.log(`Granting serviceAccountUser role to ${currentUser} for ${allAccounts['apigw-invoker-sa']}`);
          await this.gcpService.assignServiceAccountUser(
            state.projectId,
            allAccounts['apigw-invoker-sa'],
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
    
    this.emitProgress({
      currentStep: 'assignIamRoles',
      stepProgress: 0,
      totalProgress: 37.5,
      message: 'Preparing IAM role assignments...',
    });
    
    // Get project number and compute SA first
    const projectNumber = await this.getProjectNumber(state.projectId);
    const cloudBuildSA = `${projectNumber}@cloudbuild.gserviceaccount.com`;
    
    // Wait for the compute SA to be created after enabling Compute API
    const computeSA = await this.gcpService.waitForComputeServiceAccount(
      state.projectId,
      projectNumber.toString()
    );
    
    this.emitProgress({
      currentStep: 'assignIamRoles',
      stepProgress: 10,
      totalProgress: 38.75,
      message: 'Assigning IAM roles in parallel...',
    });
    
    // Cloud Functions service agent (critical for deployments)
    const cloudFunctionsSA = `service-${projectNumber}@gcf-admin-robot.iam.gserviceaccount.com`;
    
    // Log that we're setting up the service agents
    console.log(`Setting up Cloud Functions service agent: ${cloudFunctionsSA}`);
    
    // Prepare all IAM role assignments
    const roleAssignments = [
      // Cloud Functions service agent (MUST have artifactregistry.reader)
      { memberEmail: cloudFunctionsSA, role: 'roles/artifactregistry.reader' },
      
      // Compute SA roles (critical for Cloud Functions v2)
      { memberEmail: computeSA, role: 'roles/storage.objectViewer' },
      { memberEmail: computeSA, role: 'roles/logging.logWriter' },
      { memberEmail: computeSA, role: 'roles/artifactregistry.admin' },
      
      // Cloud Build SA roles
      { memberEmail: cloudBuildSA, role: 'roles/cloudfunctions.developer' },
      { memberEmail: cloudBuildSA, role: 'roles/storage.objectAdmin' },
      { memberEmail: cloudBuildSA, role: 'roles/cloudbuild.builds.editor' },
      { memberEmail: cloudBuildSA, role: 'roles/artifactregistry.admin' },
      
      // Service account specific roles
      { memberEmail: accounts['vertex-ai-sa'], role: 'roles/aiplatform.user' },
      { memberEmail: accounts['vertex-ai-sa'], role: 'roles/storage.objectAdmin' },
      { memberEmail: accounts['vertex-ai-sa'], role: 'roles/logging.logWriter' },
      { memberEmail: accounts['vertex-ai-sa'], role: 'roles/datastore.user' },
      { memberEmail: accounts['device-auth-sa'], role: 'roles/firebase.sdkAdminServiceAgent' },
      { memberEmail: accounts['device-auth-sa'], role: 'roles/firebasedatabase.admin' },
      { memberEmail: accounts['device-auth-sa'], role: 'roles/iam.serviceAccountTokenCreator' },
      { memberEmail: accounts['tvm-sa'], role: 'roles/iam.serviceAccountTokenCreator' },
      { memberEmail: accounts['apigw-invoker-sa'], role: 'roles/run.invoker' },
    ];
    
    // Assign all roles in parallel
    await this.gcpService.assignIamRoles(state.projectId, roleAssignments);
    
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
      totalProgress: 62.5 + (12.5 * 0.05),
      message: `Configuring Cloud Build and compute permissions...`,
    });

    for (let i = 0; i < roleBindings.length; i++) {
      if (this.isPaused) return;
      
      this.emitProgress({
        currentStep: 'assignIamRoles',
        stepProgress: 20 + ((i / roleBindings.length) * 80),
        totalProgress: 62.5 + (12.5 * (0.2 + (i / roleBindings.length) * 0.8)),
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
    const startTime = Date.now();
    
    console.log('Service accounts for functions:', accounts);
    
    if (!this.cloudFunctionsAPIDeployer) {
      throw new Error('Cloud Functions API deployer not initialized');
    }

    // Get project number for WIF configuration
    const projectNumber = await this.getProjectNumber(state.projectId);
    
    // CRITICAL FIX: Ensure Cloud Functions service agent has permissions BEFORE deployment starts
    // This prevents the "Unable to retrieve the repository metadata" error in parallel deployments
    const cloudFunctionsSA = `service-${projectNumber}@gcf-admin-robot.iam.gserviceaccount.com`;
    console.log(`Granting Cloud Functions service agent (${cloudFunctionsSA}) required permissions...`);
    
    try {
      await this.gcpService.assignIamRole(
        state.projectId,
        cloudFunctionsSA,
        'roles/artifactregistry.reader'
      );
      console.log(`✅ Granted Artifact Registry reader permissions to Cloud Functions service agent`);
      
      // Wait for IAM propagation - critical for avoiding race conditions
      console.log('Waiting 10 seconds for IAM permissions to propagate...');
      await new Promise(resolve => setTimeout(resolve, 10000));
    } catch (error: any) {
      console.warn('Warning: Could not grant Cloud Functions service agent permissions:', error.message);
      console.warn('This may cause deployment failures. Error details:', error.response?.data || error);
      // Continue anyway - the user might have already set this up manually
    }
    
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

    // Check for existing functions to handle resume
    const existingFunctions: Record<string, string> = this.getResourceValue('deployCloudFunctions', 'functions') || {};
    
    // Prepare source code for all functions first
    const functionConfigs = await Promise.all(functions.map(async (func) => {
      // Skip if function already deployed
      if (existingFunctions[func.name]) {
        console.log(`Function ${func.name} already deployed, skipping...`);
        return null;
      }
      
      // Create source directory with inline code
      const sourceDir = await this.createFunctionSourceCode(
        func.name,
        func.entryPoint,
        func.runtime
      );
      
      return {
        config: {
          name: func.name,
          entryPoint: func.entryPoint,
          runtime: func.runtime,
          region: state.region,
          serviceAccount: func.serviceAccount,
          environmentVariables: func.envVars,
          maxInstances: 5
        },
        sourceDir
      };
    }));
    
    // Filter out nulls (already deployed functions)
    const functionsToProcess = functionConfigs.filter(f => f !== null) as Array<{
      config: CloudFunctionConfig;
      sourceDir: string;
    }>;
    
    if (functionsToProcess.length === 0) {
      console.log('All functions already deployed');
      this.stateManager.updateStepResource('deployCloudFunctions', 'functions', existingFunctions);
      return;
    }

    this.emitProgress({
      currentStep: 'deployCloudFunctions',
      stepProgress: 0,
      totalProgress: 50,
      message: `Deploying ${functionsToProcess.length} Cloud Functions in parallel...`,
    });

    try {
      // Deploy all functions in parallel
      const deployedFunctions = await this.cloudFunctionsAPIDeployer!.deployFunctions(
        state.projectId,
        functionsToProcess,
        (completed: number, total: number) => {
          const progress = (completed / total) * 100;
          this.emitProgress({
            currentStep: 'deployCloudFunctions',
            stepProgress: progress,
            totalProgress: 50 + (12.5 * (progress / 100)),
            message: `Deployed ${completed}/${total} functions...`,
          });
        }
      );
      
      // Merge with existing functions
      const allFunctions = { ...existingFunctions, ...deployedFunctions };
      this.stateManager.updateStepResource('deployCloudFunctions', 'functions', allFunctions);
      
      const elapsed = Date.now() - startTime;
      console.log(`Cloud Functions deployed in ${elapsed}ms`);
      
    } finally {
      // Clean up all temp directories
      await Promise.all(
        functionsToProcess.map(({ sourceDir }) =>
          fs.rm(sourceDir, { recursive: true, force: true })
        )
      );
    }
    
    // Grant Cloud Run invoker permissions to API Gateway service account
    console.log('Granting Cloud Run invoker permissions to API Gateway service account...');
    const allFunctionsForPermissions = this.getResourceValue('deployCloudFunctions', 'functions') || {};
    await this.grantCloudRunInvokerPermissions(
      state.projectId,
      state.region,
      allFunctionsForPermissions,
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
    const startTime = Date.now();
    
    console.log(`Granting Cloud Run invoker permissions for ${Object.keys(functions).length} functions in parallel...`);
    
    // Create tasks for parallel execution
    const tasks = Object.entries(functions).map(([functionName]) => ({
      name: functionName,
      fn: () => cloudRunIAMManager.grantInvokerPermission(
        projectId,
        region,
        functionName,
        apiGatewayInvokerSA
      ),
      critical: false // Continue even if one fails
    }));
    
    const results = await ParallelExecutor.executeBatch(tasks, {
      maxConcurrency: 3,
      stopOnError: false
    });
    
    // Report any failures
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      console.error(`Failed to grant invoker permissions for ${failures.length} functions:`, 
        failures.map(f => f.name).join(', '));
    }
    
    const elapsed = Date.now() - startTime;
    console.log(`Granted Cloud Run invoker permissions in ${elapsed}ms`);
    
    // Wait for IAM permissions to propagate (reduced from 30s to 10s with smart retry)
    console.log('Waiting 10 seconds for IAM permissions to propagate...');
    await new Promise(resolve => setTimeout(resolve, 10000));
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

    // Get current user email for admin setup
    let userEmail: string | undefined;
    try {
      const userInfo = await this.gcpAuth.getCurrentUser();
      userEmail = userInfo?.email || undefined;
      if (userEmail) {
        logCallback(`Setting up admin access for: ${userEmail}`);
      }
    } catch (error) {
      console.warn('Could not get current user email:', error);
    }

    // Enable Firebase Auth and Storage in parallel
    this.emitProgress({
      currentStep: 'setupFirestore',
      stepProgress: 0,
      totalProgress: 87.5,
      message: 'Initializing Firebase services in parallel...',
    });

    const startTime = Date.now();

    // Execute Firebase Auth and Storage setup in parallel
    const firebaseSetupTasks = [
      {
        name: 'Firebase Authentication',
        fn: async () => {
          logCallback('=== Initializing Firebase Authentication with Terraform ===');
          
          if (!this.terraformService) {
            throw new Error('Terraform service not initialized. Cannot proceed with Firebase Auth setup.');
          }
          
          try {
            logCallback('Step 1: Initializing Terraform service...');
            await this.terraformService.initialize();
            logCallback('✅ Terraform service initialized');
            
            // Create service account key for Terraform
            logCallback('Step 2: Creating service account credentials for Terraform...');
            const keyFile = path.join(app.getPath('userData'), 'terraform-sa-key.json');
            const keyContent = await this.gcpAuth.getServiceAccountKey();
            await fs.writeFile(keyFile, JSON.stringify(keyContent, null, 2));
            logCallback('✅ Service account key created');
            
            // Get project number for OAuth setup
            const projectNumber = await this.getProjectNumber(state.projectId);
            
            // Initialize Firebase Auth with Terraform
            logCallback('Step 3: Running Terraform to initialize Firebase Authentication...');
            logCallback(`  Project ID: ${state.projectId}`);
            logCallback(`  Project Number: ${projectNumber}`);
            logCallback(`  Admin Email: ${userEmail}`);
            logCallback(`  Authorized domains: ${state.projectId}.firebaseapp.com, localhost`);
            logCallback('  Enabling email/password and anonymous authentication...');
            
            
            await this.terraformService.initializeFirebaseAuth(
              state.projectId,
              keyFile,
              {
                enableAnonymous: true,
                authorizedDomains: [
                  `${state.projectId}.firebaseapp.com`,
                  'localhost'
                ],
                adminEmail: userEmail,
                projectNumber: projectNumber
              }
            );
            
            // Clean up key file
            await fs.unlink(keyFile);
            logCallback('✅ Cleaned up temporary credentials');
            
            logCallback('✅ Firebase Authentication initialized successfully with Terraform!');
            logCallback('✅ Email/password and anonymous authentication are now enabled');
            
            // Now set up Google Sign-In with IAP OAuth
            if (userEmail && this.iapOAuthService) {
              logCallback('');
              logCallback('Step 4: Setting up Google Sign-In with IAP OAuth...');
              
              try {
                const iapCredentials = await this.iapOAuthService.setupIAPOAuth(
                  state.projectId,
                  userEmail,
                  'Anava Vision Internal',
                  logCallback
                );
                
                logCallback('');
                logCallback('✅ Google Sign-In has been fully configured!');
                logCallback('✅ OAuth credentials were created automatically');
                logCallback('✅ No manual setup required!');
                logCallback('');
                logCallback('Authentication Details:');
                logCallback(`  - Admin user: ${userEmail}`);
                logCallback('  - Access: Internal users only (your organization)');
                logCallback('  - OAuth Client: Created via IAP');
                logCallback('');
                logCallback('Your Firebase application will work without any code changes!');
                
                // Store the OAuth client ID for reference
                this.stateManager.updateStepResource('setupFirestore', 'oauthClientId', iapCredentials.clientId);
                this.stateManager.updateStepResource('setupFirestore', 'googleSignInEnabled', true);
                
              } catch (iapError: any) {
                console.error('IAP OAuth setup failed:', iapError);
                logCallback(`⚠️  Could not set up Google Sign-In automatically: ${iapError.message}`);
                logCallback('⚠️  You can still enable it manually in Firebase Console if needed');
              }
            }
            
            this.stateManager.updateStepResource('setupFirestore', 'authEnabled', true);
            this.stateManager.updateStepResource('setupFirestore', 'authConfigured', true);
            return true;
          } catch (error: any) {
            console.error('Terraform auth initialization failed:', error);
            logCallback(`❌ Failed to initialize Firebase Authentication: ${error.message}`);
            logCallback('❌ Firebase Authentication must be initialized manually in the Firebase Console');
            logCallback('❌ Go to: https://console.firebase.google.com/project/' + state.projectId + '/authentication/providers');
            logCallback('❌ Click "Get Started" and enable Email/Password authentication');
            
            this.stateManager.updateStepResource('setupFirestore', 'authEnabled', false);
            this.stateManager.updateStepResource('setupFirestore', 'authConfigured', false);
            throw new Error(`Firebase Auth initialization failed: ${error.message}`);
          }
        },
        critical: true
      },
      {
        name: 'Firebase Storage',
        fn: async () => {
          const storageBucket = await this.firestoreDeployer!.enableFirebaseStorage(
            state.projectId, 
            logCallback
          );
          this.stateManager.updateStepResource('setupFirestore', 'storageBucket', storageBucket);
          return storageBucket;
        },
        critical: true
      }
    ];

    console.log('Enabling Firebase Authentication and Storage in parallel...');
    const setupResults = await ParallelExecutor.executeBatch<any>(firebaseSetupTasks, {
      maxConcurrency: 2,
      stopOnError: true
    });

    // Check for failures
    const setupFailures = setupResults.filter(r => !r.success);
    if (setupFailures.length > 0) {
      throw new Error(`Failed to set up Firebase services: ${setupFailures.map(f => f.name).join(', ')}`);
    }

    this.emitProgress({
      currentStep: 'setupFirestore',
      stepProgress: 50,
      totalProgress: 87.5,
      message: 'Deploying security rules...',
    });
    
    // Deploy security rules (this needs to happen after storage bucket exists)
    await this.firestoreDeployer.deploySecurityRules(state.projectId, logCallback);
    this.stateManager.updateStepResource('setupFirestore', 'databaseId', '(default)');
    this.stateManager.updateStepResource('setupFirestore', 'rulesDeployed', true);
    
    const elapsed = Date.now() - startTime;
    console.log(`Firebase setup completed in ${elapsed}ms`);
    
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
          console.log('gcf-artifacts repository does not exist yet');
          console.log('Note: Cloud Functions will create this repository automatically on first deployment');
          // Don't try to create it - let Cloud Functions create it
          // This avoids permission errors for users who can deploy functions but not create repos
        } else if (error.code === 403) {
          console.log('Permission denied checking for gcf-artifacts repository');
          console.log('Note: This is normal if you don\'t have Artifact Registry admin permissions');
          console.log('Cloud Functions will create and manage this repository automatically');
        } else {
          throw error;
        }
      }
      
      // Early return if repository doesn't exist and we can't create it
      // Cloud Functions will handle repository creation automatically
      if (!repositoryExists) {
        console.log('Skipping gcf-artifacts permission setup - repository will be created by Cloud Functions');
        
        // However, we should still try to grant the Cloud Functions service agent project-wide permissions
        await this.grantCloudFunctionsServiceAgentPermissions(projectId, computeSA);
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
      
      // Add ALL necessary service accounts as admin
      // CRITICAL: The Cloud Functions service agent needs these permissions!
      const projectNumber = projectId.match(/\d+/)?.[0] || computeSA.split('-')[0];
      const cloudFunctionsSA = `service-${projectNumber}@gcf-admin-robot.iam.gserviceaccount.com`;
      
      const serviceAccounts = [
        `serviceAccount:${cloudFunctionsSA}`, // Cloud Functions service agent - MOST IMPORTANT!
        `serviceAccount:${computeSA}`,         // Compute SA for builds
        `serviceAccount:${cloudBuildSA}`       // Cloud Build SA for other operations
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
      console.log(`- Cloud Functions SA (${cloudFunctionsSA}): admin (CRITICAL for deployments)`);
      console.log(`- Compute SA (${computeSA}): admin (for Cloud Functions v2 builds)`);
      console.log(`- Cloud Build SA (${cloudBuildSA}): admin`);
      
    } catch (error: any) {
      console.error('Error granting gcf-artifacts permissions:', error.message);
      // Continue deployment - this might work anyway
    }
  }
  
  private async grantCloudFunctionsServiceAgentPermissions(
    projectId: string,
    computeSA: string
  ): Promise<void> {
    try {
      console.log('Granting Cloud Functions service agent project-wide Artifact Registry permissions...');
      
      // Extract project number from compute SA
      const projectNumber = computeSA.split('-')[0];
      const cloudFunctionsSA = `service-${projectNumber}@gcf-admin-robot.iam.gserviceaccount.com`;
      
      // Grant the Cloud Functions service agent Artifact Registry Reader role at project level
      await this.gcpService.assignIamRole(
        projectId,
        cloudFunctionsSA,
        'roles/artifactregistry.reader'
      );
      
      console.log(`✅ Granted Cloud Functions service agent (${cloudFunctionsSA}) Artifact Registry reader permissions`);
      
    } catch (error: any) {
      console.warn('Could not grant Cloud Functions service agent permissions:', error.message);
      console.warn('Cloud Functions deployment may fail - you may need to manually grant permissions');
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