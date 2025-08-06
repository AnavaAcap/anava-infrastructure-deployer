import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardMedia,
  Grid,
  Alert,
  CircularProgress,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Chip,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Videocam as VideocamIcon,
  VolumeUp as VolumeUpIcon,
  OpenInNew as OpenInNewIcon,
  Refresh as RefreshIcon,
  Image as ImageIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material';

interface CameraOption {
  id: string;
  ip: string;
  name: string;
  hasACAP: boolean;
  hasSpeaker: boolean;
  credentials?: {
    username: string;
    password: string;
  };
}

interface SceneAnalysis {
  description: string;
  imageBase64?: string;
  audioMP3Base64?: string;
  timestamp: string;
}

const DetectionTestPage: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [selectedCamera, setSelectedCamera] = useState<CameraOption | null>(null);
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [sceneAnalysis, setSceneAnalysis] = useState<SceneAnalysis | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadConfiguredCameras();
    loadApiKey();
    
    return () => {
      // Cleanup audio on unmount
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }
    };
  }, []);

  const loadApiKey = async () => {
    try {
      // Try to get the API key from config
      const storedKey = await window.electronAPI?.getConfigValue('geminiApiKey');
      if (storedKey) {
        setApiKey(storedKey);
      }
    } catch (error) {
      console.error('Failed to load API key:', error);
    }
  };

  const loadConfiguredCameras = async () => {
    try {
      const savedCameras = await window.electronAPI?.getConfigValue('configuredCameras');
      console.log('Loading configured cameras:', savedCameras);
      if (savedCameras && Array.isArray(savedCameras)) {
        setCameras(savedCameras.map((cam: any) => ({
          id: cam.id || `camera-${cam.ip}`,
          ip: cam.ip,
          name: cam.name || `Camera at ${cam.ip}`,
          hasACAP: cam.hasACAP !== false,
          hasSpeaker: cam.hasSpeaker || false,
          credentials: cam.credentials,
        })));
        console.log(`Loaded ${savedCameras.length} configured camera(s)`);
      } else {
        console.log('No configured cameras found in storage');
      }
    } catch (error) {
      console.error('Failed to load cameras:', error);
    }
  };

  const handleStartTest = () => {
    if (selectedCamera && apiKey) {
      setActiveStep(1);
      analyzeScene();
    } else if (!apiKey) {
      setError('Please enter your Gemini API key');
    }
  };

  const analyzeScene = async () => {
    if (!selectedCamera || !apiKey) return;

    setAnalyzing(true);
    setError(null);
    setSceneAnalysis(null);

    try {
      console.log('Starting scene analysis for camera:', selectedCamera.ip);
      
      const result = await window.electronAPI?.getSceneDescription(
        selectedCamera,
        apiKey,
        false // Don't include speaker for test
      );

      if (result.success) {
        const analysis: SceneAnalysis = {
          description: result.description || 'No description available',
          imageBase64: result.imageBase64,
          audioMP3Base64: result.audioMP3Base64,
          timestamp: new Date().toLocaleTimeString(),
        };
        
        setSceneAnalysis(analysis);
        
        // Play audio if available
        if (result.audioMP3Base64) {
          playAudio(result.audioMP3Base64);
        }
        
        setActiveStep(2);
      } else {
        throw new Error(result.error || 'Failed to analyze scene');
      }
    } catch (error: any) {
      console.error('Scene analysis failed:', error);
      setError(error.message || 'Failed to analyze scene');
    } finally {
      setAnalyzing(false);
    }
  };

  const playAudio = (base64Audio: string) => {
    try {
      // Stop any existing audio
      if (audioElement) {
        audioElement.pause();
      }

      // Create new audio element
      const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
      audio.play().catch(e => {
        console.error('Failed to play audio:', e);
      });
      
      setAudioElement(audio);
    } catch (error) {
      console.error('Failed to play audio:', error);
    }
  };

  const openAnavaInterface = () => {
    if (selectedCamera) {
      window.electronAPI?.openExternal(`http://${selectedCamera.ip}/local/BatonAnalytic/local-events.html`);
    }
  };

  const handleReset = () => {
    setActiveStep(0);
    setSceneAnalysis(null);
    setError(null);
    if (audioElement) {
      audioElement.pause();
      audioElement.src = '';
    }
  };

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography variant="body2" color="text.secondary" paragraph>
              Test the AI vision capabilities of your configured camera
            </Typography>
            
            {cameras.length === 0 ? (
              <Box>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  No configured cameras found. Please set up a camera first.
                </Alert>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={() => {
                    setLoading(true);
                    loadConfiguredCameras().finally(() => setLoading(false));
                  }}
                  disabled={loading}
                >
                  Refresh Camera List
                </Button>
              </Box>
            ) : (
              <Box>
                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel>Select Camera</InputLabel>
                  <Select
                    value={selectedCamera?.id || ''}
                    onChange={(e) => {
                      const cam = cameras.find(c => c.id === e.target.value);
                      setSelectedCamera(cam || null);
                    }}
                  >
                    {cameras.map((camera) => (
                      <MenuItem key={camera.id} value={camera.id}>
                        <Box>
                          <Typography variant="body1">{camera.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {camera.ip}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label="Gemini API Key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  helperText="Enter your Gemini API key for AI analysis"
                  sx={{ mb: 3 }}
                />

                <Button
                  variant="text"
                  startIcon={<RefreshIcon />}
                  onClick={() => {
                    setLoading(true);
                    loadConfiguredCameras().finally(() => setLoading(false));
                  }}
                  disabled={loading}
                >
                  Refresh List
                </Button>
              </Box>
            )}
            
            {selectedCamera && apiKey && (
              <Box sx={{ mt: 3 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item>
                        <VideocamIcon color="primary" fontSize="large" />
                      </Grid>
                      <Grid item xs>
                        <Typography variant="h6">{selectedCamera.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {selectedCamera.ip}
                        </Typography>
                      </Grid>
                      {selectedCamera.hasACAP && (
                        <Grid item>
                          <Chip label="ACAP Installed" color="success" size="small" />
                        </Grid>
                      )}
                    </Grid>
                  </CardContent>
                </Card>
              </Box>
            )}
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="body2" color="text.secondary" paragraph>
              Analyzing the camera's view using AI...
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
              <CircularProgress size={60} sx={{ mb: 3 }} />
              <Typography variant="h6" gutterBottom>
                Capturing Scene
              </Typography>
              <Typography variant="body2" color="text.secondary">
                AI is analyzing what the camera sees...
              </Typography>
            </Box>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="body2" color="text.secondary" paragraph>
              Scene analysis complete
            </Typography>
            
            {sceneAnalysis && (
              <Grid container spacing={3}>
                {sceneAnalysis.imageBase64 && (
                  <Grid item xs={12}>
                    <Card>
                      <CardMedia
                        component="img"
                        image={`data:image/jpeg;base64,${sceneAnalysis.imageBase64}`}
                        alt="Camera view"
                        sx={{ maxHeight: 400, objectFit: 'contain' }}
                      />
                    </Card>
                  </Grid>
                )}
                
                <Grid item xs={12}>
                  <Paper elevation={2} sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <DescriptionIcon sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="h6">AI Analysis</Typography>
                    </Box>
                    <Typography variant="body1" paragraph>
                      {sceneAnalysis.description}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Analyzed at {sceneAnalysis.timestamp}
                    </Typography>
                  </Paper>
                </Grid>

                {sceneAnalysis.audioMP3Base64 && (
                  <Grid item xs={12}>
                    <Paper elevation={1} sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <VolumeUpIcon sx={{ mr: 1, color: 'success.main' }} />
                        <Typography variant="body2">
                          Audio talkdown played through your speakers
                        </Typography>
                      </Box>
                    </Paper>
                  </Grid>
                )}

                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                      variant="contained"
                      onClick={analyzeScene}
                      startIcon={<RefreshIcon />}
                    >
                      Analyze Again
                    </Button>
                    
                    <Button
                      variant="outlined"
                      onClick={openAnavaInterface}
                      endIcon={<OpenInNewIcon />}
                    >
                      Open Anava
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        AI Vision Test
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        Test your camera's AI capabilities by capturing and analyzing the current scene
      </Typography>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Stepper activeStep={activeStep} orientation="vertical">
        <Step>
          <StepLabel>
            Select Camera & API Key
          </StepLabel>
          <StepContent>
            {getStepContent(0)}
            <Box sx={{ mb: 2, mt: 2 }}>
              <Button
                variant="contained"
                onClick={handleStartTest}
                disabled={!selectedCamera || !apiKey}
                startIcon={<PlayIcon />}
              >
                Start Test
              </Button>
            </Box>
          </StepContent>
        </Step>

        <Step>
          <StepLabel>
            Analyzing Scene
          </StepLabel>
          <StepContent>
            {getStepContent(1)}
          </StepContent>
        </Step>

        <Step>
          <StepLabel>
            Review Results
          </StepLabel>
          <StepContent>
            {getStepContent(2)}
            <Box sx={{ mb: 2, mt: 3 }}>
              <Button onClick={handleReset} sx={{ mr: 1 }}>
                Test Another Camera
              </Button>
            </Box>
          </StepContent>
        </Step>
      </Stepper>
    </Box>
  );
};

export default DetectionTestPage;