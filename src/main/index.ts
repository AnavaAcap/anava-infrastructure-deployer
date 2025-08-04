import { app, BrowserWindow, ipcMain, Menu, Notification } from 'electron';
import path from 'path';
import { DeploymentEngine } from './services/deploymentEngine';
import { StateManager } from './services/stateManager';
import { GCPOAuthService } from './services/gcpOAuthService';
import { OptimizedCameraDiscoveryService } from './services/camera/optimizedCameraDiscoveryService';
import { ACAPDeploymentService } from './services/camera/acapDeploymentService';
import { ACAPDownloaderService } from './services/camera/acapDownloaderService';
import { CameraConfigurationService } from './services/camera/cameraConfigurationService';
import { ProjectCreatorService } from './services/projectCreatorService';
import { AuthTestService } from './services/authTestService';
import { getLogger } from './utils/logger';
import { configCacheService } from './services/configCache';
import { fastStartService } from './services/fastStartService';
import { AIStudioService } from './services/aiStudioService';
import { google } from 'googleapis';

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
    icon: process.platform === 'win32' 
      ? path.join(__dirname, '../../assets/icon.ico')
      : path.join(__dirname, '../../assets/icon.png'),
    backgroundColor: '#FAFAFA',
    show: false, // Don't show until ready
    // Windows-specific title bar customization
    ...(process.platform === 'win32' && {
      titleBarOverlay: {
        color: '#FAFAFA',
        symbolColor: '#333333',
        height: 32
      }
    })
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

// Windows Defender check function
function checkWindowsDefender() {
  try {
    const installPath = app.getPath('exe');
    // Check if running from Program Files or another system directory
    if (installPath.includes('Program Files') || installPath.includes('Program Files (x86)')) {
      // Show notification about potential Windows Defender interference
      setTimeout(() => {
        new Notification({
          title: 'Windows Security Notice',
          body: 'If deployment is slow, consider adding Anava Vision to Windows Defender exclusions for better performance.',
          icon: path.join(__dirname, '../../assets/icon.ico')
        }).show();
      }, 5000); // Show after 5 seconds to not overwhelm on startup
    }
  } catch (error) {
    // Silent fail - not critical
    logger.debug('Windows Defender check failed:', error);
  }
}

