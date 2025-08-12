const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Test data - UPDATE THESE WITH YOUR VALUES
const TEST_DEVICE_ID = 'B8A44F45D624';
const TEST_LICENSE_CODE = '3GN5UCXY6VECG6ZYRW2A';

function testLicenseActivation(deviceId, licenseCode) {
    return new Promise((resolve, reject) => {
        console.log('\n========== TESTING BROWSERWINDOW LICENSE ACTIVATION ==========');
        console.log('Device ID:', deviceId);
        console.log('License Code:', licenseCode);
        console.log('Creating BrowserWindow...');
        
        const activatorWindow = new BrowserWindow({
            show: true, // Show for debugging
            width: 1200,
            height: 800,
            webPreferences: {
                preload: path.join(__dirname, 'src/main/activator/preload.js'),
                contextIsolation: true,
                nodeIntegration: false,
                webSecurity: false,
                allowRunningInsecureContent: true
            }
        });

        // Always show dev tools for debugging
        activatorWindow.webContents.openDevTools();

        // Load the HTML file
        const htmlPath = path.join(__dirname, 'src/main/activator/activator.html');
        console.log('Loading HTML from:', htmlPath);
        activatorWindow.loadFile(htmlPath);

        // When the window is ready, send it the data
        activatorWindow.webContents.on('did-finish-load', () => {
            console.log('Window loaded, waiting 2 seconds then sending license data...');
            
            // Wait a bit for SDK to potentially load
            setTimeout(() => {
                console.log('Sending license data to renderer...');
                activatorWindow.webContents.send('license-data', {
                    deviceId,
                    licenseCode,
                    applicationId: '415129' // BatonAnalytic
                });
            }, 2000);
        });

        // Listen for the result
        ipcMain.once('license-result', (event, result) => {
            console.log('\n========== RESULT RECEIVED ==========');
            console.log('Success:', result.success);
            
            if (result.success) {
                console.log('License data received!');
                console.log('Data type:', typeof result.data);
                console.log('Data keys:', result.data ? Object.keys(result.data) : 'none');
                
                // Check if we got the XML
                if (result.data && result.data.licenseKey && result.data.licenseKey.xml) {
                    console.log('✅ SUCCESS! Got signed XML');
                    console.log('XML length:', result.data.licenseKey.xml.length);
                    console.log('XML preview (first 500 chars):', result.data.licenseKey.xml.substring(0, 500));
                    
                    // Save XML to file for inspection
                    const fs = require('fs');
                    fs.writeFileSync('license-test-output.xml', result.data.licenseKey.xml);
                    console.log('XML saved to license-test-output.xml');
                    
                    resolve(result.data.licenseKey.xml);
                } else if (result.data && result.data.xml) {
                    console.log('✅ SUCCESS! Got signed XML (direct)');
                    console.log('XML length:', result.data.xml.length);
                    console.log('XML preview (first 500 chars):', result.data.xml.substring(0, 500));
                    
                    // Save XML to file for inspection
                    const fs = require('fs');
                    fs.writeFileSync('license-test-output.xml', result.data.xml);
                    console.log('XML saved to license-test-output.xml');
                    
                    resolve(result.data.xml);
                } else {
                    console.log('⚠️ Got success but no XML found in response');
                    console.log('Full data:', JSON.stringify(result.data, null, 2));
                    resolve(result.data);
                }
            } else {
                console.log('❌ FAILURE:', result.error);
                reject(new Error(result.error || 'Unknown error'));
            }
            
            // Don't close window immediately for debugging
            console.log('Keeping window open for debugging (will close in 30 seconds)...');
            setTimeout(() => {
                if (!activatorWindow.isDestroyed()) {
                    activatorWindow.close();
                }
            }, 30000);
        });

        // Handle errors
        activatorWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
            console.error('❌ Window failed to load:', errorDescription);
            reject(new Error(`Failed to load: ${errorDescription}`));
        });

        // Handle console messages from renderer
        activatorWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
            console.log(`[Renderer Console]: ${message}`);
        });

        // Handle timeout
        setTimeout(() => {
            if (!activatorWindow.isDestroyed()) {
                console.error('❌ Timeout - no response after 60 seconds');
                activatorWindow.close();
                reject(new Error('License activation timed out'));
            }
        }, 60000);
    });
}

// Run the test when Electron is ready
app.whenReady().then(async () => {
    console.log('Electron app ready, starting test...');
    
    try {
        const signedXml = await testLicenseActivation(TEST_DEVICE_ID, TEST_LICENSE_CODE);
        console.log('\n========== TEST SUCCESSFUL ==========');
        console.log('Got signed XML, length:', signedXml.length);
        
        // Exit successfully after a delay
        setTimeout(() => {
            app.quit();
            process.exit(0);
        }, 5000);
    } catch (error) {
        console.error('\n========== TEST FAILED ==========');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        
        // Exit with error after a delay
        setTimeout(() => {
            app.quit();
            process.exit(1);
        }, 5000);
    }
});

// Prevent multiple instances
app.on('window-all-closed', () => {
    // Don't quit automatically, let our test control it
});

// Log any uncaught errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
});