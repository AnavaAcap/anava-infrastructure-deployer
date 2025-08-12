const { contextBridge, ipcRenderer } = require('electron');

console.log('[Preload] Setting up license activator bridge...');

contextBridge.exposeInMainWorld('electronAPI', {
    // Renderer to Main: Send back the license result
    sendLicenseResult: (result) => {
        console.log('[Preload] Sending license result to main:', result);
        ipcRenderer.send('license-result', result);
    },
    
    // Main to Renderer: Receive license data to activate
    onLicenseData: (callback) => {
        console.log('[Preload] Setting up license data listener');
        ipcRenderer.on('license-data', callback);
    }
});