import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Paper,
  TextField,
  Typography,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  InputAdornment,
  Tooltip,
  LinearProgress,
  Badge,
  FormControlLabel,
  Switch,
  Collapse,
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Videocam as VideocamIcon,
  VpnKey as VpnKeyIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  ArrowBack as ArrowBackIcon,
  Router as NetworkScanIcon,
  Settings as SettingsIcon,
  Info as InfoIcon,
  Upload as UploadIcon,
  Download as DownloadIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';

interface Camera {
  id: string;
  ip: string;
  port: number;
  protocol?: 'http' | 'https';
  type: string;
  model: string;
  manufacturer: string;
  mac: string | null;
  capabilities: string[];
  discoveredAt: string;
  discoveryMethod?: 'scan' | 'mdns' | 'ssdp' | 'manual';
  status: 'accessible' | 'requires_auth';
  authenticated?: boolean;
  credentials?: {
    username: string;
    password: string;
  };
  configurationStatus?: 'pending' | 'success' | 'failed';
  configurationMessage?: string;
}

interface EnhancedCameraDiscoveryPageProps {
  onCamerasSelected: (cameras: Camera[]) => void;
  deploymentConfig?: any;
  onSkip?: () => void;
  onBack?: () => void;
}

export const EnhancedCameraDiscoveryPage: React.FC<EnhancedCameraDiscoveryPageProps> = ({ 
  onCamerasSelected,
  deploymentConfig,
  onSkip,
  onBack 
}) => {
  const [scanning, setScanning] = useState(false);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCameras, setSelectedCameras] = useState<Set<string>>(new Set());
  const [manualIp, setManualIp] = useState('');
  const [networkRange, setNetworkRange] = useState('');
  const [authDialog, setAuthDialog] = useState<Camera | null>(null);
  const [defaultCredentials, setDefaultCredentials] = useState({ username: 'root', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pushingSettings, setPushingSettings] = useState(false);
  const [pushProgress, setPushProgress] = useState<Map<string, string>>(new Map());
  const [showConfigPreview, setShowConfigPreview] = useState(false);
  const [getConfigDialog, setGetConfigDialog] = useState<Camera | null>(null);
  const [cachedConfig, setCachedConfig] = useState<any>(null);
  const [loadingCache, setLoadingCache] = useState(false);
  const [useEnhancedScanning, setUseEnhancedScanning] = useState(true);
  const [discoveredCount, setDiscoveredCount] = useState(0);
  const [scanStartTime, setScanStartTime] = useState<number | null>(null);

  useEffect(() => {
    // Load saved credentials from localStorage
    const savedCreds = localStorage.getItem('cameraDefaultCredentials');
    if (savedCreds) {
      setDefaultCredentials(JSON.parse(savedCreds));
    }
    
    // Try to load cached deployment config if no deploymentConfig is provided
    if (!deploymentConfig && window.electronAPI?.config) {
      setLoadingCache(true);
      window.electronAPI.config.getCached().then((cached) => {
        if (cached?.config) {
          console.log('Loaded cached config from', cached.timestamp);
          setCachedConfig(cached.config);
        }
        setLoadingCache(false);
      }).catch((err) => {
        console.error('Failed to load cached config:', err);
        setLoadingCache(false);
      });
    }
  }, [deploymentConfig]);

  const saveDefaultCredentials = useCallback(() => {
    localStorage.setItem('cameraDefaultCredentials', JSON.stringify(defaultCredentials));
  }, [defaultCredentials]);

  const getNetworkInfo = () => {
    // Get local network interfaces
    window.electronAPI.getNetworkInterfaces().then((interfaces: any) => {
      const primaryInterface = interfaces.find((iface: any) => 
        iface.address && !iface.internal && iface.family === 'IPv4'
      );
      if (primaryInterface) {
        const parts = primaryInterface.address.split('.');
        setNetworkRange(`${parts[0]}.${parts[1]}.${parts[2]}.0/24`);
      }
    });
  };

  useEffect(() => {
    getNetworkInfo();
  }, []);

  const scanForCameras = async (customRange?: string) => {
    setScanning(true);
    setError(null);
    setDiscoveredCount(0);
    setScanStartTime(Date.now());
    setScanProgress('Initializing network scan...');
    
    // Set up progress listener
    const removeListener = window.electronAPI.onCameraScanProgress((data) => {
      setScanProgress(`Scanning ${data.ip}...`);
    });
    
    // Set up real-time camera discovery listener for enhanced scanning
    let removeDiscoveryListener: (() => void) | null = null;
    if (useEnhancedScanning && window.electronAPI.onCameraDiscovered) {
      removeDiscoveryListener = window.electronAPI.onCameraDiscovered((camera) => {
        setCameras(prev => {
          const existing = prev.find(c => c.ip === camera.ip);
          if (existing) {
            return prev.map(c => c.ip === camera.ip ? camera : c);
          }
          return [...prev, camera];
        });
        setDiscoveredCount(prev => prev + 1);
      });
    }
    
    try {
      let discoveredCameras: Camera[];
      
      if (useEnhancedScanning && window.electronAPI.enhancedScanNetwork) {
        // Use the new enhanced scanning with concurrent and service discovery
        const options = {
          networkRange: customRange,
          concurrent: 20,
          useServiceDiscovery: true,
          ports: [443, 80, 8080, 8000, 8443]
        };
        setScanProgress('Starting service discovery and network scan...');
        discoveredCameras = await window.electronAPI.enhancedScanNetwork(options);
      } else {
        // Use the original scanning method
        const options = customRange ? { networkRange: customRange } : undefined;
        discoveredCameras = await window.electronAPI.scanNetworkCameras(options);
      }
      
      // Auto-authenticate with default credentials if available
      if (defaultCredentials.password) {
        for (const camera of discoveredCameras) {
          if (!camera.authenticated) {
            try {
              const result = await window.electronAPI.testCameraCredentials(
                camera.id,
                camera.ip,
                defaultCredentials.username,
                defaultCredentials.password
              );
              if (result.authenticated) {
                camera.authenticated = true;
                camera.status = 'accessible';
                camera.credentials = { ...defaultCredentials };
              }
            } catch (err) {
              console.error(`Failed to auto-auth ${camera.ip}:`, err);
            }
          }
        }
      }
      
      setCameras(discoveredCameras);
      
      if (discoveredCameras.length === 0) {
        setError('No cameras found on the network. Make sure cameras are connected and powered on.');
      }
    } catch (err: any) {
      setError(`Failed to scan network: ${err.message}`);
    } finally {
      setScanning(false);
      setScanProgress('');
      setScanStartTime(null);
      removeListener();
      if (removeDiscoveryListener) {
        removeDiscoveryListener();
      }
    }
  };

  const scanSpecificCamera = async () => {
    if (!manualIp) return;
    
    setScanning(true);
    setError(null);
    
    try {
      const camera = await window.electronAPI.quickScanCamera(
        manualIp, 
        defaultCredentials.username, 
        defaultCredentials.password
      );
      
      if (camera && camera.length > 0) {
        setCameras(prev => [...prev.filter(c => c.ip !== manualIp), ...camera]);
        setManualIp('');
      } else {
        setError(`No camera found at ${manualIp}`);
      }
    } catch (err: any) {
      setError(`Failed to scan ${manualIp}: ${err.message}`);
    } finally {
      setScanning(false);
    }
  };

  const scanCustomNetwork = async () => {
    if (!networkRange) return;
    
    // Validate network range format
    const rangeRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/;
    if (!rangeRegex.test(networkRange)) {
      setError('Invalid network range format. Use CIDR notation (e.g., 192.168.1.0/24)');
      return;
    }
    
    await scanForCameras(networkRange);
  };

  const handleAuthCamera = async (camera: Camera) => {
    try {
      const result = await window.electronAPI.testCameraCredentials(
        camera.id,
        camera.ip,
        defaultCredentials.username,
        defaultCredentials.password
      );
      
      if (result.authenticated) {
        setCameras(prev => prev.map(c => 
          c.id === camera.id 
            ? { ...c, authenticated: true, status: 'accessible' as const, credentials: { ...defaultCredentials } }
            : c
        ));
        setAuthDialog(null);
      } else {
        setError('Invalid credentials');
      }
    } catch (err: any) {
      setError(`Authentication failed: ${err.message}`);
    }
  };

  const toggleCameraSelection = (cameraId: string) => {
    const newSelection = new Set(selectedCameras);
    if (newSelection.has(cameraId)) {
      newSelection.delete(cameraId);
    } else {
      newSelection.add(cameraId);
    }
    setSelectedCameras(newSelection);
  };

  const selectAllCameras = () => {
    if (selectedCameras.size === cameras.length) {
      setSelectedCameras(new Set());
    } else {
      setSelectedCameras(new Set(cameras.map(c => c.id)));
    }
  };

  const generateConfigPayload = () => {
    // Use deploymentConfig if provided, otherwise use cachedConfig
    const config = deploymentConfig || cachedConfig;
    if (!config) return null;

    console.log('Using config:', deploymentConfig ? 'deploymentConfig' : 'cachedConfig');
    console.log('Config data:', config); // Debug logging
    
    // Extract project ID from various possible locations
    const projectId = config.projectId || config.firebaseConfig?.projectId || '';
    
    // Return format expected by setInstallerConfig endpoint
    return {
      firebase: {
        apiKey: config.firebaseConfig?.apiKey || config.firebaseApiKey || '',
        authDomain: config.firebaseConfig?.authDomain || `${projectId}.firebaseapp.com`,
        projectId: projectId,
        storageBucket: config.firebaseConfig?.storageBucket || `${projectId}.appspot.com`,
        messagingSenderId: config.firebaseConfig?.messagingSenderId || '',
        appId: config.firebaseConfig?.appId || '',
        databaseId: '(default)'
      },
      gemini: {
        apiKey: config.aiMode === 'ai-studio' ? (config.aiStudioApiKey || '') : '',
        vertexApiGatewayUrl: config.aiMode === 'vertex' ? (config.apiGatewayUrl || '') : '',
        vertexApiGatewayKey: config.aiMode === 'vertex' ? (config.apiKey || '') : '',
        vertexGcpProjectId: projectId,
        vertexGcpRegion: config.region || 'us-central1',
        vertexGcsBucketName: config.gcsBucketName || (projectId ? `${projectId}-anava-analytics` : '')
      },
      anavaKey: config.anavaKey || '',
      customerId: config.customerId || ''
    };
  };

  const pushSettingsToSelected = async () => {
    const config = deploymentConfig || cachedConfig;
    if (!config || selectedCameras.size === 0) return;

    setPushingSettings(true);
    const configPayload = generateConfigPayload();
    
    if (!configPayload) {
      setError('No deployment configuration available');
      setPushingSettings(false);
      return;
    }

    const selectedCamerasList = cameras.filter(c => selectedCameras.has(c.id) && c.authenticated);
    
    for (const camera of selectedCamerasList) {
      try {
        setPushProgress(prev => new Map(prev).set(camera.id, 'Pushing settings...'));
        
        const result = await window.electronAPI.pushCameraSettings(
          camera.ip,
          camera.credentials?.username || defaultCredentials.username,
          camera.credentials?.password || defaultCredentials.password,
          configPayload
        );
        
        if (result.success) {
          let statusMessage = '✅ Settings pushed successfully';
          if (result.licenseActivated === true) {
            statusMessage += ' (License activated)';
          } else if (result.licenseActivated === false) {
            statusMessage += ' (License activation failed)';
          }
          setPushProgress(prev => new Map(prev).set(camera.id, statusMessage));
          setCameras(prev => prev.map(c => 
            c.id === camera.id 
              ? { ...c, configurationStatus: 'success' as const, configurationMessage: statusMessage.replace('✅ ', '') }
              : c
          ));
        } else {
          setPushProgress(prev => new Map(prev).set(camera.id, `❌ Failed: ${result.error}`));
          setCameras(prev => prev.map(c => 
            c.id === camera.id 
              ? { ...c, configurationStatus: 'failed' as const, configurationMessage: result.error }
              : c
          ));
        }
      } catch (err: any) {
        setPushProgress(prev => new Map(prev).set(camera.id, `❌ Error: ${err.message}`));
        setCameras(prev => prev.map(c => 
          c.id === camera.id 
            ? { ...c, configurationStatus: 'failed' as const, configurationMessage: err.message }
            : c
        ));
      }
    }
    
    setPushingSettings(false);
  };

  const getSettingsFromCamera = async (camera: Camera) => {
    try {
      const result = await window.electronAPI.getCameraSettings(
        camera.ip,
        camera.credentials?.username || defaultCredentials.username,
        camera.credentials?.password || defaultCredentials.password
      );
      
      if (result.success) {
        // Show the settings in a dialog or console
        console.log('Camera settings:', result.data);
        alert(`Settings retrieved from ${camera.ip}:\n\n${JSON.stringify(result.data, null, 2)}`);
      } else {
        setError(`Failed to get settings: ${result.error}`);
      }
    } catch (err: any) {
      setError(`Error getting settings: ${err.message}`);
    }
    setGetConfigDialog(null);
  };

  const handleProceed = () => {
    const selected = cameras.filter(c => selectedCameras.has(c.id));
    onCamerasSelected(selected);
  };

  const authenticatedCount = cameras.filter(c => c.authenticated).length;
  const selectedAuthenticatedCount = cameras.filter(c => selectedCameras.has(c.id) && c.authenticated).length;

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
          Enhanced Camera Discovery
        </Typography>
      </Box>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        Discover and configure Axis cameras on your network with advanced scanning options.
      </Typography>

      {loadingCache && !deploymentConfig && (
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <CircularProgress size={20} />
          <Typography variant="body2" color="text.secondary">
            Loading cached configuration...
          </Typography>
        </Box>
      )}

      {(deploymentConfig || cachedConfig) && (
        <Alert severity="success" sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography>
              {deploymentConfig 
                ? 'GCP infrastructure deployed successfully! You can now push settings to cameras.'
                : `Using cached configuration from previous deployment${cachedConfig.timestamp ? ` (${new Date(cachedConfig.timestamp).toLocaleDateString()})` : ''}.`}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {!deploymentConfig && cachedConfig && (
                <Button
                  size="small"
                  startIcon={<ClearIcon />}
                  onClick={async () => {
                    if (window.confirm('Clear cached configuration? You will need to run a new deployment to push settings to cameras.')) {
                      await window.electronAPI.config.clearCached();
                      setCachedConfig(null);
                    }
                  }}
                  color="warning"
                >
                  Clear Cache
                </Button>
              )}
              <Button
                size="small"
                startIcon={<InfoIcon />}
                onClick={() => setShowConfigPreview(true)}
              >
                Preview Config
              </Button>
            </Box>
          </Box>
        </Alert>
      )}

      {/* Default Credentials Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Default Camera Credentials
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                label="Username"
                value={defaultCredentials.username}
                onChange={(e) => setDefaultCredentials({ ...defaultCredentials, username: e.target.value })}
                size="small"
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Password"
                type="password"
                value={defaultCredentials.password}
                onChange={(e) => setDefaultCredentials({ ...defaultCredentials, password: e.target.value })}
                size="small"
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Button
                variant="outlined"
                onClick={saveDefaultCredentials}
                fullWidth
              >
                Save Defaults
              </Button>
            </Grid>
          </Grid>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            These credentials will be used for all camera discovery and configuration operations.
          </Typography>
        </CardContent>
      </Card>

      {/* Discovery Options */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <NetworkScanIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Automatic Discovery
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={useEnhancedScanning}
                    onChange={(e) => setUseEnhancedScanning(e.target.checked)}
                    size="small"
                  />
                }
                label={
                  <Typography variant="caption">
                    Enhanced Scanning (Concurrent + Service Discovery)
                  </Typography>
                }
                sx={{ mb: 1 }}
              />
              <Button
                variant="contained"
                startIcon={scanning ? <CircularProgress size={20} /> : <SearchIcon />}
                onClick={() => scanForCameras()}
                disabled={scanning}
                fullWidth
              >
                {scanning ? 'Scanning Network...' : 'Scan Local Network'}
              </Button>
              {scanning && (
                <Box sx={{ mt: 2 }}>
                  <LinearProgress />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {scanProgress}
                    </Typography>
                    {discoveredCount > 0 && (
                      <Typography variant="caption" color="success.main">
                        Found {discoveredCount} camera{discoveredCount !== 1 ? 's' : ''}
                      </Typography>
                    )}
                  </Box>
                  {scanStartTime && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      Elapsed: {Math.round((Date.now() - scanStartTime) / 1000)}s
                    </Typography>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Manual IP Entry
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  label="Camera IP Address"
                  value={manualIp}
                  onChange={(e) => setManualIp(e.target.value)}
                  size="small"
                  fullWidth
                  placeholder="192.168.1.100"
                />
                <Button
                  variant="outlined"
                  onClick={scanSpecificCamera}
                  disabled={!manualIp || scanning}
                >
                  Add
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Custom Network Range
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  label="CIDR Range"
                  value={networkRange}
                  onChange={(e) => setNetworkRange(e.target.value)}
                  size="small"
                  fullWidth
                  placeholder="192.168.1.0/24"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title="Use CIDR notation (e.g., 192.168.1.0/24 for entire subnet)">
                          <InfoIcon fontSize="small" />
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                />
                <Button
                  variant="outlined"
                  onClick={scanCustomNetwork}
                  disabled={!networkRange || scanning}
                >
                  Scan
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {cameras.length === 0 && !scanning && (
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary" paragraph>
            No cameras discovered yet. Start by scanning your network or adding cameras manually.
          </Typography>
          {onSkip && (
            <Button
              variant="outlined"
              onClick={onSkip}
              size="large"
            >
              Skip Camera Setup
            </Button>
          )}
        </Box>
      )}

      {cameras.length > 0 && (
        <Paper sx={{ mt: 3 }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">
                Discovered Cameras ({cameras.length})
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Chip 
                  label={`${authenticatedCount} Authenticated`} 
                  color="success" 
                  size="small"
                />
                <Button
                  size="small"
                  onClick={selectAllCameras}
                >
                  {selectedCameras.size === cameras.length ? 'Deselect All' : 'Select All'}
                </Button>
              </Box>
            </Box>
          </Box>
          
          <List>
            {cameras.map((camera) => (
              <ListItem
                key={camera.id}
                sx={{
                  backgroundColor: camera.configurationStatus === 'success' ? 'success.light' : 
                                 camera.configurationStatus === 'failed' ? 'error.light' : 
                                 'inherit',
                  '&:hover': {
                    backgroundColor: camera.configurationStatus === 'success' ? 'success.light' : 
                                   camera.configurationStatus === 'failed' ? 'error.light' : 
                                   'action.hover',
                  }
                }}
              >
                <ListItemIcon>
                  <Checkbox
                    edge="start"
                    checked={selectedCameras.has(camera.id)}
                    onChange={() => toggleCameraSelection(camera.id)}
                    disabled={!camera.authenticated}
                  />
                </ListItemIcon>
                <VideocamIcon sx={{ mr: 2, color: camera.authenticated ? 'primary.main' : 'text.disabled' }} />
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {camera.model}
                      {camera.authenticated && (
                        <CheckCircleIcon color="success" fontSize="small" />
                      )}
                      {camera.protocol === 'https' && (
                        <Chip label="HTTPS" color="primary" size="small" sx={{ height: 20 }} />
                      )}
                      {camera.discoveryMethod === 'mdns' && (
                        <Chip label="mDNS" color="info" size="small" sx={{ height: 20 }} />
                      )}
                      {camera.discoveryMethod === 'ssdp' && (
                        <Chip label="SSDP" color="info" size="small" sx={{ height: 20 }} />
                      )}
                      {camera.configurationStatus === 'success' && (
                        <Chip label="Configured" color="success" size="small" />
                      )}
                      {camera.configurationStatus === 'failed' && (
                        <Chip label="Config Failed" color="error" size="small" />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2">{camera.ip}</Typography>
                      {camera.configurationMessage && (
                        <Typography variant="caption" color={camera.configurationStatus === 'success' ? 'success.main' : 'error.main'}>
                          {camera.configurationMessage}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                        {camera.capabilities.map((cap) => (
                          <Chip key={cap} label={cap} size="small" />
                        ))}
                      </Box>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  {!camera.authenticated ? (
                    <IconButton
                      edge="end"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAuthDialog(camera);
                      }}
                    >
                      <VpnKeyIcon />
                    </IconButton>
                  ) : (deploymentConfig || cachedConfig) && (
                    <Tooltip title="Get current settings from camera">
                      <IconButton
                        edge="end"
                        onClick={(e) => {
                          e.stopPropagation();
                          setGetConfigDialog(camera);
                        }}
                      >
                        <DownloadIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
          
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
            {(deploymentConfig || cachedConfig) && selectedAuthenticatedCount > 0 && (
              <Box sx={{ mb: 2 }}>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={pushingSettings ? <CircularProgress size={20} /> : <UploadIcon />}
                  onClick={pushSettingsToSelected}
                  disabled={pushingSettings || selectedAuthenticatedCount === 0}
                  fullWidth
                >
                  {pushingSettings 
                    ? `Pushing Settings... (${pushProgress.size}/${selectedAuthenticatedCount})`
                    : `Push Settings to Selected Cameras (${selectedAuthenticatedCount})`}
                </Button>
                {pushProgress.size > 0 && (
                  <Box sx={{ mt: 2 }}>
                    {Array.from(pushProgress.entries()).map(([cameraId, status]) => {
                      const camera = cameras.find(c => c.id === cameraId);
                      return (
                        <Typography key={cameraId} variant="caption" display="block">
                          {camera?.ip}: {status}
                        </Typography>
                      );
                    })}
                  </Box>
                )}
              </Box>
            )}
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              {onSkip && (
                <Button
                  variant="outlined"
                  onClick={onSkip}
                  sx={{ flex: 1 }}
                >
                  Skip Camera Setup
                </Button>
              )}
              <Button
                variant="contained"
                color="primary"
                onClick={handleProceed}
                disabled={selectedCameras.size === 0}
                sx={{ flex: 2 }}
              >
                Continue with Selected Cameras ({selectedCameras.size})
              </Button>
            </Box>
          </Box>
        </Paper>
      )}

      {/* Authentication Dialog */}
      <Dialog open={!!authDialog} onClose={() => setAuthDialog(null)}>
        <DialogTitle>Authenticate Camera</DialogTitle>
        <DialogContent>
          <Typography variant="body2" paragraph>
            Enter credentials for {authDialog?.model} at {authDialog?.ip}
          </Typography>
          <TextField
            label="Username"
            value={defaultCredentials.username}
            onChange={(e) => setDefaultCredentials({ ...defaultCredentials, username: e.target.value })}
            fullWidth
            margin="normal"
          />
          <TextField
            label="Password"
            type="password"
            value={defaultCredentials.password}
            onChange={(e) => setDefaultCredentials({ ...defaultCredentials, password: e.target.value })}
            fullWidth
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAuthDialog(null)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={() => authDialog && handleAuthCamera(authDialog)}
          >
            Authenticate
          </Button>
        </DialogActions>
      </Dialog>

      {/* Get Config Dialog */}
      <Dialog open={!!getConfigDialog} onClose={() => setGetConfigDialog(null)}>
        <DialogTitle>Get Camera Settings</DialogTitle>
        <DialogContent>
          <Typography variant="body2" paragraph>
            Retrieve current settings from {getConfigDialog?.model} at {getConfigDialog?.ip}?
          </Typography>
          <Typography variant="caption" color="text.secondary">
            This will show the current SystemConfig from the camera.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGetConfigDialog(null)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={() => getConfigDialog && getSettingsFromCamera(getConfigDialog)}
          >
            Get Settings
          </Button>
        </DialogActions>
      </Dialog>

      {/* Config Preview Dialog */}
      <Dialog 
        open={showConfigPreview} 
        onClose={() => setShowConfigPreview(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Configuration Preview</DialogTitle>
        <DialogContent>
          <Typography variant="body2" paragraph>
            This is the configuration that will be pushed to selected cameras:
          </Typography>
          <Paper sx={{ p: 2, backgroundColor: 'grey.100' }}>
            <pre style={{ margin: 0, overflow: 'auto' }}>
              {JSON.stringify(generateConfigPayload(), null, 2)}
            </pre>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfigPreview(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};