import { app, BrowserWindow, ipcMain, Menu, Notification } from 'electron';
import path from 'path';
// Lazy load heavy services to improve startup performance
import { getLogger } from './utils/logger';
import type { DeploymentEngine } from './services/deploymentEngine';
import type { StateManager } from './services/stateManager';
import type { GCPOAuthService } from './services/gcpOAuthService';
import type { UnifiedAuthService } from './services/unifiedAuthService';

// These will be lazy loaded when needed
let DeploymentEngineClass: typeof import('./services/deploymentEngine').DeploymentEngine;
let StateManagerClass: typeof import('./services/stateManager').StateManager;
let GCPOAuthServiceClass: typeof import('./services/gcpOAuthService').GCPOAuthService;
let UnifiedAuthServiceClass: typeof import('./services/unifiedAuthService').UnifiedAuthService;
let configCacheService: typeof import('./services/configCache').configCacheService;
let fastStartService: typeof import('./services/fastStartService').fastStartService;
let AIStudioServiceClass: typeof import('./services/aiStudioService').AIStudioService;

// Critical: Allow self-signed certificates for camera connections
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Global flag to track camera services initialization
declare global {
  var cameraServicesInitialized: boolean;
}

// Disable certificate errors in Chromium for packaged app
app.commandLine.appendSwitch('ignore-certificate-errors', 'true');
app.commandLine.appendSwitch('allow-insecure-localhost', 'true');

const isDevelopment = process.env.NODE_ENV === 'development' && !app.isPackaged;
const logger = getLogger();

let mainWindow: BrowserWindow | null = null;
let deploymentEngine: DeploymentEngine;
let stateManager: StateManager;
let gcpOAuthService: GCPOAuthService;
let unifiedAuthService: UnifiedAuthService;

// Lazy initialization function for camera services
const initializeCameraServices = async () => {
  if (!global.cameraServicesInitialized) {
    try {
      logger.info('Initializing camera services...');
      
      // Import services one by one to catch individual failures
      const OptimizedCameraDiscoveryService = (await import('./services/camera/optimizedCameraDiscoveryService')).OptimizedCameraDiscoveryService;
      new OptimizedCameraDiscoveryService();
      
      const ACAPDeploymentService = (await import('./services/camera/acapDeploymentService')).ACAPDeploymentService;
      new ACAPDeploymentService();
      
      const ACAPDownloaderService = (await import('./services/camera/acapDownloaderService')).ACAPDownloaderService;
      new ACAPDownloaderService();
      
      const CameraConfigurationService = (await import('./services/camera/cameraConfigurationService')).CameraConfigurationService;
      new CameraConfigurationService();
      
      const ProjectCreatorService = (await import('./services/projectCreatorService')).ProjectCreatorService;
      new ProjectCreatorService(gcpOAuthService);
      
      const AuthTestService = (await import('./services/authTestService')).AuthTestService;
      new AuthTestService();
      
      global.cameraServicesInitialized = true;
      logger.info('Camera services initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize camera services:', error);
      throw error;
    }
  }
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 900,
    minHeight: 700,
    title: 'Anava Vision',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for executing Terraform binaries
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

  // Configure Content Security Policy for Google Sign-In and Firebase Auth
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' blob:; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://*.firebaseapp.com https://*.googleapis.com; " +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "font-src 'self' https://fonts.gstatic.com; " +
          "connect-src 'self' http: https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com wss://*.firebaseio.com; " +
          "img-src 'self' data: https:; " +
          "media-src 'self' blob:; " +
          "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com;"
        ]
      }
    });
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
    const indexPath = path.join(__dirname, '../renderer/index.html');
    console.log(`[Main Process] Loading file from: ${indexPath}`);
    mainWindow.loadFile(indexPath);
    // Open DevTools in production for debugging
    mainWindow.webContents.openDevTools();
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

