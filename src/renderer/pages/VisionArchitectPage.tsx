/**
 * Vision Architect Page - Standalone access to AI vision configuration
 * 
 * Allows users to configure Vision AI independently of camera setup flow
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  Stack,
  TextField,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  Architecture as ArchitectureIcon,
  SmartToy as AIIcon,
  Videocam as CameraIcon,
  CheckCircle as CheckIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { VisionArchitectDialog } from '../components/VisionArchitectDialog';

interface Camera {
  ip: string;
  port?: number;
  username: string;
  password: string;
  name?: string;
  configured?: boolean;
  isManual?: boolean;
}

const VisionArchitectPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useManualEntry, setUseManualEntry] = useState(false);
  const [manualCamera, setManualCamera] = useState<Camera>({
    ip: '',
    port: 443,
    username: 'anava',
    password: 'baton',
    isManual: true
  });

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load configured cameras
      const configuredCameras = await (window as any).electronAPI.getConfigValue?.('configuredCameras');
      if (configuredCameras && configuredCameras.length > 0) {
        setCameras(configuredCameras);
        // Auto-select first camera if only one
        if (configuredCameras.length === 1) {
          setSelectedCamera(configuredCameras[0]);
        }
      }

      // Load Gemini API key
      const storedApiKey = await (window as any).electronAPI.getConfigValue?.('geminiApiKey');
      if (storedApiKey) {
        setGeminiApiKey(storedApiKey);
      }
    } catch (err: any) {
      console.error('Failed to load configuration:', err);
      setError('Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = () => {
    // Determine which camera to use
    const cameraToUse = useManualEntry ? manualCamera : selectedCamera;
    
    if (!cameraToUse || (useManualEntry && !manualCamera.ip)) {
      setError('Please provide camera information');
      return;
    }
    if (!geminiApiKey) {
      setError('Gemini API key not found. Please ensure you are logged in properly.');
      return;
    }
    
    // Update selected camera for dialog
    setSelectedCamera(cameraToUse);
    setDialogOpen(true);
  };

  const handleDialogComplete = async () => {
    setDialogOpen(false);
    // Refresh cameras to show updated status
    await loadConfiguration();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <ArchitectureIcon sx={{ fontSize: 40, color: 'primary.main' }} />
          <Box>
            <Typography variant="h4" fontWeight="bold">
              Vision AI Architect
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Configure intelligent camera analytics with AI
            </Typography>
          </Box>
          <Chip label="NEW!" color="primary" size="small" sx={{ ml: 1 }} />
        </Box>
      </Box>

      {/* Info Banner */}
      <Paper sx={{ p: 2, mb: 3, backgroundColor: 'info.light', borderLeft: '4px solid', borderColor: 'info.main' }}>
        <Box display="flex" alignItems="flex-start" gap={1}>
          <InfoIcon color="info" />
          <Box>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              What is Vision AI Architect?
            </Typography>
            <Typography variant="body2">
              Vision AI Architect uses advanced AI to automatically generate complete camera analytics systems. 
              Simply describe what you want to monitor or detect, and AI will create the detection scenarios, 
              analysis skills, and security profiles needed to achieve your goals.
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Configuration Section */}
      <Stack spacing={3}>
        {/* API Key Status */}
        {!geminiApiKey && (
          <Alert severity="warning">
            Gemini API key not found. Please ensure you have completed the login process with a valid API key.
          </Alert>
        )}
        
        {/* Camera Selection */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            <CameraIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Camera Information
          </Typography>
          
          {/* Selection Mode Toggle */}
          <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
            <Button
              variant={!useManualEntry ? "contained" : "outlined"}
              onClick={() => {
                setUseManualEntry(false);
                setError(null);
              }}
              disabled={cameras.length === 0}
            >
              Select Configured Camera
            </Button>
            <Button
              variant={useManualEntry ? "contained" : "outlined"}
              onClick={() => {
                setUseManualEntry(true);
                setError(null);
              }}
            >
              Enter Camera Manually
            </Button>
          </Stack>
          
          {!useManualEntry ? (
            // Configured Camera Selection
            cameras.length === 0 ? (
              <Alert severity="info">
                No configured cameras found. Use manual entry or configure cameras in Camera Setup.
              </Alert>
            ) : (
              <FormControl fullWidth>
                <InputLabel>Select Camera</InputLabel>
                <Select
                  value={selectedCamera?.ip || ''}
                  onChange={(e) => {
                    const camera = cameras.find(c => c.ip === e.target.value);
                    setSelectedCamera(camera || null);
                  }}
                  label="Select Camera"
                >
                  {cameras.map((camera) => (
                    <MenuItem key={camera.ip} value={camera.ip}>
                      <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
                        <Box>
                          <Typography variant="body2">
                            {camera.name || camera.ip}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {camera.ip}
                          </Typography>
                        </Box>
                        {camera.configured && (
                          <CheckIcon color="success" fontSize="small" />
                        )}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  Select from your previously configured cameras
                </FormHelperText>
              </FormControl>
            )
          ) : (
            // Manual Camera Entry
            <Stack spacing={2}>
              <TextField
                fullWidth
                label="Camera IP Address"
                value={manualCamera.ip}
                onChange={(e) => setManualCamera({ ...manualCamera, ip: e.target.value })}
                placeholder="192.168.1.100"
                helperText="Enter the IP address of your camera"
              />
              <TextField
                fullWidth
                label="Port"
                type="number"
                value={manualCamera.port || 443}
                onChange={(e) => setManualCamera({ ...manualCamera, port: parseInt(e.target.value) || 443 })}
                placeholder="443"
                helperText="HTTPS port (default: 443)"
                inputProps={{ min: 1, max: 65535 }}
              />
              <TextField
                fullWidth
                label="Username"
                value={manualCamera.username}
                onChange={(e) => setManualCamera({ ...manualCamera, username: e.target.value })}
                placeholder="anava"
                helperText="Camera login username"
              />
              <TextField
                fullWidth
                label="Password"
                type="password"
                value={manualCamera.password}
                onChange={(e) => setManualCamera({ ...manualCamera, password: e.target.value })}
                placeholder="baton"
                helperText="Camera login password"
              />
            </Stack>
          )}
        </Paper>


        {/* Features */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            <AIIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            What Vision AI Can Do
          </Typography>
          
          <List dense>
            <ListItem>
              <ListItemIcon>
                <CheckIcon color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Automatic Scenario Generation"
                secondary="Creates detection scenarios based on your goals"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckIcon color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Intelligent Skill Creation"
                secondary="Develops AI analysis capabilities for complex situations"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckIcon color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Security Profile Configuration"
                secondary="Sets up monitoring schedules and alert triggers"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckIcon color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Natural Language Input"
                secondary="Just describe what you want in plain English"
              />
            </ListItem>
          </List>
        </Paper>

        {/* Error Display */}
        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Action Buttons */}
        <Box display="flex" gap={2} justifyContent="center">
          <Button
            variant="contained"
            size="large"
            startIcon={<ArchitectureIcon />}
            onClick={handleOpenDialog}
            disabled={
              (!useManualEntry && !selectedCamera) || 
              (useManualEntry && !manualCamera.ip) ||
              !geminiApiKey
            }
            sx={{ px: 4 }}
          >
            Configure Vision AI
          </Button>
        </Box>
      </Stack>

      {/* Vision Architect Dialog */}
      {selectedCamera && dialogOpen && (
        <VisionArchitectDialog
          open={dialogOpen}
          cameraIp={selectedCamera.ip}
          username={selectedCamera.username || 'anava'}
          password={selectedCamera.password || 'baton'}
          geminiApiKey={geminiApiKey}
          onComplete={handleDialogComplete}
          onSkip={() => setDialogOpen(false)}
        />
      )}
    </Box>
  );
};

export default VisionArchitectPage;