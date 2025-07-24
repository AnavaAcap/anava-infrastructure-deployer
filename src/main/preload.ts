import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  auth: {
    check: () => ipcRenderer.invoke('auth:check'),
    login: () => ipcRenderer.invoke('auth:login'),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getProjects: () => ipcRenderer.invoke('auth:get-projects'),
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
      ipcRenderer.on('deployment:progress', (_, progress) => callback(progress));
    },
    onError: (callback: (error: any) => void) => {
      ipcRenderer.on('deployment:error', (_, error) => callback(error));
    },
    onComplete: (callback: (result: any) => void) => {
      ipcRenderer.on('deployment:complete', (_, result) => callback(result));
    },
    onLog: (callback: (message: string) => void) => {
      ipcRenderer.on('deployment:log', (_, message) => callback(message));
    },
    subscribe: () => ipcRenderer.send('deployment:subscribe'),
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
  },
  createFirebaseUser: (params: { projectId: string; email: string; password: string; apiKey: string }) => 
    ipcRenderer.invoke('firebase:create-user', params),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  // Camera-related APIs
  scanNetworkCameras: () => ipcRenderer.invoke('scan-network-cameras'),
  quickScanCamera: (ip: string, username: string, password: string) => 
    ipcRenderer.invoke('quick-scan-camera', ip, username, password),
  testCameraCredentials: (cameraId: string, ip: string, username: string, password: string) =>
    ipcRenderer.invoke('test-camera-credentials', cameraId, ip, username, password),
  deployACAP: (camera: any, acapPath: string) => ipcRenderer.invoke('deploy-acap', camera, acapPath),
  uninstallACAP: (camera: any, appName: string) => ipcRenderer.invoke('uninstall-acap', camera, appName),
  listInstalledACAPs: (camera: any) => ipcRenderer.invoke('list-installed-acaps', camera),
});