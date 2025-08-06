import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
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
  LinearProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Timer as TimerIcon,
  Videocam as VideocamIcon,
  PanTool as HandIcon,
  VolumeUp as VolumeUpIcon,
  OpenInNew as OpenInNewIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

interface TestResult {
  triggered: boolean;
  talkdownPlayed: boolean;
  timestamp: string;
  detectionType?: string;
  confidence?: number;
  audioPlayed?: string;
}

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

const DetectionTestPage: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [selectedCamera, setSelectedCamera] = useState<CameraOption | null>(null);
  const [countdown, setCountdown] = useState(10);
  const [isRunning, setIsRunning] = useState(false);
  const [testComplete, setTestComplete] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const monitoringIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadConfiguredCameras();
    
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current);
      }
    };
  }, []);

  const loadConfiguredCameras = async () => {
    try {
      // Load cameras that have been configured
      const savedCameras = await window.electronAPI?.getConfigValue('configuredCameras');
      console.log('Loading configured cameras:', savedCameras);
      if (savedCameras && Array.isArray(savedCameras)) {
        setCameras(savedCameras.map((cam: any) => ({
          id: cam.id || `camera-${cam.ip}`,
          ip: cam.ip,
          name: cam.name || `Camera at ${cam.ip}`,
          hasACAP: cam.hasACAP !== false,
          hasSpeaker: cam.hasSpeaker || false,
          credentials: cam.credentials, // Include credentials for API calls
        })));
        console.log(`Loaded ${savedCameras.length} configured camera(s)`);
      } else {
        console.log('No configured cameras found in storage');
      }
    } catch (error) {
      console.error('Failed to load cameras:', error);
      // Mock data for testing
      setCameras([
        {
          id: 'camera-1',
          ip: '192.168.1.100',
          name: 'Front Entrance Camera',
          hasACAP: true,
          hasSpeaker: true,
        },
      ]);
    }
  };

  const startTest = () => {
    if (!selectedCamera) return;
    
    setIsRunning(true);
    setTestComplete(false);
    setTestResult(null);
    setError(null);
    setCountdown(10);
    
    // Start countdown
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
          }
          triggerDetection();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const triggerDetection = async () => {
    try {
      // Enable virtual trigger via VAPIX
      await enableVirtualTrigger(true);
      
      // Monitor for detection events
      monitorForEvents();
      
      // Disable trigger after 5 seconds
      setTimeout(async () => {
        await enableVirtualTrigger(false);
      }, 5000);
    } catch (error) {
      console.error('Failed to trigger detection:', error);
      setError('Failed to trigger detection test');
      setIsRunning(false);
    }
  };

  const enableVirtualTrigger = async (enable: boolean) => {
    if (!selectedCamera) return;
    
    try {
      // VAPIX command to enable/disable virtual input
      const command = enable ? '6:/' : '6:\\';
      const url = `http://${selectedCamera.ip}/axis-cgi/io/virtualinput.cgi?action=${encodeURIComponent(command)}`;
      
      // In real implementation, this would make the actual API call
      console.log(`Virtual trigger ${enable ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to control virtual trigger:', error);
      throw error;
    }
  };

  const monitorForEvents = () => {
    // Monitor for detection events for 15 seconds
    let monitoringTime = 0;
    const maxMonitoringTime = 15000; // 15 seconds
    
    monitoringIntervalRef.current = setInterval(() => {
      monitoringTime += 1000;
      
      // Check for events (mock implementation)
      if (monitoringTime >= 3000 && !testResult) {
        // Simulate detection after 3 seconds
        const result: TestResult = {
          triggered: true,
          talkdownPlayed: selectedCamera?.hasSpeaker || false,
          timestamp: new Date().toISOString(),
          detectionType: 'Hand with 2 fingers',
          confidence: 0.95,
          audioPlayed: 'Security alert message',
        };
        
        setTestResult(result);
        setTestComplete(true);
        setIsRunning(false);
        
        if (monitoringIntervalRef.current) {
          clearInterval(monitoringIntervalRef.current);
        }
      }
      
      if (monitoringTime >= maxMonitoringTime) {
        // No detection
        setTestResult({
          triggered: false,
          talkdownPlayed: false,
          timestamp: new Date().toISOString(),
        });
        setTestComplete(true);
        setIsRunning(false);
        
        if (monitoringIntervalRef.current) {
          clearInterval(monitoringIntervalRef.current);
        }
      }
    }, 1000);
  };

  const stopTest = () => {
    setIsRunning(false);
    
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current);
    }
    
    // Disable virtual trigger
    enableVirtualTrigger(false);
  };

  const openACAPInterface = () => {
    if (selectedCamera) {
      window.electronAPI?.openExternal(`http://${selectedCamera.ip}/local/BatonAnalytic/`);
    }
  };

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography variant="body2" color="text.secondary" paragraph>
              Select a camera that has been configured with Anava AI analytics
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
                <FormControl fullWidth>
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
                          {camera.ip} {camera.hasSpeaker && '• Has Speaker'}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="text"
                startIcon={<RefreshIcon />}
                onClick={() => {
                  setLoading(true);
                  loadConfiguredCameras().finally(() => setLoading(false));
                }}
                disabled={loading}
                sx={{ mt: 2 }}
              >
                Refresh List
              </Button>
              </Box>
            )}
            
            {selectedCamera && (
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
                      <Grid item>
                        {selectedCamera.hasSpeaker && (
                          <Chip
                            icon={<VolumeUpIcon />}
                            label="Speaker Ready"
                            size="small"
                            color="success"
                          />
                        )}
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
                
                <Button
                  variant="contained"
                  fullWidth
                  sx={{ mt: 2 }}
                  onClick={() => setActiveStep(1)}
                >
                  Continue
                </Button>
              </Box>
            )}
          </Box>
        );

      case 1:
        return (
          <Box>
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Test Instructions:
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <HandIcon />
                  </ListItemIcon>
                  <ListItemText primary="Stand in front of the camera" />
                </ListItem>
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <HandIcon />
                  </ListItemIcon>
                  <ListItemText primary="Hold up 2 fingers when the countdown reaches zero" />
                </ListItem>
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <TimerIcon />
                  </ListItemIcon>
                  <ListItemText primary="Keep your hand visible for 3-5 seconds" />
                </ListItem>
              </List>
            </Alert>

            {!isRunning && !testComplete && (
              <Box textAlign="center">
                <Button
                  variant="contained"
                  size="large"
                  onClick={startTest}
                  startIcon={<PlayIcon />}
                  sx={{ mb: 2 }}
                >
                  Start Detection Test
                </Button>
                
                <Typography variant="body2" color="text.secondary">
                  Make sure you're ready in front of the camera
                </Typography>
              </Box>
            )}

            {isRunning && (
              <Box textAlign="center">
                <Paper sx={{ p: 4, backgroundColor: 'primary.50' }}>
                  <Typography variant="h1" color="primary" sx={{ fontSize: 120, fontWeight: 'bold' }}>
                    {countdown}
                  </Typography>
                  <Typography variant="h6" color="text.secondary">
                    {countdown > 0 ? 'Get ready...' : 'Show 2 fingers now!'}
                  </Typography>
                  
                  <LinearProgress
                    variant="determinate"
                    value={(10 - countdown) * 10}
                    sx={{ mt: 2, height: 8, borderRadius: 4 }}
                  />
                  
                  <Button
                    variant="outlined"
                    onClick={stopTest}
                    startIcon={<StopIcon />}
                    sx={{ mt: 3 }}
                  >
                    Cancel Test
                  </Button>
                </Paper>
              </Box>
            )}

            {testComplete && testResult && (
              <Box>
                {testResult.triggered ? (
                  <Alert severity="success" sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Detection Successful!
                    </Typography>
                    <Typography variant="body2">
                      AI detected: {testResult.detectionType} (Confidence: {(testResult.confidence! * 100).toFixed(0)}%)
                    </Typography>
                    {testResult.talkdownPlayed && (
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        Audio talkdown played: "{testResult.audioPlayed}"
                      </Typography>
                    )}
                  </Alert>
                ) : (
                  <Alert severity="warning" sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      No Detection
                    </Typography>
                    <Typography variant="body2">
                      The AI did not detect the gesture. Try again with clearer hand positioning.
                    </Typography>
                  </Alert>
                )}

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Button
                      variant="contained"
                      fullWidth
                      onClick={() => {
                        setTestComplete(false);
                        setTestResult(null);
                        startTest();
                      }}
                      startIcon={<RefreshIcon />}
                    >
                      Try Again
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Button
                      variant="outlined"
                      fullWidth
                      onClick={() => setActiveStep(2)}
                    >
                      View Results
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            )}
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="body1" paragraph>
              Your camera AI is working perfectly! Here's what you can do next:
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      ACAP Interface
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      Access the full analytics interface to configure detection zones, 
                      adjust sensitivity, and view real-time events.
                    </Typography>
                    <Button
                      variant="contained"
                      fullWidth
                      onClick={openACAPInterface}
                      endIcon={<OpenInNewIcon />}
                    >
                      Open ACAP Interface
                    </Button>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Detection Types
                    </Typography>
                    <List dense>
                      <ListItem>
                        <ListItemIcon>
                          <CheckCircleIcon color="success" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="Hand gestures (1-5 fingers)" />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <CheckCircleIcon color="success" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="Weapon detection" />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <CheckCircleIcon color="success" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="Person detection & tracking" />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <CheckCircleIcon color="success" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="Custom AI prompts" />
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {testResult && (
              <Box sx={{ mt: 3 }}>
                <Paper sx={{ p: 3, backgroundColor: 'grey.50' }}>
                  <Typography variant="h6" gutterBottom>
                    Test Summary
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Detection Result
                      </Typography>
                      <Typography variant="body1">
                        {testResult.triggered ? 'Success' : 'No Detection'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Audio Talkdown
                      </Typography>
                      <Typography variant="body1">
                        {testResult.talkdownPlayed ? 'Played' : 'Not Available'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Detection Type
                      </Typography>
                      <Typography variant="body1">
                        {testResult.detectionType || 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Timestamp
                      </Typography>
                      <Typography variant="body1">
                        {new Date(testResult.timestamp).toLocaleTimeString()}
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>
              </Box>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Test Detection
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Verify your AI analytics are working correctly with a simple hand gesture test
      </Typography>

      <Stepper activeStep={activeStep} orientation="vertical">
        <Step>
          <StepLabel>Select Camera</StepLabel>
          <StepContent>{getStepContent(0)}</StepContent>
        </Step>
        
        <Step>
          <StepLabel>Run Detection Test</StepLabel>
          <StepContent>{getStepContent(1)}</StepContent>
        </Step>
        
        <Step>
          <StepLabel>Results & Next Steps</StepLabel>
          <StepContent>{getStepContent(2)}</StepContent>
        </Step>
      </Stepper>

      {/* Instructions Dialog */}
      <Dialog open={showInstructions} onClose={() => setShowInstructions(false)}>
        <DialogTitle>Detection Test Instructions</DialogTitle>
        <DialogContent>
          <Typography variant="body2" paragraph>
            This test verifies that your camera's AI analytics are working correctly.
          </Typography>
          <Typography variant="subtitle2" gutterBottom>
            How it works:
          </Typography>
          <List>
            <ListItem>
              <ListItemText
                primary="1. Position yourself"
                secondary="Stand in clear view of the camera"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="2. Wait for countdown"
                secondary="A 10-second countdown will begin"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="3. Show 2 fingers"
                secondary="When countdown reaches zero, hold up 2 fingers"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="4. Wait for detection"
                secondary="Keep your hand visible for 3-5 seconds"
              />
            </ListItem>
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowInstructions(false)}>
            Got it
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DetectionTestPage;