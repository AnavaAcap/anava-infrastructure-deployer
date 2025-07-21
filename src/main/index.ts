import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { DeploymentEngine } from './services/deploymentEngine';
import { StateManager } from './services/stateManager';
import { GCPAuthService } from './services/gcpAuthService';
import Store from 'electron-store';

const isDevelopment = process.env.NODE_ENV !== 'production';
const store = new Store();

let mainWindow: BrowserWindow | null = null;
let deploymentEngine: DeploymentEngine;
let stateManager: StateManager;
let gcpAuthService: GCPAuthService;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    icon: path.join(__dirname, '../../assets/icon.png'),
  });

  if (isDevelopment) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Initialize services
  stateManager = new StateManager();
  gcpAuthService = new GCPAuthService();
  deploymentEngine = new DeploymentEngine(stateManager, gcpAuthService);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('auth:check', async () => {
  return gcpAuthService.checkAuthentication();
});

ipcMain.handle('auth:get-projects', async () => {
  return gcpAuthService.getProjects();
});

ipcMain.handle('state:get', async () => {
  return stateManager.getState();
});

ipcMain.handle('state:check-existing', async (_, projectId: string) => {
  return stateManager.checkExistingDeployment(projectId);
});

ipcMain.handle('deployment:start', async (_, config: any) => {
  return deploymentEngine.startDeployment(config);
});

ipcMain.handle('deployment:resume', async (_, deploymentId: string) => {
  return deploymentEngine.resumeDeployment(deploymentId);
});

ipcMain.handle('deployment:pause', async () => {
  return deploymentEngine.pauseDeployment();
});

ipcMain.on('deployment:subscribe', (event) => {
  deploymentEngine.on('progress', (progress) => {
    event.sender.send('deployment:progress', progress);
  });

  deploymentEngine.on('error', (error) => {
    event.sender.send('deployment:error', error);
  });

  deploymentEngine.on('complete', (result) => {
    event.sender.send('deployment:complete', result);
  });
});