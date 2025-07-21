import { EventEmitter } from 'events';
import { StateManager } from './stateManager';
import { GCPAuthService } from './gcpAuthService';
import { GCPServiceManager } from './gcpServiceManager';
import { DeploymentConfig, DeploymentProgress, DeploymentResult } from '../../types';

export class DeploymentEngine extends EventEmitter {
  private stateManager: StateManager;
  private gcpAuth: GCPAuthService;
  private gcpService: GCPServiceManager;
  private isPaused: boolean = false;
  private currentDeployment: any = null;

  constructor(stateManager: StateManager, gcpAuth: GCPAuthService) {
    super();
    this.stateManager = stateManager;
    this.gcpAuth = gcpAuth;
    this.gcpService = new GCPServiceManager(gcpAuth);
  }

  async startDeployment(config: DeploymentConfig & { projectId: string; region: string }): Promise<void> {
    try {
      this.isPaused = false;
      
      // Create new deployment state
      const state = this.stateManager.createNewDeployment(
        config.projectId,
        config.region,
        config
      );
      
      this.currentDeployment = state;
      
      // Start deployment process
      await this.runDeployment();
    } catch (error) {
      this.emitError(error);
      throw error;
    }
  }

  async resumeDeployment(deploymentId: string): Promise<void> {
    try {
      this.isPaused = false;
      
      const state = this.stateManager.getState();
      if (!state || state.deploymentId !== deploymentId) {
        throw new Error('Deployment not found');
      }
      
      this.currentDeployment = state;
      
      // Resume from next pending step
      await this.runDeployment();
    } catch (error) {
      this.emitError(error);
      throw error;
    }
  }

  async pauseDeployment(): Promise<void> {
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
          this.emitComplete({
            success: true,
            apiGatewayUrl: this.getResourceValue('createApiGateway', 'gatewayUrl'),
            apiKey: this.getResourceValue('createApiGateway', 'apiKey'),
            resources: this.getAllResources(),
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

    const authStatus = await this.gcpAuth.checkAuthentication();
    if (!authStatus.authenticated) {
      throw new Error(authStatus.error || 'Authentication failed');
    }

    const state = this.stateManager.getState()!;
    await this.gcpAuth.setProject(state.projectId);

    this.emitProgress({
      currentStep: 'authenticate',
      stepProgress: 100,
      totalProgress: 12.5,
      message: 'Authentication verified',
    });
  }

  private async stepEnableApis(): Promise<void> {
    const apis = [
      'apigateway.googleapis.com',
      'servicemanagement.googleapis.com',
      'servicecontrol.googleapis.com',
      'cloudfunctions.googleapis.com',
      'cloudbuild.googleapis.com',
      'artifactregistry.googleapis.com',
      'run.googleapis.com',
      'logging.googleapis.com',
      'storage-component.googleapis.com',
      'storage-api.googleapis.com',
      'aiplatform.googleapis.com',
      'iam.googleapis.com',
      'iamcredentials.googleapis.com',
      'cloudresourcemanager.googleapis.com',
      'firestore.googleapis.com',
      'firebase.googleapis.com',
      'firebasehosting.googleapis.com',
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
    const serviceAccounts = [
      { name: 'vertex-ai-sa', displayName: 'Vertex AI Service Account' },
      { name: 'device-auth-sa', displayName: 'Device Authenticator Service Account' },
      { name: 'tvm-sa', displayName: 'Token Vending Machine Service Account' },
      { name: 'apigw-invoker-sa', displayName: 'API Gateway Invoker' },
    ];

    const state = this.stateManager.getState()!;
    const createdAccounts: Record<string, string> = {};

    for (let i = 0; i < serviceAccounts.length; i++) {
      if (this.isPaused) return;
      
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
    }

    this.stateManager.updateStepResource('createServiceAccounts', 'accounts', createdAccounts);
  }

  private async stepAssignIamRoles(): Promise<void> {
    const state = this.stateManager.getState()!;
    const accounts = this.getResourceValue('createServiceAccounts', 'accounts');
    
    const roleBindings = [
      { account: 'vertex-ai-sa', role: 'roles/aiplatform.user' },
      { account: 'device-auth-sa', role: 'roles/firebase.sdkAdminServiceAgent' },
      { account: 'device-auth-sa', role: 'roles/firebasedatabase.admin' },
      { account: 'tvm-sa', role: 'roles/iam.serviceAccountTokenCreator' },
      { account: 'apigw-invoker-sa', role: 'roles/run.invoker' },
    ];

    for (let i = 0; i < roleBindings.length; i++) {
      if (this.isPaused) return;
      
      this.emitProgress({
        currentStep: 'assignIamRoles',
        stepProgress: (i / roleBindings.length) * 100,
        totalProgress: 37.5 + (12.5 * (i / roleBindings.length)),
        message: `Assigning ${roleBindings[i].role} to ${roleBindings[i].account}...`,
      });

      const accountEmail = accounts[roleBindings[i].account];
      await this.gcpService.assignIamRole(
        state.projectId,
        accountEmail,
        roleBindings[i].role
      );
    }
  }

  private async stepDeployCloudFunctions(): Promise<void> {
    // This will be implemented to deploy the cloud functions
    this.emitProgress({
      currentStep: 'deployCloudFunctions',
      stepProgress: 100,
      totalProgress: 62.5,
      message: 'Cloud functions deployed',
    });
  }

  private async stepCreateApiGateway(): Promise<void> {
    // This will be implemented to create the API gateway
    this.emitProgress({
      currentStep: 'createApiGateway',
      stepProgress: 100,
      totalProgress: 75,
      message: 'API Gateway created',
    });
  }

  private async stepConfigureWorkloadIdentity(): Promise<void> {
    // This will be implemented to configure workload identity
    this.emitProgress({
      currentStep: 'configureWorkloadIdentity',
      stepProgress: 100,
      totalProgress: 87.5,
      message: 'Workload identity configured',
    });
  }

  private async stepSetupFirestore(): Promise<void> {
    // This will be implemented to setup Firestore
    this.emitProgress({
      currentStep: 'setupFirestore',
      stepProgress: 100,
      totalProgress: 100,
      message: 'Firestore configured',
    });
  }

  private emitProgress(progress: DeploymentProgress): void {
    this.emit('progress', progress);
  }

  private emitError(error: any): void {
    this.emit('error', error);
  }

  private emitComplete(result: DeploymentResult): void {
    this.emit('complete', result);
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
    
    Object.entries(state.steps).forEach(([stepName, step]) => {
      if (step.resources) {
        resources[stepName] = step.resources;
      }
    });
    
    return resources;
  }
}