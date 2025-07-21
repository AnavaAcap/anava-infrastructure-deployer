import { exec } from 'child_process';
import { promisify } from 'util';
import { AuthStatus, GCPProject } from '../../types';

const execAsync = promisify(exec);

export class GCPAuthService {
  private cachedAuth: AuthStatus | null = null;

  async checkAuthentication(): Promise<AuthStatus> {
    try {
      // Check if gcloud is installed
      await execAsync('which gcloud');
      
      // Get current authenticated user
      const { stdout: authList } = await execAsync('gcloud auth list --format=json');
      const accounts = JSON.parse(authList);
      
      if (!accounts || accounts.length === 0) {
        return {
          authenticated: false,
          error: 'No authenticated Google Cloud accounts found. Please run "gcloud auth login" first.',
        };
      }

      const activeAccount = accounts.find((acc: any) => acc.status === 'ACTIVE');
      if (!activeAccount) {
        return {
          authenticated: false,
          error: 'No active Google Cloud account found.',
        };
      }

      // Verify application default credentials
      try {
        await execAsync('gcloud auth application-default print-access-token');
      } catch (error) {
        return {
          authenticated: false,
          error: 'Application default credentials not found. Please run "gcloud auth application-default login".',
        };
      }

      this.cachedAuth = {
        authenticated: true,
        user: activeAccount.account,
      };

      return this.cachedAuth;
    } catch (error) {
      if ((error as any).message?.includes('which gcloud')) {
        return {
          authenticated: false,
          error: 'Google Cloud SDK not installed. Please install gcloud CLI first.',
        };
      }
      
      return {
        authenticated: false,
        error: `Authentication check failed: ${(error as Error).message}`,
      };
    }
  }

  async getProjects(): Promise<GCPProject[]> {
    try {
      const auth = await this.checkAuthentication();
      if (!auth.authenticated) {
        throw new Error(auth.error || 'Not authenticated');
      }

      const { stdout } = await execAsync(
        'gcloud projects list --format=json --limit=100'
      );
      
      const projects = JSON.parse(stdout);
      
      return projects
        .filter((p: any) => p.lifecycleState === 'ACTIVE')
        .map((p: any) => ({
          projectId: p.projectId,
          projectNumber: p.projectNumber,
          displayName: p.name,
          state: p.lifecycleState,
        }));
    } catch (error) {
      console.error('Failed to get projects:', error);
      throw new Error(`Failed to retrieve projects: ${(error as Error).message}`);
    }
  }

  async getAccessToken(): Promise<string> {
    try {
      const { stdout } = await execAsync('gcloud auth application-default print-access-token');
      return stdout.trim();
    } catch (error) {
      throw new Error('Failed to get access token. Please ensure you are authenticated.');
    }
  }

  async setProject(projectId: string): Promise<void> {
    try {
      await execAsync(`gcloud config set project ${projectId}`);
    } catch (error) {
      throw new Error(`Failed to set project: ${(error as Error).message}`);
    }
  }

  async getProjectNumber(projectId: string): Promise<string> {
    try {
      const { stdout } = await execAsync(
        `gcloud projects describe ${projectId} --format="value(projectNumber)"`
      );
      return stdout.trim();
    } catch (error) {
      throw new Error(`Failed to get project number: ${(error as Error).message}`);
    }
  }

  async checkFirebaseEnabled(projectId: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync(
        `gcloud services list --project=${projectId} --filter="config.name:firebase.googleapis.com" --format=json`
      );
      const services = JSON.parse(stdout);
      return services.length > 0;
    } catch (error) {
      console.error('Failed to check Firebase status:', error);
      return false;
    }
  }

  async getFirebaseWebApps(projectId: string): Promise<any[]> {
    try {
      // First check if Firebase is initialized
      const { stdout: projectInfo } = await execAsync(
        `firebase projects:list --json`
      );
      
      const projects = JSON.parse(projectInfo);
      const firebaseProject = projects.result?.find((p: any) => p.projectId === projectId);
      
      if (!firebaseProject) {
        return [];
      }

      // Get web apps
      const { stdout: appsJson } = await execAsync(
        `firebase apps:list WEB --project ${projectId} --json`
      );
      
      const appsData = JSON.parse(appsJson);
      return appsData.result || [];
    } catch (error) {
      console.error('Failed to get Firebase apps:', error);
      return [];
    }
  }
}