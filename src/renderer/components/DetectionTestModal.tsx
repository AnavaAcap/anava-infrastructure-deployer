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
  const [audioData, setAudioData] = useState<{data: string, format: string} | null>(null);
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
      // First check if we have pre-fetched data (note: key is 'preFetchedScene' not 'prefetchedSceneData')
      const preFetchedData = await (window.electronAPI as any).getConfigValue?.('preFetchedScene');
      
      if (preFetchedData && preFetchedData.cameraId === camera?.id && 
          (Date.now() - preFetchedData.timestamp < 300000)) { // Less than 5 minutes old
        console.log('Using pre-fetched scene data from background capture');
        setSceneDescription(cleanDescription(preFetchedData.description || ''));
        setSceneImage(preFetchedData.imageBase64 || '');
        
        // Store audio data and auto-play when showing cached results
        if (preFetchedData.audioBase64) {
          const format = preFetchedData.audioFormat || 'pcm_l16_24000';
          setAudioData({
            data: preFetchedData.audioBase64,
            format: format
          });
          // Auto-play the cached audio
          playAudio(preFetchedData.audioBase64, format);
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
        
        // Store audio data and auto-play
        if (result.audioBase64) {
          const format = result.audioFormat || 'pcm_l16_24000';
          setAudioData({
            data: result.audioBase64,
            format: format
          });
          // Auto-play the audio
          playAudio(result.audioBase64, format);
        } else if (result.audioMP3Base64) {
          setAudioData({
            data: result.audioMP3Base64,
            format: 'mp3'
          });
          // Auto-play the audio
          playAudio(result.audioMP3Base64, 'mp3');
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
    if (!text) return '';
    
    // Remove quotes and escape characters more aggressively
    let cleaned = text
      .trim() // Remove whitespace first
      .replace(/^["'`]+|["'`]+$/g, '') // Remove any combination of quotes at start/end
      .replace(/\\(.)/g, '$1') // Replace any escaped character with the character itself
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
      .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
      .replace(/`(.*?)`/g, '$1') // Remove code markdown
      .replace(/\\+$/g, '') // Remove trailing backslashes
      .trim(); // Trim again after replacements
    
    // If it still starts with a quote, remove it
    if (cleaned.startsWith('"') || cleaned.startsWith("'")) {
      cleaned = cleaned.substring(1);
    }
    if (cleaned.endsWith('"') || cleaned.endsWith("'")) {
      cleaned = cleaned.substring(0, cleaned.length - 1);
    }
    
    // Remove trailing backslash one more time after all processing
    if (cleaned.endsWith('\\')) {
      cleaned = cleaned.substring(0, cleaned.length - 1).trim();
    }
    
    return cleaned;
  };

  const playAudio = (audioData: string, format: string = 'wav') => {
    if (!audioData) return;
    
    setAudioPlaying(true);
    
    let audioSrc: string;
    
    if (format === 'pcm_l16_24000') {
      // Convert PCM to WAV format for browser playback
      try {
        const pcmData = atob(audioData);
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
        audioSrc = URL.createObjectURL(blob);
      } catch (err) {
        console.error('Failed to convert PCM to WAV:', err);
        setAudioPlaying(false);
        return;
      }
    } else {
      // Handle MP3 or other formats
      audioSrc = `data:audio/${format === 'mp3' ? 'mp3' : 'wav'};base64,${audioData}`;
    }
    
    const audio = new Audio(audioSrc);
    
    audio.onended = () => {
      setAudioPlaying(false);
      if (format === 'pcm_l16_24000') {
        URL.revokeObjectURL(audioSrc);
      }
    };
    
    audio.onerror = () => {
      console.error('Failed to play audio');
      setAudioPlaying(false);
      if (format === 'pcm_l16_24000') {
        URL.revokeObjectURL(audioSrc);
      }
    };
    
    audio.play().catch(err => {
      console.error('Audio playback error:', err);
      setAudioPlaying(false);
      if (format === 'pcm_l16_24000') {
        URL.revokeObjectURL(audioSrc);
      }
    });
  };

  const runFreshTest = async () => {
    setLoading(true);
    setError(null);
    setSceneDescription('');
    setSceneImage('');
    setAudioData(null);
    
    try {
      // Get API key
      const deploymentConfig = await (window.electronAPI as any).getConfigValue?.('deploymentConfig');
      const storedApiKey = deploymentConfig?.vertexApiGatewayKey || 
                          await (window.electronAPI as any).getConfigValue?.('geminiApiKey');
      
      if (!storedApiKey) {
        setError('No API key found. Please configure an API key.');
        setLoading(false);
        return;
      }
      
      // Force a fresh API call (bypassing cache)
      const result = await (window.electronAPI as any).getSceneDescription?.(
        camera,
        storedApiKey,
        camera.hasSpeaker || !!speakerConfig
      );
      
      if (result.success) {
        setSceneDescription(cleanDescription(result.description || ''));
        setSceneImage(result.imageBase64 || '');
        
        // Store and play audio
        if (result.audioBase64) {
          const format = result.audioFormat || 'pcm_l16_24000';
          setAudioData({ data: result.audioBase64, format });
          playAudio(result.audioBase64, format);
        } else if (result.audioMP3Base64) {
          setAudioData({ data: result.audioMP3Base64, format: 'mp3' });
          playAudio(result.audioMP3Base64, 'mp3');
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
        
        // Store audio and auto-play since user clicked "Test Again"
        if (result.audioBase64) {
          setAudioData({
            data: result.audioBase64,
            format: result.audioFormat || 'pcm_l16_24000'
          });
          // Auto-play for manual test
          playAudio(result.audioBase64, result.audioFormat || 'pcm_l16_24000');
        } else if (result.audioMP3Base64) {
          setAudioData({
            data: result.audioMP3Base64,
            format: 'mp3'
          });
          // Auto-play for manual test
          playAudio(result.audioMP3Base64, 'mp3');
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
                
                {/* Audio Replay Button */}
                {audioData && !audioPlaying && (
                  <Button
                    variant="outlined"
                    startIcon={<VolumeUpIcon />}
                    onClick={() => playAudio(audioData.data, audioData.format)}
                    sx={{ mt: 2 }}
                    fullWidth
                  >
                    Replay Audio Response
                  </Button>
                )}
              </CardContent>
            </Card>
            
            {/* Test Again Section */}
            <Box sx={{ mt: 3, display: 'flex', gap: 2, flexDirection: 'column' }}>
              <Button
                variant="contained"
                onClick={runFreshTest}
                startIcon={<RefreshIcon />}
                fullWidth
                disabled={loading}
              >
                Run New Test
              </Button>
              
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