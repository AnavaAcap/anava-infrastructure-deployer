import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  auth: {
    check: () => ipcRenderer.invoke('auth:check'),
    login: () => ipcRenderer.invoke('auth:login'),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getProjects: () => ipcRenderer.invoke('auth:get-projects'),
    // Unified authentication
    unifiedGoogle: () => ipcRenderer.invoke('auth:unified-google'),
    unifiedSignOut: () => ipcRenderer.invoke('auth:unified-signout'),
  },
  state: {
    get: () => ipcRenderer.invoke('state:get'),
    checkExisting: (projectId: string) => ipcRenderer.invoke('state:check-existing', projectId),
  },
  deployment: {
    start: (config: any) => ipcRenderer.invoke('deployment:start', config),
    resume: (deploymentId: string) => ipcRenderer.invoke('deployment:resume', deploymentId),
    pause: () => ipcRenderer.invoke('deployment:pause'),
    onProgress: (callback: (progress: any) => void) => {
      const handler = (_: any, progress: any) => callback(progress);
      ipcRenderer.on('deployment:progress', handler);
      return () => ipcRenderer.removeListener('deployment:progress', handler);
    },
    onError: (callback: (error: any) => void) => {
      const handler = (_: any, error: any) => callback(error);
      ipcRenderer.on('deployment:error', handler);
      return () => ipcRenderer.removeListener('deployment:error', handler);
    },
    onComplete: (callback: (result: any) => void) => {
      const handler = (_: any, result: any) => callback(result);
      ipcRenderer.on('deployment:complete', handler);
      return () => ipcRenderer.removeListener('deployment:complete', handler);
    },
    onLog: (callback: (message: string) => void) => {
      const handler = (_: any, message: string) => callback(message);
      ipcRenderer.on('deployment:log', handler);
      return () => ipcRenderer.removeListener('deployment:log', handler);
    },
    subscribe: () => ipcRenderer.send('deployment:subscribe'),
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
  },
  billing: {
    checkProject: (projectId: string) => ipcRenderer.invoke('billing:check-project', projectId),
    listAccounts: () => ipcRenderer.invoke('billing:list-accounts'),
    linkAccount: (projectId: string, billingAccountName: string) => 
      ipcRenderer.invoke('billing:link-account', projectId, billingAccountName),
  },
  createFirebaseUser: (params: { projectId: string; email: string; password: string; apiKey: string }) => 
    ipcRenderer.invoke('firebase:create-user', params),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  validateDeployment: (params: {
    apiGatewayUrl: string;
    apiKey: string;
    firebaseApiKey: string;
  }) => ipcRenderer.invoke('deployment:validate', params),
  createProject: (config: {
    projectName: string;
    organizationId?: string;
    billingAccountId?: string;
  }) => ipcRenderer.invoke('create-project', config),
  listOrganizations: () => ipcRenderer.invoke('list-organizations'),
  listBillingAccounts: () => ipcRenderer.invoke('list-billing-accounts'),
  testAuthStep: (params: any) => ipcRenderer.invoke('test-auth-step', params),
  // Camera-related APIs
  camera: {
    getPreDiscoveredCameras: () => ipcRenderer.invoke('get-pre-discovered-cameras'),
    clearPreDiscoveredCameras: () => ipcRenderer.invoke('clear-pre-discovered-cameras'),
    classifyAxisDevices: (credentials: { username: string; password: string }) => 
      ipcRenderer.invoke('classify-axis-devices', credentials),
  },
  scanNetworkCameras: (options?: { networkRange?: string }) => 
    ipcRenderer.invoke('scan-network-cameras', options),
  enhancedScanNetwork: (options?: { 
    networkRange?: string;
    concurrent?: number;
    timeout?: number;
    ports?: number[];
    useServiceDiscovery?: boolean;
    credentials?: Array<{ username: string; password: string }>;
  }) => ipcRenderer.invoke('enhanced-scan-network', options),
  discoverServiceCameras: () => ipcRenderer.invoke('discover-service-cameras'),
  onCameraScanProgress: (callback: (data: { ip: string; status: string }) => void) => {
    ipcRenderer.on('camera-scan-progress', (_, data) => callback(data));
    // Return cleanup function
    return () => ipcRenderer.removeAllListeners('camera-scan-progress');
  },
  onCameraDiscovered: (callback: (camera: any) => void) => {
    ipcRenderer.on('camera-discovered', (_, camera) => callback(camera));
    // Return cleanup function
    return () => ipcRenderer.removeAllListeners('camera-discovered');
  },
  quickScanCamera: (ip: string, username: string, password: string) => 
    ipcRenderer.invoke('quick-scan-camera', ip, username, password),
  testCameraCredentials: (cameraId: string, ip: string, username: string, password: string) =>
    ipcRenderer.invoke('test-camera-credentials', cameraId, ip, username, password),
  deployACAP: (camera: any, acapPath: string) => ipcRenderer.invoke('deploy-acap', camera, acapPath),
  deployACAPAuto: (camera: any, availableAcaps: any[]) => ipcRenderer.invoke('deploy-acap-auto', camera, availableAcaps),
  getCameraFirmware: (camera: any) => ipcRenderer.invoke('get-camera-firmware', camera),
  uninstallACAP: (camera: any, appName: string) => ipcRenderer.invoke('uninstall-acap', camera, appName),
  listInstalledACAPs: (camera: any) => ipcRenderer.invoke('list-installed-acaps', camera),
  configureCamera: (camera: any, config: any) => ipcRenderer.invoke('configure-camera', camera, config),
  pushCameraSettings: (ip: string, username: string, password: string, configPayload: any) =>
    ipcRenderer.invoke('push-camera-settings', ip, username, password, configPayload),
  pushSystemConfig: (params: { cameraIp: string; username: string; password: string; systemConfig: any }) =>
    ipcRenderer.invoke('push-system-config', params.cameraIp, params.username, params.password, params.systemConfig),
  getCameraSettings: (ip: string, username: string, password: string) =>
    ipcRenderer.invoke('get-camera-settings', ip, username, password),
  getSceneDescription: (camera: any, apiKey: string, includeSpeaker?: boolean) =>
    ipcRenderer.invoke('get-scene-description', camera, apiKey, includeSpeaker),
  activateLicenseKey: (ip: string, username: string, password: string, licenseKey: string, applicationName: string, macAddress?: string | null) =>
    ipcRenderer.invoke('activate-license-key', ip, username, password, licenseKey, applicationName, macAddress),
  testSpeakerAudio: (speakerIp: string, username: string, password: string) =>
    ipcRenderer.invoke('testSpeakerAudio', speakerIp, username, password),
  getNetworkInterfaces: () => ipcRenderer.invoke('get-network-interfaces'),
  // ACAP download APIs
  acap: {
    getReleases: () => ipcRenderer.invoke('acap:get-releases'),
    download: (release: any) => ipcRenderer.invoke('acap:download', release),
    downloadToUser: (release: any) => ipcRenderer.invoke('acap:download-to-user', release),
    getLocalPath: (filename: string) => ipcRenderer.invoke('acap:get-local-path', filename),
  },
  // Config cache APIs
  config: {
    getCached: () => ipcRenderer.invoke('config:getCached'),
    getAllCached: () => ipcRenderer.invoke('config:getAllCached'),
    clearCached: () => ipcRenderer.invoke('config:clearCached'),
  },
  // Magical experience APIs
  magical: {
    generateApiKey: () => ipcRenderer.invoke('magical:generate-api-key'),
    startExperience: (apiKey: string, anavaKey?: string) => ipcRenderer.invoke('magical:start-experience', apiKey, anavaKey),
    connectToCamera: (params: { apiKey: string; ip: string; username: string; password: string; anavaKey?: string }) => 
      ipcRenderer.invoke('magical:connect-to-camera', params),
    analyzeCustom: (params: { query: string; camera: any }) => 
      ipcRenderer.invoke('magical:analyze-custom', params),
    cancel: () => ipcRenderer.invoke('magical:cancel'),
    subscribe: () => ipcRenderer.send('magical:subscribe'),
    onProgress: (callback: (progress: any) => void) => {
      ipcRenderer.on('magical:progress', (_, progress) => callback(progress));
    },
    onCancelled: (callback: () => void) => {
      ipcRenderer.on('magical:cancelled', callback);
    },
  },
  // License Key Management APIs
  license: {
    getAssignedKey: () => ipcRenderer.invoke('license:get-assigned-key'),
    assignKey: (params: { firebaseConfig: any; email: string; password: string }) => 
      ipcRenderer.invoke('license:assign-key', params),
    assignWithGoogle: (params: { idToken: string; firebaseConfig: any }) =>
      ipcRenderer.invoke('license:assign-with-google', params),
    assignWithFirebaseGoogle: (params: { googleIdToken: string; googleAccessToken: string; firebaseConfig: any }) =>
      ipcRenderer.invoke('license:assign-with-firebase-google', params),
    checkAvailability: (firebaseConfig: any) => ipcRenderer.invoke('license:check-availability', firebaseConfig),
    setManualKey: (params: { key: string; email?: string }) => 
      ipcRenderer.invoke('license:set-manual-key', params),
  },
  // Config value storage
  setConfigValue: (key: string, value: any) => ipcRenderer.invoke('config:set-value', key, value),
  getConfigValue: (key: string) => ipcRenderer.invoke('config:get-value', key),
});