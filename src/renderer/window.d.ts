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
      createProject: (projectName: string) => Promise<{ success: boolean; projectId?: string; error?: string }>;
      testAuthStep: (params: any) => Promise<any>;
      // Camera-related APIs
      scanNetworkCameras: () => Promise<any[]>;
      onCameraScanProgress: (callback: (data: { ip: string; status: string }) => void) => () => void;
      quickScanCamera: (ip: string, username: string, password: string) => Promise<any[]>;
      testCameraCredentials: (cameraId: string, ip: string, username: string, password: string) => Promise<any>;
      deployACAP: (camera: any, acapPath: string) => Promise<any>;
      uninstallACAP: (camera: any, appName: string) => Promise<any>;
      listInstalledACAPs: (camera: any) => Promise<string[]>;
      configureCamera: (camera: any, config: any) => Promise<any>;
      // ACAP download APIs
      acap: {
        getReleases: () => Promise<any[]>;
        download: (release: any) => Promise<any>;
        getLocalPath: (filename: string) => Promise<string>;
      };
    };
  }
}

export {};