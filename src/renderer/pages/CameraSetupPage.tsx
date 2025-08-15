import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Grid,
  Alert,
  AlertTitle,
  CircularProgress,
  LinearProgress,
  IconButton,
  InputAdornment,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  Chip,
  Collapse,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  FormControlLabel,
  RadioGroup,
  Radio,
  Tooltip,
  Switch,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import DetectionTestModal from '../components/DetectionTestModal';
import { AOAScenarioDialog } from '../components/AOAScenarioDialog';
import { VisionArchitectDialog } from '../components/VisionArchitectDialog';
// import { useNavigationGuard } from '../hooks/useNavigationGuard';
// import NavigationWarningDialog from '../components/NavigationWarningDialog';
import {
  Visibility,
  VisibilityOff,
  Videocam as VideocamIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  VolumeUp as VolumeUpIcon,
  NetworkCheck as NetworkCheckIcon,
  PlayArrow as PlayArrowIcon,
  Security as SecurityIcon,
  CloudDownload as CloudDownloadIcon,
  Speaker as SpeakerIcon,
  Cloud as CloudIcon,
  SkipNext as SkipNextIcon,
  SmartToy as SmartToyIcon,
  OpenInNew as OpenInNewIcon,
  AutoFixHigh as AutoFixHighIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useCameraContext } from '../contexts/CameraContext';

interface CameraInfo {
  id: string;
  ip: string;
  port?: number;
  model: string;
  name: string;
  firmwareVersion?: string;
  accessible: boolean;
  authRequired?: boolean;
  mac?: string | null;
  hasACAP?: boolean;
  isLicensed?: boolean;
  status?: 'idle' | 'deploying' | 'licensing' | 'analyzing' | 'complete' | 'error';
  error?: string;
  sceneAnalysis?: {
    description: string;
    imageBase64: string;
    audioMP3Base64?: string;
  };
}

interface CameraSetupPageProps {
  onNavigate?: (view: string) => void;
}

