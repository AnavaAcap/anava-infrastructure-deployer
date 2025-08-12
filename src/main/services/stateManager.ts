import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { DeploymentState, DeploymentConfig, StepStatus, DeploymentSteps } from '../../types';

export class StateManager {
  private statePath: string;
  private state: DeploymentState | null = null;

  constructor() {
    const userDataPath = app.getPath('userData');
    const stateDir = path.join(userDataPath, '.anava-deployer');
    
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }
    
    this.statePath = path.join(stateDir, 'state.json');
    this.loadState();
  }

  private loadState(): void {
    try {
      if (fs.existsSync(this.statePath)) {
        const data = fs.readFileSync(this.statePath, 'utf8');
        // Check if file is empty or contains only whitespace
        if (!data || data.trim().length === 0) {
          console.log('State file is empty, starting fresh');
          this.state = null;
          // Remove the empty file to avoid future issues
          fs.unlinkSync(this.statePath);
          return;
        }
        this.state = JSON.parse(data);
        console.log('Loaded existing deployment state');
      }
    } catch (error) {
      console.error('Failed to load state, will start fresh:', error);
      this.state = null;
      // Try to remove corrupted state file
      try {
        if (fs.existsSync(this.statePath)) {
          fs.unlinkSync(this.statePath);
          console.log('Removed corrupted state file');
        }
      } catch (e) {
        console.error('Failed to remove corrupted state file:', e);
      }
    }
  }

  private saveState(): void {
    try {
      if (this.state) {
        this.state.lastUpdatedAt = new Date().toISOString();
        fs.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2));
      }
    } catch (error) {
      console.error('Failed to save state:', error);
      throw new Error('Failed to save deployment state');
    }
  }

  public getState(): DeploymentState | null {
    return this.state;
  }

  public createNewDeployment(projectId: string, region: string, config: DeploymentConfig): DeploymentState {
    // Define steps based on AI mode
    const steps: DeploymentSteps = config.aiMode === 'ai-studio' 
      ? {
          authenticate: { status: 'pending' as const },
          enableApis: { status: 'pending' as const },
          createAiStudioKey: { status: 'pending' as const },
        }
      : {
          authenticate: { status: 'pending' as const },
          enableApis: { status: 'pending' as const },
          createServiceAccounts: { status: 'pending' as const },
          assignIamRoles: { status: 'pending' as const },
          deployCloudFunctions: { status: 'pending' as const },
          createApiGateway: { status: 'pending' as const },
          configureWorkloadIdentity: { status: 'pending' as const },
          setupFirestore: { status: 'pending' as const },
          createFirebaseWebApp: { status: 'pending' as const },
        };

    this.state = {
      version: '1.0',
      projectId,
      region,
      deploymentId: uuidv4(),
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      configuration: config,
      steps,
    };
    
    this.saveState();
    return this.state;
  }

  public updateStep(stepName: string, status: StepStatus): void {
    if (!this.state) {
      throw new Error('No active deployment');
    }

    this.state.steps[stepName] = {
      ...this.state.steps[stepName],
      ...status,
    };

    if (status.status === 'in_progress' && !status.startedAt) {
      this.state.steps[stepName].startedAt = new Date().toISOString();
    }

    if (status.status === 'completed' && !status.completedAt) {
      this.state.steps[stepName].completedAt = new Date().toISOString();
    }

    this.saveState();
  }

  public updateStepResource(stepName: string, resourceKey: string, resourceValue: any): void {
    if (!this.state) {
      throw new Error('No active deployment');
    }

    if (!this.state.steps[stepName].resources) {
      this.state.steps[stepName].resources = {};
    }

    this.state.steps[stepName].resources![resourceKey] = resourceValue;
    this.saveState();
  }

  public checkExistingDeployment(projectId: string): DeploymentState | null {
    if (this.state && this.state.projectId === projectId) {
      // Check if deployment is incomplete
      const hasIncompleteSteps = Object.values(this.state.steps).some(
        step => step.status === 'pending' || step.status === 'in_progress'
      );
      
      if (hasIncompleteSteps) {
        return this.state;
      }
    }
    return null;
  }

  public updateConfiguration(config: DeploymentConfig): void {
    if (!this.state) {
      throw new Error('No active deployment');
    }
    
    this.state.configuration = config;
    this.saveState();
  }

  public clearState(): void {
    this.state = null;
    if (fs.existsSync(this.statePath)) {
      fs.unlinkSync(this.statePath);
    }
  }

  public getNextPendingStep(): string | null {
    if (!this.state) return null;

    const stepOrder = [
      'authenticate',
      'enableApis',
      'createFirebaseWebApp',      // Needs to be early for Firebase config
      'createServiceAccounts',
      'assignIamRoles',           // Must happen before setupFirestore for Storage permissions
      'setupFirestore',           // Needs IAM roles for Storage service agent
      'deployCloudFunctions',
      'createApiGateway',
      'configureWorkloadIdentity',
    ];

    for (const stepName of stepOrder) {
      const step = this.state.steps[stepName];
      if (step && (step.status === 'pending' || step.status === 'failed')) {
        return stepName;
      }
    }

    return null;
  }

  public isDeploymentComplete(): boolean {
    if (!this.state) return false;

    return Object.values(this.state.steps).every(
      step => step.status === 'completed'
    );
  }
}