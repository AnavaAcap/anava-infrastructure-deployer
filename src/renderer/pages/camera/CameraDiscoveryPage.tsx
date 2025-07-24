import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
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
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Videocam as VideocamIcon,
  VpnKey as VpnKeyIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';

interface Camera {
  id: string;
  ip: string;
  port: number;
  type: string;
  model: string;
  manufacturer: string;
  mac: string | null;
  capabilities: string[];
  discoveredAt: string;
  status: 'accessible' | 'requires_auth';
  authenticated?: boolean;
}

interface CameraDiscoveryPageProps {
  onCamerasSelected: (cameras: Camera[]) => void;
  deploymentConfig?: any;
  onSkip?: () => void;
  onBack?: () => void;
}

export const CameraDiscoveryPage: React.FC<CameraDiscoveryPageProps> = ({ 
  onCamerasSelected,
  deploymentConfig,
  onSkip,
  onBack 
}) => {
  const [scanning, setScanning] = useState(false);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCameras, setSelectedCameras] = useState<Set<string>>(new Set());
  const [manualIp, setManualIp] = useState('');
  const [authDialog, setAuthDialog] = useState<Camera | null>(null);
  const [credentials, setCredentials] = useState({ username: 'root', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<string>('');

  const scanForCameras = async () => {
    setScanning(true);
    setError(null);
    setScanProgress('Starting network scan...');
    
    // Set up progress listener
    const removeListener = window.electronAPI.onCameraScanProgress((data) => {
      setScanProgress(`Scanning ${data.ip}...`);
    });
    
    try {
      const discoveredCameras = await window.electronAPI.scanNetworkCameras();
      setCameras(discoveredCameras);
      
      if (discoveredCameras.length === 0) {
        setError('No cameras found on the network. Make sure cameras are connected and powered on.');
      }
    } catch (err: any) {
      setError(`Failed to scan network: ${err.message}`);
    } finally {
      setScanning(false);
      setScanProgress('');
      removeListener(); // Clean up listener
    }
  };

  const scanSpecificCamera = async () => {
    if (!manualIp) return;
    
    setScanning(true);
    setError(null);
    
    try {
      const camera = await window.electronAPI.quickScanCamera(
        manualIp, 
        credentials.username, 
        credentials.password
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

  const handleAuthCamera = async (camera: Camera) => {
    try {
      const result = await window.electronAPI.testCameraCredentials(
        camera.id,
        camera.ip,
        credentials.username,
        credentials.password
      );
      
      if (result.authenticated) {
        // Update camera status
        setCameras(prev => prev.map(c => 
          c.id === camera.id 
            ? { ...c, authenticated: true, status: 'accessible' as const }
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

  const handleProceed = () => {
    const selected = cameras.filter(c => selectedCameras.has(c.id));
    onCamerasSelected(selected);
  };

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
          Camera Discovery
        </Typography>
      </Box>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        Find and configure Axis cameras on your network for deployment.
      </Typography>

      {deploymentConfig && (
        <Alert severity="success" sx={{ mb: 3 }}>
          GCP infrastructure deployed successfully! Now let's configure your cameras to use it.
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Automatic Discovery
              </Typography>
              <Button
                variant="contained"
                startIcon={scanning ? <CircularProgress size={20} /> : <SearchIcon />}
                onClick={scanForCameras}
                disabled={scanning}
                fullWidth
              >
                {scanning ? 'Scanning...' : 'Scan Network'}
              </Button>
              {scanning && scanProgress && (
                <Typography 
                  variant="caption" 
                  sx={{ 
                    display: 'block', 
                    mt: 1, 
                    color: 'text.secondary',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem'
                  }}
                >
                  {scanProgress}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Manual Entry
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  label="Camera IP Address"
                  value={manualIp}
                  onChange={(e) => setManualIp(e.target.value)}
                  size="small"
                  fullWidth
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
      </Grid>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {cameras.length === 0 && !scanning && (
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary" paragraph>
            No cameras discovered yet. You can scan for cameras or skip this step.
          </Typography>
          <Button
            variant="outlined"
            onClick={onSkip}
            size="large"
          >
            Skip Camera Setup
          </Button>
        </Box>
      )}

      {cameras.length > 0 && (
        <Paper sx={{ mt: 3 }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6">
              Discovered Cameras ({cameras.length})
            </Typography>
          </Box>
          <List>
            {cameras.map((camera) => (
              <ListItem
                key={camera.id}
                button
                selected={selectedCameras.has(camera.id)}
                onClick={() => toggleCameraSelection(camera.id)}
              >
                <VideocamIcon sx={{ mr: 2, color: 'primary.main' }} />
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {camera.model}
                      {camera.authenticated && (
                        <CheckCircleIcon color="success" fontSize="small" />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2">{camera.ip}</Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                        {camera.capabilities.map((cap) => (
                          <Chip key={cap} label={cap} size="small" />
                        ))}
                      </Box>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  {!camera.authenticated && (
                    <IconButton
                      edge="end"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAuthDialog(camera);
                      }}
                    >
                      <VpnKeyIcon />
                    </IconButton>
                  )}
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
          
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={onSkip}
              sx={{ flex: 1 }}
            >
              Skip Camera Setup
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleProceed}
              disabled={selectedCameras.size === 0}
              sx={{ flex: 2 }}
            >
              Configure Selected Cameras ({selectedCameras.size})
            </Button>
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
            value={credentials.username}
            onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
            fullWidth
            margin="normal"
          />
          <TextField
            label="Password"
            type="password"
            value={credentials.password}
            onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
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
    </Box>
  );
};