const CameraSetupPage: React.FC<CameraSetupPageProps> = ({ onNavigate }) => {
  const { addCamera, updateCamera } = useCameraContext();
  
  // Load saved state from localStorage
  const loadSavedState = () => {
    try {
      const savedState = localStorage.getItem('cameraSetupState');
      if (savedState) {
        try {
          const state = JSON.parse(savedState);
          // console.log('Restoring camera setup state from localStorage');
          return state;
        } catch (error) {
          console.error('Failed to parse saved camera setup state:', error);
          // Clear corrupted state
          localStorage.removeItem('cameraSetupState');
        }
      }
    } catch (error) {
      console.error('Failed to access localStorage:', error);
      // localStorage might be disabled or throw in some environments
    }
    return null;
  };
  
  const savedState = loadSavedState();
  
  const [activeStep, setActiveStep] = useState(savedState?.activeStep || 0);
  const [completed, setCompleted] = useState<{ [key: number]: boolean }>(savedState?.completed || {});
  const [mode, setMode] = useState<'manual' | 'scan'>(savedState?.mode || 'manual');
  const [credentials, setCredentials] = useState(savedState?.credentials || {
    username: 'root',
    password: '',
    port: 443,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [manualIP, setManualIP] = useState(savedState?.manualIP || '');
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number; foundCount: number }>({ 
    current: 0, 
    total: 254, 
    foundCount: 0 
  });
  const [connecting, setConnecting] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [cameras, setCameras] = useState<CameraInfo[]>(savedState?.cameras || []);
  const [selectedCamera, setSelectedCamera] = useState<CameraInfo | null>(savedState?.selectedCamera || null);
  const [deploymentProgress, setDeploymentProgress] = useState(0);
  const [deploymentStatus, setDeploymentStatus] = useState('');
  const [selectedACAPFile, setSelectedACAPFile] = useState<string | null>(savedState?.selectedACAPFile || null);
  const [licenseKey, setLicenseKey] = useState<string | null>(savedState?.licenseKey || null);
  const [error, setError] = useState<string | null>(null);
  const [showLicensePrompt, setShowLicensePrompt] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [sceneDescription, setSceneDescription] = useState(savedState?.sceneDescription || '');
  const [sceneImage, setSceneImage] = useState(savedState?.sceneImage || '');
  const [licenseMode, setLicenseMode] = useState<'trial' | 'manual'>(savedState?.licenseMode || 'trial');
  const [manualLicenseKey, setManualLicenseKey] = useState(savedState?.manualLicenseKey || '');
  
  // Speaker configuration state
  const [configureSpeaker, setConfigureSpeaker] = useState(savedState?.configureSpeaker || false);
  const [speakerConfig, setSpeakerConfig] = useState(savedState?.speakerConfig || {
    ip: '',
    username: 'root',
    password: ''
  });
  const [showSpeakerPassword, setShowSpeakerPassword] = useState(false);
  const [availableSpeakers, setAvailableSpeakers] = useState<Array<{ ip: string; model?: string }>>(savedState?.availableSpeakers || []);
  const [testingSpeaker, setTestingSpeaker] = useState(false);
  const [processingSpeakerConfig, setProcessingSpeakerConfig] = useState(false);
  const [showDetectionModal, setShowDetectionModal] = useState(false);
  const [validatingCredentials, setValidatingCredentials] = useState(false);
  const [showAOADialog, setShowAOADialog] = useState(false);
  const [showVisionArchitectDialog, setShowVisionArchitectDialog] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState<string>(
    localStorage.getItem('customGeminiApiKey') || ''
  );
  const [manualCameraIp, setManualCameraIp] = useState<string>('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [useVisionArchitect, setUseVisionArchitect] = useState(true); // Use Vision Architect by default
  
  // Check if any operation is in progress
  const isOperationInProgress = scanning || connecting || deploying || analyzing || 
    testingSpeaker || processingSpeakerConfig || validatingCredentials ||
    (activeStep > 0 && activeStep < 4);
  
  // Navigation guard disabled - app doesn't use React Router
  // Would need to wrap app in Router component to use this
  const showDialog = false;
  const confirmNavigation = () => {};
  const cancelNavigation = () => {};
  const guardedNavigate = (path: string) => onNavigate?.(path);
  const message = '';
  const isProcessing = false;
  
  // State to track if we need to restore from saved state
  const [hasPreDiscoveredCameras, setHasPreDiscoveredCameras] = useState(false);

  // Save state to localStorage whenever key values change
  useEffect(() => {
    try {
      const stateToSave = {
        activeStep,
        completed,
        mode,
        credentials,
        manualIP,
        cameras,
        selectedCamera,
        selectedACAPFile,
        licenseKey,
        sceneDescription,
        sceneImage,
        licenseMode,
        manualLicenseKey,
        configureSpeaker,
        speakerConfig,
        availableSpeakers,
      };
      
      // Don't save state during initial load from savedState
      if (savedState === null || JSON.stringify(stateToSave) !== JSON.stringify(savedState)) {
        localStorage.setItem('cameraSetupState', JSON.stringify(stateToSave));
      }
    } catch (error) {
      console.error('Failed to save state to localStorage:', error);
      // Continue without saving - localStorage might be disabled
    }
  }, [
    activeStep,
    completed,
    mode,
    credentials,
    manualIP,
    cameras,
    selectedCamera,
    selectedACAPFile,
    licenseKey,
    sceneDescription,
    sceneImage,
    licenseMode,
    manualLicenseKey,
    configureSpeaker,
    speakerConfig,
    availableSpeakers,
  ]);
  
  // Load license key and check for pre-discovered cameras on mount
  useEffect(() => {
    loadLicenseKey();
    checkPreDiscoveredCameras();
    loadApiKey();
    
    // Load discovered speakers from localStorage when component mounts
    const savedSpeakers = localStorage.getItem('discoveredSpeakers');
    if (savedSpeakers) {
      try {
        const speakers = JSON.parse(savedSpeakers);
        if (Array.isArray(speakers) && speakers.length > 0) {
          console.log(`Loading ${speakers.length} previously discovered speaker(s):`, speakers);
          setAvailableSpeakers(speakers);
          
          // Auto-fill speaker config with first speaker if available
          if (speakers[0] && !speakerConfig.ip) {
            setSpeakerConfig({
              ip: speakers[0].ip,
              username: credentials.username || 'root',
              password: credentials.password || ''
            });
          }
        }
      } catch (error) {
        console.error('Failed to parse saved speakers:', error);
      }
    }
  }, []);

  const loadApiKey = async () => {
    try {
      // Try to load from config
      const savedApiKey = await window.electronAPI?.getConfigValue('geminiApiKey');
      if (savedApiKey) {
        console.log('✅ Loaded Gemini API key from config');
        setGeminiApiKey(savedApiKey);
        localStorage.setItem('customGeminiApiKey', savedApiKey);
      } else {
        // Try to get from localStorage
        const localApiKey = localStorage.getItem('customGeminiApiKey');
        if (localApiKey) {
          console.log('✅ Loaded Gemini API key from localStorage');
          setGeminiApiKey(localApiKey);
        }
      }
    } catch (error) {
      console.error('Failed to load API key:', error);
    }
  };

  const loadLicenseKey = async () => {
    try {
      // Try to load from unified auth config first
      const axisKey = await window.electronAPI?.getConfigValue('axisLicenseKey');
      const licenseKeyFromConfig = await window.electronAPI?.getConfigValue('licenseKey');
      
      // Use axisLicenseKey first, then fall back to licenseKey
      const key = axisKey || licenseKeyFromConfig;
      
      if (key && !key.startsWith('ANAVA-')) {
        console.log('✅ Loaded real license key from config:', key);
        setLicenseKey(key);
      } else if (key && key.startsWith('ANAVA-')) {
        console.error('❌ Fake license detected in config:', key);
        setError('Invalid license key. Please sign out and sign in again to get a valid license.');
      } else {
        // Fall back to old API if no key in config
        const result = await (window.electronAPI as any).license?.getAssignedKey?.();
        if (result?.success && result?.key && !result.key.startsWith('ANAVA-')) {
          console.log('✅ Loaded license key from old API:', result.key);
          setLicenseKey(result.key);
        } else {
          console.warn('⚠️ No valid license key found');
        }
      }
    } catch (error) {
      console.error('Failed to load license key:', error);
    }
  };

  const checkPreDiscoveredCameras = async () => {
    try {
      const result = await (window.electronAPI as any).camera?.getPreDiscoveredCameras?.();
      if (result && result.cameras && result.cameras.length > 0) {
        setHasPreDiscoveredCameras(true);
        console.log('Pre-discovered cameras available:', result.cameras.length);
      }
    } catch (error) {
      console.error('Failed to check pre-discovered cameras:', error);
    }
  };

  const handleCredentialsSubmit = async () => {
    if (credentials.username && credentials.password) {
      setValidatingCredentials(true);
      setError(null);
      
      // Classify any pre-discovered Axis devices with the provided credentials
      try {
        const result = await (window.electronAPI as any).camera?.classifyAxisDevices?.(credentials);
        if (result) {
          console.log('Classified devices:', result);
          // Store classified devices for later use
          if (result.cameras && result.cameras.length > 0) {
            console.log(`Found ${result.cameras.length} cameras after classification`);
            // Populate the cameras list
            setCameras(result.cameras.map((camera: any) => ({
              ...camera,
              accessible: true,
              authenticated: true,
            })));
            // Cameras are now available for selection
          } else {
            // No cameras found
            setCameras([]);
            // No cameras found
          }
          if (result.speakers && result.speakers.length > 0) {
            console.log(`Found ${result.speakers.length} speakers after classification`);
            setAvailableSpeakers(result.speakers);
            // Auto-fill speaker config if we found one
            if (result.speakers[0]) {
              setSpeakerConfig({
                ip: result.speakers[0].ip,
                username: credentials.username,
                password: credentials.password
              });
            }
          }
        } else {
          // No result, no cameras
          setCameras([]);
          // No result, no cameras
        }
      } catch (error) {
        console.error('Failed to classify devices:', error);
        setCameras([]);
        setError('Failed to validate credentials. Please check your network connection.');
      } finally {
        setValidatingCredentials(false);
      }
      
      setActiveStep(1);
      setCompleted(prev => ({ ...prev, 0: true }));
    }
  };

  const handleManualConnect = async () => {
    if (!manualIP || !credentials.username || !credentials.password) return;

    console.log(`Manual connect initiated for ${manualIP} with user ${credentials.username}`);
    setError(null); // Clear any previous errors
    setConnecting(true);

    try {
      const camera: CameraInfo = {
        id: `camera-${manualIP}`,
        ip: manualIP,
        model: 'Checking...',
        name: `Camera at ${manualIP}`,
        accessible: false,
        status: 'idle',
      };

      setCameras([camera]);
      
      // Test connection
      console.log('Calling quickScanCamera...');
      const result = await (window.electronAPI as any).quickScanCamera?.(
        manualIP,
        credentials.username,
        credentials.password
      );

      if (result && result.length > 0) {
        const discoveredCamera = result[0];
        console.log('Quick scan result:', discoveredCamera);
        
        // Check if authentication was successful
        if (discoveredCamera.status === 'accessible' || discoveredCamera.authenticated === true) {
          console.log('Authentication successful, checking for ACAP...');
          
          // Check if camera already has ACAP installed
          const installedACAPs = await (window.electronAPI as any).listInstalledACAPs?.({
            ip: manualIP,
            credentials: {
              username: credentials.username,
              password: credentials.password,
            },
          });
          
          const hasACAP = installedACAPs?.includes('BatonAnalytic') || false;
          
          const updatedCamera = {
            ...camera,
            ...discoveredCamera,
            accessible: true,
            hasACAP,
            isLicensed: hasACAP, // If ACAP is installed, assume it's licensed
            credentials: {
              username: credentials.username,
              password: credentials.password,
            },
          };
          setCameras([updatedCamera]);
          setSelectedCamera(updatedCamera);
          
          // Add to global camera context
          const globalCamera = {
            id: updatedCamera.id,
            name: updatedCamera.name || `Camera at ${updatedCamera.ip}`,
            ip: updatedCamera.ip,
            model: updatedCamera.model,
            mac: updatedCamera.mac || null,
            status: {
              credentials: {
                completed: true,
                username: credentials.username,
                password: credentials.password
              },
              discovery: {
                completed: true,
                ip: updatedCamera.ip,
                model: updatedCamera.model,
                firmwareVersion: updatedCamera.firmwareVersion
              },
              deployment: {
                completed: hasACAP,
                hasACAP: hasACAP,
                isLicensed: hasACAP
              },
              speaker: {
                completed: false,
                configured: false
              },
              verification: {
                completed: false
              }
            },
            lastUpdated: new Date()
          };
          addCamera(globalCamera);
          
          setActiveStep(2);
          setCompleted(prev => ({ ...prev, 0: true, 1: true }));
        } else {
          // Authentication failed
          const errorMsg = discoveredCamera.error || 'Authentication failed. Check username and password.';
          console.error('Authentication failed:', errorMsg);
          setError(errorMsg);
          setCameras([{
            ...camera,
            model: 'Authentication Failed',
            accessible: false,
            error: errorMsg,
          }]);
        }
      } else {
        // No camera found at this IP
        const errorMsg = 'No camera found at this IP address. Please check the IP and try again.';
        console.error('No camera found:', errorMsg);
        setError(errorMsg);
        setCameras([{
          ...camera,
          model: 'Not Found',
          accessible: false,
          error: errorMsg,
        }]);
      }
    } catch (error: any) {
      console.error('Manual connection failed:', error);
      const errorMsg = error.message || 'Connection failed. Please check the IP address and try again.';
      setError(errorMsg);
      setCameras([{
        id: `camera-${manualIP}`,
        ip: manualIP,
        model: 'Connection Error',
        name: `Camera at ${manualIP}`,
        accessible: false,
        error: errorMsg,
      }]);
    } finally {
      setConnecting(false);
    }
  };

  const handleNetworkScan = async () => {
    // Clear state and start fresh scan
    setScanning(true);
    setCameras([]);
    setError(null);
    setSelectedCamera(null);
    setScanProgress({ current: 0, total: 254, foundCount: 0 });
    
    // Set up progress listener
    const unsubscribe = (window.electronAPI as any).onScanProgress?.((data: { ip: string; status: string; total?: number }) => {
      if (data.status === 'total' && data.total) {
        // Set the actual total number of IPs to scan
        setScanProgress(prev => ({ ...prev, total: data.total }));
      } else {
        setScanProgress(prev => ({
          ...prev,
          current: prev.current + 1,
          foundCount: data.status === 'found' ? prev.foundCount + 1 : prev.foundCount
        }));
        
        if (data.status === 'found') {
          setDeploymentStatus(`Found camera at ${data.ip}`);
        }
      }
    });
    
    try {
      // Show initial status
      setDeploymentStatus(`Scanning network for cameras (port ${credentials.port || 443})...`);
      
      // Use the FAST scanner
      const results = await (window.electronAPI as any).fastNetworkScan?.({
        credentials: {
          username: credentials.username,
          password: credentials.password,
        },
        port: credentials.port || 443
      });
      
      if (!Array.isArray(results)) {
        throw new Error('Invalid scan response');
      }

      // Filter out speakers - only show cameras in this view
      const camerasOnly = results.filter((device: any) => 
        device.deviceType !== 'speaker'
      );
      
      // Store speakers separately for later use in speaker configuration
      const speakers = results.filter((device: any) => 
        device.deviceType === 'speaker'
      );
      if (speakers.length > 0) {
        console.log(`Found ${speakers.length} speaker(s) for later configuration:`, speakers);
        // Store speakers in localStorage AND update state for speaker config page
        localStorage.setItem('discoveredSpeakers', JSON.stringify(speakers));
        setAvailableSpeakers(speakers);  // FIX: Update state immediately
      }

      const formattedCameras: CameraInfo[] = camerasOnly.map((cam: any) => ({
        id: cam.id || `camera-${cam.ip}`,
        ip: cam.ip,
        port: cam.port || credentials.port || 443,
        model: cam.model || 'Unknown',
        name: cam.name || `Camera at ${cam.ip}`,
        firmwareVersion: cam.firmwareVersion,
        accessible: cam.accessible || false,
        authRequired: cam.authRequired || false,
        mac: cam.mac || null,  // Include MAC address from scanner!
        hasACAP: false,
        isLicensed: false,
        status: 'idle',
      }));

      setCameras(formattedCameras);
      
      // Update status message
      if (formattedCameras.length > 0) {
        const accessibleCount = formattedCameras.filter(cam => cam.accessible).length;
        const unauthenticatedCount = formattedCameras.filter(cam => cam.authRequired).length;
        
        if (accessibleCount > 0) {
          setDeploymentStatus(`Network scan complete. Found ${formattedCameras.length} camera(s), ${accessibleCount} accessible.`);
          // Auto-select first accessible camera but DON'T auto-advance
          const firstAccessible = formattedCameras.find(cam => cam.accessible);
          if (firstAccessible) {
            setSelectedCamera(firstAccessible);
          }
        } else if (unauthenticatedCount > 0) {
          setDeploymentStatus(`Found ${formattedCameras.length} Axis device(s), but none are accessible with current credentials. Click on a device to update credentials.`);
        } else {
          setDeploymentStatus(`Found ${formattedCameras.length} camera(s). Please verify credentials.`);
        }
      } else {
        setDeploymentStatus('No cameras found on the network. Please check your connection.');
      }
    } catch (error: any) {
      console.error('Network scan failed:', error);
      
      // Platform-specific error messages
      let errorMessage = 'Failed to scan network. ';
      if (navigator.platform.includes('Win')) {
        errorMessage += 'Please check Windows Firewall settings and ensure the application has network access. You may need to run as Administrator.';
      } else if (navigator.platform.includes('Mac')) {
        errorMessage += 'Please check network permissions in System Settings > Privacy & Security.';
      } else {
        errorMessage += 'Please check your connection and firewall settings.';
      }
      
      setError(errorMessage);
      setDeploymentStatus('Scan failed. Please check permissions and try again.');
    } finally {
      setScanning(false);
      // Clean up listener
      if (unsubscribe) unsubscribe();
    }
  };

  // Handle network permission request
  const handleRequestNetworkPermission = async () => {
    try {
      await (window.electronAPI as any).networkRequestPermission?.();
    } catch (error) {
      console.error('Failed to request network permission:', error);
    }
  };

  const handleDeploy = async () => {
    if (!selectedCamera) {
      setError('No camera selected');
      return;
    }

    // Check if camera is already licensed
    if (selectedCamera.isLicensed) {
      console.log('Camera already has ACAP installed and licensed');
      setDeploymentStatus('Camera already configured, updating settings...');
      setDeploymentProgress(50);
    } else if (!licenseKey) {
      // For unlicensed cameras, we need a license key
      setError('No license key available. This camera needs a license to enable AI analytics.');
      console.error('Deployment blocked: No license key available');
      
      // Show license prompt
      setShowLicensePrompt(true);
      return;
    }

    setError(null);
    setDeploying(true);
    setDeploymentProgress(0);
    setDeploymentStatus('Downloading ACAP...');

    try {
      // Update camera status
      updateCameraStatus(selectedCamera.id, 'deploying');

      // Step 1: Download ACAP
      setDeploymentProgress(10);
      setDeploymentStatus('Downloading latest ACAP...');
      
      const releases = await (window.electronAPI as any).acap?.getReleases?.();
      if (!releases || releases.length === 0) {
        throw new Error('No ACAP releases found');
      }

      // Download all available releases first
      const downloadedReleases = [];
      for (const release of releases) {
        if (!release.isDownloaded) {
          const downloadResult = await (window.electronAPI as any).acap?.download?.(release);
          if (downloadResult.success) {
            downloadedReleases.push({ ...release, isDownloaded: true });
          }
        } else {
          downloadedReleases.push(release);
        }
      }

      // Step 2: Deploy ACAP with automatic OS version selection
      setDeploymentProgress(30);
      setDeploymentStatus('Detecting camera firmware and installing appropriate ACAP...');
      updateCameraStatus(selectedCamera.id, 'deploying');

      // Create camera object with credentials for deployment
      const cameraForDeployment = {
        ...selectedCamera,
        credentials: {
          username: credentials.username,
          password: credentials.password
        }
      };
      
      // Start a progress animation for better UX during the 10-15 second deployment
      let progressCounter = 0;
      const progressInterval = setInterval(() => {
        progressCounter++;
        setDeploymentProgress((prev) => {
          // Smoothly increment from 30 to 48 over ~12 seconds
          if (prev < 48) {
            return prev + 1.5;
          }
          return prev;
        });
        
        // Update status message periodically for better UX
        if (progressCounter === 3) {
          setDeploymentStatus('Connecting to camera and checking firmware version...');
        } else if (progressCounter === 6) {
          setDeploymentStatus('Uploading ACAP package to camera...');
        } else if (progressCounter === 9) {
          setDeploymentStatus('Installing and verifying ACAP...');
        } else if (progressCounter === 11) {
          setDeploymentStatus('Finalizing ACAP installation...');
        }
      }, 1000); // Update every second
      
      let deployResult;
      try {
        // Use automatic deployment which will detect firmware and select correct ACAP
        deployResult = await (window.electronAPI as any).deployACAPAuto?.(cameraForDeployment, downloadedReleases);
        
        // Stop the progress animation
        clearInterval(progressInterval);
        
        if (!deployResult.success) {
          throw new Error(deployResult.error || 'ACAP deployment failed');
        }
        
        // Store the selected ACAP filename
        if (deployResult.selectedFile) {
          setSelectedACAPFile(deployResult.selectedFile);
        }
      } catch (deployError) {
        // Make sure to clear the interval on error
        clearInterval(progressInterval);
        throw deployError;
      }
      
      console.log('ACAP deployment successful:', deployResult.message);
      if (deployResult.firmwareVersion && deployResult.osVersion) {
        console.log(`Deployed ${deployResult.osVersion} ACAP for firmware ${deployResult.firmwareVersion}`);
        setDeploymentStatus(`Installed ${deployResult.osVersion} ACAP for firmware ${deployResult.firmwareVersion}`);
      }

      // Step 3: Apply license (only if not already licensed)
      if (!selectedCamera.isLicensed && licenseKey) {
        setDeploymentProgress(50);
        setDeploymentStatus('Applying license key...');
        updateCameraStatus(selectedCamera.id, 'licensing');
        
        // Animate progress during license activation
        const licenseInterval = setInterval(() => {
          setDeploymentProgress((prev) => {
            if (prev < 65) {
              return prev + 2;
            }
            return prev;
          });
        }, 500);

        try {
          console.log('[DEBUG] CameraSetupPage activating license:', {
            ip: selectedCamera.ip,
            mac: selectedCamera.mac,
            hasMAC: !!selectedCamera.mac
          });
          await (window.electronAPI as any).activateLicenseKey?.(
            selectedCamera.ip,
            credentials.username,
            credentials.password,
            licenseKey,
            'BatonAnalytic',
            selectedCamera.mac,  // PASS THE MAC ADDRESS!
            selectedCamera.port || 443
          );
          console.log('License key activated successfully');
        } catch (licenseError: any) {
          clearInterval(licenseInterval);
          console.error('License activation failed:', licenseError);
          
          // Show detailed error message to user
          const errorMessage = licenseError?.message || 'Failed to activate license';
          setDeploymentError(
            `License activation failed: ${errorMessage}\n\n` +
            `This may be due to:\n` +
            `• Network connectivity issues\n` +
            `• Invalid license key\n` +
            `• Camera compatibility issues\n\n` +
            `Please check the logs for more details.`
          );
          setIsDeploying(false);
          
          // Don't continue if license activation fails
          return;
        }
        
        clearInterval(licenseInterval);
        setDeploymentProgress(68);
      } else if (selectedCamera.isLicensed) {
        setDeploymentProgress(68);
        setDeploymentStatus('Camera already licensed, updating configuration...');
      }
      
      // Scene capture moved to after pushCameraSettings to ensure app is running

      // Step 4: Configure camera
      setDeploymentProgress(70);
      setDeploymentStatus('Configuring AI settings...');
      
      // Animate progress during configuration
      const configInterval = setInterval(() => {
        setDeploymentProgress((prev) => {
          if (prev < 85) {
            return prev + 2.5;
          }
          return prev;
        });
      }, 500);
      
      // Get API key that should have been generated on home screen
      const geminiApiKey = await (window.electronAPI as any).getConfigValue?.('geminiApiKey') || '';
      if (!geminiApiKey) {
        console.warn('No API key found - user may need to add it manually in Detection Test');
      }
      
      // Get Firebase config (use real Anava AI config)
      const firebaseConfig = {
        apiKey: "AIzaSyCJbWAa-zQir1v8kmlye8Kv3kmhPb9r18s",
        authDomain: "anava-ai.firebaseapp.com",
        projectId: "anava-ai",
        storageBucket: "anava-ai.appspot.com",
        messagingSenderId: "392865621461",
        appId: "1:392865621461:web:15db206ae4e9c72f7dc95c",
        databaseId: "(default)"
      };
      
      const configPayload = {
        firebase: firebaseConfig,
        gemini: {
          apiKey: geminiApiKey || '', // Use the generated/stored API key
          vertexApiGatewayUrl: '',
          vertexApiGatewayKey: '',
          vertexGcpProjectId: '',
          vertexGcpRegion: 'us-central1',
          vertexGcsBucketName: '',
        },
        anavaKey: licenseKey,
        customerId: 'trial-user',
      };

      clearInterval(configInterval);
      
      await (window.electronAPI as any).pushCameraSettings?.(
        selectedCamera.ip,
        credentials.username,
        credentials.password,
        configPayload
      );

      // Step 5: Capture and analyze scene
      setDeploymentProgress(88);
      setDeploymentStatus('AI is learning to see...');
      updateCameraStatus(selectedCamera.id, 'analyzing');
      
      // Animate final progress
      const finalInterval = setInterval(() => {
        setDeploymentProgress((prev) => {
          if (prev < 95) {
            return prev + 1;
          }
          return prev;
        });
      }, 200);

      // Get scene description with audio - NOW the app is running after pushCameraSettings
      console.log('Starting scene capture after app is confirmed running...');
      let sceneResult = null;
      
      const sceneApiKey = await (window.electronAPI as any).getConfigValue?.('geminiApiKey');
      if (sceneApiKey) {
        // Create camera object with credentials for scene capture
        const cameraForCapture = {
          id: selectedCamera.id,
          ip: selectedCamera.ip,
          port: selectedCamera.port || 443,
          name: selectedCamera.model || `Camera at ${selectedCamera.ip}`,
          hasACAP: true,
          hasSpeaker: false,
          credentials: {
            username: credentials.username,
            password: credentials.password
          }
        };
        
        try {
          // Get user's name from localStorage for personalized greeting
          const userDisplayName = localStorage.getItem('userDisplayName');
          let customPrompt: string | undefined;
          
          if (userDisplayName) {
            // Extract first name from display name
            const firstName = userDisplayName.split(' ')[0];
            customPrompt = `You are Anava, an AI vision assistant analyzing a live camera feed. The person testing you is named ${firstName}. Please: 1) Greet ${firstName} by name, 2) Introduce yourself as Anava, 3) Then describe what you see in this image, mentioning specific details like objects, people, colors, or activities to prove you're seeing their actual environment in real-time. Keep the entire response under 3 sentences and make it conversational.`;
            console.log('Using personalized prompt for:', firstName);
          }
          
          // Call the real getSceneDescription - app is now running!
          const result = await (window.electronAPI as any).getSceneDescription?.(
            cameraForCapture,
            sceneApiKey,
            false, // No speaker yet
            customPrompt
          );
          
          if (result?.success) {
            console.log('Scene capture completed successfully');
            sceneResult = result;
            
            // Store the pre-fetched scene data with camera info and timestamp
            (window.electronAPI as any).setConfigValue?.('preFetchedScene', {
              ...result,
              audioBase64: result.audioBase64 || result.audioMP3Base64,
              audioFormat: result.audioFormat || 'mp3',
              cameraId: selectedCamera.id,
              cameraIp: selectedCamera.ip,
              timestamp: Date.now()
            });
          } else {
            console.log('Scene capture failed:', result?.error);
            // Use fallback mock if capture fails
            sceneResult = await captureAndAnalyzeScene(selectedCamera);
          }
        } catch (err) {
          console.error('Scene capture error:', err);
          // Use fallback mock if capture fails
          sceneResult = await captureAndAnalyzeScene(selectedCamera);
        }
      } else {
        // No API key, use mock
        console.log('No API key available, using mock scene');
        sceneResult = await captureAndAnalyzeScene(selectedCamera);
      }
      
      clearInterval(finalInterval);
      
      // Update camera with results temporarily for display
      updateCameraStatus(selectedCamera.id, 'complete', {
        sceneAnalysis: sceneResult,
      });
      
      // Clear scene analysis after a brief display
      setTimeout(() => {
        updateCameraStatus(selectedCamera.id, 'complete', {
          sceneAnalysis: null,
        });
      }, 500);
      

      // Check if we have a Gemini API key for AOA configuration
      setDeploymentProgress(97);
      
      // Define completeSetupFlow inline
      const completeSetupFlow = async () => {
        await new Promise(resolve => setTimeout(resolve, 300));
        setDeploymentProgress(100);
        setDeploymentStatus('Setup complete!');
        
        // Camera configuration complete - no longer saving to persistent storage
        console.log('Camera setup completed successfully');
        
        // Update global camera context
        const globalCameraUpdate = {
          id: selectedCamera.id,
          name: selectedCamera.name || `Camera at ${selectedCamera.ip}`,
          ip: selectedCamera.ip,
          model: selectedCamera.model,
          mac: selectedCamera.mac || null,
          status: {
            credentials: {
              completed: true,
              username: credentials.username,
              password: credentials.password
            },
            discovery: {
              completed: true,
              ip: selectedCamera.ip,
              model: selectedCamera.model,
              firmwareVersion: selectedCamera.firmwareVersion
            },
            deployment: {
              completed: true,
              hasACAP: true,
              isLicensed: true,
              deployedFile: selectedACAPFile
            },
            speaker: {
              completed: configureSpeaker,
              configured: configureSpeaker && !!speakerConfig.ip,
              ip: speakerConfig.ip,
              username: speakerConfig.username,
              password: speakerConfig.password
            },
            verification: {
              completed: false
            }
          },
          lastUpdated: new Date()
        };
        updateCamera(selectedCamera.id, globalCameraUpdate);
        
        // NOTE: Background scene capture already started earlier, right after ACAP deployment
        // It's running in parallel while user configures speaker
        
        // Force step progression - clear deployment state and advance
        console.log('Deployment complete, advancing to step 3 (speaker config)');
        setDeploying(false);
        setDeploymentProgress(0);
        setDeploymentStatus('');
        
        // Mark step 2 as completed
        setCompleted(prev => ({ ...prev, 2: true }));
        
        // Use a callback to ensure state updates properly
        setActiveStep(prev => {
          console.log('Previous step was:', prev, 'advancing to 3');
          return 3;
        });
      };

      // Now check for API key and decide whether to show dialogs
      try {
        // First try to get the Gemini API key from config
        const geminiKey = await (window.electronAPI as any).getConfigValue?.('geminiApiKey');
        
        if (geminiKey) {
          setGeminiApiKey(geminiKey);
          // Show Vision Architect or AOA dialog for scenario creation
          if (useVisionArchitect) {
            setShowVisionArchitectDialog(true);
            setDeploymentStatus('Configure AI vision system...');
          } else {
            setShowAOADialog(true);
            setDeploymentStatus('Configure AI detection...');
          }
          return; // Don't complete yet, wait for dialog
        }
        
        // Fallback: try to get from deployments
        const savedDeployments = await (window.electronAPI as any).getConfigValue?.('deployments') || {};
        const projectIds = Object.keys(savedDeployments);
        if (projectIds.length > 0) {
          const deployment = savedDeployments[projectIds[0]];
          // Try to get API key from deployment
          const apiKey = deployment?.aiStudioApiKey || deployment?.geminiApiKey || '';
          if (apiKey) {
            setGeminiApiKey(apiKey);
            // Show Vision Architect or AOA dialog for scenario creation
            if (useVisionArchitect) {
              setShowVisionArchitectDialog(true);
              setDeploymentStatus('Configure AI vision system...');
            } else {
              setShowAOADialog(true);
              setDeploymentStatus('Configure AI detection...');
            }
            return; // Don't complete yet, wait for dialog
          }
        }
      } catch (error) {
        console.log('Could not get Gemini API key for AOA:', error);
      }
      
      // If no API key or error, complete normally
      await completeSetupFlow();

    } catch (error: any) {
      console.error('Deployment failed:', error);
      updateCameraStatus(selectedCamera.id, 'error', {
        error: error.message || 'Deployment failed',
      });
      setDeploymentStatus(`Error: ${error.message}`);
      setError(error.message || 'Deployment failed. Please check the logs and try again.');
      setDeploying(false); // Only set false on error
      // DO NOT advance to next step on error
    }
  };

  const updateCameraStatus = (cameraId: string, status: any, updates?: any) => {
    setCameras(prev => prev.map(cam => 
      cam.id === cameraId 
        ? { ...cam, status, ...updates }
        : cam
    ));
  };

  // Removed getFirebaseConfig - using real config inline

  const captureAndAnalyzeScene = async (camera: CameraInfo) => {
    // Mock implementation - would call actual VAPIX endpoint
    return {
      description: "I see a well-lit office space with a desk and computer monitor. The area appears secure with no immediate concerns.",
      imageBase64: "", // Would contain actual image
      audioMP3Base64: "", // Would contain audio response
    };
  };

  // Function removed - scene capture now happens inline right after ACAP deployment

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Camera Credentials
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Enter the username and password for your Axis cameras. These credentials will be used to connect and configure your devices.
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Username"
                  value={credentials.username}
                  onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                  helperText="Default is usually 'root'"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  type={showPassword ? 'text' : 'password'}
                  label="Password"
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Port"
                  type="number"
                  value={credentials.port || 443}
                  onChange={(e) => setCredentials({ ...credentials, port: parseInt(e.target.value) || 443 })}
                  helperText="HTTPS port (default: 443)"
                  inputProps={{ min: 1, max: 65535 }}
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleCredentialsSubmit}
                  disabled={!credentials.username || !credentials.password || validatingCredentials}
                  size="large"
                  startIcon={validatingCredentials ? <CircularProgress size={20} /> : null}
                >
                  {validatingCredentials ? 'Validating Credentials...' : 'Continue'}
                </Button>
              </Grid>
            </Grid>
          </Box>
        );

      case 1:
        return (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Choose how to connect to your camera
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Using credentials: {credentials.username}
                </Typography>
              </Box>
              <Button
                variant="text"
                onClick={() => {
                  setError(null);
                  setActiveStep(0);
                }}
                size="small"
              >
                Change Credentials
              </Button>
            </Box>


            <RadioGroup value={mode} onChange={(e) => setMode(e.target.value as any)}>
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <FormControlLabel
                  value="manual"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="subtitle2">Manual Entry</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Enter the IP address of your camera
                      </Typography>
                    </Box>
                  }
                />
                
                <Collapse in={mode === 'manual'}>
                  <Box sx={{ mt: 2, pl: 4 }}>
                    <TextField
                      fullWidth
                      label="Camera IP Address"
                      placeholder="192.168.1.100"
                      value={manualIP}
                      onChange={(e) => setManualIP(e.target.value)}
                      sx={{ mb: 2 }}
                    />
                    <Button
                      variant="contained"
                      onClick={handleManualConnect}
                      disabled={!manualIP || connecting}
                      startIcon={connecting ? <CircularProgress size={20} /> : <VideocamIcon />}
                    >
                      {connecting ? 'Connecting...' : 'Connect to Camera'}
                    </Button>
                  </Box>
                </Collapse>
              </Paper>

              <Paper variant="outlined" sx={{ p: 2 }}>
                <FormControlLabel
                  value="scan"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="subtitle2">
                        Scan Network for Axis Devices
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Search for cameras on your network
                      </Typography>
                    </Box>
                  }
                />
                
                <Collapse in={mode === 'scan'}>
                  <Box sx={{ mt: 2, pl: 4 }}>
                    <Button
                      variant="contained"
                      onClick={handleNetworkScan}
                      disabled={scanning}
                      startIcon={scanning ? <CircularProgress size={20} /> : <NetworkCheckIcon />}
                    >
                      {scanning ? 'Scanning...' : 'Start Network Scan'}
                    </Button>
                    
                    {scanning && (
                      <Box sx={{ mt: 2, width: '100%', maxWidth: 400 }}>
                        <LinearProgress 
                          variant="indeterminate"
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                          Scanning IPs: {scanProgress.current} • Found: {scanProgress.foundCount}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Collapse>
              </Paper>
            </RadioGroup>

            {cameras.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  {mode === 'manual' ? 'Connection Result:' : 'Found Cameras:'}
                </Typography>
                
                {/* Show info message if there are devices needing authentication */}
                {cameras.some(cam => cam.authRequired) && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      <strong>Tip:</strong> Orange devices require valid credentials. Click on any device with a warning icon to enter the correct username and password.
                    </Typography>
                  </Alert>
                )}
                
                <List>
                  {cameras.map((camera) => (
                    <Paper
                      key={camera.id}
                      variant="outlined"
                      sx={{
                        p: 2,
                        mb: 1,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' },
                        border: selectedCamera?.id === camera.id ? 2 : 1,
                        borderColor: selectedCamera?.id === camera.id ? 'primary.main' : 
                                      camera.authRequired ? 'warning.main' : 'divider',
                        bgcolor: camera.authRequired ? 'warning.light' : 'background.paper',
                        opacity: camera.authRequired ? 0.95 : 1
                      }}
                      onClick={() => {
                        if (camera.accessible && !camera.authRequired) {
                          setSelectedCamera(camera);
                        } else if (camera.authRequired) {
                          // Navigate back to credentials step with this camera's info
                          setSelectedCamera(camera);
                          setActiveStep(0);
                          setDeploymentStatus(`Please enter valid credentials for ${camera.name || camera.ip}`);
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box>
                          {camera.accessible ? (
                            <CheckCircleIcon color="success" sx={{ fontSize: 40 }} />
                          ) : camera.authRequired ? (
                            <WarningIcon sx={{ color: 'warning.dark', fontSize: 40 }} />
                          ) : connecting ? (
                            <CircularProgress size={40} />
                          ) : (
                            <ErrorIcon color="error" sx={{ fontSize: 40 }} />
                          )}
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle1" fontWeight="medium">
                            {camera.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {camera.ip} • {camera.model}
                          </Typography>
                          {camera.authRequired && (
                            <Alert severity="warning" sx={{ mt: 1, py: 0 }}>
                              <Typography variant="caption">
                                Valid credentials required - click to enter credentials
                              </Typography>
                            </Alert>
                          )}
                          {camera.error && (
                            <Alert severity="error" sx={{ mt: 1, py: 0 }}>
                              <Typography variant="caption">
                                {camera.error}
                              </Typography>
                            </Alert>
                          )}
                        </Box>
                      </Box>
                    </Paper>
                  ))}
                </List>
                
                {selectedCamera && selectedCamera.accessible && !selectedCamera.authRequired && (
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => {
                      setActiveStep(2);
                      setCompleted(prev => ({ ...prev, 0: true, 1: true }));
                    }}
                    sx={{ mt: 2 }}
                  >
                    Continue with Selected Camera
                  </Button>
                )}
                
                {cameras.length > 0 && !cameras.some(cam => cam.accessible && !cam.authRequired) && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      No accessible cameras found. Please click on a device above to enter valid credentials.
                    </Typography>
                  </Alert>
                )}
              </Box>
            )}
          </Box>
        );

      case 2:
        return (
          <Box>
            {selectedCamera && (
              <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item>
                      <VideocamIcon color="primary" fontSize="large" />
                    </Grid>
                    <Grid item xs>
                      <Typography variant="h6">{selectedCamera.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {selectedCamera.ip} • {selectedCamera.model}
                      </Typography>
                    </Grid>
                    {(licenseKey || selectedCamera.isLicensed) && (
                      <Grid item>
                        <Chip
                          icon={<SecurityIcon />}
                          label={selectedCamera.isLicensed ? "Already Licensed" : "Trial License Ready"}
                          color="success"
                          size="small"
                        />
                      </Grid>
                    )}
                  </Grid>
                </CardContent>
              </Card>
            )}

            {showLicensePrompt && (
              <Alert severity="warning" sx={{ mb: 3 }}>
                <AlertTitle>License Key Required</AlertTitle>
                <Typography variant="body2" gutterBottom>
                  This camera needs a license key to enable AI analytics.
                </Typography>
                
                <RadioGroup
                  value={licenseMode}
                  onChange={(e) => setLicenseMode(e.target.value as 'trial' | 'manual')}
                  sx={{ mt: 2 }}
                >
                  <FormControlLabel
                    value="trial"
                    control={<Radio />}
                    label={
                      <Box>
                        <Typography variant="body2">Get Trial License Automatically</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Instantly receive a free trial license
                        </Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel
                    value="manual"
                    control={<Radio />}
                    label={
                      <Box>
                        <Typography variant="body2">Enter License Key Manually</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Use your existing Anava license key
                        </Typography>
                      </Box>
                    }
                  />
                </RadioGroup>

                {licenseMode === 'manual' && (
                  <TextField
                    fullWidth
                    label="License Key"
                    value={manualLicenseKey}
                    onChange={(e) => setManualLicenseKey(e.target.value)}
                    placeholder="Enter your license key"
                    variant="outlined"
                    size="small"
                    sx={{ mt: 2 }}
                  />
                )}

                <Button
                  variant="contained"
                  size="small"
                  sx={{ mt: 2 }}
                  disabled={licenseMode === 'manual' && !manualLicenseKey.trim()}
                  onClick={async () => {
                    setShowLicensePrompt(false);
                    
                    if (licenseMode === 'manual') {
                      // Handle manual license key
                      setError('Validating license key...');
                      
                      try {
                        const result = await (window.electronAPI as any).license?.setManualKey?.({
                          key: manualLicenseKey,
                          email: await (window.electronAPI as any).getConfigValue?.('userEmail') || undefined
                        });
                        
                        if (result.success) {
                          setLicenseKey(manualLicenseKey);
                          setError(null);
                          setManualLicenseKey(''); // Clear the input field
                          // Retry deployment
                          handleDeploy();
                        } else {
                          setError(result.error || 'Failed to set license key');
                          setShowLicensePrompt(true);
                        }
                      } catch (error: any) {
                        setError(`Error setting license: ${error.message}`);
                        setShowLicensePrompt(true);
                      }
                    } else {
                      // Handle trial license (existing code)
                      setError('Getting trial license...');
                      
                      try {
                        // Get Firebase config
                        const firebaseConfig = {
                          apiKey: "AIzaSyCJbWAa-zQir1v8kmlye8Kv3kmhPb9r18s", // Correct API key for anava-ai
                          authDomain: "anava-ai.firebaseapp.com",
                          projectId: "anava-ai",
                          storageBucket: "anava-ai.appspot.com",
                          messagingSenderId: "392865621461",
                          appId: "1:392865621461:web:15db206ae4e9c72f7dc95c" // Anava Device Manager app
                        };
                        
                        // Try to get a trial license
                        const email = `trial-${Date.now()}@anava.ai`;
                        const result = await (window.electronAPI as any).license?.assignKey?.({
                          firebaseConfig,
                          email,
                          password: 'TrialUser123!'
                        });
                        
                        if (result.success && result.key) {
                          setLicenseKey(result.key);
                          setError(null);
                          // Store for future use
                          await (window.electronAPI as any).setConfigValue?.('userEmail', email);
                          // Retry deployment
                          handleDeploy();
                        } else {
                          setError(result.error || 'Failed to obtain trial license');
                        }
                      } catch (error: any) {
                        setError(`Error getting license: ${error.message}`);
                      }
                    }
                  }}
                >
                  {licenseMode === 'manual' ? 'Use This License' : 'Get Trial License'}
                </Button>
              </Alert>
            )}

            {!deploying && !selectedCamera?.sceneAnalysis && !showLicensePrompt && (
              <Box textAlign="center" sx={{ py: 3 }}>
                <CloudDownloadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Ready to Deploy AI Vision
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {selectedCamera?.isLicensed 
                    ? 'Camera already has AI analytics installed. Click to update configuration.'
                    : 'This will install Anava AI analytics, apply your license, and configure the camera.'}
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                  <Button
                    variant="outlined"
                    size="large"
                    onClick={() => {
                      setError(null);
                      setActiveStep(1);
                    }}
                  >
                    Back
                  </Button>
                  {(selectedCamera?.hasACAP || selectedCamera?.isLicensed) && (
                    <Button
                      variant="outlined"
                      size="large"
                      onClick={() => {
                        setActiveStep(3);
                        setCompleted(prev => ({ ...prev, 2: true }));
                      }}
                      startIcon={<SkipNextIcon />}
                    >
                      Skip to Speaker Config
                    </Button>
                  )}
                  <Button
                    variant="contained"
                    size="large"
                    onClick={handleDeploy}
                    startIcon={<PlayArrowIcon />}
                  >
                    {(selectedCamera?.hasACAP || selectedCamera?.isLicensed) ? 'Re-deploy ACAP' : 'Deploy & Configure'}
                  </Button>
                </Box>
              </Box>
            )}

            {deploying && (
              <Box sx={{ py: 3 }}>
                <Typography variant="h6" gutterBottom textAlign="center">
                  {deploymentStatus}
                </Typography>
                {selectedACAPFile && (
                  <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 1 }}>
                    Installing: {selectedACAPFile}
                  </Typography>
                )}
                <LinearProgress
                  variant="determinate"
                  value={deploymentProgress}
                  sx={{ mb: 2, height: 8, borderRadius: 4 }}
                />
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  {deploymentProgress}% complete
                </Typography>
              </Box>
            )}

          </Box>
        );

      case 3:
        // Vision AI Configuration Step
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Configure Vision AI System
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Use natural language to describe what you want your camera to detect and monitor.
            </Typography>
            
            {/* Manual camera entry if no camera selected */}
            {!selectedCamera && (
              <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'background.default' }}>
                <Typography variant="subtitle2" gutterBottom>
                  Camera Connection
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={3}>
                    <TextField
                      label="Camera IP Address"
                      value={manualCameraIp}
                      onChange={(e) => setManualCameraIp(e.target.value)}
                      placeholder="192.168.1.100"
                      fullWidth
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      label="Port"
                      type="number"
                      value={credentials.port || 443}
                      onChange={(e) => setCredentials(prev => ({ ...prev, port: parseInt(e.target.value) || 443 }))}
                      placeholder="443"
                      fullWidth
                      size="small"
                      inputProps={{ min: 1, max: 65535 }}
                    />
                  </Grid>
                  <Grid item xs={12} md={3.5}>
                    <TextField
                      label="Username"
                      value={credentials.username}
                      onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={3.5}>
                    <TextField
                      label="Password"
                      type="password"
                      value={credentials.password}
                      onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                </Grid>
              </Paper>
            )}
            
            {/* Show selected camera info */}
            {selectedCamera && (
              <Alert severity="success" sx={{ mb: 3 }}>
                <Typography variant="body2">
                  <strong>Connected Camera:</strong> {selectedCamera.name} ({selectedCamera.ip})
                </Typography>
              </Alert>
            )}
            
            {/* Vision Architect Interface */}
            <Paper variant="outlined" sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <SmartToyIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">
                  Vision AI Assistant
                </Typography>
              </Box>
              
              <Typography variant="body2" gutterBottom>
                Describe what you want to monitor. For example:
              </Typography>
              
              <Box sx={{ ml: 2, mb: 3 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  • "Detect people entering the building"<br/>
                  • "Monitor delivery trucks at the loading dock"<br/>
                  • "Alert when someone loiters for more than 30 seconds"<br/>
                  • "Count customers entering and track busy times"
                </Typography>
              </Box>
              
              <Button
                variant="contained"
                fullWidth
                size="large"
                startIcon={<AutoFixHighIcon />}
                onClick={() => {
                  // Set camera info for Vision Architect
                  if (!selectedCamera && manualCameraIp) {
                    // Create temporary camera object for manual entry
                    setSelectedCamera({
                      id: 'manual-camera',
                      ip: manualCameraIp,
                      name: `Camera at ${manualCameraIp}`,
                      model: 'Unknown',
                      accessible: true,
                      authRequired: false,
                      status: 'idle'
                    } as any);
                  }
                  setShowVisionArchitectDialog(true);
                }}
                disabled={!selectedCamera && (!manualCameraIp || !credentials.username || !credentials.password)}
              >
                Open Vision AI Configuration
              </Button>
              
              {(!selectedCamera && (!manualCameraIp || !credentials.username || !credentials.password)) && (
                <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                  Please enter camera details above or select a camera from previous steps
                </Typography>
              )}
              
              {/* API Key Configuration */}
              <Box sx={{ mt: 2 }}>
                <Button
                  variant="text"
                  size="small"
                  onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                  sx={{ textTransform: 'none' }}
                >
                  {showApiKeyInput ? 'Hide' : 'Use Custom'} API Key
                </Button>
                
                {showApiKeyInput && (
                  <Box sx={{ mt: 1 }}>
                    <TextField
                      label="Gemini API Key (Optional)"
                      value={geminiApiKey}
                      onChange={(e) => {
                        setGeminiApiKey(e.target.value);
                        localStorage.setItem('customGeminiApiKey', e.target.value);
                      }}
                      placeholder="Enter your Gemini API key for better rate limits"
                      fullWidth
                      size="small"
                      helperText="Get a free API key at ai.google.dev"
                      type="password"
                      InputProps={{
                        endAdornment: geminiApiKey !== 'AIzaSyD4TlgvKlDUZRn5nIuS6O-uMKKHEqu8qCQ' && (
                          <Typography variant="caption" color="success.main">
                            Custom Key Active
                          </Typography>
                        )
                      }}
                    />
                  </Box>
                )}
                
                {error && error.includes('quota') && (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    <Typography variant="caption">
                      The default API key has hit its rate limit. Please wait a few minutes or 
                      <Button 
                        size="small" 
                        onClick={() => setShowApiKeyInput(true)}
                        sx={{ ml: 1 }}
                      >
                        use your own API key
                      </Button>
                    </Typography>
                  </Alert>
                )}
              </Box>
            </Paper>
            
            <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
              <Button
                variant="outlined"
                onClick={() => setActiveStep(1)}
                startIcon={<SearchIcon />}
              >
                Find Camera
              </Button>
              
              <Box sx={{ flex: 1 }} />
              
              <Button
                variant="contained"
                onClick={() => {
                  setActiveStep(5);
                  setCompleted(prev => ({ ...prev, 3: true }));
                }}
                disabled={!selectedCamera && !manualCameraIp}
              >
                Continue
              </Button>
            </Box>
          </Box>
        );
        
      case 4:
        // Speaker Configuration (was case 3)
        return (
          <Box sx={{ position: 'relative' }}>
            {/* Loading overlay */}
            {processingSpeakerConfig && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  zIndex: 1000,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 1
                }}
              >
                <CircularProgress size={60} thickness={4} />
                <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
                  Configuring Speaker...
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Pushing configuration to camera, this may take up to 10 seconds
                </Typography>
              </Box>
            )}
            
            <Typography variant="h6" gutterBottom>
              Optional: Configure Audio Speaker
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              If you have an Axis network speaker, you can associate it with this camera to enable audio responses when the AI detects specific events. This allows your system to actively engage with the environment through audible deterrents or notifications.
            </Typography>
            
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Grid container spacing={2} alignItems="center">
                  <Grid item>
                    <SpeakerIcon sx={{ fontSize: 48, color: 'action.active' }} />
                  </Grid>
                  <Grid item xs>
                    <Typography variant="subtitle1">
                      Audio Deterrence System
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Play pre-recorded messages when suspicious activity is detected
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
            
            <FormControlLabel
              control={
                <Switch
                  checked={configureSpeaker}
                  onChange={(e) => {
                    setConfigureSpeaker(e.target.checked);
                    // When enabling speaker config, default to camera credentials
                    if (e.target.checked && credentials.username && credentials.password) {
                      setSpeakerConfig(prev => ({
                        ...prev,
                        username: credentials.username,
                        password: credentials.password
                      }));
                    }
                  }}
                />
              }
              label="I have a network speaker to configure"
              sx={{ mb: 3 }}
            />
            
            <Collapse in={configureSpeaker}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  {availableSpeakers.length > 0 ? (
                    <TextField
                      fullWidth
                      select
                      label="Select Speaker"
                      value={speakerConfig.ip}
                      onChange={(e) => {
                        const selectedSpeaker = availableSpeakers.find(s => s.ip === e.target.value);
                        if (selectedSpeaker) {
                          setSpeakerConfig({
                            ...speakerConfig,
                            ip: selectedSpeaker.ip
                          });
                        }
                      }}
                      helperText={`Found ${availableSpeakers.length} speaker(s) on your network`}
                    >
                      {availableSpeakers.map((speaker) => (
                        <MenuItem key={speaker.ip} value={speaker.ip}>
                          {speaker.model ? `${speaker.model} (${speaker.ip})` : speaker.ip}
                        </MenuItem>
                      ))}
                      <MenuItem value="">
                        <em>Enter manually</em>
                      </MenuItem>
                    </TextField>
                  ) : (
                    <TextField
                      fullWidth
                      label="Speaker IP Address"
                      value={speakerConfig.ip}
                      onChange={(e) => setSpeakerConfig({ ...speakerConfig, ip: e.target.value })}
                      placeholder="192.168.1.101"
                      helperText="IP address of your Axis network speaker"
                    />
                  )}
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Speaker Username"
                    value={speakerConfig.username}
                    onChange={(e) => setSpeakerConfig({ ...speakerConfig, username: e.target.value })}
                    helperText="Default is usually 'root'"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    type={showSpeakerPassword ? 'text' : 'password'}
                    label="Speaker Password"
                    value={speakerConfig.password}
                    onChange={(e) => setSpeakerConfig({ ...speakerConfig, password: e.target.value })}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowSpeakerPassword(!showSpeakerPassword)}
                            edge="end"
                          >
                            {showSpeakerPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
              </Grid>
            </Collapse>
            
            <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                onClick={() => {
                  setActiveStep(4);
                  setCompleted(prev => ({ ...prev, 3: true }));
                }}
                startIcon={<SkipNextIcon />}
              >
                Skip This Step
              </Button>
              {configureSpeaker && speakerConfig.ip && speakerConfig.password && (
                <Button
                  variant="outlined"
                  onClick={async () => {
                    setTestingSpeaker(true);
                    setError(null);
                    try {
                      // Use IPC to test speaker with proper digest authentication
                      console.log('Testing speaker via IPC with digest auth...');
                      const result = await (window.electronAPI as any).testSpeakerAudio?.(
                        speakerConfig.ip,
                        speakerConfig.username,
                        speakerConfig.password
                      );
                      
                      if (result?.success) {
                        console.log('Speaker test successful:', result.message);
                        setError(null); // Clear any previous errors
                        // Show success feedback
                        const tempMsg = 'Speaker test successful! Audio should be playing.';
                        setDeploymentStatus(tempMsg);
                        setTimeout(() => setDeploymentStatus(''), 3000);
                      } else {
                        setError(result?.error || 'Failed to test speaker audio');
                      }
                    } catch (error: any) {
                      console.error('Speaker test error:', error);
                      setError('Failed to test speaker. Please check the connection and credentials.');
                    } finally {
                      setTestingSpeaker(false);
                    }
                  }}
                  disabled={testingSpeaker}
                  startIcon={testingSpeaker ? <CircularProgress size={20} /> : <VolumeUpIcon />}
                >
                  {testingSpeaker ? 'Testing...' : 'Test Speaker Config'}
                </Button>
              )}
              <Button
                variant="contained"
                onClick={async () => {
                  // Set loading state
                  setProcessingSpeakerConfig(true);
                  
                  // Save speaker config if configured
                  if (configureSpeaker && speakerConfig.ip) {
                    console.log('Speaker configured:', speakerConfig);
                    
                    // Push the speaker configuration to the camera
                    try {
                      console.log('Pushing speaker configuration to camera...');
                      
                      // Get the current deployment info if available
                      const savedDeployments = await (window.electronAPI as any).getConfigValue?.('deployments') || {};
                      const projectIds = Object.keys(savedDeployments);
                      let deployment = null;
                      
                      // Find any deployment that we can use for config
                      if (projectIds.length > 0) {
                        deployment = savedDeployments[projectIds[0]];
                      }
                      
                      // Build the system config with speaker info
                      const systemConfig: any = {
                        firebase: deployment?.firebaseConfig || {
                          apiKey: "AIzaSyCJbWAa-zQir1v8kmlye8Kv3kmhPb9r18s",
                          authDomain: "anava-ai.firebaseapp.com",
                          projectId: "anava-ai",
                          storageBucket: "anava-ai.appspot.com",
                          messagingSenderId: "392865621461",
                          appId: "1:392865621461:web:15db206ae4e9c72f7dc95c",
                          databaseId: "(default)"
                        },
                        gemini: deployment ? {
                          apiKey: '',
                          vertexApiGatewayUrl: deployment.apiGatewayUrl || '',
                          vertexApiGatewayKey: deployment.apiKey || '',
                          vertexGcpProjectId: deployment.projectId || '',
                          vertexGcpRegion: deployment.region || 'us-central1',
                          vertexGcsBucketName: deployment.gcsBucketName || ''
                        } : {
                          apiKey: '',
                          vertexApiGatewayUrl: '',
                          vertexApiGatewayKey: '',
                          vertexGcpProjectId: '',
                          vertexGcpRegion: 'us-central1',
                          vertexGcsBucketName: ''
                        },
                        anavaKey: licenseKey || '',
                        customerId: deployment?.customerId || 'trial-user',
                        axis: {
                          speakerIp: speakerConfig.ip,
                          speakerUser: speakerConfig.username,
                          speakerPass: speakerConfig.password
                        }
                      };
                      
                      console.log('Pushing speaker config to camera:', systemConfig.axis);
                      
                      const result = await (window.electronAPI as any).pushSystemConfig({
                        cameraIp: selectedCamera?.ip,
                        username: credentials.username,
                        password: credentials.password,
                        systemConfig
                      });
                      
                      if (result.success) {
                        console.log('Speaker configuration pushed successfully');
                        
                        // Update the camera object with speaker info
                        if (selectedCamera) {
                          const updatedCamera = {
                            ...selectedCamera,
                            hasSpeaker: true,
                            speaker: {
                              ip: speakerConfig.ip,
                              username: speakerConfig.username,
                              password: speakerConfig.password
                            }
                          };
                          setSelectedCamera(updatedCamera);
                          
                          // Update global camera context with speaker info
                          updateCamera(selectedCamera.id, {
                            status: {
                              speaker: {
                                completed: true,
                                configured: true,
                                ip: speakerConfig.ip,
                                username: speakerConfig.username,
                                password: speakerConfig.password
                              }
                            }
                          });
                        }
                      } else {
                        console.error('Failed to push speaker configuration:', result.error);
                        // Still continue even if push fails
                      }
                    } catch (error) {
                      console.error('Error pushing speaker configuration:', error);
                      // Still continue even if push fails
                    }
                  }
                  // Mark speaker config as completed and move to next step
                  setCompleted(prev => ({ ...prev, 3: true }));
                  setActiveStep(4);
                  
                  // Clear loading state
                  setProcessingSpeakerConfig(false);
                }}
                disabled={processingSpeakerConfig || (configureSpeaker && (!speakerConfig.ip || !speakerConfig.password))}
                startIcon={processingSpeakerConfig ? <CircularProgress size={20} color="inherit" /> : null}
              >
                {processingSpeakerConfig ? 'Configuring Speaker...' : 'Continue'}
              </Button>
            </Box>
          </Box>
        );

      case 5:
        // Complete step (was case 4)
        return (
          <Box textAlign="center" sx={{ py: 4 }}>
            <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Setup Complete!
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Your camera is now equipped with AI-powered analytics.
            </Typography>
            
            <Box sx={{ mt: 4 }}>
              <Button
                variant="contained"
                fullWidth
                onClick={() => setShowDetectionModal(true)}
                startIcon={<SmartToyIcon />}
                size="large"
                color="primary"
                sx={{ py: 2, fontSize: '1.1rem' }}
              >
                Test AI Vision Now
              </Button>
              
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 3 }} align="center">
                See what your AI-powered camera can detect
              </Typography>
              
              <Grid container spacing={2} sx={{ mt: 2 }}>
                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => {
                      // Save current camera to context before navigating
                      if (selectedCamera) {
                        updateCamera(selectedCamera.id, {
                          ...selectedCamera,
                          credentials: { username: credentials.username, password: credentials.password }
                        });
                      }
                      // Navigate to Private Cloud Setup
                      if (onNavigate) {
                        onNavigate('gcp-setup');
                      }
                    }}
                    startIcon={<CloudDownloadIcon />}
                    color="secondary"
                    size="large"
                    sx={{ py: 1.5 }}
                  >
                    Setup Private Cloud
                  </Button>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    Deploy your own Google Cloud infrastructure for this camera
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => {
                      const url = `https://${selectedCamera?.ip}/local/BatonAnalytic/local-events.html`;
                      window.open(url, '_blank');
                    }}
                    startIcon={<OpenInNewIcon />}
                  >
                    Open Camera UI
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => {
                      // Clear state for new camera setup
                      localStorage.removeItem('cameraSetupState');
                      setActiveStep(0);
                      setCompleted({});
                      setMode('manual');
                      setCredentials({ username: 'root', password: '' });
                      setManualIP('');
                      setCameras([]);
                      setSelectedCamera(null);
                      setSelectedACAPFile(null);
                      setDeploymentProgress(0);
                      setDeploymentStatus('');
                      setSceneDescription('');
                      setSceneImage('');
                      setLicenseMode('trial');
                      setManualLicenseKey('');
                      setConfigureSpeaker(false);
                      setSpeakerConfig({ ip: '', username: 'root', password: '' });
                      setAvailableSpeakers([]);
                      setError(null);
                      // Reload license key for fresh start
                      loadLicenseKey();
                    }}
                    startIcon={<VideocamIcon />}
                  >
                    Set Up Another Camera
                  </Button>
                </Grid>
              </Grid>
              
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 3, textAlign: 'center' }}>
                The Camera UI allows you to view live events and manage settings directly on the camera
              </Typography>
            </Box>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Camera Setup
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Get your first camera running with AI analytics in minutes
          </Typography>
        </Box>
        {(activeStep > 0 || selectedCamera) && (
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              if (window.confirm('Start a new camera setup? This will clear your current progress.')) {
                // Clear all state
                localStorage.removeItem('cameraSetupState');
                setActiveStep(0);
                setCompleted({});
                setMode('manual');
                setCredentials({ username: 'root', password: '' });
                setManualIP('');
                setCameras([]);
                setSelectedCamera(null);
                setSelectedACAPFile(null);
                setLicenseKey(null);
                setSceneDescription('');
                setSceneImage('');
                setLicenseMode('trial');
                setManualLicenseKey('');
                setConfigureSpeaker(false);
                setSpeakerConfig({ ip: '', username: 'root', password: '' });
                setAvailableSpeakers([]);
                setError(null);
                // Reload license key for fresh start
                loadLicenseKey();
              }
            }}
            startIcon={<RefreshIcon />}
          >
            Start Fresh Setup
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {licenseKey && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            Your trial license key: <strong>{licenseKey}</strong>
          </Typography>
        </Alert>
      )}

      <Stepper activeStep={activeStep} orientation="vertical" nonLinear>
        <Step completed={completed[0]}>
          <StepLabel 
            onClick={() => setActiveStep(0)}
            sx={{ cursor: 'pointer' }}
          >
            Enter Camera Credentials
          </StepLabel>
          <StepContent>{getStepContent(0)}</StepContent>
        </Step>
        
        <Step completed={completed[1]}>
          <StepLabel 
            onClick={() => {
              if (completed[0] || selectedCamera) {
                setActiveStep(1);
              }
            }}
            sx={{ cursor: (completed[0] || selectedCamera) ? 'pointer' : 'default' }}
          >
            Find Your Camera
          </StepLabel>
          <StepContent>{getStepContent(1)}</StepContent>
        </Step>
        
        <Step completed={completed[2]}>
          <StepLabel 
            onClick={() => {
              if (selectedCamera) {
                setActiveStep(2);
              }
            }}
            sx={{ cursor: selectedCamera ? 'pointer' : 'default' }}
          >
            Deploy Anava
            {selectedACAPFile && (activeStep > 2 || completed[2]) && (
              <Typography 
                component="span" 
                variant="caption" 
                sx={{ 
                  ml: 1, 
                  fontStyle: 'italic', 
                  color: 'text.secondary' 
                }}
              >
                Deployed {selectedACAPFile}
              </Typography>
            )}
          </StepLabel>
          <StepContent>{getStepContent(2)}</StepContent>
        </Step>
        
        <Step completed={completed[3]}>
          <StepLabel 
            onClick={() => {
              // Allow jumping to Vision Architect if camera is selected
              // Can access this even without ACAP deployment
              if (selectedCamera || (credentials.username && credentials.password)) {
                setActiveStep(3);
              }
            }}
            sx={{ cursor: (selectedCamera || (credentials.username && credentials.password)) ? 'pointer' : 'default' }}
          >
            Configure Vision AI
            <Typography variant="caption" sx={{ ml: 1, color: 'primary.main' }}>
              (New!)
            </Typography>
          </StepLabel>
          <StepContent>{getStepContent(3)}</StepContent>
        </Step>
        
        <Step completed={completed[4]}>
          <StepLabel 
            optional={<Typography variant="caption">Optional</Typography>}
            onClick={() => {
              // Allow jumping to speaker config if camera is selected and either:
              // - Step 2 is completed, or
              // - Camera has ACAP installed, or  
              // - Camera was loaded from previously configured (has credentials)
              if (selectedCamera && (completed[2] || selectedCamera?.hasACAP || selectedCamera?.isLicensed || completed[1])) {
                setActiveStep(4);
              }
            }}
            sx={{ cursor: (selectedCamera && (completed[2] || selectedCamera?.hasACAP || selectedCamera?.isLicensed || completed[1])) ? 'pointer' : 'default' }}
          >
            Configure Audio Speaker
          </StepLabel>
          <StepContent>{getStepContent(4)}</StepContent>
        </Step>
        
        <Step completed={completed[5]}>
          <StepLabel 
            onClick={() => {
              // Allow jumping to complete if deployment is done or speaker is configured
              if (selectedCamera && (completed[2] || completed[3] || completed[4] || selectedCamera?.hasACAP)) {
                setActiveStep(5);
              }
            }}
            sx={{ cursor: (selectedCamera && (completed[2] || completed[3] || completed[4] || selectedCamera?.hasACAP)) ? 'pointer' : 'default' }}
          >
            Complete
          </StepLabel>
          <StepContent>{getStepContent(5)}</StepContent>
        </Step>
      </Stepper>
      
      {/* Detection Test Modal */}
      <DetectionTestModal
        open={showDetectionModal}
        onClose={() => setShowDetectionModal(false)}
        camera={selectedCamera ? {
          ...selectedCamera,
          credentials: {
            username: credentials.username,
            password: credentials.password
          }
        } : null}
        speakerConfig={configureSpeaker ? speakerConfig : undefined}
      />
      
      {/* AOA Scenario Dialog */}
      {selectedCamera && credentials.username && credentials.password && (
        <AOAScenarioDialog
          open={showAOADialog}
          cameraIp={selectedCamera.ip}
          cameraPort={selectedCamera.port}
          username={credentials.username}
          password={credentials.password}
          geminiApiKey={geminiApiKey}
          onComplete={() => {
            setShowAOADialog(false);
            completeSetupFlow();
          }}
          onSkip={() => {
            setShowAOADialog(false);
            completeSetupFlow();
          }}
        />
      )}
      
      {/* Vision Architect Dialog - Revolutionary AI system */}
      {selectedCamera && credentials.username && credentials.password && (
        <VisionArchitectDialog
          open={showVisionArchitectDialog}
          cameraIp={selectedCamera.ip}
          cameraPort={selectedCamera.port}
          username={credentials.username}
          password={credentials.password}
          geminiApiKey={geminiApiKey}
          onComplete={() => {
            setShowVisionArchitectDialog(false);
            completeSetupFlow();
          }}
          onSkip={() => {
            setShowVisionArchitectDialog(false);
            completeSetupFlow();
          }}
        />
      )}
      
      {/* Navigation warning disabled - app doesn't use React Router */}
    </Box>
  );
};

export default CameraSetupPage;