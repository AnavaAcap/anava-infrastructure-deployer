import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { DeploymentEngine } from './services/deploymentEngine';
import { StateManager } from './services/stateManager';
import { GCPOAuthService } from './services/gcpOAuthService';

const isDevelopment = process.env.NODE_ENV !== 'production';

let mainWindow: BrowserWindow | null = null;
let deploymentEngine: DeploymentEngine;
let stateManager: StateManager;
let gcpOAuthService: GCPOAuthService;

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
    // In development, try to connect to Vite dev server
    mainWindow.loadURL('http://localhost:5173').catch(() => {
      // If Vite isn't running, load the built files
      console.log('Vite dev server not running, loading built files...');
      if (mainWindow) {
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
      }
    });
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
  gcpOAuthService = new GCPOAuthService();
  deploymentEngine = new DeploymentEngine(stateManager, gcpOAuthService);

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
  const isAuthenticated = gcpOAuthService.isAuthenticated();
  const user = isAuthenticated ? await gcpOAuthService.getCurrentUser() : null;
  return {
    authenticated: isAuthenticated,
    user: user?.email,
    error: isAuthenticated ? null : 'Not authenticated. Please click "Login with Google".'
  };
});

ipcMain.handle('auth:login', async () => {
  try {
    const result = await gcpOAuthService.authenticate();
    return result;
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('auth:logout', async () => {
  await gcpOAuthService.logout();
  return { success: true };
});

ipcMain.handle('auth:get-projects', async () => {
  return gcpOAuthService.listProjects();
});

ipcMain.handle('state:get', async () => {
  return stateManager.getState();
});

ipcMain.handle('state:check-existing', async (_, projectId: string) => {
  return stateManager.checkExistingDeployment(projectId);
});

ipcMain.handle('state:clear', async () => {
  stateManager.clearState();
  return { success: true };
});

ipcMain.handle('deployment:start', async (_, config: any) => {
  // Always clear state before starting a new deployment
  stateManager.clearState();
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