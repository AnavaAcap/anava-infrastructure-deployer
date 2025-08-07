declare global {
  interface Window {
    electronAPI?: {
      auth: {
        check: () => Promise<{ authenticated: boolean; user?: string; error?: string }>;
        login: () => Promise<{ success: boolean; user?: { email: string }; error?: string }>;
        logout: () => Promise<{ success: boolean }>;
        getProjects: () => Promise<any[]>;
        // Unified authentication
        unifiedGoogle: () => Promise<{
          success: boolean;
          user?: {
            email: string;
            name: string;
            picture: string;
            idToken: string;
            accessToken: string;
          };
          error?: string;
        }>;
        unifiedSignOut: () => Promise<{ success: boolean; error?: string }>;
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
      billing: {
        checkProject: (projectId: string) => Promise<{
          enabled: boolean;
          billingAccountName?: string;
          error?: string;
        }>;
        listAccounts: () => Promise<Array<{
          name: string;
          displayName: string;
          open: boolean;
        }>>;
        linkAccount: (projectId: string, billingAccountName: string) => Promise<boolean>;
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
      createProject: (config: {
        projectName: string;
        organizationId?: string;
        billingAccountId?: string;
      }) => Promise<{ success: boolean; projectId?: string; error?: string }>;
      listOrganizations: () => Promise<{ organizations: any[]; error?: string }>;
      listBillingAccounts: () => Promise<{ accounts: any[]; error?: string }>;
      testAuthStep: (params: any) => Promise<any>;
      // Camera-related APIs
      scanNetworkCameras: (options?: { networkRange?: string }) => Promise<any[]>;
      enhancedScanNetwork: (options?: { 
        networkRange?: string;
        concurrent?: number;
        timeout?: number;
        ports?: number[];
        useServiceDiscovery?: boolean;
        credentials?: Array<{ username: string; password: string }>;
      }) => Promise<any[]>;
      discoverServiceCameras: () => Promise<any[]>;
      onCameraScanProgress: (callback: (data: { ip: string; status: string }) => void) => () => void;
      onCameraDiscovered: (callback: (camera: any) => void) => () => void;
      quickScanCamera: (ip: string, username: string, password: string) => Promise<any[]>;
      testCameraCredentials: (cameraId: string, ip: string, username: string, password: string) => Promise<any>;
      deployACAP: (camera: any, acapPath: string) => Promise<any>;
      deployACAPAuto: (camera: any, availableAcaps: any[]) => Promise<any>;
      getCameraFirmware: (camera: any) => Promise<{ firmwareVersion: string; osVersion: 'OS11' | 'OS12'; architecture?: string }>;
      uninstallACAP: (camera: any, appName: string) => Promise<any>;
      listInstalledACAPs: (camera: any) => Promise<string[]>;
      configureCamera: (camera: any, config: any) => Promise<any>;
      pushCameraSettings: (ip: string, username: string, password: string, configPayload: any) => Promise<any>;
      getCameraSettings: (ip: string, username: string, password: string) => Promise<any>;
      getSceneDescription: (camera: any, apiKey: string, includeSpeaker?: boolean) => Promise<any>;
      activateLicenseKey: (ip: string, username: string, password: string, licenseKey: string, applicationName: string) => Promise<void>;
      getNetworkInterfaces: () => Promise<any[]>;
      // Speaker-related APIs
      camera: {
        testSpeaker: (speakerIp: string, username: string, password: string) => Promise<any>;
        configureSpeaker: (cameraIp: string, speakerIp: string, username: string, password: string) => Promise<any>;
        playSpeakerAudio: (speakerIp: string, username: string, password: string, audioFile: string) => Promise<any>;
      };
      // ACAP download APIs
      acap: {
        getReleases: () => Promise<any[]>;
        download: (release: any) => Promise<any>;
        getLocalPath: (filename: string) => Promise<string>;
      };
      // Config cache APIs
      config: {
        getCached: () => Promise<any>;
        getAllCached: () => Promise<any[]>;
        clearCached: () => Promise<boolean>;
      };
      // Magical experience APIs
      magical: {
        generateApiKey: () => Promise<{
          success: boolean;
          apiKey?: string;
          projectId?: string;
          needsManual?: boolean;
          message?: string;
          error?: string;
        }>;
        startExperience: (apiKey: string, anavaKey?: string) => Promise<{
          success: boolean;
          camera?: any;
          firstInsight?: string;
          error?: string;
          apiKey?: string;
        }>;
        analyzeCustom: (params: { query: string; camera: any }) => Promise<{
          success: boolean;
          response?: string;
          error?: string;
        }>;
        cancel: () => Promise<{ success: boolean }>;
        subscribe: () => void;
        onProgress: (callback: (progress: {
          stage: 'discovering' | 'configuring' | 'awakening' | 'analyzing' | 'complete' | 'error';
          message: string;
          progress: number;
          detail?: string;
        }) => void) => void;
        onCancelled: (callback: () => void) => void;
        connectToCamera: (params: { 
          apiKey: string; 
          ip: string; 
          username: string; 
          password: string; 
          anavaKey?: string;
        }) => Promise<{
          success: boolean;
          camera?: any;
          error?: string;
        }>;
      };
      // License Key Management APIs
      license: {
        getAssignedKey: () => Promise<{
          success: boolean;
          key?: string;
          email?: string;
          error?: string;
        }>;
        assignKey: (params: {
          firebaseConfig: any;
          email: string;
          password: string;
        }) => Promise<{
          success: boolean;
          key?: string;
          email?: string;
          alreadyAssigned?: boolean;
          error?: string;
        }>;
        assignWithGoogle: (params: {
          idToken: string;
          firebaseConfig: any;
        }) => Promise<{
          success: boolean;
          key?: string;
          email?: string;
          alreadyAssigned?: boolean;
          error?: string;
        }>;
        assignWithFirebaseGoogle: (params: {
          googleIdToken: string;
          googleAccessToken: string;
          firebaseConfig: any;
        }) => Promise<{
          success: boolean;
          key?: string;
          email?: string;
          alreadyAssigned?: boolean;
          error?: string;
        }>;
        setManualKey: (params: { 
          key: string; 
          email?: string;
        }) => Promise<{
          success: boolean;
          key?: string;
          email?: string;
          error?: string;
        }>;
        checkAvailability: (firebaseConfig: any) => Promise<{
          success: boolean;
          available?: number;
          total?: number;
          error?: string;
        }>;
      };
      // Config value storage
      setConfigValue: (key: string, value: any) => Promise<{ success: boolean; error?: string }>;
      getConfigValue: (key: string) => Promise<any>;
    };
  }
}

export {};