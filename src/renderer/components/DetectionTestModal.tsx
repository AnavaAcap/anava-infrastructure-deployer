import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  IconButton,
  Card,
  CardContent,
  Divider,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Collapse,
} from '@mui/material';
import {
  Close as CloseIcon,
  Refresh as RefreshIcon,
  VolumeUp as VolumeUpIcon,
  Image as ImageIcon,
  SmartToy as SmartToyIcon,
  Settings as SettingsIcon,
  Videocam as VideocamIcon,
} from '@mui/icons-material';

interface DetectionTestModalProps {
  open: boolean;
  onClose: () => void;
  camera: any;
  speakerConfig?: any;
}

const DetectionTestModal: React.FC<DetectionTestModalProps> = ({
  open,
  onClose,
  camera,
  speakerConfig
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sceneDescription, setSceneDescription] = useState<string>('');
  const [sceneImage, setSceneImage] = useState<string>('');
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [apiKey, setApiKey] = useState<string>('');
  const [alternativeCamera, setAlternativeCamera] = useState<any>(null);
  const [availableCameras, setAvailableCameras] = useState<any[]>([]);
  
  useEffect(() => {
    if (open) {
      // Load API key and test the camera immediately
      loadAndTest();
      loadAvailableCameras();
    }
  }, [open]);

  const loadAvailableCameras = async () => {
    try {
      const configuredCameras = await (window.electronAPI as any).getConfigValue?.('configuredCameras') || [];
      setAvailableCameras(configuredCameras.filter((cam: any) => cam.id !== camera?.id));
    } catch (error) {
      console.error('Failed to load available cameras:', error);
    }
  };

  const loadAndTest = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // First check if we have pre-fetched data
      const preFetchedData = await (window.electronAPI as any).getConfigValue?.('prefetchedSceneData');
      
      if (preFetchedData && preFetchedData.cameraIp === camera?.ip && 
          (Date.now() - preFetchedData.timestamp < 60000)) { // Less than 1 minute old
        console.log('Using pre-fetched scene data');
        setSceneDescription(cleanDescription(preFetchedData.description || ''));
        setSceneImage(preFetchedData.imageBase64 || '');
        
        // Auto-play audio if available
        if (preFetchedData.audioMP3Base64 || preFetchedData.audioBase64) {
          playAudio(preFetchedData.audioMP3Base64 || preFetchedData.audioBase64, 
                   preFetchedData.audioMP3Base64 ? 'mp3' : preFetchedData.audioFormat);
        }
        
        setLoading(false);
        return;
      }
      
      // Otherwise, get API key and fetch fresh data
      const deploymentConfig = await (window.electronAPI as any).getConfigValue?.('deploymentConfig');
      const storedApiKey = deploymentConfig?.vertexApiGatewayKey || 
                          await (window.electronAPI as any).getConfigValue?.('geminiApiKey');
      
      if (!storedApiKey) {
        setError('No API key found. Please configure an API key below.');
        setLoading(false);
        return;
      }
      
      setApiKey(storedApiKey);
      
      // Call the scene description API
      const result = await (window.electronAPI as any).getSceneDescription?.(
        camera,
        storedApiKey,
        camera.hasSpeaker || !!speakerConfig
      );
      
      if (result.success) {
        setSceneDescription(cleanDescription(result.description || ''));
        setSceneImage(result.imageBase64 || '');
        
        // Auto-play audio if available
        if (result.audioMP3Base64 || result.audioBase64) {
          playAudio(result.audioMP3Base64 || result.audioBase64,
                   result.audioMP3Base64 ? 'mp3' : result.audioFormat);
        }
      } else {
        setError(result.error || 'Failed to analyze scene');
      }
    } catch (error: any) {
      console.error('Detection test error:', error);
      setError(error.message || 'Failed to perform detection test');
    } finally {
      setLoading(false);
    }
  };

  const cleanDescription = (text: string): string => {
    // Remove quotes and escape characters
    let cleaned = text
      .replace(/^["']|["']$/g, '') // Remove leading/trailing quotes
      .replace(/\\"/g, '"') // Replace escaped quotes
      .replace(/\\'/g, "'") // Replace escaped single quotes
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
      .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
      .replace(/`(.*?)`/g, '$1'); // Remove code markdown
    
    return cleaned;
  };

  const playAudio = (audioData: string, format: string = 'wav') => {
    if (!audioData) return;
    
    setAudioPlaying(true);
    const audio = new Audio(`data:audio/${format};base64,${audioData}`);
    
    audio.onended = () => setAudioPlaying(false);
    audio.onerror = () => {
      console.error('Failed to play audio');
      setAudioPlaying(false);
    };
    
    audio.play().catch(err => {
      console.error('Audio playback error:', err);
      setAudioPlaying(false);
    });
  };

  const handleTestAgain = async () => {
    if (!apiKey && showAdvanced) {
      setError('Please enter an API key');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const testCamera = alternativeCamera || camera;
      const testApiKey = apiKey || await (window.electronAPI as any).getConfigValue?.('geminiApiKey');
      
      const result = await (window.electronAPI as any).getSceneDescription?.(
        testCamera,
        testApiKey,
        testCamera.hasSpeaker || !!speakerConfig
      );
      
      if (result.success) {
        setSceneDescription(cleanDescription(result.description || ''));
        setSceneImage(result.imageBase64 || '');
        
        if (result.audioMP3Base64 || result.audioBase64) {
          playAudio(result.audioMP3Base64 || result.audioBase64,
                   result.audioMP3Base64 ? 'mp3' : result.audioFormat);
        }
      } else {
        setError(result.error || 'Failed to analyze scene');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to perform detection test');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '60vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <SmartToyIcon color="primary" />
            <Typography variant="h6">AI Vision Test</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent dividers>
        {loading ? (
          <Box display="flex" flexDirection="column" alignItems="center" py={4}>
            <CircularProgress size={48} />
            <Typography variant="body1" sx={{ mt: 2 }}>
              Analyzing scene...
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              The AI is examining what the camera sees
            </Typography>
          </Box>
        ) : error ? (
          <Box py={2}>
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
            <Button
              variant="contained"
              onClick={handleTestAgain}
              startIcon={<RefreshIcon />}
            >
              Try Again
            </Button>
          </Box>
        ) : (
          <Box>
            {/* Scene Image */}
            {sceneImage && (
              <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <ImageIcon color="action" />
                    <Typography variant="subtitle2">Camera View</Typography>
                  </Box>
                  <Box
                    component="img"
                    src={`data:image/jpeg;base64,${sceneImage}`}
                    alt="Scene capture"
                    sx={{
                      width: '100%',
                      maxHeight: 400,
                      objectFit: 'contain',
                      borderRadius: 1,
                      bgcolor: 'grey.100'
                    }}
                  />
                </CardContent>
              </Card>
            )}
            
            {/* AI Description */}
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <SmartToyIcon color="primary" />
                    <Typography variant="subtitle2">AI Analysis</Typography>
                  </Box>
                  {audioPlaying && (
                    <Box display="flex" alignItems="center" gap={1}>
                      <VolumeUpIcon color="primary" sx={{ animation: 'pulse 1s infinite' }} />
                      <Typography variant="caption" color="primary">
                        Playing audio...
                      </Typography>
                    </Box>
                  )}
                </Box>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {sceneDescription || 'No description available'}
                </Typography>
              </CardContent>
            </Card>
            
            {/* Test Again Section */}
            <Box sx={{ mt: 3 }}>
              <Button
                variant="outlined"
                onClick={() => setShowAdvanced(!showAdvanced)}
                startIcon={<SettingsIcon />}
                size="small"
              >
                Advanced Options
              </Button>
              
              <Collapse in={showAdvanced}>
                <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Test with Different Settings
                  </Typography>
                  
                  <Box sx={{ mt: 2, display: 'flex', gap: 2, flexDirection: 'column' }}>
                    {availableCameras.length > 0 && (
                      <FormControl fullWidth size="small">
                        <InputLabel>Test Another Camera</InputLabel>
                        <Select
                          value={alternativeCamera?.id || ''}
                          label="Test Another Camera"
                          onChange={(e) => {
                            const cam = availableCameras.find(c => c.id === e.target.value);
                            setAlternativeCamera(cam);
                          }}
                        >
                          <MenuItem value="">
                            <em>Use Current Camera ({camera?.name || camera?.ip})</em>
                          </MenuItem>
                          {availableCameras.map((cam) => (
                            <MenuItem key={cam.id} value={cam.id}>
                              {cam.name || cam.ip}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                    
                    <TextField
                      fullWidth
                      size="small"
                      label="Custom API Key (Optional)"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Leave empty to use configured key"
                      helperText="Only needed if you want to test with a different API key"
                    />
                    
                    <Button
                      variant="contained"
                      onClick={handleTestAgain}
                      startIcon={<RefreshIcon />}
                      disabled={loading}
                    >
                      Test Again
                    </Button>
                  </Box>
                </Box>
              </Collapse>
            </Box>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions>
        <Box display="flex" justifyContent="space-between" width="100%" px={1}>
          <Typography variant="caption" color="text.secondary">
            {camera?.name || camera?.ip} • {speakerConfig ? 'With Speaker' : 'Camera Only'}
          </Typography>
          <Button onClick={onClose}>
            Close
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default DetectionTestModal;