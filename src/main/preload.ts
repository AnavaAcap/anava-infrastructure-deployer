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
    subscribe: () => ipcRenderer.send('deployment:subscribe'),
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
  },
});