export interface DeploymentState {
  version: string;
  projectId: string;
  region: string;
  deploymentId: string;
  startedAt: string;
  lastUpdatedAt: string;
  configuration: DeploymentConfig;
  steps: DeploymentSteps;
}

export interface DeploymentConfig {
  projectId: string;
  region: string;
  namePrefix: string;
  firebaseProjectId?: string;
  firebaseWebAppId?: string;
  firebaseApiKey?: string;
  apiKeyRestrictions: string[];
  corsOrigins: string[];
  aiMode?: 'vertex' | 'ai-studio';  // Which AI path to use
  aiStudioApiKey?: string;           // API key for AI Studio
  adminPassword?: string;            // Password for admin user
  anavaKey?: string;                 // Anava license key
  customerId?: string;               // Customer identifier
}

export interface DeploymentSteps {
  [key: string]: StepStatus;
}

export interface StepStatus {
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  error?: string;
  resources?: Record<string, any>;
}

export interface GCPProject {
  projectId: string;
  projectNumber: string;
  displayName: string;
  state: string;
}

export interface ServiceAccount {
  name: string;
  displayName: string;
  email?: string;
}

export interface DeploymentProgress {
  currentStep: string;
  stepProgress: number;
  totalProgress: number;
  message: string;
  detail?: string;
  subStep?: string;
}

export interface DeploymentResult {
  success: boolean;
  apiGatewayUrl?: string;
  apiKey?: string;
  adminEmail?: string;
  firebaseConfig?: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId?: string;
  };
  resources?: Record<string, any>;
  error?: string;
  warning?: string;
  aiMode?: 'vertex' | 'ai-studio';
  aiStudioApiKey?: string;
  gcsBucketName?: string;
}

export interface AuthStatus {
  authenticated: boolean;
  user?: string;
  error?: string;
}

declare global {
  interface Window {
    electronAPI: {
      auth: {
        check: () => Promise<AuthStatus>;
        login: () => Promise<any>;
        logout: () => Promise<{ success: boolean }>;
        getProjects: () => Promise<GCPProject[]>;
      };
      state: {
        get: () => Promise<DeploymentState | null>;
        checkExisting: (projectId: string) => Promise<DeploymentState | null>;
      };
      deployment: {
        start: (config: DeploymentConfig) => Promise<void>;
        resume: (deploymentId: string) => Promise<void>;
        pause: () => Promise<void>;
        onProgress: (callback: (progress: DeploymentProgress) => void) => void;
        onError: (callback: (error: any) => void) => void;
        onComplete: (callback: (result: DeploymentResult) => void) => void;
        subscribe: () => void;
      };
    };
  }
}