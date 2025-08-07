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
  IconButton,
  InputAdornment,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  Chip,
  LinearProgress,
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
import {
  Visibility,
  VisibilityOff,
  Videocam as VideocamIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  VolumeUp as VolumeUpIcon,
  NetworkCheck as NetworkCheckIcon,
  PlayArrow as PlayArrowIcon,
  Security as SecurityIcon,
  CloudDownload as CloudDownloadIcon,
  Speaker as SpeakerIcon,
  SkipNext as SkipNextIcon,
  SmartToy as SmartToyIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';

interface CameraInfo {
  id: string;
  ip: string;
  model: string;
  name: string;
  firmwareVersion?: string;
  accessible: boolean;
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
  const [activeStep, setActiveStep] = useState(0);
  const [completed, setCompleted] = useState<{ [key: number]: boolean }>({});
  const [previouslyConfiguredCameras, setPreviouslyConfiguredCameras] = useState<any[]>([]);
  const [mode, setMode] = useState<'manual' | 'scan'>('manual');
  const [credentials, setCredentials] = useState({
    username: 'root',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [manualIP, setManualIP] = useState('');
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<CameraInfo | null>(null);
  const [deploymentProgress, setDeploymentProgress] = useState(0);
  const [deploymentStatus, setDeploymentStatus] = useState('');
  const [selectedACAPFile, setSelectedACAPFile] = useState<string | null>(null);
  const [licenseKey, setLicenseKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLicensePrompt, setShowLicensePrompt] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [sceneDescription, setSceneDescription] = useState('');
  const [sceneImage, setSceneImage] = useState('');
  const [licenseMode, setLicenseMode] = useState<'trial' | 'manual'>('trial');
  const [manualLicenseKey, setManualLicenseKey] = useState('');
  const [hasPreDiscoveredCameras, setHasPreDiscoveredCameras] = useState(false);
  
  // Speaker configuration state
  const [configureSpeaker, setConfigureSpeaker] = useState(false);
  const [speakerConfig, setSpeakerConfig] = useState({
    ip: '',
    username: 'root',
    password: ''
  });
  const [showSpeakerPassword, setShowSpeakerPassword] = useState(false);
  const [availableSpeakers, setAvailableSpeakers] = useState<Array<{ ip: string; model?: string }>>([]);
  const [testingSpeaker, setTestingSpeaker] = useState(false);
  const [showDetectionModal, setShowDetectionModal] = useState(false);

  // Load license key, previously configured cameras, and check for pre-discovered cameras on mount
  useEffect(() => {
    loadLicenseKey();
    loadPreviouslyConfiguredCameras();
    checkPreDiscoveredCameras();
  }, []);

  const loadPreviouslyConfiguredCameras = async () => {
    try {
      const configuredCameras = await (window.electronAPI as any).getConfigValue?.('configuredCameras') || [];
      setPreviouslyConfiguredCameras(configuredCameras);
      console.log('Loaded previously configured cameras:', configuredCameras);
    } catch (error) {
      console.error('Failed to load configured cameras:', error);
    }
  };

  const loadLicenseKey = async () => {
    try {
      const result = await (window.electronAPI as any).license?.getAssignedKey?.();
      if (result.success && result.key) {
        setLicenseKey(result.key);
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
            setHasPreDiscoveredCameras(true);
          } else {
            // No cameras found
            setCameras([]);
            setHasPreDiscoveredCameras(false);
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
          setHasPreDiscoveredCameras(false);
        }
      } catch (error) {
        console.error('Failed to classify devices:', error);
        setCameras([]);
        setHasPreDiscoveredCameras(false);
      }
      
      setActiveStep(1);
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
    setScanning(true);
    setCameras([]);
    
    try {
      // First, classify any pre-discovered Axis devices with current credentials
      const classified = await (window.electronAPI as any).camera?.classifyAxisDevices?.(credentials);
      console.log('Classification result:', classified);
      
      // Check if we have pre-discovered and now classified cameras
      const preDiscovered = await (window.electronAPI as any).camera?.getPreDiscoveredCameras?.();
      console.log('Pre-discovered response:', preDiscovered);
      
      if (classified && classified.cameras && classified.cameras.length > 0) {
        console.log('Using classified cameras:', classified.cameras.length);
        
        const formattedCameras: CameraInfo[] = classified.cameras.map((cam: any) => ({
          id: cam.id || `camera-${cam.ip}`,
          ip: cam.ip,
          model: cam.model || 'Unknown',
          name: cam.name || `Camera at ${cam.ip}`,
          firmwareVersion: cam.firmwareVersion,
          accessible: cam.authenticated || cam.status === 'accessible' || false,
          hasACAP: false,
          isLicensed: false,
          status: 'idle',
          credentials: cam.credentials
        }));

        setCameras(formattedCameras);
        setScanning(false); // Stop scanning animation
        
        // Auto-select first accessible camera
        const firstAccessible = formattedCameras.find(cam => cam.accessible);
        if (firstAccessible) {
          setSelectedCamera(firstAccessible);
          setActiveStep(2);
          setCompleted(prev => ({ ...prev, 0: true, 1: true }));
        }
        
        return;
      }
      
      // If no pre-discovered cameras, do a fresh scan
      console.log('No pre-discovered cameras, performing fresh scan...');
      
      const results = await (window.electronAPI as any).enhancedScanNetwork?.({
        credentials: [{
          username: credentials.username,
          password: credentials.password,
        }],
        concurrent: 50,
        timeout: 2000,
      });

      const formattedCameras: CameraInfo[] = results.map((cam: any) => ({
        id: cam.id || `camera-${cam.ip}`,
        ip: cam.ip,
        model: cam.model || 'Unknown',
        name: cam.name || `Camera at ${cam.ip}`,
        firmwareVersion: cam.firmwareVersion,
        accessible: cam.accessible || false,
        hasACAP: false,
        isLicensed: false,
        status: 'idle',
      }));

      setCameras(formattedCameras);
      
      // Auto-select first accessible camera
      const firstAccessible = formattedCameras.find(cam => cam.accessible);
      if (firstAccessible) {
        setSelectedCamera(firstAccessible);
        setActiveStep(2);
        setCompleted(prev => ({ ...prev, 0: true, 1: true }));
      }
    } catch (error) {
      console.error('Network scan failed:', error);
    } finally {
      setScanning(false);
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

        await (window.electronAPI as any).activateLicenseKey?.(
          selectedCamera.ip,
          credentials.username,
          credentials.password,
          licenseKey,
          'BatonAnalytic'
        );
        
        clearInterval(licenseInterval);
        setDeploymentProgress(68);
      } else if (selectedCamera.isLicensed) {
        setDeploymentProgress(68);
        setDeploymentStatus('Camera already licensed, updating configuration...');
      }

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
      
      // Get Firebase config (we'll need to implement this)
      const firebaseConfig = await getFirebaseConfig();
      
      const configPayload = {
        firebase: firebaseConfig,
        gemini: {
          apiKey: '', // Will be set if using AI Studio mode
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

      // Get scene description with audio
      const sceneResult = await captureAndAnalyzeScene(selectedCamera);
      
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
      

      // Smoothly complete to 100%
      setDeploymentProgress(97);
      await new Promise(resolve => setTimeout(resolve, 300));
      setDeploymentProgress(100);
      setDeploymentStatus('Setup complete!');
      
      // Save configured camera for Detection Test page
      const configuredCamera = {
        id: selectedCamera.id,
        ip: selectedCamera.ip,
        name: selectedCamera.model || `Camera at ${selectedCamera.ip}`,
        hasACAP: true,
        hasSpeaker: configureSpeaker && speakerConfig.ip ? true : false,
        speaker: configureSpeaker && speakerConfig.ip ? {
          ip: speakerConfig.ip,
          username: speakerConfig.username,
          password: speakerConfig.password
        } : undefined,
        credentials: {
          username: credentials.username,
          password: credentials.password
        },
        isConfigured: true,
        configuredAt: new Date().toISOString()
      };
      
      // Get existing configured cameras
      const existingCameras = await (window.electronAPI as any).getConfigValue?.('configuredCameras') || [];
      
      // Add or update this camera
      const updatedCameras = existingCameras.filter((cam: any) => cam.ip !== selectedCamera.ip);
      updatedCameras.push(configuredCamera);
      
      // Save to config
      await (window.electronAPI as any).setConfigValue?.('configuredCameras', updatedCameras);
      console.log('Saved configured camera:', configuredCamera);
      
      // Start background scene capture for Detection Test page
      // This runs in the background while user configures speaker
      startBackgroundSceneCapture(configuredCamera);
      
      // Force step progression - clear deployment state and advance
      console.log('Deployment complete, advancing to step 3 (speaker config)');
      setDeploying(false);
      setDeploymentProgress(0);
      setDeploymentStatus('');
      
      // Use a callback to ensure state updates properly
      setActiveStep(prev => {
        console.log('Previous step was:', prev, 'advancing to 3');
        return 3;
      });

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

  const getFirebaseConfig = async () => {
    // For now, return a mock config
    // In production, this would fetch from your deployment
    return {
      apiKey: "AIzaSyDemoKey",
      authDomain: "demo.firebaseapp.com",
      projectId: "anava-demo",
      storageBucket: "anava-demo.appspot.com",
      messagingSenderId: "123456789",
      appId: "1:123456789:web:abcdef",
      databaseId: "(default)",
    };
  };

  const captureAndAnalyzeScene = async (camera: CameraInfo) => {
    // Mock implementation - would call actual VAPIX endpoint
    return {
      description: "I see a well-lit office space with a desk and computer monitor. The area appears secure with no immediate concerns.",
      imageBase64: "", // Would contain actual image
      audioMP3Base64: "", // Would contain audio response
    };
  };

  const startBackgroundSceneCapture = async (camera: any) => {
    try {
      console.log('Starting background scene capture for Detection Test page...');
      
      // Get API key
      const apiKey = await (window.electronAPI as any).getConfigValue?.('geminiApiKey');
      if (!apiKey) {
        console.log('No API key available, skipping background capture');
        return;
      }
      
      // Start the capture in the background - don't await
      (window.electronAPI as any).getSceneDescription?.(
        camera,
        apiKey,
        camera.hasSpeaker
      ).then(result => {
        if (result.success) {
          // Store the pre-fetched scene data
          (window.electronAPI as any).setConfigValue?.('preFetchedScene', {
            cameraId: camera.id,
            cameraIp: camera.ip,
            description: result.description,
            imageBase64: result.imageBase64,
            audioBase64: result.audioBase64,
            audioFormat: result.audioFormat,
            audioMP3Base64: result.audioMP3Base64,
            timestamp: Date.now(),
            hasSpeaker: camera.hasSpeaker || false
          });
          console.log('Background scene capture completed successfully');
        } else {
          console.error('Background scene capture failed:', result.error);
        }
      }).catch(err => {
        console.error('Background scene capture error:', err);
      });
    } catch (error) {
      console.error('Failed to start background scene capture:', error);
    }
  };

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box>
            {previouslyConfiguredCameras.length > 0 && (
              <Box mb={3}>
                <Alert severity="info" sx={{ mb: 2 }}>
                  <AlertTitle>Previously Configured Cameras</AlertTitle>
                  You can select a camera below to edit its configuration or set up a new camera.
                </Alert>
                
                <List>
                  {previouslyConfiguredCameras.map((camera: any) => (
                    <ListItem
                      key={camera.id}
                      component="div"
                      onClick={() => {
                        // Load the camera's credentials and data
                        setSelectedCamera(camera);
                        setCredentials({
                          username: camera.credentials?.username || 'root',
                          password: camera.credentials?.password || ''
                        });
                        if (camera.speaker) {
                          setConfigureSpeaker(true);
                          setSpeakerConfig({
                            ip: camera.speaker.ip,
                            username: camera.speaker.username || 'root',
                            password: camera.speaker.password
                          });
                        }
                        
                        // Store the license key if available
                        if (camera.licenseKey) {
                          setLicenseKey(camera.licenseKey);
                        }
                        
                        // Mark steps as completed based on camera state
                        const newCompleted: { [key: number]: boolean } = {
                          0: true, // Credentials are set
                          1: true, // Camera is already found
                        };
                        
                        // If camera has ACAP installed, mark deploy step as complete
                        if (camera.hasACAP || camera.isLicensed) {
                          newCompleted[2] = true;
                        }
                        
                        // If camera has speaker configured, mark that step as complete
                        if (camera.hasSpeaker) {
                          newCompleted[3] = true;
                        }
                        
                        setCompleted(newCompleted);
                        
                        // Determine which step to show based on what needs attention
                        let targetStep = 2; // Default to deployment
                        if (!newCompleted[2]) {
                          targetStep = 2; // Need to deploy ACAP
                        } else if (!newCompleted[3] && !camera.hasSpeaker) {
                          targetStep = 3; // ACAP done, maybe configure speaker
                        } else {
                          targetStep = 4; // Everything done, go to complete
                        }
                        
                        setActiveStep(targetStep);
                      }}
                      sx={{
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        mb: 1,
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: 'action.hover'
                        }
                      }}
                    >
                      <ListItemIcon>
                        <VideocamIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary={camera.name || camera.model || `Camera at ${camera.ip}`}
                        secondary={
                          <>
                            IP: {camera.ip}
                            {camera.hasSpeaker && ' • Has Speaker'}
                            {camera.isLicensed && ' • Licensed'}
                          </>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton edge="end">
                          <PlayArrowIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
                
                <Divider sx={{ my: 3 }}>
                  <Chip label="OR" />
                </Divider>
              </Box>
            )}
            
            <Typography variant="h6" gutterBottom>
              {previouslyConfiguredCameras.length > 0 ? 'Set Up New Camera' : 'Camera Credentials'}
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
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleCredentialsSubmit}
                  disabled={!credentials.username || !credentials.password}
                  size="large"
                >
                  {previouslyConfiguredCameras.length > 0 ? 'Next: Find New Camera' : 'Continue'}
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

            {/* Show dropdown if cameras were pre-discovered, otherwise show "No Cameras" message */}
            {hasPreDiscoveredCameras ? (
              <Box sx={{ mb: 3 }}>
                <FormControl fullWidth>
                  <InputLabel>Select Camera from Network</InputLabel>
                  <Select
                    value={selectedCamera?.id || ''}
                    label="Select Camera from Network"
                    onChange={async (e: any) => {
                      const cameraId = e.target.value;
                      const camera = cameras.find(c => c.id === cameraId);
                      if (camera) {
                        setSelectedCamera(camera);
                      }
                    }}
                  >
                    {cameras.map((camera) => (
                      <MenuItem key={camera.id} value={camera.id}>
                        {camera.name} - {camera.ip} ({camera.model})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {cameras.length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    {cameras.length} camera{cameras.length !== 1 ? 's' : ''} discovered on your network
                  </Typography>
                )}
              </Box>
            ) : (
              <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  No Cameras Automatically Discovered
                </Typography>
              </Box>
            )}

            <Divider sx={{ my: 3 }}>
              <Typography variant="caption" color="text.secondary">OR</Typography>
            </Divider>

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
                        Scan Network Again
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
                  </Box>
                </Collapse>
              </Paper>
            </RadioGroup>

            {cameras.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  {mode === 'manual' ? 'Connection Result:' : 'Found Cameras:'}
                </Typography>
                <List>
                  {cameras.map((camera) => (
                    <Paper
                      key={camera.id}
                      variant="outlined"
                      sx={{
                        p: 2,
                        mb: 1,
                        cursor: camera.accessible ? 'pointer' : 'default',
                        '&:hover': camera.accessible ? { bgcolor: 'action.hover' } : {},
                        border: selectedCamera?.id === camera.id ? 2 : 1,
                        borderColor: selectedCamera?.id === camera.id ? 'primary.main' : 'divider'
                      }}
                      onClick={() => camera.accessible && setSelectedCamera(camera)}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box>
                          {camera.accessible ? (
                            <CheckCircleIcon color="success" sx={{ fontSize: 40 }} />
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
                
                {selectedCamera && (
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
        return (
          <Box>
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
                  onChange={(e) => setConfigureSpeaker(e.target.checked)}
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
                          
                          // Update saved cameras
                          const configuredCameras = await (window.electronAPI as any).getConfigValue?.('configuredCameras') || [];
                          const cameraIndex = configuredCameras.findIndex((c: any) => c.id === selectedCamera.id);
                          if (cameraIndex >= 0) {
                            configuredCameras[cameraIndex] = updatedCamera;
                          } else {
                            configuredCameras.push(updatedCamera);
                          }
                          await (window.electronAPI as any).setConfigValue?.('configuredCameras', configuredCameras);
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
                  setActiveStep(4);
                }}
                disabled={configureSpeaker && (!speakerConfig.ip || !speakerConfig.password)}
              >
                Continue
              </Button>
            </Box>
          </Box>
        );

      case 4:
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
                <Grid item xs={12} sm={6}>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => {
                      const url = `http://${selectedCamera?.ip}/local/BatonAnalytic/local-events.html`;
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
                      // Reset to start and configure another camera
                      setActiveStep(0);
                      setSelectedCamera(null);
                      setDeploymentProgress(0);
                      setDeploymentStatus('');
                      setError(null);
                      setCredentials({ username: 'root', password: '' });
                      setConfigureSpeaker(false);
                      setSpeakerConfig({ ip: '', username: 'root', password: '' });
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
      <Typography variant="h4" gutterBottom>
        Camera Setup
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Get your first camera running with AI analytics in minutes
      </Typography>

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
            optional={<Typography variant="caption">Optional</Typography>}
            onClick={() => {
              // Allow jumping to speaker config if camera is selected and either:
              // - Step 2 is completed, or
              // - Camera has ACAP installed, or  
              // - Camera was loaded from previously configured (has credentials)
              if (selectedCamera && (completed[2] || selectedCamera?.hasACAP || selectedCamera?.isLicensed || completed[1])) {
                setActiveStep(3);
              }
            }}
            sx={{ cursor: (selectedCamera && (completed[2] || selectedCamera?.hasACAP || selectedCamera?.isLicensed || completed[1])) ? 'pointer' : 'default' }}
          >
            Configure Audio Speaker
          </StepLabel>
          <StepContent>{getStepContent(3)}</StepContent>
        </Step>
        
        <Step completed={completed[4]}>
          <StepLabel 
            onClick={() => {
              // Allow jumping to complete if deployment is done or speaker is configured
              if (selectedCamera && (completed[2] || completed[3] || selectedCamera?.hasACAP)) {
                setActiveStep(4);
              }
            }}
            sx={{ cursor: (selectedCamera && (completed[2] || completed[3] || selectedCamera?.hasACAP)) ? 'pointer' : 'default' }}
          >
            Complete
          </StepLabel>
          <StepContent>{getStepContent(4)}</StepContent>
        </Step>
      </Stepper>
      
      {/* Detection Test Modal */}
      <DetectionTestModal
        open={showDetectionModal}
        onClose={() => setShowDetectionModal(false)}
        camera={selectedCamera}
        speakerConfig={configureSpeaker ? speakerConfig : undefined}
      />
    </Box>
  );
};

export default CameraSetupPage;