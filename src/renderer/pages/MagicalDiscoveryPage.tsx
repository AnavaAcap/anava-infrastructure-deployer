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

// Function to format AI response text
const formatAIResponse = (text: string) => {
  // Split into paragraphs
  const paragraphs = text.split('\n\n').filter(p => p.trim());
  
  return paragraphs.map((para, idx) => {
    // Check for bullet points
    if (para.includes('•') || para.includes('-')) {
      const items = para.split(/[•-]/).filter(Boolean);
      return (
        <Box component="ul" key={idx} sx={{ pl: 2, my: 2, listStyleType: 'disc' }}>
          {items.map((item, i) => (
            <li key={i} style={{ marginBottom: 8, color: 'rgba(255, 255, 255, 0.9)' }}>
              {item.trim()}
            </li>
          ))}
        </Box>
      );
    }
    
    // Check for single line breaks
    if (para.includes('\n')) {
      return (
        <Box key={idx} sx={{ mb: 2 }}>
          {para.split('\n').map((line, i) => (
            <Typography key={i} sx={{ color: 'rgba(255, 255, 255, 0.9)', mb: 0.5 }}>
              {line.trim()}
            </Typography>
          ))}
        </Box>
      );
    }
    
    // Regular paragraph
    return (
      <Typography key={idx} paragraph sx={{ mb: 2, color: 'rgba(255, 255, 255, 0.9)' }}>
        {para}
      </Typography>
    );
  });
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
          const connectResult = await window.electronAPI.magical.connectToCamera({
            apiKey,
            ip: firstCamera.ip,
            username: firstCamera.credentials?.username || 'root',
            password: firstCamera.credentials?.password || 'pass'
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
      if (!apiKey) {
        throw new Error('No API key available');
      }
      
      const result = await window.electronAPI.magical.startExperience(apiKey);
      
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
      if (!apiKey) {
        throw new Error('No API key available');
      }
      
      const result = await window.electronAPI.magical.connectToCamera({
        apiKey,
        ip: manualIp,
        username: manualUsername,
        password: manualPassword
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
        <Box sx={{ maxWidth: 600, mx: 'auto' }}>
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
          <Container maxWidth={false} sx={{ px: { xs: 2, sm: 3, md: 4 }, height: '100%' }}>
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

            {/* Main content - horizontal layout */}
            <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)', gap: 2, mt: 1 }}>
              {/* Top section - Camera feed and analysis side by side */}
              <Box sx={{ display: 'flex', gap: 2, flex: 1, minHeight: 0 }}>
                {/* Camera feed container */}
                <Paper elevation={8} sx={{
                  position: 'relative',
                  flex: '0 0 60%',
                  overflow: 'hidden',
                  borderRadius: 3,
                  background: '#0A0E27',
                  border: '1px solid rgba(0, 102, 255, 0.2)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    borderColor: 'rgba(0, 102, 255, 0.4)',
                    boxShadow: '0 12px 40px rgba(0, 102, 255, 0.3)',
                  }
                }}>
              <Box sx={{ 
                position: 'relative',
                paddingTop: { xs: '56.25%', md: '50%', lg: '45%' }, // Wider aspect ratio on larger screens
              }}>
                {firstImage ? (
                  <img
                    src={firstImage}
                    alt="Camera view"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
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

                {/* Scene Description Container - beside camera */}
                {firstInsight && (
                  <Fade in timeout={1000}>
                    <Card sx={{
                      flex: 1,
                      background: 'rgba(0, 102, 255, 0.05)',
                      border: '1px solid rgba(0, 102, 255, 0.2)',
                      borderRadius: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      minHeight: 0,
                      overflow: 'hidden',
                    }}>
                  <CardHeader
                    title="AI Scene Analysis"
                    sx={{
                      borderBottom: '1px solid rgba(0, 102, 255, 0.1)',
                      py: 1.5,
                      '& .MuiCardHeader-title': {
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: 'rgba(255, 255, 255, 0.9)',
                      }
                    }}
                  />
                  <CardContent sx={{
                    flex: 1,
                    overflowY: 'auto',
                    p: 2,
                    '&::-webkit-scrollbar': {
                      width: 8,
                    },
                    '&::-webkit-scrollbar-track': {
                      background: 'rgba(0, 102, 255, 0.1)',
                      borderRadius: 4,
                    },
                    '&::-webkit-scrollbar-thumb': {
                      background: 'rgba(0, 102, 255, 0.3)',
                      borderRadius: 4,
                      '&:hover': {
                        background: 'rgba(0, 102, 255, 0.5)',
                      }
                    }
                  }}>
                    <Box sx={{ 
                      fontFamily: 'Inter, system-ui, sans-serif',
                      fontSize: { xs: '0.875rem', md: '1rem' },
                      lineHeight: 1.8,
                    }}>
                      {formatAIResponse(aiResponse || firstInsight)}
                    </Box>
                  </CardContent>
                    </Card>
                  </Fade>
                )}
              </Box>

              {/* Bottom section - Actions in a row */}
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {/* Camera Analytics Button */}
                {camera && (
                  <Button
                    size="medium"
                    onClick={() => window.open(`http://${camera.ip}/local/BatonAnalytic/events.html`, '_blank')}
                    sx={{
                      px: 3,
                      py: 1.5,
                  background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: 2,
                  color: 'white',
                  fontSize: '1.1rem',
                  fontWeight: 500,
                  textTransform: 'none',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 24px rgba(59, 130, 246, 0.4)',
                  },
                  '&:active': {
                    transform: 'translateY(0)',
                  }
                }}
                startIcon={<DashboardIcon sx={{ fontSize: 20 }}/>}
              >
                View Analytics Dashboard
              </Button>
                )}

                {/* Query Input Section - Compact */}
                <Box sx={{ 
                  flex: 1, 
                  display: 'flex', 
                  gap: 1,
                  minWidth: 300,
                }}>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="Ask about the scene..."
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleUserQuery()}
                    disabled={isAnalyzing}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: 1,
                        '&.Mui-focused': {
                          '& fieldset': {
                            borderColor: 'rgba(0, 212, 255, 0.5)',
                          }
                        }
                      }
                    }}
                  />
                  <Button
                    variant="contained"
                    size="medium"
                    onClick={handleUserQuery}
                    disabled={!userQuery.trim() || isAnalyzing}
                    sx={{
                      minWidth: 80,
                      background: 'linear-gradient(135deg, #00D4FF 0%, #0066FF 100%)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #00D4FF 20%, #0066FF 80%)',
                      }
                    }}
                  >
                    {isAnalyzing ? <CircularProgress size={20}/> : 'Ask'}
                  </Button>
                </Box>


                {/* Build Infrastructure Button - Compact */}
                <Button
                  size="medium"
                  variant="contained"
                  onClick={() => {
                    // Transition to main infrastructure installer
                    const event = new CustomEvent('navigate-to-infrastructure', {
                      detail: {
                        fromMagicalMode: true,
                        apiKey: camera?.apiKey || '',
                        cameraIp: camera?.ip
                      }
                    });
                    window.dispatchEvent(event);
                  }}
                  sx={{
                    px: 3,
                    py: 1.5,
                    background: 'linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)',
                    fontWeight: 600,
                    textTransform: 'none',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #9333EA 0%, #C084FC 100%)',
                      transform: 'scale(1.02)',
                    }
                  }}
                  startIcon={<RocketLaunchIcon />}
                >
                  Build Full Infrastructure
                </Button>
              </Box>
            </Box>
          </Container>
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
        minHeight: '100vh', 
        background: 'linear-gradient(180deg, #0A0E27 0%, #1a1f3a 100%)',
        color: 'white'
      }}>
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
    </Box>
    </ThemeProvider>
  );
};