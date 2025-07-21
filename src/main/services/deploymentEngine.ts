import { EventEmitter } from 'events';
import { StateManager } from './stateManager';
import { GCPApiServiceManager } from './gcpApiServiceManager';
import { GCPOAuthService } from './gcpOAuthService';
import { CloudFunctionsDeployerV1 } from './cloudFunctionsDeployerV1';
import { ApiGatewayDeployer } from './apiGatewayDeployer';
import { FirestoreDeployer } from './firestoreDeployer';
import { WorkloadIdentityDeployer } from './workloadIdentityDeployer';
import { DeploymentConfig, DeploymentProgress, DeploymentResult } from '../../types';
import path from 'path';
import { app } from 'electron';

export class DeploymentEngine extends EventEmitter {
  private stateManager: StateManager;
  private gcpService: GCPApiServiceManager;
  private gcpAuth: GCPOAuthService;
  private cloudFunctionsDeployer?: CloudFunctionsDeployerV1;
  private apiGatewayDeployer?: ApiGatewayDeployer;
  private firestoreDeployer?: FirestoreDeployer;
  private workloadIdentityDeployer?: WorkloadIdentityDeployer;
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
      this.cloudFunctionsDeployer = new CloudFunctionsDeployerV1(this.gcpAuth.oauth2Client);
      this.apiGatewayDeployer = new ApiGatewayDeployer(this.gcpAuth.oauth2Client);
      this.firestoreDeployer = new FirestoreDeployer(this.gcpAuth.oauth2Client);
      this.workloadIdentityDeployer = new WorkloadIdentityDeployer(this.gcpAuth.oauth2Client);
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
          
          this.emitComplete({
            success: true,
            apiGatewayUrl: this.getResourceValue('createApiGateway', 'gatewayUrl'),
            apiKey: this.getResourceValue('createApiGateway', 'apiKey'),
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
        default:
          throw new Error(`Unknown step: ${stepName}`);
      }
      
      this.stateManager.updateStep(stepName, { status: 'completed' });
    } catch (error) {
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
  }

  private async stepAssignIamRoles(): Promise<void> {
    const state = this.stateManager.getState()!;
    const accounts = this.getResourceValue('createServiceAccounts', 'accounts');
    
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
    
    // Grant permission to access Artifact Registry
    await this.gcpService.assignIamRole(
      state.projectId,
      cloudBuildSA,
      'roles/artifactregistry.writer'
    );
    
    // Grant compute service account permission to access Cloud Functions internal buckets (gcf-sources-*)
    // This fixes the "Access to bucket gcf-sources-* denied" error
    await this.gcpService.assignIamRole(
      state.projectId,
      computeSA,
      'roles/storage.objectViewer'
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
    
    // Grant permissions to gcf-artifacts repository (created by Cloud Functions)
    await this.grantGcfArtifactsPermissions(state.projectId, state.region, cloudBuildSA, computeSA);
  }

  private async stepDeployCloudFunctions(): Promise<void> {
    const state = this.stateManager.getState()!;
    const accounts = this.getResourceValue('createServiceAccounts', 'accounts');
    
    if (!this.cloudFunctionsDeployer) {
      throw new Error('Cloud Functions deployer not initialized');
    }

    // Get project number for WIF configuration
    const projectNumber = await this.getProjectNumber(state.projectId);
    
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

      const functionUrl = await this.cloudFunctionsDeployer.deployFunction(
        state.projectId,
        functions[i].name,
        functions[i].sourceDir,
        functions[i].entryPoint,
        functions[i].runtime,
        functions[i].serviceAccount,
        functions[i].envVars,
        state.region
      );

      deployedFunctions[functions[i].name] = functionUrl;
      this.stateManager.updateStepResource('deployCloudFunctions', 'functions', deployedFunctions);
    }
  }

  private async stepCreateApiGateway(): Promise<void> {
    const state = this.stateManager.getState()!;
    const accounts = this.getResourceValue('createServiceAccounts', 'accounts');
    const functions = this.getResourceValue('deployCloudFunctions', 'functions');
    
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

    const { gatewayUrl, apiKey } = await this.apiGatewayDeployer.deployApiGateway(
      state.projectId,
      apiId,
      configPath,
      accounts['apigw-invoker-sa'],
      state.region,
      functions['device-auth'],
      functions['token-vending-machine'],
      state.configuration.corsOrigins || []
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
    const state = this.stateManager.getState()!;
    const accounts = this.getResourceValue('createServiceAccounts', 'accounts');
    
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
    const state = this.stateManager.getState()!;
    
    if (!this.firestoreDeployer) {
      throw new Error('Firestore deployer not initialized');
    }

    this.emitProgress({
      currentStep: 'setupFirestore',
      stepProgress: 0,
      totalProgress: 87.5,
      message: 'Setting up Firestore database...',
    });

    await this.firestoreDeployer.setupFirestore(state.projectId, state.region);

    this.stateManager.updateStepResource('setupFirestore', 'databaseId', '(default)');

    this.emitProgress({
      currentStep: 'setupFirestore',
      stepProgress: 100,
      totalProgress: 100,
      message: 'Firestore setup complete',
    });
  }

  private async grantGcfArtifactsPermissions(
    projectId: string,
    region: string,
    cloudBuildSA: string,
    computeSA: string
  ): Promise<void> {
    try {
      console.log('Checking for gcf-artifacts repository...');
      
      // Try to grant permissions using gcloud CLI since the repository might exist
      // but not be accessible via APIs yet
      const { execSync } = require('child_process');
      
      // Grant Cloud Build SA writer access (needs to upload cache)
      try {
        execSync(
          `gcloud artifacts repositories add-iam-policy-binding gcf-artifacts ` +
          `--location=${region} ` +
          `--member="serviceAccount:${cloudBuildSA}" ` +
          `--role="roles/artifactregistry.writer" ` +
          `--project=${projectId} ` +
          `--quiet`,
          { stdio: 'pipe' }
        );
        console.log('Granted Cloud Build SA writer access to gcf-artifacts repository');
      } catch (error: any) {
        // Repository might not exist yet, which is fine
        console.log('gcf-artifacts repository not found yet (will be created by Cloud Functions)');
      }
      
      // Grant compute SA writer access (Cloud Functions builds run as compute SA)
      try {
        execSync(
          `gcloud artifacts repositories add-iam-policy-binding gcf-artifacts ` +
          `--location=${region} ` +
          `--member="serviceAccount:${computeSA}" ` +
          `--role="roles/artifactregistry.writer" ` +
          `--project=${projectId} ` +
          `--quiet`,
          { stdio: 'pipe' }
        );
        console.log('Granted compute SA writer access to gcf-artifacts repository');
      } catch (error: any) {
        // Repository might not exist yet, which is fine
        console.log('gcf-artifacts repository not found yet (will be created by Cloud Functions)');
      }
    } catch (error) {
      console.warn('Could not grant gcf-artifacts permissions:', error);
      // This is not fatal - the repository might not exist yet
    }
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

  private emitComplete(result: DeploymentResult): void {
    this.emit('complete', result);
  }

  private emitError(error: any): void {
    this.emit('error', error);
  }
}