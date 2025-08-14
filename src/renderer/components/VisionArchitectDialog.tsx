/**
 * Vision Architect Dialog - Revolutionary AI-driven camera configuration
 * 
 * Simple form that lets users describe what they want and AI does everything
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  List,
  ListItem,
  ListItemText,
  Paper,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
} from '@mui/material';
import {
  SmartToy as AIIcon,
  CheckCircle as SuccessIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  CameraAlt as CameraIcon,
  Security as SecurityIcon,
  Analytics as AnalyticsIcon,
  Architecture as ArchitectureIcon,
  Image as ImageIcon,
  Psychology as BrainIcon,
  Visibility as VisionIcon,
  Build as BuildIcon,
  CloudUpload as DeployIcon,
  AutoAwesome as SparkleIcon,
  Memory as ProcessIcon,
} from '@mui/icons-material';

interface Props {
  open: boolean;
  cameraIp: string;
  username: string;
  password: string;
  geminiApiKey: string;
  onComplete: () => void;
  onSkip?: () => void;
}

interface GeneratedSystem {
  systemOverview: string;
  axisScenarios: any[];
  skills: any[];
  securityProfiles: any[];
  systemJustification: string;
}

export const VisionArchitectDialog: React.FC<Props> = ({
  open,
  cameraIp,
  username,
  password,
  geminiApiKey,
  onComplete,
  onSkip
}) => {
  const [userGoal, setUserGoal] = useState('');
  const [imageDescription, setImageDescription] = useState('');
  const [processing, setProcessing] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedSystem, setGeneratedSystem] = useState<GeneratedSystem | null>(null);
  const [deploymentResult, setDeploymentResult] = useState<any>(null);
  const [selectedModel, setSelectedModel] = useState('');
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [sceneImage, setSceneImage] = useState<string>('');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  
  // Loading states for sophisticated UI
  const [loadingPhase, setLoadingPhase] = useState<'idle' | 'capturing' | 'analyzing' | 'deploying'>('idle');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [currentLoadingStep, setCurrentLoadingStep] = useState('');
  const [loadingStartTime, setLoadingStartTime] = useState<number>(0);

  // Load available models when dialog opens
  useEffect(() => {
    if (open && geminiApiKey) {
      loadModels();
    }
  }, [open, geminiApiKey]);

  const loadModels = async () => {
    setLoadingModels(true);
    try {
      const result = await (window as any).electronAPI.invokeIPC(
        'vision-architect-list-models',
        geminiApiKey
      );
      if (result.success && result.models && result.models.length > 0) {
        setAvailableModels(result.models);
        // Select the first model (which should be the best for free tier due to sorting)
        const firstModel = result.models[0];
        if (firstModel) {
          setSelectedModel(firstModel.name);
        }
      } else if (result.success && (!result.models || result.models.length === 0)) {
        setError('No models available. Please check your API key.');
        setAvailableModels([]);
      }
    } catch (error: any) {
      console.error('Failed to load models:', error);
      // Don't set a default list - show error to user
      setAvailableModels([]);
      setError('Failed to load available models. Please check your API key.');
    } finally {
      setLoadingModels(false);
    }
  };

  const captureSceneImage = async () => {
    try {
      console.log('Capturing scene image from camera...');
      
      // Build camera object with proper credentials structure
      const camera = {
        ip: cameraIp,
        credentials: {
          username: username,
          password: password
        }
      };
      
      // Get scene description and image
      const result = await (window as any).electronAPI.getSceneDescription?.(
        camera,
        geminiApiKey,
        false, // No speaker
        null // No custom prompt
      );
      
      if (result.success) {
        console.log('Scene captured successfully');
        setSceneImage(result.imageBase64 || '');
        // Also set the description if provided
        if (result.description) {
          setImageDescription(result.description);
        }
        return result.imageBase64;
      } else {
        console.error('Failed to capture scene:', result.error);
        throw new Error('Failed to capture scene from camera: ' + (result.error || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Error capturing scene:', error);
      throw new Error('Error capturing scene: ' + error.message);
    }
  };

  const handleGenerate = async () => {
    if (!userGoal.trim()) {
      setError('Please describe what you want to achieve');
      return;
    }

    setProcessing(true);
    setError(null);
    setGeneratedSystem(null);
    setLoadingPhase('analyzing');
    setLoadingProgress(0);
    setLoadingStartTime(Date.now());

    // AI Analysis progress simulation with realistic steps
    const analysisSteps = [
      { step: 'Capturing scene image from camera...', progress: 5, duration: 800 },
      { step: 'Initializing AI Vision Architect...', progress: 10, duration: 500 },
      { step: 'Processing scene image...', progress: 20, duration: 800 },
      { step: 'Understanding your requirements...', progress: 30, duration: 1000 },
      { step: 'Analyzing camera environment...', progress: 45, duration: 1200 },
      { step: 'Designing detection scenarios...', progress: 60, duration: 1500 },
      { step: 'Creating AI analysis skills...', progress: 75, duration: 1800 },
      { step: 'Architecting security profiles...', progress: 85, duration: 1000 },
      { step: 'Optimizing system configuration...', progress: 95, duration: 800 },
      { step: 'Finalizing intelligence ecosystem...', progress: 100, duration: 500 },
    ];

    try {
      // First, ensure we have a scene image
      let imageToUse = sceneImage;
      if (!imageToUse) {
        setCurrentLoadingStep('Capturing scene from camera...');
        console.log('No scene image available, capturing from camera...');
        try {
          imageToUse = await captureSceneImage();
        } catch (captureError: any) {
          setProcessing(false);
          setLoadingPhase('idle');
          setError(captureError.message || 'Failed to capture scene from camera');
          return;
        }
      }

      console.log('Generating vision system with scene image...');
      
      // Start the progress simulation
      let stepIndex = 0;
      const progressInterval = setInterval(() => {
        if (stepIndex < analysisSteps.length) {
          const currentStep = analysisSteps[stepIndex];
          setCurrentLoadingStep(currentStep.step);
          setLoadingProgress(currentStep.progress);
          stepIndex++;
        }
      }, 1200);

      // Generate the vision system with the image
      const result = await (window as any).electronAPI.invokeIPC(
        'vision-architect-generate',
        geminiApiKey,
        userGoal,
        imageDescription || undefined,
        selectedModel,
        imageToUse // Pass the scene image
      );

      clearInterval(progressInterval);
      
      if (result.success) {
        setCurrentLoadingStep('AI system architecture completed!');
        setLoadingProgress(100);
        
        // Brief success display
        setTimeout(() => {
          setLoadingPhase('idle');
          setLoadingProgress(0);
          setCurrentLoadingStep('');
          setGeneratedSystem(result);
        }, 1500);
      } else {
        setLoadingPhase('idle');
        setError(result.error || 'Failed to generate system');
      }
    } catch (error: any) {
      console.error('Vision generation error:', error);
      setLoadingPhase('idle');
      setError(error.message || 'Failed to generate vision system');
    } finally {
      setTimeout(() => setProcessing(false), 1500);
    }
  };

  const handleDeploy = async () => {
    if (!generatedSystem) return;

    setDeploying(true);
    setError(null);
    setLoadingPhase('deploying');
    setLoadingProgress(0);
    setLoadingStartTime(Date.now());

    const deploymentSteps = [
      { step: 'Connecting to camera system...', progress: 10, duration: 800 },
      { step: 'Uploading detection scenarios...', progress: 30, duration: 1500 },
      { step: 'Installing AI analysis skills...', progress: 55, duration: 2000 },
      { step: 'Configuring security profiles...', progress: 75, duration: 1200 },
      { step: 'Activating monitoring system...', progress: 90, duration: 1000 },
      { step: 'Validating deployment...', progress: 95, duration: 800 },
    ];

    try {
      console.log('Deploying Vision System to camera:', cameraIp);
      console.log('System contains:', {
        scenarios: generatedSystem.axisScenarios?.length || 0,
        skills: generatedSystem.skills?.length || 0,
        profiles: generatedSystem.securityProfiles?.length || 0
      });
      
      // Start deployment progress simulation
      let stepIndex = 0;
      const deployProgressInterval = setInterval(() => {
        if (stepIndex < deploymentSteps.length) {
          const currentStep = deploymentSteps[stepIndex];
          setCurrentLoadingStep(currentStep.step);
          setLoadingProgress(currentStep.progress);
          stepIndex++;
        }
      }, 1000);
      
      // Deploy the generated system to camera (real deployment only)
      const result = await (window as any).electronAPI.invokeIPC(
        'vision-architect-deploy',
        cameraIp,
        username,
        password,
        generatedSystem
      );

      clearInterval(deployProgressInterval);
      console.log('Deployment result:', result);
      setDeploymentResult(result);
      
      if (result.success) {
        console.log('✅ Vision System successfully deployed!');
        setCurrentLoadingStep('Vision system successfully deployed!');
        setLoadingProgress(100);
        
        // Success display before completion
        setTimeout(() => {
          setLoadingPhase('idle');
          setLoadingProgress(0);
          setCurrentLoadingStep('');
          onComplete();
        }, 3000);
      } else {
        console.error('❌ Deployment failed:', result.errors);
        setLoadingPhase('idle');
        const errorMessage = result.errors?.join('\n') || result.message || 'Deployment failed';
        setError(errorMessage);
      }
    } catch (error: any) {
      console.error('Deployment error:', error);
      setLoadingPhase('idle');
      setError(error.message || 'Failed to deploy system');
    } finally {
      setDeploying(false);
    }
  };

  const exampleGoals = [
    "Tell me about any suspicious activity that happens",
    "Monitor for safety violations and PPE compliance",
    "Track customer flow and queue lengths during business hours",
    "Alert me when delivery trucks arrive and how long they stay",
    "Detect weapons or threatening behavior immediately",
    "Optimize my retail operations with customer analytics",
    "Monitor equipment status and worker productivity",
    "Ensure no unauthorized access after hours"
  ];

  // Get the appropriate icon and color for current loading phase
  const getPhaseIcon = () => {
    switch (loadingPhase) {
      case 'capturing': return <CameraIcon sx={{ fontSize: '3rem' }} />;
      case 'analyzing': return <BrainIcon sx={{ fontSize: '3rem' }} />;
      case 'deploying': return <DeployIcon sx={{ fontSize: '3rem' }} />;
      default: return <AIIcon sx={{ fontSize: '3rem' }} />;
    }
  };

  const getPhaseColor = () => {
    switch (loadingPhase) {
      case 'capturing': return '#2196f3'; // Blue
      case 'analyzing': return '#9c27b0'; // Purple
      case 'deploying': return '#4caf50'; // Green
      default: return '#ff9800'; // Orange
    }
  };

  const getPhaseTitle = () => {
    switch (loadingPhase) {
      case 'capturing': return 'Capturing Scene';
      case 'analyzing': return 'AI Vision Architect Working';
      case 'deploying': return 'Deploying to Camera';
      default: return 'Processing';
    }
  };

  // Sophisticated Loading Overlay Component
  const renderLoadingOverlay = () => {
    if (loadingPhase === 'idle') return null;

    const elapsedTime = loadingStartTime > 0 ? Math.floor((Date.now() - loadingStartTime) / 1000) : 0;
    const phaseColor = getPhaseColor();

    return (
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          backdropFilter: 'blur(12px)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          borderRadius: 2,
        }}
        data-testid="vision-architect-loading-overlay"
      >
        {/* Animated Background Effects */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `linear-gradient(45deg, ${phaseColor}15, transparent, ${phaseColor}15)`,
            animation: 'backgroundPulse 3s ease-in-out infinite',
            borderRadius: 2,
          }}
        />
        
        {/* Floating Particles Animation */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflow: 'hidden',
            borderRadius: 2,
          }}
        >
          {[...Array(12)].map((_, i) => (
            <Box
              key={i}
              sx={{
                position: 'absolute',
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                backgroundColor: phaseColor,
                opacity: 0.6,
                left: `${10 + (i * 7)}%`,
                animation: `floatParticle ${3 + (i % 3)}s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </Box>

        {/* Main Content */}
        <Box
          sx={{
            textAlign: 'center',
            zIndex: 2,
            maxWidth: '80%',
          }}
        >
          {/* Phase Icon with Glow Effect */}
          <Box
            sx={{
              mb: 3,
              position: 'relative',
              display: 'inline-block',
            }}
          >
            <Box
              sx={{
                color: phaseColor,
                filter: `drop-shadow(0 0 20px ${phaseColor}80)`,
                animation: loadingPhase === 'analyzing' ? 'brainPulse 2s ease-in-out infinite' : 
                          loadingPhase === 'capturing' ? 'cameraSpin 3s linear infinite' :
                          'deploymentBounce 1.5s ease-in-out infinite',
              }}
            >
              {getPhaseIcon()}
            </Box>
            
            {/* Sparkle effects for AI analysis */}
            {loadingPhase === 'analyzing' && (
              <>
                <SparkleIcon 
                  sx={{ 
                    position: 'absolute', 
                    top: -10, 
                    right: -5, 
                    fontSize: '1rem',
                    color: '#ffd700',
                    animation: 'sparkle 1.5s ease-in-out infinite',
                    animationDelay: '0s',
                  }} 
                />
                <SparkleIcon 
                  sx={{ 
                    position: 'absolute', 
                    bottom: -5, 
                    left: -10, 
                    fontSize: '0.8rem',
                    color: '#ffd700',
                    animation: 'sparkle 1.5s ease-in-out infinite',
                    animationDelay: '0.7s',
                  }} 
                />
              </>
            )}
          </Box>

          {/* Phase Title */}
          <Typography 
            variant="h5" 
            sx={{ 
              fontWeight: 'bold',
              mb: 1,
              color: phaseColor,
              textShadow: `0 0 10px ${phaseColor}50`,
            }}
          >
            {getPhaseTitle()}
          </Typography>

          {/* Current Step */}
          <Typography 
            variant="h6" 
            sx={{ 
              mb: 3,
              color: 'white',
              fontWeight: 500,
              minHeight: '2rem',
            }}
          >
            {currentLoadingStep}
          </Typography>

          {/* Enhanced Progress Bar */}
          <Box sx={{ width: '100%', maxWidth: 400, mb: 3 }}>
            <Box
              sx={{
                width: '100%',
                height: 8,
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                borderRadius: 4,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <Box
                sx={{
                  width: `${loadingProgress}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, ${phaseColor}, ${phaseColor}cc, ${phaseColor})`,
                  borderRadius: 4,
                  transition: 'width 0.5s ease-in-out',
                  position: 'relative',
                  overflow: 'hidden',
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)`,
                    animation: 'shimmer 2s infinite',
                  }
                }}
              />
            </Box>
            <Box 
              sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                mt: 1 
              }}
            >
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                {Math.round(loadingProgress)}%
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                {elapsedTime}s
              </Typography>
            </Box>
          </Box>

          {/* Phase-specific Intelligence Indicators */}
          {loadingPhase === 'analyzing' && (
            <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ProcessIcon sx={{ fontSize: '1.2rem', color: phaseColor }} />
                <Typography variant="caption">Neural Processing</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <VisionIcon sx={{ fontSize: '1.2rem', color: phaseColor }} />
                <Typography variant="caption">Computer Vision</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BuildIcon sx={{ fontSize: '1.2rem', color: phaseColor }} />
                <Typography variant="caption">System Design</Typography>
              </Box>
            </Stack>
          )}

          {/* Motivational text based on phase */}
          <Typography 
            variant="body2" 
            sx={{ 
              mt: 3, 
              opacity: 0.7,
              fontStyle: 'italic',
              maxWidth: 350,
            }}
          >
            {loadingPhase === 'capturing' && "Capturing high-resolution scene data from your camera..."}
            {loadingPhase === 'analyzing' && "AI is analyzing your scene and architecting a complete intelligent surveillance system..."}
            {loadingPhase === 'deploying' && "Installing your custom AI system directly to the camera hardware..."}
          </Typography>
        </Box>

        {/* Global Styles for Animations */}
        <style>
          {`
            @keyframes backgroundPulse {
              0%, 100% { opacity: 0.3; }
              50% { opacity: 0.6; }
            }
            
            @keyframes floatParticle {
              0%, 100% { transform: translateY(0px) scale(1); opacity: 0.6; }
              50% { transform: translateY(-20px) scale(1.2); opacity: 1; }
            }
            
            @keyframes brainPulse {
              0%, 100% { transform: scale(1); filter: drop-shadow(0 0 20px #9c27b080); }
              50% { transform: scale(1.1); filter: drop-shadow(0 0 30px #9c27b0cc); }
            }
            
            @keyframes cameraSpin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            
            @keyframes deploymentBounce {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-10px); }
            }
            
            @keyframes sparkle {
              0%, 100% { opacity: 0; transform: scale(0.8) rotate(0deg); }
              50% { opacity: 1; transform: scale(1.2) rotate(180deg); }
            }
            
            @keyframes shimmer {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(100%); }
            }
          `}
        </style>
      </Box>
    );
  };

  return (
    <Dialog 
      open={open} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          maxHeight: '90vh',
          position: 'relative', // Required for overlay positioning
        }
      }}
    >
      {/* Sophisticated Loading Overlay */}
      {renderLoadingOverlay()}
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <ArchitectureIcon color="primary" fontSize="large" />
          <Box>
            <Typography variant="h6">
              AI Vision Architect
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Describe what you want to know, and AI will create the complete system
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 2 }}>
          {!generatedSystem ? (
            <>
              {/* User Goal Input */}
              <TextField
                fullWidth
                multiline
                rows={3}
                label="What do you want to achieve?"
                placeholder="E.g., 'Tell me about any suspicious activity' or 'Monitor safety compliance' or 'Track customer patterns'"
                value={userGoal}
                onChange={(e) => setUserGoal(e.target.value)}
                disabled={processing}
                autoFocus
                helperText="Describe your goal in plain language - be as specific or general as you want"
              />

              
              {/* Optional: Environment Description */}
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Describe what the camera sees (optional)"
                placeholder="E.g., 'Store entrance with checkout area' or 'Factory floor with assembly line'"
                value={imageDescription}
                onChange={(e) => setImageDescription(e.target.value)}
                disabled={processing}
                helperText={sceneImage ? "Scene image captured - description is optional" : "Help the AI understand your environment for better configuration"}
              />

              {/* Example Goals */}
              <Box>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Example goals (click to use):
                </Typography>
                <Box display="flex" flexWrap="wrap" gap={1} mt={1}>
                  {exampleGoals.map((goal) => (
                    <Chip
                      key={goal}
                      label={goal}
                      size="small"
                      onClick={() => setUserGoal(goal)}
                      variant="outlined"
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                </Box>
              </Box>

              {/* Advanced Options (Collapsible Model Selection) */}
              <Accordion expanded={showAdvancedOptions} onChange={() => setShowAdvancedOptions(!showAdvancedOptions)}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="body2" color="text.secondary">
                    Advanced Options
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <FormControl fullWidth>
                    <InputLabel id="model-select-label">AI Model</InputLabel>
                    <Select
                      labelId="model-select-label"
                      value={availableModels.length > 0 ? selectedModel : ''}
                      label="AI Model"
                      onChange={(e) => setSelectedModel(e.target.value)}
                      disabled={processing || loadingModels || availableModels.length === 0}
                    >
                      {loadingModels ? (
                        <MenuItem disabled>
                          <Typography variant="body2">Loading models...</Typography>
                        </MenuItem>
                      ) : availableModels.length === 0 ? (
                        <MenuItem disabled>
                          <Typography variant="body2">No models available</Typography>
                        </MenuItem>
                      ) : (
                        availableModels.map((model) => (
                          <MenuItem key={model.name} value={model.name}>
                            <Box>
                              <Typography variant="body2">{model.displayName}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {model.description}
                              </Typography>
                            </Box>
                          </MenuItem>
                        ))
                      )}
                    </Select>
                    <FormHelperText>
                      {loadingModels ? 'Loading available models...' :
                       availableModels.length === 0 ? 'Unable to load models. Check your API key.' :
                       'Choose the AI model to use. Pro models provide maximum intelligence quality.'}
                    </FormHelperText>
                  </FormControl>
                </AccordionDetails>
              </Accordion>

              {error && (
                <Alert severity="error" icon={<WarningIcon />}>
                  <Typography variant="subtitle2" gutterBottom>
                    Deployment Error
                  </Typography>
                  <Typography variant="body2" component="pre" sx={{ 
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem'
                  }}>
                    {error}
                  </Typography>
                </Alert>
              )}
            </>
          ) : (
            /* Generated System Display */
            <Box>
              <Alert severity="success" icon={<SuccessIcon />} sx={{ mb: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  Vision System Generated Successfully!
                </Typography>
              </Alert>

              {/* System Overview */}
              <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  <ArchitectureIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
                  System Overview
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {generatedSystem.systemOverview}
                </Typography>
              </Paper>

              {/* Generated Components */}
              <Stack spacing={1}>
                {/* AOA Scenarios */}
                <Accordion defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <CameraIcon color="primary" />
                      <Typography>
                        Chipset Detection ({generatedSystem.axisScenarios.length} scenarios)
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <List dense>
                      {generatedSystem.axisScenarios.map((scenario, idx) => (
                        <ListItem key={idx}>
                          <ListItemText
                            primary={scenario.name}
                            secondary={`Type: ${scenario.type} | Objects: ${
                              scenario.objectClassifications.map((o: any) => o.type).join(', ')
                            }`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </AccordionDetails>
                </Accordion>

                {/* Skills */}
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <AnalyticsIcon color="primary" />
                      <Typography>
                        AI Analysis Skills ({generatedSystem.skills.length} skills)
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <List dense>
                      {generatedSystem.skills.map((skill, idx) => (
                        <ListItem key={idx}>
                          <ListItemText
                            primary={skill.name}
                            secondary={skill.description}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </AccordionDetails>
                </Accordion>

                {/* Security Profiles */}
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <SecurityIcon color="primary" />
                      <Typography>
                        Security Profiles ({generatedSystem.securityProfiles.length} profiles)
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <List dense>
                      {generatedSystem.securityProfiles.map((profile, idx) => (
                        <ListItem key={idx}>
                          <ListItemText
                            primary={profile.name}
                            secondary={`Trigger: ${profile.trigger.type} | Schedule: ${profile.analysisSchedule || 'Always'}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </AccordionDetails>
                </Accordion>
              </Stack>

              {/* Deployment Result */}
              {deploymentResult && (
                <Alert 
                  severity={deploymentResult.success ? "success" : "warning"} 
                  sx={{ mt: 2 }}
                >
                  <Typography variant="subtitle2">
                    {deploymentResult.message}
                  </Typography>
                  {deploymentResult.deployed && (
                    <Box mt={1}>
                      <Typography variant="caption">
                        Deployed: {deploymentResult.deployed.scenarios} scenarios, 
                        {deploymentResult.deployed.skills} skills, 
                        {deploymentResult.deployed.profiles} profiles
                      </Typography>
                    </Box>
                  )}
                </Alert>
              )}
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        {!generatedSystem ? (
          <>
            {onSkip && (
              <Button onClick={onSkip} disabled={processing}>
                Skip
              </Button>
            )}
            <Button
              variant="contained"
              onClick={handleGenerate}
              disabled={!userGoal.trim() || !selectedModel || processing || availableModels.length === 0 || loadingPhase !== 'idle'}
              startIcon={(processing || loadingPhase !== 'idle') ? <CircularProgress size={20} /> : <AIIcon />}
            >
              {loadingPhase === 'analyzing' ? 'AI architecting system...' :
               processing ? 'AI is architecting your system...' : 
               'Generate Vision System'}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => setGeneratedSystem(null)}>
              Start Over
            </Button>
            <Button
              variant="contained"
              color="success"
              onClick={handleDeploy}
              disabled={deploying || deploymentResult?.success || loadingPhase !== 'idle'}
              startIcon={(deploying || loadingPhase === 'deploying') ? <CircularProgress size={20} /> : <SecurityIcon />}
            >
              {loadingPhase === 'deploying' ? 'Deploying system...' :
               deploying ? 'Deploying...' : 
               deploymentResult?.success ? 'Deployed!' : 'Deploy to Camera'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};