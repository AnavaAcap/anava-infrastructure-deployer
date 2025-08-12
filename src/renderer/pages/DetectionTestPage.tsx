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
  InputAdornment,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Videocam as VideocamIcon,
  VolumeUp as VolumeUpIcon,
  VolumeOff as VolumeOffIcon,
  OpenInNew as OpenInNewIcon,
  Refresh as RefreshIcon,
  Image as ImageIcon,
  Description as DescriptionIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
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
  audioMP3Base64?: string; // Keep for backward compatibility
  audioBase64?: string;
  audioFormat?: string;
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
  const [showApiKey, setShowApiKey] = useState(false);
  const [sceneAnalysis, setSceneAnalysis] = useState<SceneAnalysis | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [hasPreFetchedData, setHasPreFetchedData] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  useEffect(() => {
    loadConfiguredCameras();
    loadApiKey();
    checkPreFetchedData();
    
    // Add global click handler to retry blocked audio
    const handleGlobalClick = () => {
      if ((window as any).pendingAudio) {
        console.log('Retrying blocked audio playback...');
        (window as any).pendingAudio.play().catch((e: any) => {
          console.error('Still cannot play audio:', e);
        });
        (window as any).pendingAudio = null;
      }
    };
    
    document.addEventListener('click', handleGlobalClick);
    
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, []);

  // Separate effect for audio cleanup to avoid stale closure
  useEffect(() => {
    return () => {
      // Cleanup audio on unmount
      if (audioElement) {
        audioElement.pause();
        // Remove all event listeners
        audioElement.removeEventListener('ended', () => {});
        audioElement.src = '';
      }
    };
  }, [audioElement]);

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

  const checkPreFetchedData = async () => {
    try {
      const preFetched = await window.electronAPI?.getConfigValue('preFetchedScene');
      if (preFetched && preFetched.timestamp && (Date.now() - preFetched.timestamp) < 60000) {
        setHasPreFetchedData(true);
      }
    } catch (error) {
      console.error('Failed to check pre-fetched data:', error);
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
      setError('No API key available. Please ensure an API key was generated during setup.');
    } else if (!selectedCamera) {
      setError('Please select a camera first');
    }
  };

  const analyzeScene = async () => {
    if (!selectedCamera || !apiKey) return;

    setAnalyzing(true);
    setError(null);
    setSceneAnalysis(null);

    try {
      console.log('Starting scene analysis for camera:', selectedCamera.ip);
      
      // Check for pre-fetched scene data first
      const preFetched = await window.electronAPI?.getConfigValue('preFetchedScene');
      
      if (preFetched && 
          preFetched.cameraIp === selectedCamera.ip && 
          preFetched.timestamp && 
          (Date.now() - preFetched.timestamp) < 60000) { // Less than 1 minute old
        
        console.log('Using pre-fetched scene data');
        setHasPreFetchedData(false); // Clear the indicator
        
        const analysis: SceneAnalysis = {
          description: cleanDescription(preFetched.description || 'No description available'),
          imageBase64: preFetched.imageBase64,
          audioMP3Base64: preFetched.audioMP3Base64,
          audioBase64: preFetched.audioBase64,
          audioFormat: preFetched.audioFormat,
          timestamp: new Date().toLocaleTimeString(),
        };
        
        setSceneAnalysis(analysis);
        
        // Play audio if available - use new format if available
        // Delay slightly to ensure modal is fully rendered
        setTimeout(() => {
          if (preFetched.audioBase64) {
            playAudio(preFetched.audioBase64, preFetched.audioFormat);
          } else if (preFetched.audioMP3Base64) {
            playAudio(preFetched.audioMP3Base64, 'mp3');
          }
        }, 100);
        
        // Clear the pre-fetched data after using it
        await window.electronAPI?.setConfigValue('preFetchedScene', null);
        
        setActiveStep(2);
      } else {
        // No pre-fetched data or it's stale, fetch fresh
        console.log('Fetching fresh scene data');
        
        // Get user's name for personalized prompt
        const userDisplayName = localStorage.getItem('userDisplayName');
        let customPrompt: string | undefined;
        
        if (userDisplayName) {
          const firstName = userDisplayName.split(' ')[0];
          customPrompt = `You are Anava, an AI vision assistant analyzing a live camera feed. The person testing you is named ${firstName}. Please: 1) Greet ${firstName} by name, 2) Introduce yourself as Anava, 3) Then describe what you see in this image, mentioning specific details like objects, people, colors, or activities to prove you're seeing their actual environment in real-time. Keep the entire response under 3 sentences and make it conversational.`;
        }
        
        const result = await window.electronAPI?.getSceneDescription(
          selectedCamera,
          apiKey,
          selectedCamera.hasSpeaker, // Pass speaker config if available
          customPrompt
        );

        if (result.success) {
          const analysis: SceneAnalysis = {
            description: cleanDescription(result.description || 'No description available'),
            imageBase64: result.imageBase64,
            audioMP3Base64: result.audioMP3Base64,
            audioBase64: result.audioBase64,
            audioFormat: result.audioFormat,
            timestamp: new Date().toLocaleTimeString(),
          };
          
          setSceneAnalysis(analysis);
          
          // Play audio if available - use new format if available
          // Delay slightly to ensure modal is fully rendered
          setTimeout(() => {
            if (result.audioBase64) {
              playAudio(result.audioBase64, result.audioFormat);
            } else if (result.audioMP3Base64) {
              playAudio(result.audioMP3Base64, 'mp3');
            }
          }, 100);
          
          setActiveStep(2);
        } else {
          throw new Error(result.error || 'Failed to analyze scene');
        }
      }
    } catch (error: any) {
      console.error('Scene analysis failed:', error);
      setError(error.message || 'Failed to analyze scene');
    } finally {
      setAnalyzing(false);
    }
  };

  const cleanDescription = (text: string): string => {
    // Remove escaped quotes
    let cleaned = text.replace(/\\"/g, '');
    
    // Remove surrounding quotes if present
    cleaned = cleaned.replace(/^["']|["']$/g, '');
    
    // Clean up common markdown formatting
    cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '$1'); // Bold
    cleaned = cleaned.replace(/\*(.*?)\*/g, '$1'); // Italic
    cleaned = cleaned.replace(/__(.*?)__/g, '$1'); // Bold
    cleaned = cleaned.replace(/_(.*?)_/g, '$1'); // Italic
    cleaned = cleaned.replace(/`(.*?)`/g, '$1'); // Code
    
    // Clean up extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  };

  const playAudio = (base64Audio: string, format?: string) => {
    try {
      // Stop any existing audio
      if (audioElement) {
        audioElement.pause();
      }

      let audioUrl: string;
      
      if (format === 'pcm_l16_24000') {
        // Convert PCM to WAV format for browser playback
        const pcmData = atob(base64Audio);
        const pcmArray = new Uint8Array(pcmData.length);
        for (let i = 0; i < pcmData.length; i++) {
          pcmArray[i] = pcmData.charCodeAt(i);
        }
        
        // Create WAV header for 16-bit PCM at 24kHz
        const wavHeader = new ArrayBuffer(44);
        const view = new DataView(wavHeader);
        
        // "RIFF" chunk descriptor
        view.setUint32(0, 0x52494646, false); // "RIFF"
        view.setUint32(4, 36 + pcmArray.length, true); // file size - 8
        view.setUint32(8, 0x57415645, false); // "WAVE"
        
        // "fmt " sub-chunk
        view.setUint32(12, 0x666d7420, false); // "fmt "
        view.setUint32(16, 16, true); // subchunk size
        view.setUint16(20, 1, true); // audio format (1 = PCM)
        view.setUint16(22, 1, true); // number of channels
        view.setUint32(24, 24000, true); // sample rate
        view.setUint32(28, 24000 * 2, true); // byte rate
        view.setUint16(32, 2, true); // block align
        view.setUint16(34, 16, true); // bits per sample
        
        // "data" sub-chunk
        view.setUint32(36, 0x64617461, false); // "data"
        view.setUint32(40, pcmArray.length, true); // subchunk2 size
        
        // Combine header and PCM data
        const wavBuffer = new Uint8Array(44 + pcmArray.length);
        wavBuffer.set(new Uint8Array(wavHeader), 0);
        wavBuffer.set(pcmArray, 44);
        
        // Create blob and URL
        const blob = new Blob([wavBuffer], { type: 'audio/wav' });
        audioUrl = URL.createObjectURL(blob);
      } else {
        // Default to MP3
        audioUrl = `data:audio/mp3;base64,${base64Audio}`;
      }

      // Create new audio element
      const audio = new Audio(audioUrl);
      
      // Track playing state
      audio.addEventListener('play', () => setIsAudioPlaying(true));
      audio.addEventListener('pause', () => setIsAudioPlaying(false));
      audio.addEventListener('ended', () => setIsAudioPlaying(false));
      
      // Ensure audio is loaded before playing
      audio.addEventListener('canplaythrough', () => {
        audio.play().then(() => {
          setIsAudioPlaying(true);
        }).catch(e => {
          console.error('Failed to play audio:', e);
          // Retry with user interaction if blocked
          if (e.name === 'NotAllowedError') {
            console.log('Audio blocked by browser, will play on next user interaction');
            // Store for retry
            window.pendingAudio = audio;
          }
        });
      });
      
      // Load the audio
      audio.load();
      
      // Clean up object URL when done
      if (format === 'pcm_l16_24000') {
        audio.addEventListener('ended', () => {
          URL.revokeObjectURL(audioUrl);
        });
      }
      
      setAudioElement(audio);
    } catch (error) {
      console.error('Failed to play audio:', error);
    }
  };

  const openAnavaInterface = () => {
    if (selectedCamera) {
      window.electronAPI?.openExternal(`https://${selectedCamera.ip}/local/BatonAnalytic/local-events.html`);
    }
  };

  const handleReset = () => {
    setActiveStep(0);
    setSceneAnalysis(null);
    setError(null);
    setIsAudioPlaying(false);
    if (audioElement) {
      audioElement.pause();
      audioElement.src = '';
    }
  };
  
  const toggleAudio = () => {
    if (!audioElement) return;
    
    if (isAudioPlaying) {
      audioElement.pause();
      setIsAudioPlaying(false);
    } else {
      audioElement.play().then(() => {
        setIsAudioPlaying(true);
      }).catch(e => {
        console.error('Failed to play audio:', e);
      });
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
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  helperText={apiKey ? "API key configured automatically" : "No API key found - please generate one"}
                  sx={{ mb: 3 }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowApiKey(!showApiKey)}
                          edge="end"
                          size="small"
                        >
                          {showApiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                <Box sx={{ display: 'flex', gap: 2 }}>
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
                  
                  {!apiKey && (
                    <Button
                      variant="outlined"
                      onClick={async () => {
                        setLoading(true);
                        try {
                          const result = await window.electronAPI?.magical?.generateApiKey();
                          if (result?.success && result.apiKey) {
                            await window.electronAPI?.setConfigValue('geminiApiKey', result.apiKey);
                            setApiKey(result.apiKey);
                            setError(null);
                          } else if (result?.needsManual) {
                            setError('Please create an API key manually in AI Studio');
                          } else {
                            setError('Failed to generate API key');
                          }
                        } catch (err) {
                          setError('Failed to generate API key');
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading}
                    >
                      Generate API Key
                    </Button>
                  )}
                </Box>
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
                      {hasPreFetchedData && (
                        <Grid item>
                          <Chip 
                            label="Ready to Test" 
                            color="info" 
                            size="small" 
                            icon={<CheckCircleIcon />}
                          />
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
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <DescriptionIcon sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant="h6">AI Analysis</Typography>
                      </Box>
                      {audioElement && (
                        <IconButton 
                          onClick={toggleAudio}
                          color="primary"
                          title={isAudioPlaying ? 'Mute audio' : 'Play audio'}
                        >
                          {isAudioPlaying ? <VolumeOffIcon /> : <VolumeUpIcon />}
                        </IconButton>
                      )}
                    </Box>
                    <Typography variant="body1" paragraph>
                      {cleanDescription(sceneAnalysis.description)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Analyzed at {sceneAnalysis.timestamp}
                    </Typography>
                  </Paper>
                </Grid>

                {(sceneAnalysis.audioMP3Base64 || sceneAnalysis.audioBase64) && (
                  <Grid item xs={12}>
                    <Paper elevation={1} sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <VolumeUpIcon sx={{ mr: 1, color: isAudioPlaying ? 'success.main' : 'text.secondary' }} />
                          <Typography variant="body2">
                            {isAudioPlaying ? 'Audio talkdown playing...' : 'Audio talkdown available'}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          onClick={toggleAudio}
                          startIcon={isAudioPlaying ? <VolumeOffIcon /> : <VolumeUpIcon />}
                        >
                          {isAudioPlaying ? 'Mute' : 'Play'}
                        </Button>
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