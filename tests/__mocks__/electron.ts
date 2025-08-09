/**
 * Electron Mock for Unit Tests
 * Provides mock implementations of Electron APIs
 */

export const app = {
  getPath: jest.fn((name: string) => {
    const paths: Record<string, string> = {
      userData: '/tmp/test-user-data',
      temp: '/tmp',
      appData: '/tmp/app-data',
      desktop: '/tmp/desktop',
      documents: '/tmp/documents',
      downloads: '/tmp/downloads',
      home: '/tmp/home'
    };
    return paths[name] || '/tmp';
  }),
  getVersion: jest.fn(() => '1.0.0'),
  getName: jest.fn(() => 'anava-installer'),
  isPackaged: false,
  quit: jest.fn(),
  getLocale: jest.fn(() => 'en-US'),
  getAppPath: jest.fn(() => '/app'),
  on: jest.fn(),
  once: jest.fn(),
  whenReady: jest.fn(() => Promise.resolve()),
};

export const ipcMain = {
  handle: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  removeHandler: jest.fn(),
  removeAllListeners: jest.fn(),
};

export const ipcRenderer = {
  invoke: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  send: jest.fn(),
  sendSync: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn(),
};

export const BrowserWindow = jest.fn().mockImplementation(() => ({
  loadURL: jest.fn(),
  loadFile: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  webContents: {
    send: jest.fn(),
    on: jest.fn(),
    openDevTools: jest.fn(),
    executeJavaScript: jest.fn(),
    session: {
      clearCache: jest.fn(),
      clearStorageData: jest.fn(),
    }
  },
  show: jest.fn(),
  hide: jest.fn(),
  close: jest.fn(),
  focus: jest.fn(),
  isVisible: jest.fn(() => true),
  isMinimized: jest.fn(() => false),
  setMenu: jest.fn(),
}));

export const dialog = {
  showOpenDialog: jest.fn(),
  showSaveDialog: jest.fn(),
  showMessageBox: jest.fn(),
  showErrorBox: jest.fn(),
  showCertificateTrustDialog: jest.fn(),
};

export const shell = {
  openExternal: jest.fn(),
  openPath: jest.fn(),
  showItemInFolder: jest.fn(),
  moveItemToTrash: jest.fn(),
  beep: jest.fn(),
};

export const Menu = {
  buildFromTemplate: jest.fn(),
  setApplicationMenu: jest.fn(),
};

export const MenuItem = jest.fn();

export const Tray = jest.fn().mockImplementation(() => ({
  setToolTip: jest.fn(),
  setContextMenu: jest.fn(),
  on: jest.fn(),
  destroy: jest.fn(),
}));

export const nativeImage = {
  createFromPath: jest.fn(),
  createFromBuffer: jest.fn(),
  createFromDataURL: jest.fn(),
  createEmpty: jest.fn(),
};

export const clipboard = {
  readText: jest.fn(),
  writeText: jest.fn(),
  readImage: jest.fn(),
  writeImage: jest.fn(),
  clear: jest.fn(),
};

export const systemPreferences = {
  isDarkMode: jest.fn(() => false),
  isInvertedColorScheme: jest.fn(() => false),
  isHighContrastColorScheme: jest.fn(() => false),
};

export const net = {
  request: jest.fn(),
  isOnline: jest.fn(() => true),
};

export const session = {
  defaultSession: {
    clearCache: jest.fn(),
    clearStorageData: jest.fn(),
    getCacheSize: jest.fn(() => Promise.resolve(0)),
    clearAuthCache: jest.fn(),
  }
};

// Export as default for import compatibility
export default {
  app,
  ipcMain,
  ipcRenderer,
  BrowserWindow,
  dialog,
  shell,
  Menu,
  MenuItem,
  Tray,
  nativeImage,
  clipboard,
  systemPreferences,
  net,
  session
};