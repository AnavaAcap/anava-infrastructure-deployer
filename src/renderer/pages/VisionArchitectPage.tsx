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
  Settings as SettingsIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { VisionArchitectDialog } from '../components/VisionArchitectDialog';

interface Camera {
  ip: string;
  username: string;
  password: string;
  name?: string;
  configured?: boolean;
}

const VisionArchitectPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (!selectedCamera) {
      setError('Please select a camera first');
      return;
    }
    if (!geminiApiKey) {
      setError('Please enter your Gemini API key');
      return;
    }
    setDialogOpen(true);
  };

  const handleDialogComplete = async () => {
    setDialogOpen(false);
    // Refresh cameras to show updated status
    await loadConfiguration();
  };

  const handleApiKeyChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = event.target.value;
    setGeminiApiKey(newKey);
    
    // Save API key
    if (newKey) {
      try {
        await (window as any).electronAPI.setConfigValue?.('geminiApiKey', newKey);
      } catch (err) {
        console.error('Failed to save API key:', err);
      }
    }
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
        {/* Camera Selection */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            <CameraIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Select Camera
          </Typography>
          
          {cameras.length === 0 ? (
            <Alert severity="warning">
              No cameras configured yet. Please configure cameras first using the Camera Setup page.
            </Alert>
          ) : (
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Camera</InputLabel>
              <Select
                value={selectedCamera?.ip || ''}
                onChange={(e) => {
                  const camera = cameras.find(c => c.ip === e.target.value);
                  setSelectedCamera(camera || null);
                }}
                label="Camera"
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
                Select the camera you want to configure with Vision AI
              </FormHelperText>
            </FormControl>
          )}
        </Paper>

        {/* API Key Configuration */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            <SettingsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            AI Configuration
          </Typography>
          
          <TextField
            fullWidth
            label="Gemini API Key"
            type="password"
            value={geminiApiKey}
            onChange={handleApiKeyChange}
            placeholder="Enter your Gemini API key"
            helperText="Get your free API key from makersuite.google.com/app/apikey"
            sx={{ mt: 2 }}
          />
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
            disabled={!selectedCamera || !geminiApiKey}
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