app.whenReady().then(async () => {
  logger.info('App ready, starting fast initialization...');
  
  // Windows-specific DPI scaling
  if (process.platform === 'win32') {
    app.commandLine.appendSwitch('high-dpi-support', '1');
    app.commandLine.appendSwitch('force-device-scale-factor', '1');
  }
  
  // Initialize services immediately
  // macOS network permissions (only if on macOS)
  if (process.platform === 'darwin') {
    const { macOSNetworkPermission } = await import('./services/macOSNetworkPermission');
    await macOSNetworkPermission.initialize();
  }
  
  // Load core services
  logger.info('Loading core services...');
  [StateManagerClass, GCPOAuthServiceClass, UnifiedAuthServiceClass] = await Promise.all([
    import('./services/stateManager').then(m => m.StateManager),
    import('./services/gcpOAuthService').then(m => m.GCPOAuthService),
    import('./services/unifiedAuthService').then(m => m.UnifiedAuthService)
  ]);
  
  // Initialize essential services
  stateManager = new StateManagerClass();
  gcpOAuthService = new GCPOAuthServiceClass();
  unifiedAuthService = new UnifiedAuthServiceClass();
  
  // Initialize camera services inline
  const { OptimizedCameraDiscoveryService } = await import('./services/camera/optimizedCameraDiscoveryService');
  const { ACAPDeploymentService } = await import('./services/camera/acapDeploymentService');
  const { ACAPDownloaderService } = await import('./services/camera/acapDownloaderService');
  const { CameraConfigurationService } = await import('./services/camera/cameraConfigurationService');
  const { ProjectCreatorService } = await import('./services/projectCreatorService');
  const { AuthTestService } = await import('./services/authTestService');
  
  new OptimizedCameraDiscoveryService();
  new ACAPDeploymentService();
  new ACAPDownloaderService();
  new CameraConfigurationService();
  new ProjectCreatorService(gcpOAuthService);
  new AuthTestService();
  
  // Clear auth cache asynchronously (non-blocking)
  Promise.all([
    gcpOAuthService.logout().catch(err => logger.warn('Auth logout failed:', err)),
    unifiedAuthService.clearAuthCache().catch(err => logger.warn('Clear auth cache failed:', err))
  ]);
  
  logger.info('Core services initialized');
  
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
  
  // Create window after menu setup
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
  // Cleanup OAuth server before quitting
  if (gcpOAuthService) {
    gcpOAuthService.cleanup();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Ensure cleanup happens before quit
  if (gcpOAuthService) {
    gcpOAuthService.cleanup();
  }
});

app.on('will-quit', () => {
  // Final cleanup attempt
  if (gcpOAuthService) {
    gcpOAuthService.cleanup();
  }
});

// IPC Handlers

// Network permission handler for macOS 15
ipcMain.handle('network:request-permission', async () => {
  const { macOSNetworkPermission } = await import('./services/macOSNetworkPermission');
  
  // Show the manual instructions dialog
  await macOSNetworkPermission.showManualInstructions();
  
  return { success: true };
});

ipcMain.handle('network:check-permission', async () => {
  // Check if we have network access
  if (process.platform !== 'darwin') {
    return { hasPermission: true };
  }
  
  // Simple check - try to create a socket
  const net = await import('net');
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(100);
    
    socket.on('error', () => {
      resolve({ hasPermission: false });
    });
    
    socket.on('connect', () => {
      socket.destroy();
      resolve({ hasPermission: true });
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ hasPermission: false });
    });
    
    try {
      socket.connect(80, '192.168.1.1');
    } catch (e) {
      resolve({ hasPermission: false });
    }
  });
});

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
    
    // Focus the main window after successful authentication
    if (result && (result as any).success && mainWindow) {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.focus();
          mainWindow.show();
          if (process.platform === 'darwin') {
            app.focus(); // Additional focus for macOS
          }
        }
      }, 1000); // Small delay to let browser window close
    }
    
    return result;
  } catch (error: any) {
    console.error('Authentication error:', error);
    console.error('Error stack:', error.stack);
    throw error;
  }
});

ipcMain.handle('auth:logout', async () => {
  // Clear GCP auth
  await gcpOAuthService.logout();
  
  // Clear cached license key
  const { LicenseKeyService } = await import('./services/licenseKeyService');
  const licenseService = new LicenseKeyService();
  licenseService.clearCachedLicenseKey();
  licenseService.dispose();
  
  return { success: true };
});

