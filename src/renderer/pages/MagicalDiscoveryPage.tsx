import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Typography, 
  Container,
  Fade,
  LinearProgress,
  Button,
  TextField,
  Paper,
  Collapse,
  Alert,
  IconButton,
  Zoom
} from '@mui/material';
import { keyframes } from '@mui/system';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import WifiIcon from '@mui/icons-material/Wifi';
import PsychologyIcon from '@mui/icons-material/Psychology';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import { CameraInfo } from '../../types';

// Radar sweep animation
const radarSweep = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;

// Pulse animation for discovered items
const pulse = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.2);
    opacity: 1;
  }
`;

// Neural network data flow
const dataFlow = keyframes`
  0% {
    transform: translateY(0);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: translateY(-100%);
    opacity: 0;
  }
`;

interface MagicalProgress {
  stage: 'discovering' | 'configuring' | 'awakening' | 'analyzing' | 'complete' | 'error';
  message: string;
  progress: number;
  detail?: string;
}

interface MagicalDiscoveryPageProps {
  onComplete: (camera: CameraInfo) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

export const MagicalDiscoveryPage: React.FC<MagicalDiscoveryPageProps> = ({
  onComplete,
  onError,
  onCancel
}) => {
  const [progress, setProgress] = useState<MagicalProgress>({
    stage: 'discovering',
    message: 'Initializing magical experience...',
    progress: 0
  });
  const [camera, setCamera] = useState<CameraInfo | null>(null);
  const [firstInsight, setFirstInsight] = useState<string>('');
  const [userQuery, setUserQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    startMagicalExperience();
    subscribeToEvents();

    return () => {
      // Cleanup
      window.electronAPI.magical.cancel();
    };
  }, []);

  const startMagicalExperience = async () => {
    try {
      const result = await window.electronAPI.magical.startExperience();
      
      if (result.success && result.camera) {
        setCamera(result.camera);
        setFirstInsight(result.firstInsight || '');
        
        // Start showing camera feed
        startCameraFeed(result.camera);
        
        // Notify parent
        onComplete(result.camera);
      } else {
        setErrorMessage(result.error || 'Failed to complete magical setup');
        setShowError(true);
        onError(result.error || 'Failed to complete magical setup');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'An unexpected error occurred');
      setShowError(true);
      onError(error.message || 'An unexpected error occurred');
    }
  };

  const subscribeToEvents = () => {
    window.electronAPI.magical.subscribe();

    window.electronAPI.magical.onProgress((update: MagicalProgress) => {
      setProgress(update);
    });

    window.electronAPI.magical.onRateLimit((data) => {
      setErrorMessage(data.message);
      setShowError(true);
    });

    window.electronAPI.magical.onLowQuota((data) => {
      // Could show a warning banner
      console.warn(`Low quota: ${data.remaining} requests remaining`);
    });

    window.electronAPI.magical.onCancelled(() => {
      onCancel();
    });
  };

  const startCameraFeed = async (cameraInfo: CameraInfo) => {
    // In a real implementation, this would connect to the camera's MJPEG stream
    // For now, we'll simulate with a placeholder
    console.log('Starting camera feed from:', cameraInfo.ip);
  };

  const handleUserQuery = async () => {
    if (!userQuery.trim() || !camera || isAnalyzing) return;

    setIsAnalyzing(true);
    setAiResponse('');

    try {
      const result = await window.electronAPI.magical.analyzeCustom({
        query: userQuery,
        camera
      });

      if (result.success) {
        // Typewriter effect for response
        typewriterEffect(result.response || 'I processed your request.');
      } else {
        setErrorMessage(result.error || 'Failed to analyze');
        setShowError(true);
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Analysis failed');
      setShowError(true);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const typewriterEffect = (text: string) => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < text.length) {
        setAiResponse((prev) => prev + text.charAt(index));
        index++;
      } else {
        clearInterval(interval);
      }
    }, 30);
  };

  const renderStage = () => {
    switch (progress.stage) {
      case 'discovering':
        return (
          <Box sx={{ textAlign: 'center' }}>
            {/* Radar animation */}
            <Box sx={{ position: 'relative', width: 300, height: 300, mx: 'auto', mb: 4 }}>
              {/* Radar circles */}
              {[1, 2, 3].map((ring) => (
                <Box
                  key={ring}
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: ring * 100,
                    height: ring * 100,
                    border: '2px solid',
                    borderColor: 'primary.main',
                    borderRadius: '50%',
                    transform: 'translate(-50%, -50%)',
                    opacity: 1 - (ring * 0.3),
                  }}
                />
              ))}
              
              {/* Radar sweep */}
              <Box
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: '100%',
                  height: 2,
                  background: 'linear-gradient(90deg, transparent 0%, #00D4FF 50%, transparent 100%)',
                  transformOrigin: 'left center',
                  animation: `${radarSweep} 3s linear infinite`,
                }}
              />
              
              {/* Center icon */}
              <WifiIcon
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  fontSize: 60,
                  color: 'primary.main',
                  filter: 'drop-shadow(0 0 20px rgba(0, 102, 255, 0.5))',
                }}
              />
            </Box>
            
            <Typography variant="h5" sx={{ color: 'text.primary', mb: 2 }}>
              {progress.message}
            </Typography>
            
            {progress.detail && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {progress.detail}
              </Typography>
            )}
          </Box>
        );

      case 'configuring':
      case 'awakening':
        return (
          <Box sx={{ textAlign: 'center' }}>
            {/* Neural network animation */}
            <Box sx={{ position: 'relative', width: 300, height: 300, mx: 'auto', mb: 4 }}>
              <PsychologyIcon
                sx={{
                  fontSize: 120,
                  color: 'primary.main',
                  filter: 'drop-shadow(0 0 30px rgba(0, 102, 255, 0.8))',
                  animation: `${pulse} 2s ease-in-out infinite`,
                }}
              />
              
              {/* Data flow particles */}
              {Array.from({ length: 10 }).map((_, i) => (
                <Box
                  key={i}
                  sx={{
                    position: 'absolute',
                    width: 4,
                    height: 20,
                    background: 'linear-gradient(180deg, transparent 0%, #00D4FF 50%, transparent 100%)',
                    left: `${20 + Math.random() * 60}%`,
                    top: '100%',
                    animation: `${dataFlow} 2s linear ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </Box>
            
            <Typography variant="h5" sx={{ color: 'text.primary', mb: 2 }}>
              {progress.message}
            </Typography>
          </Box>
        );

      case 'analyzing':
      case 'complete':
        return (
          <Box>
            {/* Camera feed placeholder */}
            <Paper
              sx={{
                position: 'relative',
                width: '100%',
                maxWidth: 800,
                mx: 'auto',
                mb: 4,
                overflow: 'hidden',
                borderRadius: 2,
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              }}
            >
              <Box
                sx={{
                  position: 'relative',
                  paddingTop: '56.25%', // 16:9 aspect ratio
                  background: 'linear-gradient(45deg, #1a1f3a 0%, #0A0E27 100%)',
                }}
              >
                <CameraAltIcon
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontSize: 80,
                    color: 'rgba(255, 255, 255, 0.1)',
                  }}
                />
                
                {camera && (
                  <Typography
                    variant="caption"
                    sx={{
                      position: 'absolute',
                      bottom: 8,
                      left: 8,
                      color: 'rgba(255, 255, 255, 0.7)',
                      background: 'rgba(0, 0, 0, 0.5)',
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                    }}
                  >
                    {camera.model} at {camera.ip}
                  </Typography>
                )}
              </Box>
            </Paper>

            {/* First insight */}
            {firstInsight && (
              <Fade in timeout={1000}>
                <Paper
                  sx={{
                    p: 3,
                    mb: 4,
                    background: 'rgba(0, 102, 255, 0.1)',
                    border: '1px solid rgba(0, 102, 255, 0.3)',
                  }}
                >
                  <Typography
                    variant="h6"
                    sx={{
                      fontStyle: 'italic',
                      color: 'text.primary',
                      textAlign: 'center',
                      mb: 2,
                    }}
                  >
                    "{firstInsight}"
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                    — Anava Vision AI
                  </Typography>
                </Paper>
              </Fade>
            )}

            {/* User query input */}
            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" sx={{ mb: 2, color: 'text.primary' }}>
                What would you like me to watch for?
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  fullWidth
                  variant="outlined"
                  placeholder="Ask me to find something, count objects, or analyze the scene..."
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleUserQuery()}
                  disabled={isAnalyzing}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: 'background.paper',
                    },
                  }}
                />
                <Button
                  variant="contained"
                  onClick={handleUserQuery}
                  disabled={!userQuery.trim() || isAnalyzing}
                  endIcon={<SendIcon />}
                  sx={{ minWidth: 120 }}
                >
                  {isAnalyzing ? 'Analyzing...' : 'Ask'}
                </Button>
              </Box>
            </Box>

            {/* AI Response */}
            <Collapse in={!!aiResponse}>
              <Paper
                sx={{
                  mt: 3,
                  p: 3,
                  background: 'rgba(0, 212, 255, 0.05)',
                  border: '1px solid rgba(0, 212, 255, 0.2)',
                }}
              >
                <Typography variant="body1" sx={{ color: 'text.primary' }}>
                  {aiResponse}
                </Typography>
              </Paper>
            </Collapse>
          </Box>
        );

      case 'error':
        return (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h5" sx={{ color: 'error.main', mb: 2 }}>
              {progress.message}
            </Typography>
            <Button variant="outlined" onClick={onCancel}>
              Try Traditional Setup
            </Button>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4, minHeight: '100vh' }}>
        {/* Progress bar */}
        <LinearProgress
          variant="determinate"
          value={progress.progress}
          sx={{
            mb: 4,
            height: 8,
            borderRadius: 4,
            backgroundColor: 'rgba(0, 102, 255, 0.1)',
            '& .MuiLinearProgress-bar': {
              borderRadius: 4,
              background: 'linear-gradient(90deg, #0066FF 0%, #00D4FF 100%)',
            },
          }}
        />

        {/* Stage content */}
        <Fade in key={progress.stage} timeout={500}>
          <Box>{renderStage()}</Box>
        </Fade>

        {/* Error alert */}
        <Collapse in={showError}>
          <Alert
            severity="error"
            action={
              <IconButton
                size="small"
                onClick={() => setShowError(false)}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            }
            sx={{ mt: 4 }}
          >
            {errorMessage}
          </Alert>
        </Collapse>
      </Box>
    </Container>
  );
};