app.whenReady().then(() => {
  logger.info('App ready, initializing services...');
  
  // Windows-specific DPI scaling
  if (process.platform === 'win32') {
    app.commandLine.appendSwitch('high-dpi-support', '1');
    app.commandLine.appendSwitch('force-device-scale-factor', '1');
  }
  
  // Initialize services
  stateManager = new StateManager();
  gcpOAuthService = new GCPOAuthService();
  deploymentEngine = new DeploymentEngine(stateManager, gcpOAuthService);
  
  // Initialize camera services
  // Only use one discovery service to avoid duplicate IPC handlers
  new OptimizedCameraDiscoveryService();
  new ACAPDeploymentService();
  new ACAPDownloaderService();
  new CameraConfigurationService();
  new ProjectCreatorService(gcpOAuthService);
  new AuthTestService();
  
  // Setup Windows Jump List
  if (process.platform === 'win32') {
    app.setJumpList([
      {
        type: 'custom',
        name: 'Recent Actions',
        items: [
          {
            type: 'task',
            title: 'New Deployment',
            description: 'Start a new infrastructure deployment',
            program: process.execPath,
            args: '--new-deployment',
            iconPath: process.execPath,
            iconIndex: 0
          },
          {
            type: 'task',
            title: 'Discover Cameras',
            description: 'Scan network for cameras',
            program: process.execPath,
            args: '--discover-cameras',
            iconPath: process.execPath,
            iconIndex: 0
          }
        ]
      },
      {
        type: 'recent'
      }
    ]);
  }

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
  
  // Check for Windows Defender potential issues
  if (process.platform === 'win32') {
    checkWindowsDefender();
  }
  
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
    
    // Update Windows taskbar progress
    if (process.platform === 'win32' && mainWindow) {
      const overallProgress = progress.overallProgress / 100;
      mainWindow.setProgressBar(overallProgress);
    }
  });

  deploymentEngine.on('error', (error) => {
    event.sender.send('deployment:error', error);
    
    // Flash taskbar on error (Windows)
    if (process.platform === 'win32' && mainWindow) {
      mainWindow.flashFrame(true);
      mainWindow.setProgressBar(-1); // Remove progress bar
    }
  });

  deploymentEngine.on('complete', async (result) => {
    event.sender.send('deployment:complete', result);
    
    // Clear Windows taskbar progress on completion
    if (process.platform === 'win32' && mainWindow) {
      mainWindow.setProgressBar(-1); // Remove progress bar
      // Show completion notification
      new Notification({
        title: 'Deployment Complete',
        body: 'Your Anava Vision deployment has completed successfully!',
        icon: path.join(__dirname, '../../assets/icon.ico')
      }).show();
    }
    
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

// Magical Experience IPC Handlers
ipcMain.handle('magical:generate-api-key', async () => {
  try {
    if (!gcpOAuthService.oauth2Client) {
      throw new Error('Not authenticated');
    }

    const user = await gcpOAuthService.getCurrentUser();
    if (!user) {
      throw new Error('No user authenticated');
    }

    // Check for existing project or use AI Studio without project
    const projects = await gcpOAuthService.listProjects();
    let projectId = null;
    
    if (projects && projects.length > 0) {
      // Use the first available project
      projectId = projects[0].projectId;
    }

    const aiStudioService = new AIStudioService(gcpOAuthService.oauth2Client);
    
    if (projectId) {
      try {
        // Enable required APIs
        await aiStudioService.enableGenerativeLanguageAPI(projectId);
        
        // Also enable API Keys API if needed
        try {
          const serviceusage = google.serviceusage({ version: 'v1', auth: gcpOAuthService.oauth2Client });
          await serviceusage.services.enable({
            name: `projects/${projectId}/services/apikeys.googleapis.com`,
          });
          logger.info('[Magical] API Keys API enabled');
        } catch (err: any) {
          if (!err.message?.includes('already enabled')) {
            logger.warn('[Magical] Could not enable API Keys API:', err.message);
          }
        }
        
        const apiKey = await aiStudioService.getOrCreateAPIKey(projectId);
        
        if (apiKey) {
          logger.info('[Magical] Successfully generated/retrieved API key');
          return { success: true, apiKey, projectId };
        } else {
          logger.warn('[Magical] API key creation returned null, attempting retry...');
          // Try one more time with a delay
          await new Promise(resolve => setTimeout(resolve, 3000));
          const retryKey = await aiStudioService.getOrCreateAPIKey(projectId);
          if (retryKey) {
            return { success: true, apiKey: retryKey, projectId };
          }
        }
      } catch (keyError: any) {
        logger.error('[Magical] Error during API key generation:', keyError);
        // Don't immediately fall back to manual - return the error
        return { 
          success: false, 
          error: `Failed to generate API key: ${keyError.message}`,
          needsManual: false // Let the UI decide when to show manual option
        };
      }
    }
    
    // Only open manual creation as absolute last resort
    logger.info('[Magical] No project available or multiple failures, falling back to manual creation');
    await aiStudioService.openAIStudioConsole();
    return { 
      success: false, 
      needsManual: true,
      message: 'Please create an API key in AI Studio and paste it below'
    };
    
  } catch (error: any) {
    logger.error('Failed to generate API key:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('magical:start-experience', async (_, apiKey: string) => {
  try {
    logger.info('Starting magical experience with user API key...');
    
    // Subscribe to progress events
    const progressHandler = (progress: any) => {
      mainWindow?.webContents.send('magical:progress', progress);
    };
    
    fastStartService.on('progress', progressHandler);
    
    const result = await fastStartService.startMagicalExperience(apiKey);
    
    // Clean up listener
    fastStartService.off('progress', progressHandler);
    
    return result;
  } catch (error: any) {
    logger.error('Magical experience failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('magical:analyze-custom', async (_, params: {
  query: string;
  camera: any;
}) => {
  try {
    const response = await fastStartService.processUserQuery(params.query, params.camera);
    return { success: true, response };
  } catch (error: any) {
    logger.error('Custom analysis failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('magical:connect-to-camera', async (_, params: {
  apiKey: string;
  ip: string;
  username: string;
  password: string;
}) => {
  try {
    logger.info(`Connecting to camera at ${params.ip} with ${params.username}...`);
    
    // Subscribe to progress events
    const progressHandler = (progress: any) => {
      mainWindow?.webContents.send('magical:progress', progress);
    };
    
    fastStartService.on('progress', progressHandler);
    
    const result = await fastStartService.connectToSpecificCamera(
      params.apiKey,
      params.ip,
      params.username,
      params.password
    );
    
    // Clean up listener
    fastStartService.off('progress', progressHandler);
    
    return result;
  } catch (error: any) {
    logger.error('Manual camera connection failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.on('magical:subscribe', (event) => {
  // Cancelled
  fastStartService.on('cancelled', () => {
    event.sender.send('magical:cancelled');
  });
});

ipcMain.handle('magical:cancel', async () => {
  fastStartService.cancel();
  return { success: true };
});