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
  Zoom,
  ThemeProvider,
  createTheme,
  AppBar,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Grid,
  CircularProgress
} from '@mui/material';
import { keyframes } from '@mui/system';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import WifiIcon from '@mui/icons-material/Wifi';
import PsychologyIcon from '@mui/icons-material/Psychology';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DashboardIcon from '@mui/icons-material/Dashboard';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
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

// Create a dark theme for this magical page
const magicalDarkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00D4FF',
    },
    background: {
      default: '#0A0E27',
      paper: 'rgba(255, 255, 255, 0.05)',
    },
  },
});

// Function to format AI response text - PROPERLY
const formatAIResponse = (text: string) => {
  // Replace \n\n with single line breaks and fix quotes
  const cleanedText = text
    .replace(/\\n\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"');
  
  return (
    <Typography sx={{ 
      color: 'rgba(255, 255, 255, 0.9)', 
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word'
    }}>
      {cleanedText}
    </Typography>
  );
};

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
  const [firstImage, setFirstImage] = useState<string>('');
  const [userQuery, setUserQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [manualMode, setManualMode] = useState(true); // Start with manual mode
  const [manualIp, setManualIp] = useState('');
  const [manualUsername, setManualUsername] = useState('anava');
  const [manualPassword, setManualPassword] = useState('baton');
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Don't auto-start, wait for user to either enter IP or scan
    subscribeToEvents();
    
    let isConnecting = false;
    let intervalRef: NodeJS.Timeout | null = null;
    
    // Check for pre-discovered cameras immediately and periodically
    const checkAndAutoConnect = async () => {
      if (isConnecting) return false; // Prevent multiple connections
      
      const result = await window.electronAPI.camera.getPreDiscoveredCameras();
      if (result.cameras.length > 0) {
        // FOUND A CAMERA - START IMMEDIATELY!
        console.log('CAMERA FOUND - STARTING AUTOMATIC CONNECTION!');
        const firstCamera = result.cameras[0];
        const apiKey = (window as any).__magicalApiKey;
        
        if (apiKey && !isConnecting) {
          isConnecting = true; // Mark as connecting
          
          // Hide manual form IMMEDIATELY
          setManualMode(false);
          setProgress({
            stage: 'configuring',
            message: `Connecting to camera at ${firstCamera.ip}...`,
            progress: 40
          });
          
          // Connect NOW
          const anavaKey = (window as any).__anavaLicenseKey;
          const connectResult = await window.electronAPI.magical.connectToCamera({
            apiKey,
            ip: firstCamera.ip,
            username: firstCamera.credentials?.username || 'root',
            password: firstCamera.credentials?.password || 'pass',
            anavaKey
          });
          
          if (connectResult.success && connectResult.camera) {
            console.log('Connect result:', {
              hasCamera: !!connectResult.camera,
              hasInsight: !!connectResult.firstInsight,
              hasImage: !!connectResult.firstImage,
              imageLength: connectResult.firstImage?.length || 0,
              imagePreview: connectResult.firstImage?.substring(0, 100) + '...'
            });
            
            setCamera(connectResult.camera);
            setFirstInsight(connectResult.firstInsight || '');
            setFirstImage(connectResult.firstImage || '');
            startCameraFeed(connectResult.camera);
            // Don't call onComplete yet - wait for the progress to reach 'complete'
            // The progress event will trigger the UI update
          } else if (connectResult.error) {
            setErrorMessage(connectResult.error);
            setShowError(true);
            isConnecting = false; // Reset on error
          }
        }
        return true;
      }
      return false;
    };
    
    // Check immediately
    checkAndAutoConnect();
    
    // Keep checking every 500ms until we find a camera or timeout
    intervalRef = setInterval(async () => {
      const found = await checkAndAutoConnect();
      if (found && intervalRef) {
        clearInterval(intervalRef);
        intervalRef = null;
      }
    }, 500);
    
    // Stop checking after 15 seconds
    setTimeout(() => {
      if (intervalRef) {
        clearInterval(intervalRef);
        intervalRef = null;
      }
    }, 15000);

    return () => {
      if (intervalRef) {
        clearInterval(intervalRef);
      }
      window.electronAPI.magical.cancel();
    };
  }, []);

  const startMagicalExperience = async () => {
    try {
      // Get the API key from window storage
      const apiKey = (window as any).__magicalApiKey;
      const anavaKey = (window as any).__anavaLicenseKey;
      if (!apiKey) {
        throw new Error('No API key available');
      }
      
      const result = await window.electronAPI.magical.startExperience(apiKey, anavaKey);
      
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

  const handleManualConnect = async () => {
    if (!manualIp.trim()) {
      setErrorMessage('Please enter a camera IP address');
      setShowError(true);
      return;
    }

    try {
      setIsScanning(true);
      setManualMode(false);
      setProgress({
        stage: 'discovering',
        message: `Connecting to camera at ${manualIp}...`,
        progress: 20
      });

      // Get the API key from window storage
      const apiKey = (window as any).__magicalApiKey;
      const anavaKey = (window as any).__anavaLicenseKey;
      if (!apiKey) {
        throw new Error('No API key available');
      }
      
      const result = await window.electronAPI.magical.connectToCamera({
        apiKey,
        ip: manualIp,
        username: manualUsername,
        password: manualPassword,
        anavaKey
      });
      
      if (result.success && result.camera) {
        console.log('Manual connect result:', {
          hasCamera: !!result.camera,
          hasInsight: !!result.firstInsight,
          hasImage: !!result.firstImage,
          imageLength: result.firstImage?.length || 0,
          imagePreview: result.firstImage?.substring(0, 100) + '...'
        });
        
        setCamera(result.camera);
        setFirstInsight(result.firstInsight || '');
        setFirstImage(result.firstImage || '');
        startCameraFeed(result.camera);
        onComplete(result.camera);
      } else {
        setErrorMessage(result.error || 'Failed to connect to camera');
        setShowError(true);
        setManualMode(true);
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to connect to camera');
      setShowError(true);
      setManualMode(true);
    } finally {
      setIsScanning(false);
    }
  };

  const handleScanNetwork = async () => {
    setManualMode(false);
    setIsScanning(true);
    startMagicalExperience();
  };

  const subscribeToEvents = () => {
    window.electronAPI.magical.subscribe();

    window.electronAPI.magical.onProgress((update: MagicalProgress) => {
      console.log('Magical progress:', update);
      setProgress(update);
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
    // Show manual entry form if in manual mode
    if (manualMode && !camera) {
      return (
        <Box sx={{ 
          maxWidth: 600, 
          mx: 'auto',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          height: '100%',
          p: 3
        }}>
          <Typography variant="h4" sx={{ color: 'text.primary', mb: 1, textAlign: 'center' }}>
            Connect to Your Camera
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4, textAlign: 'center' }}>
            Enter your camera's IP address and credentials to begin the magical experience
          </Typography>
          
          <Paper sx={{ p: 4, background: 'rgba(255, 255, 255, 0.05)' }}>
            <TextField
              fullWidth
              variant="outlined"
              label="Camera IP Address"
              placeholder="192.168.1.100"
              value={manualIp}
              onChange={(e) => {
                console.log('IP input changed:', e.target.value);
                setManualIp(e.target.value);
              }}
              autoFocus
              sx={{ mb: 3 }}
              helperText="Enter the IP address of your Axis camera"
            />
            
            <TextField
              fullWidth
              label="Username"
              value={manualUsername}
              onChange={(e) => setManualUsername(e.target.value)}
              sx={{ mb: 3 }}
              helperText="Default: anava"
            />
            
            <TextField
              fullWidth
              type="password"
              label="Password"
              value={manualPassword}
              onChange={(e) => setManualPassword(e.target.value)}
              sx={{ mb: 4 }}
              helperText="Default: baton"
            />
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                fullWidth
                onClick={handleManualConnect}
                disabled={!manualIp.trim() || isScanning}
                sx={{ height: 48 }}
              >
                Connect to Camera
              </Button>
              
              <Button
                variant="outlined"
                fullWidth
                onClick={handleScanNetwork}
                disabled={isScanning}
                sx={{ height: 48 }}
              >
                Scan Network
              </Button>
            </Box>
            
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Button
                variant="text"
                size="small"
                onClick={onCancel}
                sx={{ color: 'text.secondary' }}
              >
                Use Traditional Setup
              </Button>
            </Box>
          </Paper>
        </Box>
      );
    }

    switch (progress.stage) {
      case 'discovering':
        return (
          <Box sx={{ 
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            p: 3
          }}>
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
          <Box sx={{ 
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            p: 3
          }}>
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
          <Box sx={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex', 
            flexDirection: 'column', 
            overflow: 'hidden'
          }}>
            {/* API Key Success Indicator - Floating overlay */}
            <Box sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              background: 'rgba(16, 185, 129, 0.1)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 2,
              px: 2,
              py: 1,
              zIndex: 10,
            }}>
              <CheckCircleIcon sx={{
                color: '#10B981',
                fontSize: 20,
                filter: 'drop-shadow(0 0 4px rgba(16, 185, 129, 0.6))',
              }}/>
              <Typography variant="body2" sx={{
                color: '#10B981',
                fontWeight: 600,
              }}>
                API Key Active
              </Typography>
            </Box>

            {/* Main content area - with bottom padding for action bar */}
            <Box sx={{ 
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 52, // Space for action bar
              p: 2, 
              display: 'flex', 
              gap: 2,
              overflow: 'hidden'
            }}>
                {/* Camera feed panel */}
                <Paper elevation={4} sx={{
                  flex: '0 0 60%',
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 2,
                  background: '#000',
                  border: '1px solid rgba(0, 102, 255, 0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  <Box sx={{ 
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#000',
                  }}>
                    {firstImage ? (
                      <img
                        src={firstImage}
                        alt="Camera view"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                        }}
                      />
                    ) : (
                      <CameraAltIcon
                        sx={{
                          fontSize: 80,
                          color: 'rgba(255, 255, 255, 0.1)',
                        }}
                      />
                    )}
                
                {camera && (
                  <Box sx={{
                    position: 'absolute',
                    bottom: 16,
                    left: 16,
                    right: 16,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}>
                    <Chip 
                      label={camera.model} 
                      sx={{
                        background: 'rgba(0, 0, 0, 0.6)',
                        backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: 'rgba(255, 255, 255, 0.9)',
                        fontWeight: 500,
                      }}
                    />
                    <Chip 
                      label={`📍 ${camera.ip}`} 
                      sx={{
                        background: 'rgba(0, 0, 0, 0.6)',
                        backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: 'rgba(255, 255, 255, 0.9)',
                        fontWeight: 500,
                      }}
                    />
                  </Box>
                )}
              </Box>
            </Paper>

                {/* AI Analysis Panel */}
                <Paper sx={{
                  flex: 1,
                  background: 'rgba(0, 102, 255, 0.03)',
                  border: '1px solid rgba(0, 102, 255, 0.2)',
                  borderRadius: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  p: 2,
                }}>
                  <Typography variant="h6" sx={{
                    fontWeight: 600,
                    color: 'rgba(255, 255, 255, 0.95)',
                    mb: 1.5,
                    fontSize: '1.1rem',
                  }}>
                    AI Scene Analysis
                  </Typography>
                  
                  <Box sx={{
                    flex: 1,
                    overflowY: 'auto',
                    pr: 1,
                    '&::-webkit-scrollbar': {
                      width: 6,
                    },
                    '&::-webkit-scrollbar-track': {
                      background: 'rgba(0, 102, 255, 0.05)',
                      borderRadius: 3,
                    },
                    '&::-webkit-scrollbar-thumb': {
                      background: 'rgba(0, 102, 255, 0.2)',
                      borderRadius: 3,
                      '&:hover': {
                        background: 'rgba(0, 102, 255, 0.3)',
                      }
                    }
                  }}>
                    {firstInsight ? (
                      formatAIResponse(aiResponse || firstInsight)
                    ) : (
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                        Waiting for AI analysis...
                      </Typography>
                    )}
                  </Box>
                </Paper>
              </Box>

            {/* Action Bar - FIXED AT BOTTOM, NO SCROLLING */}
            <Box sx={{ 
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              height: 52, 
              display: 'flex',
              alignItems: 'center',
              px: 2,
              borderTop: '1px solid rgba(0, 102, 255, 0.2)',
              background: 'rgba(10, 14, 39, 0.98)',
              zIndex: 10,
            }}>
              <Box sx={{ 
                display: 'flex', 
                gap: 2, 
                width: '100%',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                {/* Primary Actions Group */}
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  {/* View Analytics Dashboard Button */}
                  {camera && (
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => window.open(`http://${camera.ip}/local/BatonAnalytic/events.html`, '_blank')}
                      sx={{
                        height: 40,
                        px: 3,
                        background: 'linear-gradient(135deg, #1976D2 0%, #2196F3 100%)',
                        borderRadius: 3,
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        textTransform: 'none',
                        boxShadow: '0 2px 8px rgba(25, 118, 210, 0.3)',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #1565C0 0%, #1E88E5 100%)',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 4px 16px rgba(25, 118, 210, 0.4)',
                        },
                      }}
                      startIcon={<DashboardIcon />}
                    >
                      View Analytics Dashboard
                    </Button>
                  )}

                  {/* Build Infrastructure Button */}
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => {
                      // Get the API key from window storage
                      const apiKey = (window as any).__magicalApiKey;
                      const event = new CustomEvent('navigate-to-infrastructure', {
                        detail: {
                          fromMagicalMode: true,
                          apiKey: apiKey || '',
                          cameraIp: camera?.ip,
                          camera: camera
                        }
                      });
                      window.dispatchEvent(event);
                    }}
                    sx={{
                      height: 40,
                      px: 3,
                      background: 'linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)',
                      borderRadius: 3,
                      fontSize: '0.9rem',
                      fontWeight: 500,
                      textTransform: 'none',
                      boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #7C3AED 0%, #9333EA 100%)',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 16px rgba(139, 92, 246, 0.4)',
                      }
                    }}
                    startIcon={<RocketLaunchIcon />}
                  >
                    Build Full Infrastructure
                  </Button>
                </Box>

                {/* Chat Input Section */}
                <Box sx={{ 
                  display: 'flex', 
                  gap: 1.5,
                  flex: 1,
                  maxWidth: 600,
                }}>
                  <TextField
                    fullWidth
                    placeholder="Ask questions about this scene..."
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleUserQuery()}
                    disabled={isAnalyzing}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        height: 40,
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: 3,
                        fontSize: '1rem',
                        '& fieldset': {
                          borderColor: 'rgba(0, 102, 255, 0.2)',
                        },
                        '&:hover fieldset': {
                          borderColor: 'rgba(0, 102, 255, 0.3)',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: 'rgba(0, 212, 255, 0.5)',
                        }
                      }
                    }}
                  />
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleUserQuery}
                    disabled={!userQuery.trim() || isAnalyzing}
                    sx={{
                      height: 40,
                      minWidth: 80,
                      background: 'linear-gradient(135deg, #00D4FF 0%, #0066FF 100%)',
                      borderRadius: 3,
                      fontSize: '1rem',
                      boxShadow: '0 2px 8px rgba(0, 102, 255, 0.3)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #00B8E6 0%, #0052CC 100%)',
                        boxShadow: '0 4px 16px rgba(0, 102, 255, 0.4)',
                      },
                      '&:disabled': {
                        background: 'rgba(0, 102, 255, 0.2)',
                      }
                    }}
                  >
                    {isAnalyzing ? <CircularProgress size={24} color="inherit" /> : 'Ask'}
                  </Button>
                </Box>
              </Box>
            </Box>
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
    <ThemeProvider theme={magicalDarkTheme}>
      <Box sx={{ 
        height: '100vh',
        width: '100vw', 
        background: 'linear-gradient(180deg, #0A0E27 0%, #1a1f3a 100%)',
        color: 'white',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Only show progress bar for non-complete stages */}
        {progress.stage !== 'complete' && progress.stage !== 'analyzing' && (
          <Box sx={{ p: 3 }}>
            <LinearProgress
              variant="determinate"
              value={progress.progress}
              sx={{
                height: 8,
                borderRadius: 4,
                backgroundColor: 'rgba(0, 102, 255, 0.1)',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                  background: 'linear-gradient(90deg, #0066FF 0%, #00D4FF 100%)',
                },
              }}
            />
          </Box>
        )}

        {/* Stage content */}
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Fade in key={progress.stage} timeout={500}>
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{renderStage()}</Box>
          </Fade>
        </Box>

        {/* Error alert - floating */}
        <Collapse in={showError} sx={{ position: 'absolute', bottom: 16, left: 16, right: 16, zIndex: 20 }}>
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
            sx={{ 
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              borderRadius: 2
            }}
          >
            {errorMessage}
          </Alert>
        </Collapse>
      </Box>
    </ThemeProvider>
  );
};