// Config cache handlers
ipcMain.handle('config:getCached', async () => {
  // Lazy load config cache service
  if (!configCacheService) {
    const module = await import('./services/configCache');
    configCacheService = module.configCacheService;
  }
  const user = await gcpOAuthService.getCurrentUser();
  if (user?.email) {
    return configCacheService.getConfig(user.email);
  }
  return null;
});

ipcMain.handle('config:getAllCached', async () => {
  // Lazy load config cache service
  if (!configCacheService) {
    const module = await import('./services/configCache');
    configCacheService = module.configCacheService;
  }
  return configCacheService.getAllConfigs();
});

ipcMain.handle('config:clearCached', async () => {
  // Lazy load config cache service
  if (!configCacheService) {
    const module = await import('./services/configCache');
    configCacheService = module.configCacheService;
  }
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

// Billing check handlers
ipcMain.handle('billing:check-project', async (_, projectId: string) => {
  const { billingService } = await import('./services/billingService');
  return billingService.checkProjectBilling(projectId);
});

ipcMain.handle('billing:list-accounts', async () => {
  const { billingService } = await import('./services/billingService');
  return billingService.listBillingAccounts();
});

ipcMain.handle('billing:link-account', async (_, projectId: string, billingAccountName: string) => {
  const { billingService } = await import('./services/billingService');
  return billingService.linkBillingAccount(projectId, billingAccountName);
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
  // Lazy load deployment engine
  if (!deploymentEngine) {
    if (!DeploymentEngineClass) {
      const module = await import('./services/deploymentEngine');
      DeploymentEngineClass = module.DeploymentEngine;
    }
    deploymentEngine = new DeploymentEngineClass(stateManager, gcpOAuthService);
  }
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

ipcMain.on('deployment:subscribe', async (event) => {
  // Ensure deployment engine is loaded
  if (!deploymentEngine) {
    if (!DeploymentEngineClass) {
      const module = await import('./services/deploymentEngine');
      DeploymentEngineClass = module.DeploymentEngine;
    }
    deploymentEngine = new DeploymentEngineClass(stateManager, gcpOAuthService);
  }
  
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
        // Lazy load config cache service
        if (!configCacheService) {
          const module = await import('./services/configCache');
          configCacheService = module.configCacheService;
        }
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
    // Check if authenticated first before trying to get user
    if (!gcpOAuthService.oauth2Client || !gcpOAuthService.isAuthenticated()) {
      logger.info('[Magical] User not authenticated with Google, will need manual API key creation');
      return { 
        success: false, 
        needsManual: true,
        message: 'Google authentication required for automatic API key generation'
      };
    }

    let user;
    try {
      user = await gcpOAuthService.getCurrentUser();
    } catch (error) {
      logger.warn('[Magical] Could not get current user, likely not authenticated');
      return { 
        success: false, 
        needsManual: true,
        message: 'Please sign in with Google or create an API key manually'
      };
    }
    
    if (!user) {
      return { 
        success: false, 
        needsManual: true,
        message: 'No user authenticated'
      };
    }

    // Check for existing project or use AI Studio without project
    const projects = await gcpOAuthService.listProjects();
    let projectId = null;
    
    if (projects && projects.length > 0) {
      // Use the first available project
      projectId = projects[0].projectId;
    }

    // Lazy load AI Studio service
    if (!AIStudioServiceClass) {
      const module = await import('./services/aiStudioService');
      AIStudioServiceClass = module.AIStudioService;
    }
    const aiStudioService = new AIStudioServiceClass(gcpOAuthService.oauth2Client);
    
    if (projectId) {
      try {
        // Enable required APIs
        await aiStudioService.enableGenerativeLanguageAPI(projectId);
        
        // Also enable API Keys API if needed
        try {
          // Lazy load googleapis only when needed
          const { google } = await import('googleapis');
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

ipcMain.handle('magical:start-experience', async (_, apiKey: string, anavaKey?: string) => {
  try {
    logger.info('Starting magical experience with user API key...');
    if (anavaKey) {
      logger.info('Anava license key provided for automatic activation');
    }
    
    // Lazy load fast start service and camera services
    if (!fastStartService) {
      const module = await import('./services/fastStartService');
      fastStartService = module.fastStartService;
    }
    
    // Initialize camera services if not already done
    await initializeCameraServices();
    
    // Subscribe to progress events
    const progressHandler = (progress: any) => {
      mainWindow?.webContents.send('magical:progress', progress);
    };
    
    fastStartService.on('progress', progressHandler);
    
    const result = await fastStartService.startMagicalExperience(apiKey, anavaKey);
    
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
    // Lazy load fast start service
    if (!fastStartService) {
      const module = await import('./services/fastStartService');
      fastStartService = module.fastStartService;
    }
    
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
  anavaKey?: string;
}) => {
  try {
    logger.info(`Connecting to camera at ${params.ip} with ${params.username}...`);
    if (params.anavaKey) {
      logger.info('Anava license key provided for manual connection');
    }
    
    // Lazy load fast start service and camera services
    if (!fastStartService) {
      const module = await import('./services/fastStartService');
      fastStartService = module.fastStartService;
    }
    
    // Initialize camera services if not already done
    await initializeCameraServices();
    
    // Subscribe to progress events
    const progressHandler = (progress: any) => {
      mainWindow?.webContents.send('magical:progress', progress);
    };
    
    fastStartService.on('progress', progressHandler);
    
    const result = await fastStartService.connectToSpecificCamera(
      params.apiKey,
      params.ip,
      params.username,
      params.password,
      params.anavaKey
    );
    
    // Clean up listener
    fastStartService.off('progress', progressHandler);
    
    return result;
  } catch (error: any) {
    logger.error('Manual camera connection failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.on('magical:subscribe', async (event) => {
  // Lazy load fast start service if needed
  if (!fastStartService) {
    const module = await import('./services/fastStartService');
    fastStartService = module.fastStartService;
  }
  
  // Cancelled
  fastStartService.on('cancelled', () => {
    event.sender.send('magical:cancelled');
  });
});

ipcMain.handle('magical:cancel', async () => {
  // Only cancel if service is loaded
  if (fastStartService) {
    fastStartService.cancel();
  }
  return { success: true };
});

// License Key Management IPC Handlers
ipcMain.handle('license:get-assigned-key', async () => {
  try {
    const { LicenseKeyService } = await import('./services/licenseKeyService');
    const licenseService = new LicenseKeyService();
    
    // Check for cached key first
    const cached = await licenseService.getCachedLicenseKey();
    if (cached) {
      logger.info('Returning cached license key');
      return { success: true, key: cached.key, email: cached.email };
    }
    
    // If no cached key, user needs to authenticate
    return { success: false, error: 'No license key assigned. Please sign in.' };
  } catch (error: any) {
    logger.error('Failed to get license key:', error);
    return { success: false, error: error.message };
  }
});

// NEW: Proper Firebase Google Auth handler
ipcMain.handle('license:assign-with-firebase-google', async (_, params: {
  googleIdToken: string;
  googleAccessToken: string;
  firebaseConfig: any;
}) => {
  try {
    // Log tokens for testing
    console.log('\n=== TOKENS FOR TESTING ===');
    console.log('Copy and run this command:');
    console.log(`node test-firebase-auth.js "${params.googleIdToken}" "${params.googleAccessToken}"`);
    console.log('===========================\n');
    
    const { FirebaseAuthService } = await import('./services/firebaseAuthService');
    const authService = new FirebaseAuthService();
    
    // Initialize Firebase
    await authService.initialize(params.firebaseConfig);
    
    // Sign in with Google tokens (both ID and access token)
    await authService.signInWithGoogleTokens(params.googleIdToken, params.googleAccessToken);
    
    // Request license key (will return existing or assign new)
    const result = await authService.requestLicenseKey();
    
    // Clean up
    authService.dispose();
    
    return {
      success: true,
      key: result.key,
      email: result.email,
      alreadyAssigned: result.alreadyAssigned
    };
  } catch (error: any) {
    logger.error('Failed to assign license with Firebase Google Auth:', error);
    return { success: false, error: error.message };
  }
});

// DEPRECATED: Old email/password handler (kept for backwards compatibility)
ipcMain.handle('license:assign-key', async (_, params: { 
  firebaseConfig: any;
  email: string;
  password: string;
}) => {
  try {
    const { LicenseKeyService } = await import('./services/licenseKeyService');
    const licenseService = new LicenseKeyService();
    
    // Initialize with Firebase config
    await licenseService.initialize(params.firebaseConfig);
    
    // Create user or sign in if already exists
    await licenseService.createOrSignInUser(params.email, params.password);
    
    // Request license key assignment
    const result = await licenseService.assignLicenseKey();
    
    // Cache the key
    await licenseService.cacheLicenseKey(result.key, result.email);
    
    // Clean up
    licenseService.dispose();
    
    return { 
      success: true, 
      key: result.key, 
      email: result.email,
      alreadyAssigned: result.alreadyAssigned 
    };
  } catch (error: any) {
    logger.error('Failed to assign license key:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('license:check-availability', async (_, firebaseConfig: any) => {
  try {
    const { LicenseKeyService } = await import('./services/licenseKeyService');
    const licenseService = new LicenseKeyService();
    
    await licenseService.initialize(firebaseConfig);
    const stats = await licenseService.getLicenseStats();
    
    licenseService.dispose();
    
    return { 
      success: true, 
      available: stats.available, 
      total: stats.total 
    };
  } catch (error: any) {
    logger.error('Failed to check license availability:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('license:set-manual-key', async (_, params: { 
  key: string;
  email?: string;
}) => {
  try {
    const { LicenseKeyService } = await import('./services/licenseKeyService');
    const licenseService = new LicenseKeyService();
    
    const result = await licenseService.setManualLicenseKey(params.key, params.email);
    
    licenseService.dispose();
    
    return result;
  } catch (error: any) {
    logger.error('Failed to set manual license key:', error);
    return { success: false, error: error.message };
  }
});

// Unified authentication handler
ipcMain.handle('auth:unified-google', async () => {
  try {
    if (!mainWindow) {
      throw new Error('Main window not available');
    }
    
    // Check for existing valid auth first
    const existingAuth = await unifiedAuthService.getStoredAuth();
    if (existingAuth) {
      return existingAuth;
    }
    
    // Perform new authentication
    const result = await unifiedAuthService.authenticate(mainWindow);
    return result;
  } catch (error: any) {
    logger.error('Unified authentication failed:', error);
    return { success: false, error: error.message };
  }
});

// Unified auth sign out
ipcMain.handle('auth:unified-signout', async () => {
  try {
    await unifiedAuthService.signOut();
    return { success: true };
  } catch (error: any) {
    logger.error('Sign out failed:', error);
    return { success: false, error: error.message };
  }
});

// Google Sign-In license assignment
ipcMain.handle('license:assign-with-google', async (_, params: {
  idToken: string;
  firebaseConfig: any;
}) => {
  try {
    const { GoogleLicenseService } = await import('./services/googleLicenseService');
    const googleLicenseService = new GoogleLicenseService();
    
    const result = await googleLicenseService.assignLicenseWithGoogle(params);
    
    return result;
  } catch (error: any) {
    logger.error('Failed to assign license with Google:', error);
    return { success: false, error: error.message };
  }
});

// Config value handlers for license key caching
ipcMain.handle('config:set-value', async (_, key: string, value: any) => {
  try {
    const userDataPath = app.getPath('userData');
    const configPath = path.join(userDataPath, 'config.json');
    
    let config: any = {};
    try {
      const fs = await import('fs');
      const data = await fs.promises.readFile(configPath, 'utf8');
      config = JSON.parse(data);
    } catch (err) {
      // Config doesn't exist yet
    }
    
    config[key] = value;
    
    const fs = await import('fs');
    await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
    
    return { success: true };
  } catch (error: any) {
    logger.error('Failed to set config value:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('config:get-value', async (_, key: string) => {
  try {
    const userDataPath = app.getPath('userData');
    const configPath = path.join(userDataPath, 'config.json');
    
    const fs = await import('fs');
    const data = await fs.promises.readFile(configPath, 'utf8');
    const config = JSON.parse(data);
    
    return config[key];
  } catch (error) {
    // Config doesn't exist or key not found
    return null;
  }
});