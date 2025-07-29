import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import path from 'path';
import { DeploymentEngine } from './services/deploymentEngine';
import { StateManager } from './services/stateManager';
import { GCPOAuthService } from './services/gcpOAuthService';
import { CameraDiscoveryService } from './services/camera/cameraDiscoveryService';
import { ACAPDeploymentService } from './services/camera/acapDeploymentService';
import { ACAPDownloaderService } from './services/camera/acapDownloaderService';
import { CameraConfigurationService } from './services/camera/cameraConfigurationService';
import { ProjectCreatorService } from './services/projectCreatorService';
import { AuthTestService } from './services/authTestService';
import { getLogger } from './utils/logger';
import { configCacheService } from './services/configCache';

const isDevelopment = process.env.NODE_ENV === 'development' && !app.isPackaged;
const logger = getLogger();

let mainWindow: BrowserWindow | null = null;
let deploymentEngine: DeploymentEngine;
let stateManager: StateManager;
let gcpOAuthService: GCPOAuthService;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Anava Vision',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    icon: path.join(__dirname, '../../assets/icon.png'),
    backgroundColor: '#FAFAFA',
    show: false, // Don't show until ready
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
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
    // Open dev tools in development
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  logger.info('App ready, initializing services...');
  
  // Initialize services
  stateManager = new StateManager();
  gcpOAuthService = new GCPOAuthService();
  deploymentEngine = new DeploymentEngine(stateManager, gcpOAuthService);
  
  // Initialize camera services
  new CameraDiscoveryService();
  new ACAPDeploymentService();
  new ACAPDownloaderService();
  new CameraConfigurationService();
  new ProjectCreatorService(gcpOAuthService);
  new AuthTestService();

  // Create application menu with standard shortcuts
  const template: any[] = [
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
  ];

  // Add macOS-specific menu
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services', submenu: [] },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  // Add developer tools in development
  if (isDevelopment) {
    template.push({
      label: 'Developer',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
      ],
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  createWindow();
  
  // Disable right-click context menu in production
  if (!isDevelopment) {
    mainWindow?.webContents.on('context-menu', (e) => {
      e.preventDefault();
    });
  }

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
  console.log('=== AUTH LOGIN CALLED ===');
  console.log('App version:', app.getVersion());
  console.log('Electron version:', process.versions.electron);
  console.log('Platform:', process.platform);
  console.log('User data path:', app.getPath('userData'));
  
  try {
    console.log('Starting authentication...');
    const result = await gcpOAuthService.authenticate();
    console.log('Authentication result:', result ? 'Success' : 'Failed');
    return result;
  } catch (error: any) {
    console.error('Authentication error:', error);
    console.error('Error stack:', error.stack);
    throw error;
  }
});

ipcMain.handle('auth:logout', async () => {
  await gcpOAuthService.logout();
  return { success: true };
});

// Config cache handlers
ipcMain.handle('config:getCached', async () => {
  const user = await gcpOAuthService.getCurrentUser();
  if (user?.email) {
    return configCacheService.getConfig(user.email);
  }
  return null;
});

ipcMain.handle('config:getAllCached', async () => {
  return configCacheService.getAllConfigs();
});

ipcMain.handle('config:clearCached', async () => {
  const user = await gcpOAuthService.getCurrentUser();
  if (user?.email) {
    configCacheService.clearConfig(user.email);
    return true;
  }
  return false;
});

ipcMain.handle('app:get-log-path', () => {
  return logger.getLogFilePath();
});

ipcMain.handle('app:get-version', () => {
  return app.getVersion();
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

  deploymentEngine.on('complete', async (result) => {
    event.sender.send('deployment:complete', result);
    
    // Save the deployment config to cache
    if (result.success) {
      const user = await gcpOAuthService.getCurrentUser();
      const state = stateManager.getState();
      if (state && user?.email) {
        configCacheService.saveConfig(user.email, {
          ...state.configuration,
          apiGatewayUrl: result.apiGatewayUrl,
          apiKey: result.apiKey,
          firebaseConfig: result.firebaseConfig,
          projectId: state.projectId,
          region: state.region,
          aiMode: state.configuration.aiMode,
          anavaKey: state.configuration.anavaKey,
          customerId: state.configuration.customerId,
          aiStudioApiKey: state.configuration.aiStudioApiKey,
          gcsBucketName: result.gcsBucketName,
          timestamp: new Date().toISOString()
        });
      }
    }
  });
  
  deploymentEngine.on('log', (message) => {
    event.sender.send('deployment:log', message);
  });
});

ipcMain.handle('firebase:create-user', async (_, params: { 
  projectId: string; 
  email: string; 
  password: string; 
  apiKey: string 
}) => {
  try {
    const { FirebaseAppDeployer } = await import('./services/firebaseAppDeployer');
    
    if (!gcpOAuthService.oauth2Client) {
      throw new Error('Not authenticated');
    }
    
    const firebaseDeployer = new FirebaseAppDeployer(gcpOAuthService.oauth2Client);
    
    const userId = await firebaseDeployer.createAdminUser(
      params.projectId,
      params.email,
      params.password,
      params.apiKey
    );
    
    return { success: true, userId };
  } catch (error: any) {
    logger.error('Failed to create Firebase user:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to create user' 
    };
  }
});

ipcMain.handle('open-external', async (_, url: string) => {
  const { shell } = await import('electron');
  await shell.openExternal(url);
});

ipcMain.handle('deployment:validate', async (_, params: {
  apiGatewayUrl: string;
  apiKey: string;
  firebaseApiKey: string;
}) => {
  try {
    if (!gcpOAuthService.oauth2Client) {
      throw new Error('Not authenticated');
    }
    
    const { DeploymentValidator } = await import('./services/deploymentValidator');
    const validator = new DeploymentValidator();
    
    const result = await validator.validateDeployment(
      params.apiGatewayUrl,
      params.apiKey,
      params.firebaseApiKey
    );
    
    return result;
  } catch (error: any) {
    logger.error('Validation failed:', error);
    return {
      success: false,
      steps: [],
      error: error.message || 'Validation failed'
    };
  }
});