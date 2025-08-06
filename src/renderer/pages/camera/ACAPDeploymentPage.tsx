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
  console.log('ACAPDeploymentPage render:', { cameras: initialCameras, deploymentConfig });
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
          // Create camera object with credentials and updated IP
          const cameraWithCreds = {
            ...camera,
            ip: cameraIPs[camera.id] || camera.ip,
            credentials: credentials[camera.id]
          };
          
          const currentIP = cameraIPs[camera.id] || camera.ip;
          addLog(`Connecting to ${currentIP}...`);
          addLog(`Sending GCP configuration to camera...`);
          addLog(`POST http://${currentIP}/local/BatonAnalytic/baton_analytic.cgi?command=setInstallerConfig`);
          
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
    // Check if any cameras have missing credentials
    const missingCreds = cameras.filter(cam => 
      !credentials[cam.id]?.username || !credentials[cam.id]?.password
    );
    
    if (missingCreds.length > 0) {
      setError('Please enter credentials for all cameras');
      setShowCredentialsDialog(true);
    } else {
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
      httpUrl: 'http://192.168.1.100',
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
    setDeploying(true);
    setError(null);
    setDeploymentLog([]);

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
      
      for (const camera of cameras) {
        const currentIP = cameraIPs[camera.id] || camera.ip;
        addLog(`\n--- Deploying to ${camera.model} (${currentIP}) ---`);
        
        setDeploymentStatus(prev => {
          const newMap = new Map(prev);
          newMap.set(camera.id, { cameraId: camera.id, status: 'deploying' });
          return newMap;
        });

        try {
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
          }
          
          // Deploy appropriate ACAP based on firmware
          addLog(`Selecting appropriate ACAP for ${firmwareInfo.osVersion}...`);
          const result = await window.electronAPI.deployACAPAuto(cameraWithCreds, releases);
          
          if (result.success) {
            addLog(`✓ ACAP uploaded and installed successfully`);
            if (result.firmwareVersion) {
              addLog(`✓ Deployed correct ACAP for firmware ${result.firmwareVersion} (${result.osVersion})`);
            }
            // Apply license key if provided
            if (deploymentConfig?.anavaKey) {
              addLog(`Applying Anava license key...`);
              try {
                await window.electronAPI.activateLicenseKey(
                  currentIP,
                  credentials[camera.id].username,
                  credentials[camera.id].password,
                  deploymentConfig.anavaKey,
                  'BatonAnalytic'
                );
                addLog(`✓ License key activated successfully`);
              } catch (licenseError: any) {
                if (licenseError.message?.includes('already licensed')) {
                  addLog(`✓ Camera already has a valid license`);
                } else if (licenseError.message?.includes('stream has been aborted')) {
                  addLog(`⚠ License activation timeout - camera may be processing the request`);
                } else {
                  addLog(`⚠ License activation failed: ${licenseError.message}`);
                }
                // Non-fatal - continue with deployment
              }
            }
            
            addLog(`✓ ${camera.model} deployment successful!`);
            
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
            throw new Error(result.error || 'Deployment failed');
          }
        } catch (error: any) {
          addLog(`✗ ERROR: ${error.message}`);
          addLog(`✗ Failed to deploy to ${camera.model}`);
          
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

      addLog(`\n=== Deployment completed ===`);
      addLog(`Successfully deployed to ${cameras.filter(c => deploymentStatus.get(c.id)?.status === 'success').length} of ${cameras.length} cameras`);
      setActiveStep(2);
    } catch (err: any) {
      setError(`Deployment failed: ${err.message}`);
      addLog(`\nERROR: ${err.message}`);
    } finally {
      setDeploying(false);
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