import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { DeploymentState, DeploymentConfig, StepStatus } from '../../types';

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
        this.state = JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load state:', error);
      this.state = null;
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
    this.state = {
      version: '1.0',
      projectId,
      region,
      deploymentId: uuidv4(),
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      configuration: config,
      steps: {
        authenticate: { status: 'pending' },
        enableApis: { status: 'pending' },
        createServiceAccounts: { status: 'pending' },
        assignIamRoles: { status: 'pending' },
        deployCloudFunctions: { status: 'pending' },
        createApiGateway: { status: 'pending' },
        configureWorkloadIdentity: { status: 'pending' },
        setupFirestore: { status: 'pending' },
        createFirebaseWebApp: { status: 'pending' },
      },
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
      'createServiceAccounts',
      'assignIamRoles',
      'deployCloudFunctions',
      'createApiGateway',
      'configureWorkloadIdentity',
      'setupFirestore',
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