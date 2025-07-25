declare global {
  interface Window {
    electronAPI?: {
      auth: {
        check: () => Promise<{ authenticated: boolean; user?: string; error?: string }>;
        login: () => Promise<boolean>;
        logout: () => Promise<{ success: boolean }>;
        getProjects: () => Promise<any[]>;
      };
      state: {
        get: () => Promise<any>;
        checkExisting: (projectId: string) => Promise<any>;
      };
      deployment: {
        start: (config: any) => Promise<void>;
        resume: (deploymentId: string) => Promise<void>;
        pause: () => Promise<void>;
        onProgress: (callback: (progress: any) => void) => void;
        onError: (callback: (error: any) => void) => void;
        onComplete: (callback: (result: any) => void) => void;
        onLog: (callback: (message: string) => void) => void;
        subscribe: () => void;
      };
      app: {
        getVersion: () => Promise<string>;
      };
      createFirebaseUser: (params: {
        projectId: string;
        email: string;
        password: string;
        apiKey: string;
      }) => Promise<{ success: boolean; userId?: string; error?: string }>;
      openExternal: (url: string) => Promise<void>;
      validateDeployment: (params: {
        apiGatewayUrl: string;
        apiKey: string;
        firebaseApiKey: string;
      }) => Promise<{
        success: boolean;
        steps: {
          name: string;
          success: boolean;
          message: string;
          details?: any;
        }[];
        summary?: string;
        error?: string;
      }>;
    };
  }
}

export {};