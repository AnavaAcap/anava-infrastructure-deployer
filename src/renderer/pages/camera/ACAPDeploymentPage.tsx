import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Paper,
  Typography,
  Alert,
  AlertTitle,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  TextField,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  CloudUpload as CloudUploadIcon,
  Settings as SettingsIcon,
  Videocam as VideocamIcon,
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
} from '@mui/icons-material';

interface Camera {
  id: string;
  ip: string;
  port?: number;
  type?: string;
  model: string;
  manufacturer?: string;
  mac?: string | null;
  capabilities?: string[];
  discoveredAt?: string;
  status?: 'accessible' | 'requires_auth';
  authenticated?: boolean;
  credentials?: {
    username: string;
    password: string;
  };
  rtspUrl?: string;
  httpUrl?: string;
}

interface DeploymentStatus {
  cameraId: string;
  status: 'pending' | 'deploying' | 'success' | 'error';
  message?: string;
}

interface ACAPDeploymentPageProps {
  cameras: Camera[];
  deploymentConfig: any;
  onComplete: () => void;
  onBack?: () => void;
}

interface CameraCredentials {
  [cameraId: string]: {
    username: string;
    password: string;
  };
}

interface ManualCamera extends Camera {
  isManual?: boolean;
}

export const ACAPDeploymentPage: React.FC<ACAPDeploymentPageProps> = ({
  cameras: initialCameras,
  deploymentConfig,
  onComplete,
  onBack,
}) => {
  console.log('ACAPDeploymentPage render:', { 
    cameras: initialCameras,
    deploymentConfig,
    camerasWithMAC: initialCameras.map(c => ({ id: c.id, mac: c.mac, hasMAC: !!c.mac }))
  });
  const [cameras, setCameras] = useState<ManualCamera[]>(initialCameras);
  const [activeStep, setActiveStep] = useState(0);
  const [deploymentStatus, setDeploymentStatus] = useState<Map<string, DeploymentStatus>>(
    new Map(cameras.map(c => [c.id, { cameraId: c.id, status: 'pending' }]))
  );
  const [configuring, setConfiguring] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [credentials, setCredentials] = useState<CameraCredentials>(
    cameras.reduce((acc, cam) => ({
      ...acc,
      [cam.id]: { username: cam.credentials?.username || 'root', password: cam.credentials?.password || '' }
    }), {})
  );
  const [deploymentLog, setDeploymentLog] = useState<string[]>([]);
  const [cameraIPs, setCameraIPs] = useState<{ [cameraId: string]: string }>(
    cameras.reduce((acc, cam) => ({
      ...acc,
      [cam.id]: cam.ip
    }), {})
  );
  const [licenseFailures, setLicenseFailures] = useState<Map<string, string>>(new Map());

  const steps = [
    {
      label: 'Prepare Cameras',
      description: 'Configure cameras with GCP credentials',
    },
    {
      label: 'Deploy ACAP',
      description: 'Install Anava authentication application',
    },
    {
      label: 'Verify Deployment',
      description: 'Test camera connections',
    },
  ];

  const retryLicenseActivation = async (cameraId: string) => {
    const camera = cameras.find(c => c.id === cameraId);
    if (!camera) return;

    try {
      setDeploymentLog(prev => [...prev, `Retrying license activation for ${camera.model}...`]);
      
      const currentIP = cameraIPs[camera.id] || camera.ip;
      console.log('[DEBUG] Retrying license for camera:', {
        id: camera.id,
        ip: currentIP,
        model: camera.model,
        mac: camera.mac,
        hasMAC: !!camera.mac
      });
      // Retry logic for license activation (camera may be restarting)
      let retryCount = 0;
      const maxRetries = 3;
      let lastError = null;
      
      while (retryCount < maxRetries) {
        try {
          await window.electronAPI.activateLicenseKey(
            currentIP,
            credentials[camera.id].username,
            credentials[camera.id].password,
            deploymentConfig.anavaKey,
            'BatonAnalytic',
            camera.mac // Pass the MAC address for proper device ID
          );
          break; // Success, exit retry loop
          
        } catch (retryError: any) {
          retryCount++;
          lastError = retryError;
          console.log(`[LICENSE RETRY] Attempt ${retryCount}/${maxRetries} failed:`, retryError.message);
          
          // Check if it's a network error (camera restarting)
          if (retryError.message && (
            retryError.message.includes('ECONNREFUSED') ||
            retryError.message.includes('ETIMEDOUT') ||
            retryError.message.includes('503')
          ) && retryCount < maxRetries) {
            console.log(`[LICENSE RETRY] Waiting 10 seconds before retry...`);
            await new Promise(resolve => setTimeout(resolve, 10000));
            continue;
          }
          
          throw retryError;
        }
      }
      
      if (retryCount >= maxRetries && lastError) {
        throw lastError;
      }
      
      // Remove from failures if successful
      setLicenseFailures(prev => {
        const newMap = new Map(prev);
        newMap.delete(cameraId);
        return newMap;
      });
      
      setDeploymentLog(prev => [...prev, `✓ License activated successfully for ${camera.model}`]);
    } catch (error: any) {
      setDeploymentLog(prev => [...prev, `✗ License retry failed: ${error.message}`]);
      setLicenseFailures(prev => new Map(prev).set(cameraId, error.message));
    }
  };

  const configureCameras = async () => {
    setConfiguring(true);
    setError(null);
    setDeploymentLog([]);

    try {
      addLog('Starting camera configuration...');
      
      for (const camera of cameras) {
        const currentIP = cameraIPs[camera.id] || camera.ip;
        addLog(`\n--- Configuring ${camera.model} (${currentIP}) ---`);
        
        try {
          console.log(`[Deploy] Processing camera ${camera.id} - ${camera.model}`);
          // Create camera object with credentials and updated IP
          const cameraWithCreds = {
            ...camera,
            ip: cameraIPs[camera.id] || camera.ip,
            credentials: credentials[camera.id]
          };
          
          const currentIP = cameraIPs[camera.id] || camera.ip;
          addLog(`Connecting to ${currentIP}...`);
          addLog(`Sending GCP configuration to camera...`);
          addLog(`POST https://${currentIP}/local/BatonAnalytic/baton_analytic.cgi?command=setInstallerConfig`);
          
          const result = await window.electronAPI.configureCamera(cameraWithCreds, deploymentConfig);
          
          if (result.success) {
            addLog(`✓ Configuration uploaded successfully`);
            addLog(`✓ Camera ${camera.model} configured with GCP credentials`);
          } else {
            throw new Error(result.error || 'Configuration failed');
          }
        } catch (error: any) {
          addLog(`✗ ERROR: ${error.message}`);
          addLog(`✗ Failed to configure ${camera.model}`);
          throw error;
        }
      }
      
      addLog(`\n=== Configuration completed ===`);
      addLog(`Successfully configured ${cameras.length} camera${cameras.length !== 1 ? 's' : ''}`);
      
      setActiveStep(1);
    } catch (err: any) {
      setError(`Configuration failed: ${err.message}`);
      addLog(`\nERROR: ${err.message}`);
    } finally {
      setConfiguring(false);
    }
  };

  const handleDeployClick = () => {
    console.log('[BUTTON] Deploy button clicked');
    console.log('[BUTTON] Current state:', { activeStep, deploying, cameras: cameras.length });
    window.electronAPI.send('deployment-log', 'info', `[BUTTON] Deploy clicked - step: ${activeStep}, deploying: ${deploying}`);
    
    // Check if any cameras have missing credentials
    const missingCreds = cameras.filter(cam => 
      !credentials[cam.id]?.username || !credentials[cam.id]?.password
    );
    
    if (missingCreds.length > 0) {
      setError('Please enter credentials for all cameras');
      setShowCredentialsDialog(true);
    } else {
      console.log('[BUTTON] All cameras have credentials, starting deployment');
      window.electronAPI.send('deployment-log', 'info', '[BUTTON] Starting deployACAP()');
      deployACAP();
    }
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDeploymentLog(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const addManualCamera = () => {
    const newCamera: ManualCamera = {
      id: `manual-${Date.now()}`,
      ip: '192.168.1.100',
      port: 80,
      type: 'Axis Camera',
      model: 'Manual Camera',
      manufacturer: 'Axis Communications',
      mac: null,
      capabilities: ['HTTP', 'ACAP', 'VAPIX', 'RTSP'],
      discoveredAt: new Date().toISOString(),
      status: 'accessible',
      httpUrl: 'https://192.168.1.100',
      authenticated: false,
      isManual: true
    };
    
    setCameras(prev => [...prev, newCamera]);
    setCameraIPs(prev => ({ ...prev, [newCamera.id]: newCamera.ip }));
    setCredentials(prev => ({ 
      ...prev, 
      [newCamera.id]: { username: 'root', password: '' }
    }));
    setDeploymentStatus(prev => {
      const newMap = new Map(prev);
      newMap.set(newCamera.id, { cameraId: newCamera.id, status: 'pending' });
      return newMap;
    });
  };

  const deployACAP = async () => {
    // AGGRESSIVE LOGGING TO MAIN PROCESS
    window.electronAPI.send('deployment-log', 'info', '=== DEPLOY ACAP FUNCTION CALLED ===');
    window.electronAPI.send('deployment-log', 'info', `Active step: ${activeStep}`);
    window.electronAPI.send('deployment-log', 'info', `Cameras to deploy: ${cameras.length}`);
    window.electronAPI.send('deployment-log', 'info', `Deployment config exists: ${!!deploymentConfig}`);
    
    console.log('[Deploy] Starting deployACAP function');
    console.log('[Deploy] Current activeStep:', activeStep);
    console.log('[Deploy] Deployment status:', Array.from(deploymentStatus.entries()));
    console.log('[Deploy] Deployment config:', deploymentConfig);
    
    // Add defensive check for deployment config
    if (!deploymentConfig || !deploymentConfig.anavaKey) {
      console.error('[Deploy] CRITICAL: No deployment config or anava key!', deploymentConfig);
      setError('Deployment configuration is missing. Please complete GCP setup first.');
      addLog('ERROR: No deployment configuration found. Please complete GCP setup.');
      setDeploying(false);
      return;
    }
    
    setDeploying(true);
    setError(null);
    // Don't clear logs on retry - append instead to preserve history
    if (deploymentLog.length > 0) {
      setDeploymentLog(prev => [...prev, '', '=== Retrying Deployment ===', '']);
    } else {
      setDeploymentLog([]);
    }

    try {
      addLog('Starting ACAP deployment process...');
      
      // First check if we have any downloaded ACAP files
      addLog('Checking for downloaded ACAP packages...');
      const releases = await window.electronAPI.acap.getReleases();
      const downloadedReleases = releases.filter(r => r.isDownloaded);
      
      if (downloadedReleases.length === 0) {
        setError('No ACAP packages downloaded. Please download ACAP packages first.');
        addLog('ERROR: No ACAP packages found. Please go to ACAP Manager to download.');
        return;
      }
      
      addLog(`Found ${downloadedReleases.length} ACAP package(s):`);
      downloadedReleases.forEach(r => {
        addLog(` - ${r.name}`);
      });
      
      // Track successes during deployment
      let successCount = 0;
      let errorCount = 0;
      
      for (const camera of cameras) {
        const currentIP = cameraIPs[camera.id] || camera.ip;
        addLog(`\n--- Deploying to ${camera.model} (${currentIP}) ---`);
        
        setDeploymentStatus(prev => {
          const newMap = new Map(prev);
          newMap.set(camera.id, { cameraId: camera.id, status: 'deploying' });
          return newMap;
        });

        try {
          console.log(`[Deploy] Processing camera ${camera.id} - ${camera.model}`);
          // Create camera object with credentials and updated IP
          const cameraWithCreds = {
            ...camera,
            ip: cameraIPs[camera.id] || camera.ip,
            credentials: credentials[camera.id]
          };
          
          // Validate credentials exist
          if (!cameraWithCreds.credentials || !cameraWithCreds.credentials.username || !cameraWithCreds.credentials.password) {
            addLog(`✗ Missing credentials for ${camera.model}`);
            setDeploymentStatus(prev => {
              const newMap = new Map(prev);
              newMap.set(camera.id, { cameraId: camera.id, status: 'error', message: 'Missing credentials' });
              return newMap;
            });
            continue;
          }
          
          const currentIP = cameraIPs[camera.id] || camera.ip;
          addLog(`Connecting to ${currentIP} with user '${credentials[camera.id].username}'...`);
          
          // First detect firmware version
          addLog(`Detecting camera firmware version...`);
          const firmwareInfo = await window.electronAPI.getCameraFirmware(cameraWithCreds);
          addLog(`Camera firmware: ${firmwareInfo.firmwareVersion} (${firmwareInfo.osVersion})`);
          
          if (firmwareInfo.architecture) {
            addLog(`Camera architecture: ${firmwareInfo.architecture}`);
            if (firmwareInfo.detectionMethod) {
              addLog(`Detection method: ${firmwareInfo.detectionMethod}`);
              
              // Show warning if detection was uncertain
              if (firmwareInfo.detectionMethod.includes('Default') || firmwareInfo.detectionMethod.includes('Inferred')) {
                addLog(`⚠️ WARNING: Architecture detection was uncertain. Please verify this is correct.`);
                // Don't stop deployment but warn the user
              }
            }
          } else {
            addLog(`⚠️ Could not detect camera architecture, using default: aarch64`);
          }
          
          // Deploy appropriate ACAP based on firmware
          addLog(`Selecting appropriate ACAP for ${firmwareInfo.osVersion}...`);
          
          // LOG BEFORE DEPLOYMENT
          window.electronAPI.send('deployment-log', 'info', `About to call deployACAPAuto for camera ${camera.id}`);
          window.electronAPI.send('deployment-log', 'debug', 'Camera details', cameraWithCreds);
          window.electronAPI.send('deployment-log', 'debug', `Number of releases: ${releases.length}`);
          
          console.log('[Deploy] Calling deployACAPAuto for camera:', camera.id);
          let result;
          try {
            result = await window.electronAPI.deployACAPAuto(cameraWithCreds, releases);
            
            // LOG RESULT
            window.electronAPI.send('deployment-log', 'info', `deployACAPAuto returned`, result);
            console.log('[Deploy] deployACAPAuto result:', result);
          } catch (ipcError: any) {
            // LOG ERROR
            window.electronAPI.send('deployment-log', 'error', `IPC Error calling deployACAPAuto: ${ipcError.message}`, ipcError);
            console.error('[Deploy] IPC Error calling deployACAPAuto:', ipcError);
            throw new Error(`IPC communication failed: ${ipcError.message || 'Unknown error'}`);
          }
          
          if (!result) {
            window.electronAPI.send('deployment-log', 'error', 'CRITICAL: deployACAPAuto returned null/undefined');
            console.error('[Deploy] CRITICAL: deployACAPAuto returned null/undefined');
            throw new Error('Deployment returned no result');
          }
          
          // Check for IPC error boundary response format
          if (typeof result === 'object' && 'success' in result && !result.success) {
            window.electronAPI.send('deployment-log', 'error', `Deployment failed: ${result.error || result.message || 'Unknown error'}`);
            console.error('[Deploy] Deployment failed:', result);
            throw new Error(result.error || result.message || 'Deployment failed');
          }
          
          console.log('[Deploy] Checking result.success:', result.success);
          console.log('[Deploy] Full result object:', result);
          
          if (result.success) {
            console.log('[Deploy] >>> SUCCESS PATH - Camera deployed successfully! <<<');
            window.electronAPI.send('deployment-log', 'info', 'ACAP deployment successful');
            window.electronAPI.send('deployment-log', 'info', `SUCCESS COUNT NOW: ${successCount + 1}`);
            addLog(`✓ ACAP uploaded and installed successfully`);
            
            // Note about the macOS permission
            if (process.platform === 'darwin') {
              console.log('[Deploy] Note: macOS may show privacy alert for Chrome automation');
            }
            if (result.firmwareVersion) {
              addLog(`✓ Deployed correct ACAP for firmware ${result.firmwareVersion} (${result.osVersion})`);
            }
            // Apply license key if provided
            console.log('[LICENSE] >>> CHECKING IF WE SHOULD ACTIVATE LICENSE <<<');
            console.log('[LICENSE] deploymentConfig:', deploymentConfig);
            console.log('[LICENSE] deploymentConfig?.anavaKey:', deploymentConfig?.anavaKey);
            console.log('[LICENSE] Has anavaKey?:', !!deploymentConfig?.anavaKey);
            
            if (deploymentConfig?.anavaKey) {
              console.log('[LICENSE] ✅ WE HAVE A LICENSE KEY - PROCEEDING WITH ACTIVATION');
              console.log('[LICENSE] Starting license activation');
              console.log('[LICENSE] Deployment config has anavaKey:', !!deploymentConfig.anavaKey);
              console.log('[LICENSE] AnavaKey length:', deploymentConfig.anavaKey?.length);
              
              addLog(`Applying Anava license key...`);
              window.electronAPI.send('deployment-log', 'info', '[LICENSE] Starting license activation');
              
              try {
                // Pass the camera's MAC address for proper device ID
                console.log('[LICENSE] === ACTIVATING LICENSE ===');
                console.log('[LICENSE] Camera ID:', camera.id);
                console.log('[LICENSE] Camera IP:', currentIP);
                console.log('[LICENSE] Camera Model:', camera.model);
                console.log('[LICENSE] Camera MAC:', camera.mac);
                console.log('[LICENSE] Has MAC?:', !!camera.mac);
                console.log('[LICENSE] Username:', credentials[camera.id].username);
                console.log('[LICENSE] Has Password?:', !!credentials[camera.id].password);
                console.log('[LICENSE] License Key:', deploymentConfig.anavaKey?.substring(0, 8) + '...');
                console.log('[LICENSE] App Name: BatonAnalytic');
                
                window.electronAPI.send('deployment-log', 'info', `[LICENSE] Calling activateLicenseKey for ${camera.id}`, {
                  ip: currentIP,
                  mac: camera.mac,
                  hasMAC: !!camera.mac,
                  keyPrefix: deploymentConfig.anavaKey?.substring(0, 8)
                });
                
                console.log('[LICENSE] >>> CALLING activateLicenseKey NOW <<<');
                
                // Retry logic for license activation (ACAP may restart after deployment)
                let licenseResult = null;
                let retryCount = 0;
                const maxRetries = 3;
                
                while (retryCount < maxRetries) {
                  try {
                    licenseResult = await window.electronAPI.activateLicenseKey(
                      currentIP,
                      credentials[camera.id].username,
                      credentials[camera.id].password,
                      deploymentConfig.anavaKey,
                      'BatonAnalytic',
                      camera.mac // Pass the MAC address from camera discovery
                    );
                    
                    console.log('[LICENSE] License activation result:', licenseResult);
                    break; // Success, exit retry loop
                    
                  } catch (retryError: any) {
                    retryCount++;
                    console.log(`[LICENSE] Attempt ${retryCount}/${maxRetries} failed:`, retryError.message);
                    
                    // Check if it's a network error (camera restarting)
                    if (retryError.message && (
                      retryError.message.includes('ECONNREFUSED') ||
                      retryError.message.includes('ETIMEDOUT') ||
                      retryError.message.includes('503')
                    )) {
                      if (retryCount < maxRetries) {
                        addLog(`⏳ Camera may be restarting, waiting 10 seconds before retry ${retryCount + 1}/${maxRetries}...`);
                        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
                        continue;
                      }
                    }
                    
                    // If not a network error or max retries reached, throw the error
                    throw retryError;
                  }
                }
                
                if (!licenseResult) {
                  throw new Error('Failed to activate license after multiple attempts');
                }
                
                // Check the result
                if (licenseResult?.licensed === true) {
                  // Definitely licensed
                  console.log('[LICENSE] ✅ License VERIFIED as active!');
                  window.electronAPI.send('deployment-log', 'info', '[LICENSE] License activation VERIFIED', licenseResult);
                  addLog(`✅ License key activated and verified successfully!`);
                  addLog(`✅ ACAP is licensed and ready to use`);
                } else if (licenseResult?.licensed === 'uncertain') {
                  // Activation accepted but couldn't verify
                  console.log('[LICENSE] License activation accepted but verification uncertain');
                  window.electronAPI.send('deployment-log', 'warn', '[LICENSE] License activation uncertain', licenseResult);
                  addLog(`✓ License key activation accepted`);
                  addLog(`⚠ Please verify license status in camera web UI`);
                } else if (licenseResult?.success) {
                  // Generic success
                  console.log('[LICENSE] License activation reported success');
                  window.electronAPI.send('deployment-log', 'info', '[LICENSE] License activation succeeded', licenseResult);
                  addLog(`✓ License key activated successfully`);
                } else {
                  // This shouldn't happen if the method throws on failure
                  throw new Error('Unexpected license activation response');
                }
              } catch (licenseError: any) {
                console.log('[LICENSE] >>> LICENSE ERROR CAUGHT <<<');
                console.log('[LICENSE] Error type:', typeof licenseError);
                console.log('[LICENSE] Error message:', licenseError?.message);
                console.log('[LICENSE] Full error:', licenseError);
                console.log('[LICENSE] Error stack:', licenseError?.stack);
                
                window.electronAPI.send('deployment-log', 'error', `[LICENSE] License activation failed: ${licenseError?.message}`, {
                  error: licenseError?.message,
                  stack: licenseError?.stack,
                  cameraId: camera.id
                });
                
                // Check for network/connectivity errors indicating camera is down
                if (licenseError.message && (
                    licenseError.message.includes('ECONNREFUSED') ||
                    licenseError.message.includes('ETIMEDOUT') ||
                    licenseError.message.includes('EHOSTDOWN') ||
                    licenseError.message.includes('ENETUNREACH') ||
                    licenseError.message.includes('ENOTFOUND') ||
                    licenseError.message.includes('socket hang up') ||
                    licenseError.message.includes('connect ECONNREFUSED')
                )) {
                  console.log('[LICENSE] CRITICAL: Camera is not responding');
                  window.electronAPI.send('deployment-log', 'error', '[LICENSE] CRITICAL: Camera appears to be down');
                  
                  // Show prominent error in UI log
                  addLog(``);
                  addLog(`❌❌❌ CRITICAL ERROR ❌❌❌`);
                  addLog(`Camera ${camera.model} at ${currentIP} is NOT RESPONDING!`);
                  addLog(`The camera appears to be offline or has crashed.`);
                  addLog(`Please manually restart the camera and try again.`);
                  addLog(``);
                  
                  // Track as critical failure
                  setLicenseFailures(prev => {
                    const newMap = new Map(prev);
                    newMap.set(camera.id, `🔴 CAMERA OFFLINE - Not responding at ${currentIP}`);
                    return newMap;
                  });
                  
                  // Mark deployment as failed
                  setDeploymentStatus(prev => {
                    const newMap = new Map(prev);
                    newMap.set(camera.id, {
                      cameraId: camera.id,
                      status: 'error',
                      message: `Camera offline/crashed - not responding`,
                    });
                    return newMap;
                  });
                  
                  // Don't continue - this camera is dead
                  throw new Error(`Camera ${camera.model} is offline. Manual restart required.`);
                  
                } else if (licenseError.message?.includes('already licensed')) {
                  console.log('[LICENSE] Camera already licensed - this is OK');
                  window.electronAPI.send('deployment-log', 'info', '[LICENSE] Camera already has valid license');
                  addLog(`✓ Camera already has a valid license`);
                } else if (
                  // Check for license already used on another device
                  licenseError.message?.toLowerCase().includes('already activated') ||
                  licenseError.message?.toLowerCase().includes('already in use') ||
                  licenseError.message?.toLowerCase().includes('another device') ||
                  licenseError.message?.toLowerCase().includes('different device') ||
                  licenseError.message?.toLowerCase().includes('already registered') ||
                  licenseError.message?.toLowerCase().includes('already bound')
                ) {
                  console.log('[LICENSE] CRITICAL: License already used on another device');
                  window.electronAPI.send('deployment-log', 'error', '[LICENSE] License already used on another device');
                  
                  // Show prominent error in UI with FULL ERROR DETAILS
                  addLog(``);
                  addLog(`❌❌❌ LICENSE ERROR ❌❌❌`);
                  addLog(`This license key is already registered to another device!`);
                  addLog(`The license cannot be used on ${camera.model} at ${currentIP}`);
                  addLog(``);
                  addLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                  addLog(`FULL ERROR RESPONSE:`);
                  addLog(`${licenseError.message}`);
                  if (licenseError.response) {
                    addLog(`Response Status: ${licenseError.response.status}`);
                    addLog(`Response Data: ${JSON.stringify(licenseError.response.data, null, 2)}`);
                  }
                  addLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                  addLog(``);
                  addLog(`To fix this:`);
                  addLog(`  1. Use a different license key for this camera`);
                  addLog(`  2. OR deactivate the license from the other device first`);
                  addLog(`  3. OR contact Anava support for assistance`);
                  addLog(``);
                  
                  // Track as critical failure
                  setLicenseFailures(prev => {
                    const newMap = new Map(prev);
                    newMap.set(camera.id, `License already registered to another device`);
                    return newMap;
                  });
                  
                  // Set prominent error message with FULL ERROR DETAILS
                  const fullError = licenseError.response ?
                    `License activation failed: This license key is already registered to another device.

Full Error: ${licenseError.message}

Response Data: ${JSON.stringify(licenseError.response.data, null, 2)}

Please use a different license key or deactivate it from the other device first.` :
                    `License activation failed: This license key is already registered to another device.

Full Error: ${licenseError.message}

Please use a different license key or deactivate it from the other device first.`;
                  setError(fullError);
                  
                  // Mark deployment as failed
                  setDeploymentStatus(prev => {
                    const newMap = new Map(prev);
                    newMap.set(camera.id, {
                      cameraId: camera.id,
                      status: 'error',
                      message: `License already used on another device`,
                    });
                    return newMap;
                  });
                  
                  // Stop the entire deployment process
                  throw new Error(`License key is already registered to another device. Cannot continue deployment.`);
                  
                } else if (licenseError.message?.includes('stream has been aborted')) {
                  console.log('[LICENSE] License timeout - may still be processing');
                  window.electronAPI.send('deployment-log', 'warn', '[LICENSE] License activation timeout');
                  addLog(`⚠ License activation timeout - camera may be processing the request`);
                  // Track failure for retry
                  setLicenseFailures(prev => new Map(prev).set(camera.id, 'License activation timeout'));
                } else if (licenseError.message?.includes('Cannot find module')) {
                  console.log('[LICENSE] Puppeteer not found, but checking if license worked anyway...');
                  window.electronAPI.send('deployment-log', 'warn', '[LICENSE] Puppeteer missing, verifying license status');
                  
                  // Try to verify if license is actually active despite the error
                  try {
                    const verifyUrl = `https://${currentIP}/axis-cgi/applications/list.cgi`;
                    const response = await window.electronAPI.makeAuthenticatedRequest(
                      verifyUrl,
                      'GET',
                      credentials[camera.id].username,
                      credentials[camera.id].password
                    );
                    if (response && response.includes('Licensed')) {
                      console.log('[LICENSE] License is actually active despite puppeteer error!');
                      addLog(`✓ License verified active (fallback method worked)`);
                    } else {
                      addLog(`⚠ License activation may have failed - unable to verify`);
                      setLicenseFailures(prev => new Map(prev).set(camera.id, 'License verification failed'));
                    }
                  } catch (verifyErr) {
                    addLog(`⚠ Could not verify license status`);
                    setLicenseFailures(prev => new Map(prev).set(camera.id, 'Unable to verify license'));
                  }
                } else {
                  console.log('[LICENSE] Unknown license error - THIS IS FATAL');
                  window.electronAPI.send('deployment-log', 'error', `[LICENSE] FATAL ERROR: ${licenseError.message}`);
                  
                  // Show FULL RAW ERROR in logs
                  addLog(``);
                  addLog(`❌ LICENSE ACTIVATION FAILED`);
                  addLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                  addLog(`FULL ERROR RESPONSE:`);
                  addLog(`${licenseError.message}`);
                  if (licenseError.response) {
                    addLog(`Response Status: ${licenseError.response.status}`);
                    addLog(`Response Data: ${JSON.stringify(licenseError.response.data, null, 2)}`);
                  }
                  if (licenseError.stack) {
                    addLog(`Stack Trace: ${licenseError.stack}`);
                  }
                  addLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                  addLog(`The ACAP will NOT work without a valid license!`);
                  addLog(``);
                  
                  // Track failure with FULL error details
                  const fullErrorMsg = licenseError.response ? 
                    `${licenseError.message} | Response: ${JSON.stringify(licenseError.response.data)}` : 
                    licenseError.message;
                  setLicenseFailures(prev => new Map(prev).set(camera.id, fullErrorMsg));
                  
                  // Set error with FULL details visible to user
                  const detailedError = licenseError.response ?
                    `License activation failed: ${licenseError.message}

Full Response: ${JSON.stringify(licenseError.response.data, null, 2)}` :
                    `License activation failed: ${licenseError.message}`;
                  setError(detailedError);
                  
                  // Mark as error - this is FATAL
                  setDeploymentStatus(prev => {
                    const newMap = new Map(prev);
                    newMap.set(camera.id, {
                      cameraId: camera.id,
                      status: 'error',
                      message: `License activation failed - ACAP will not work`,
                    });
                    return newMap;
                  });
                  
                  // THROW ERROR - License failure is FATAL
                  throw new Error(`License activation failed for ${camera.model}: ${licenseError.message}. The ACAP will not function without a valid license.`);
                }
              }
            } else {
              console.log('[LICENSE] No anavaKey in deployment config, skipping license');
              window.electronAPI.send('deployment-log', 'warn', '[LICENSE] No license key provided, skipping activation');
            }
            
            addLog(`✓ ${camera.model} deployment successful!`);
            
            // Track success immediately
            successCount++;
            console.log('[Deploy] Incremented successCount to:', successCount);
            console.log('[Deploy] Camera successfully deployed:', camera.id, camera.model);
            
            setDeploymentStatus(prev => {
              const newMap = new Map(prev);
              newMap.set(camera.id, {
                cameraId: camera.id,
                status: 'success',
                message: `ACAP deployed successfully`,
              });
              return newMap;
            });
          } else {
            console.log('[Deploy] >>> FAILURE PATH - result.success is false <<<');
            console.log('[Deploy] Result error:', result.error);
            window.electronAPI.send('deployment-log', 'error', `Result success=false: ${result.error}`);
            throw new Error(result.error || 'Deployment failed');
          }
        } catch (error: any) {
          console.log('[Deploy] >>> CATCH BLOCK - Error occurred <<<');
          console.log('[Deploy] Error:', error);
          console.log('[Deploy] Error message:', error.message);
          console.log('[Deploy] Error stack:', error.stack);
          
          // LOG ERROR TO MAIN PROCESS
          window.electronAPI.send('deployment-log', 'error', `Deployment failed for camera ${camera.model}: ${error.message}`, {
            camera,
            error: error.message,
            stack: error.stack
          });
          window.electronAPI.send('deployment-result', false, camera, error);
          
          addLog(`✗ ERROR: ${error.message}`);
          addLog(`✗ Failed to deploy to ${camera.model}`);
          
          // Track error immediately
          errorCount++;
          
          setDeploymentStatus(prev => {
            const newMap = new Map(prev);
            newMap.set(camera.id, {
              cameraId: camera.id,
              status: 'error',
              message: error.message,
            });
            return newMap;
          });
        }
      }

      addLog(`
=== Deployment completed ===`);
      
      // Use the tracked counts (not state which hasn't updated yet)
      addLog(`Successfully deployed to ${successCount} of ${cameras.length} cameras`);
      if (errorCount > 0) {
        addLog(`Failed deployments: ${errorCount}`);
      }
      
      // Check if we have ANY license failures
      const hasLicenseFailures = licenseFailures.size > 0;
      
      // Check what kind of failures we have
      const criticalFailures = Array.from(licenseFailures.values()).filter(
        msg => !msg.includes('already licensed') && 
               !msg.includes('verification uncertain') &&
               !msg.includes('verify manually')
      );
      
      // Only advance if we had successes AND no critical license failures
      if (successCount > 0) {
        if (criticalFailures.length > 0) {
          // Critical license failures - do NOT advance
          console.log('[Deploy] CRITICAL: License activation had critical failures - BLOCKING');
          console.log('[Deploy] Critical failures on', criticalFailures.length, 'cameras');
          
          addLog(``);
          addLog(`❌ DEPLOYMENT BLOCKED - LICENSE ISSUES ❌`);
          addLog(`Critical license failures on ${criticalFailures.length} camera(s)`);
          addLog(`The ACAP will NOT function properly without valid licenses!`);
          addLog(``);
          addLog(`Issues detected:`);
          licenseFailures.forEach((msg, cameraId) => {
            const camera = cameras.find(c => c.id === cameraId);
            if (!msg.includes('already licensed')) {
              addLog(`  • ${camera?.model || cameraId}: ${msg}`);
            }
          });
          addLog(``);
          addLog(`Please resolve these issues before proceeding.`);
          
          setError(`Critical license failures on ${criticalFailures.length} camera(s). Cannot proceed.`);
          
          // DO NOT ADVANCE - stay on current step
          console.log('[Deploy] Staying on step 1 due to critical license failures');
        } else if (hasLicenseFailures) {
          // Non-critical issues (uncertain verification) - allow proceeding with warning
          console.log('[Deploy] Some license verifications were uncertain but allowing proceed');
          addLog(``);
          addLog(`⚠ Some licenses could not be fully verified`);
          addLog(`Please check the camera web UI to confirm licenses are active`);
          addLog(``);
          addLog(`✅ Proceeding to next step...`);
          
          setActiveStep(2);
        } else {
          // Success - can advance
          console.log('[Deploy] SUCCESS! All cameras deployed and licensed properly');
          console.log('[Deploy] Final counts - Success:', successCount, 'Error:', errorCount);
          console.log('[Deploy] Setting activeStep from', activeStep, 'to 2');
          window.electronAPI.send('deployment-log', 'info', `Deployment completed: ${successCount} success, ${errorCount} failed`);
          window.electronAPI.send('deployment-log', 'info', `[STATE] Advancing from step ${activeStep} to step 2`);
          
          addLog(``);
          addLog(`✅ Deployment successful on all cameras!`);
          
          setActiveStep(2);
          // Force update the UI
          setTimeout(() => {
            console.log('[Deploy] Active step should now be 2, actual:', activeStep);
          }, 100);
        }
      } else {
        console.log('[Deploy] No successful deployments, staying on step 1');
        console.log('[Deploy] Final counts - Success:', successCount, 'Error:', errorCount);
        window.electronAPI.send('deployment-log', 'error', 'No cameras were successfully deployed');
        addLog(`⚠ No cameras were successfully deployed. Please check the errors above and try again.`);
        setError('All camera deployments failed. Please check the logs above for details.');
      }
    } catch (err: any) {
      console.error('[Deploy] Deployment failed with error:', err);
      window.electronAPI.send('deployment-log', 'error', `Deployment process failed: ${err.message}`, err);
      setError(`Deployment failed: ${err.message}`);
      addLog(`\nERROR: ${err.message}`);
      
      // Show more user-friendly error messages
      if (err.message?.includes('IPC communication failed')) {
        setError('Communication with the deployment service failed. Please restart the application and try again.');
      } else if (err.message?.includes('No ACAP packages')) {
        setError('No ACAP packages found. Please download ACAP packages from the ACAP Manager first.');
      } else if (err.message?.includes('credentials')) {
        setError('Camera credentials are missing or invalid. Please verify the username and password.');
      }
    } finally {
      console.log('[Deploy] === DEPLOYMENT FINALLY BLOCK ===');
      console.log('[Deploy] Setting deploying to false');
      console.log('[Deploy] Current activeStep:', activeStep);
      window.electronAPI.send('deployment-log', 'info', '[FINALLY] Deployment process completed');
      window.electronAPI.send('deployment-log', 'info', `[FINALLY] Final activeStep: ${activeStep}`);
      setDeploying(false);
      
      // Log final state after a short delay
      setTimeout(() => {
        console.log('[Deploy] FINAL STATE CHECK:');
        console.log('[Deploy] - activeStep:', activeStep);
        console.log('[Deploy] - deploying:', deploying);
        console.log('[Deploy] - deploymentStatus:', Array.from(deploymentStatus.entries()));
      }, 500);
    }
  };

  const verifyDeployment = async () => {
    // In a real implementation, this would test the cameras
    setActiveStep(3);
    setTimeout(onComplete, 2000);
  };

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography variant="body2" paragraph>
              Configure cameras with the deployed GCP infrastructure:
            </Typography>
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  API Gateway URL
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {deploymentConfig?.apiGatewayUrl || 'Not configured'}
                </Typography>
              </CardContent>
            </Card>
            {!deploymentConfig?.apiGatewayUrl ? (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  GCP infrastructure not deployed yet. You need to deploy the cloud infrastructure first.
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => window.location.hash = '#gcp-setup'}
                >
                  Go to GCP Infrastructure Setup
                </Button>
              </Alert>
            ) : (
              <Button
                variant="contained"
                onClick={configureCameras}
                disabled={configuring}
                startIcon={configuring ? <CircularProgress size={20} /> : <SettingsIcon />}
              >
                {configuring ? 'Configuring...' : 'Configure Cameras'}
              </Button>
            )}
            <Button
              variant="text"
              onClick={() => setActiveStep(1)}
              sx={{ ml: 2 }}
            >
              Skip to ACAP Deployment
            </Button>
            
            {/* Configuration Log */}
            {deploymentLog.length > 0 && (
              <Card 
                variant="outlined" 
                sx={{ 
                  mt: 2, 
                  bgcolor: '#f5f5f5',
                  maxHeight: 300,
                  overflow: 'auto'
                }}
              >
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>
                    Configuration Log
                  </Typography>
                  <Box 
                    component="pre" 
                    sx={{ 
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      whiteSpace: 'pre-wrap',
                      wordWrap: 'break-word',
                      m: 0
                    }}
                  >
                    {deploymentLog.join('\n')}
                  </Box>
                </CardContent>
              </Card>
            )}
          </Box>
        );

      case 1:
        return (
          <Box>
            {/* Show prominent error message at the top */}
            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                <AlertTitle>Deployment Error</AlertTitle>
                <Typography 
                  variant="body2" 
                  component="pre"
                  sx={{ 
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'monospace',
                    fontSize: '0.875rem'
                  }}
                >
                  {error}
                </Typography>
              </Alert>
            )}
            
            <Typography variant="body2" paragraph>
              Deploy the Anava authentication application to each camera:
            </Typography>
            
            {/* Credentials Section */}
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Camera Credentials
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Enter the IP address, username and password for your Axis cameras
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={addManualCamera}
                    variant="outlined"
                  >
                    Add Camera
                  </Button>
                </Box>
                {cameras.map(camera => (
                  <Box key={camera.id} sx={{ mb: 3 }}>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                      {camera.model}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                      <TextField
                        size="small"
                        label="IP Address"
                        value={cameraIPs[camera.id] || ''}
                        onChange={(e) => setCameraIPs(prev => ({
                          ...prev,
                          [camera.id]: e.target.value
                        }))}
                        sx={{ flex: 1 }}
                      />
                      <TextField
                        size="small"
                        label="Username"
                        value={credentials[camera.id]?.username || ''}
                        onChange={(e) => setCredentials(prev => ({
                          ...prev,
                          [camera.id]: { ...prev[camera.id], username: e.target.value }
                        }))}
                        sx={{ flex: 1 }}
                      />
                      <TextField
                        size="small"
                        label="Password"
                        type="password"
                        value={credentials[camera.id]?.password || ''}
                        onChange={(e) => setCredentials(prev => ({
                          ...prev,
                          [camera.id]: { ...prev[camera.id], password: e.target.value }
                        }))}
                        sx={{ flex: 1 }}
                      />
                    </Box>
                  </Box>
                ))}
              </CardContent>
            </Card>
            
            {/* Deployment Status */}
            <List>
              {cameras.map(camera => {
                const status = deploymentStatus.get(camera.id);
                return (
                  <ListItem key={camera.id}>
                    <ListItemIcon>
                      {status?.status === 'success' ? (
                        <CheckCircleIcon color="success" />
                      ) : status?.status === 'error' ? (
                        <ErrorIcon color="error" />
                      ) : status?.status === 'deploying' ? (
                        <CircularProgress size={24} />
                      ) : (
                        <VideocamIcon />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={camera.model}
                      secondary={
                        <Box>
                          <Typography variant="body2">{camera.ip}</Typography>
                          {status?.message && (
                            <Typography 
                              variant="caption" 
                              color={status.status === 'error' ? 'error' : 'text.secondary'}
                            >
                              {status.message}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                );
              })}
            </List>
            <Button
              variant="contained"
              onClick={handleDeployClick}
              disabled={deploying || activeStep !== 1}
              startIcon={deploying ? <CircularProgress size={20} /> : <CloudUploadIcon />}
              sx={{ mt: 2 }}
            >
              {deploying ? 'Deploying...' : 'Deploy ACAP'}
            </Button>
            
            {/* Deployment Log */}
            {deploymentLog.length > 0 && (
              <Card 
                variant="outlined" 
                sx={{ 
                  mt: 2, 
                  bgcolor: '#f5f5f5',
                  maxHeight: 300,
                  overflow: 'auto'
                }}
              >
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>
                    Deployment Log
                  </Typography>
                  <Box 
                    component="pre" 
                    sx={{ 
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      whiteSpace: 'pre-wrap',
                      wordWrap: 'break-word',
                      m: 0
                    }}
                  >
                    {deploymentLog.join('\n')}
                  </Box>
                </CardContent>
              </Card>
            )}
            
            {/* License Activation Failures */}
            {licenseFailures.size > 0 && activeStep === 1 && (
              <Alert 
                severity="warning" 
                sx={{ mt: 2 }}
                action={
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {Array.from(licenseFailures.entries()).map(([cameraId, errorMsg]) => {
                      const camera = cameras.find(c => c.id === cameraId);
                      return (
                        <Button
                          key={cameraId}
                          size="small"
                          variant="outlined"
                          onClick={() => retryLicenseActivation(cameraId)}
                        >
                          Retry {camera?.model || cameraId}
                        </Button>
                      );
                    })}
                  </Box>
                }
              >
                <Typography variant="subtitle2" gutterBottom>
                  License Activation Issues
                </Typography>
                {Array.from(licenseFailures.entries()).map(([cameraId, errorMsg]) => {
                  const camera = cameras.find(c => c.id === cameraId);
                  return (
                    <Typography key={cameraId} variant="body2">
                      • {camera?.model || cameraId}: {errorMsg}
                    </Typography>
                  );
                })}
                <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                  You can retry activation or manually activate through the camera's web interface.
                </Typography>
              </Alert>
            )}
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="body2" paragraph>
              Verify that cameras can authenticate with the GCP infrastructure:
            </Typography>
            <Alert severity="success" sx={{ mb: 2 }}>
              All cameras deployed successfully!
            </Alert>
            <Button
              variant="contained"
              onClick={verifyDeployment}
              color="success"
            >
              Complete Setup
            </Button>
          </Box>
        );

      default:
        return null;
    }
  };

  // Ensure we always return something
  if (!cameras || cameras.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h5">No cameras provided</Typography>
        <Button onClick={onBack} sx={{ mt: 2 }}>Back to Camera Discovery</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={onBack}
          sx={{ mr: 2 }}
        >
          Back
        </Button>
        <Typography variant="h4">
          Camera Configuration
        </Typography>
      </Box>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        Configure {cameras.length} camera{cameras.length !== 1 ? 's' : ''} to use the deployed infrastructure.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Stepper activeStep={activeStep} orientation="vertical">
          {steps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel
                optional={
                  index === 2 ? (
                    <Typography variant="caption">Last step</Typography>
                  ) : null
                }
              >
                {step.label}
              </StepLabel>
              <StepContent>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {step.description}
                </Typography>
                {getStepContent(index)}
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </Paper>
    </Box>
  );
};