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
  const [capturingScene, setCapturingScene] = useState(false);

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
    setCapturingScene(true);
    setError(null);
    
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
        setError('Failed to capture scene from camera: ' + (result.error || 'Unknown error'));
        return null;
      }
    } catch (error: any) {
      console.error('Error capturing scene:', error);
      setError('Error capturing scene: ' + error.message);
      return null;
    } finally {
      setCapturingScene(false);
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

    try {
      // First, ensure we have a scene image
      let imageToUse = sceneImage;
      if (!imageToUse) {
        console.log('No scene image available, capturing from camera...');
        imageToUse = await captureSceneImage();
        if (!imageToUse) {
          // Error already set by captureSceneImage
          setProcessing(false);
          return;
        }
      }

      console.log('Generating vision system with scene image...');
      
      // Generate the vision system with the image
      const result = await (window as any).electronAPI.invokeIPC(
        'vision-architect-generate',
        geminiApiKey,
        userGoal,
        imageDescription || undefined,
        selectedModel,
        imageToUse // Pass the scene image
      );

      if (result.success) {
        setGeneratedSystem(result);
      } else {
        setError(result.error || 'Failed to generate system');
      }
    } catch (error: any) {
      console.error('Vision generation error:', error);
      setError(error.message || 'Failed to generate vision system');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeploy = async () => {
    if (!generatedSystem) return;

    setDeploying(true);
    setError(null);

    try {
      console.log('Deploying Vision System to camera:', cameraIp);
      console.log('System contains:', {
        scenarios: generatedSystem.axisScenarios?.length || 0,
        skills: generatedSystem.skills?.length || 0,
        profiles: generatedSystem.securityProfiles?.length || 0
      });
      
      // Deploy the generated system to camera (real deployment only)
      const result = await (window as any).electronAPI.invokeIPC(
        'vision-architect-deploy',
        cameraIp,
        username,
        password,
        generatedSystem
      );

      console.log('Deployment result:', result);
      setDeploymentResult(result);
      
      if (result.success) {
        console.log('✅ Vision System successfully deployed!');
        // Auto-complete after 3 seconds
        setTimeout(() => {
          onComplete();
        }, 3000);
      } else {
        console.error('❌ Deployment failed:', result.errors);
        const errorMessage = result.errors?.join('\n') || result.message || 'Deployment failed';
        setError(errorMessage);
      }
    } catch (error: any) {
      console.error('Deployment error:', error);
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

  return (
    <Dialog 
      open={open} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          maxHeight: '90vh'
        }
      }}
    >
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
              {/* Model Selection */}
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
                   'Choose the AI model to use. Flash models have better rate limits.'}
                </FormHelperText>
              </FormControl>

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

              {/* Scene Image Status */}
              {sceneImage && (
                <Alert severity="success" icon={<ImageIcon />}>
                  <Typography variant="body2">
                    Scene image captured from camera - AI will analyze the actual environment
                  </Typography>
                </Alert>
              )}
              
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
              disabled={!userGoal.trim() || !selectedModel || processing || capturingScene || availableModels.length === 0}
              startIcon={(processing || capturingScene) ? <CircularProgress size={20} /> : <AIIcon />}
            >
              {capturingScene ? 'Capturing scene from camera...' :
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
              disabled={deploying || deploymentResult?.success}
              startIcon={deploying ? <CircularProgress size={20} /> : <SecurityIcon />}
            >
              {deploying ? 'Deploying...' : 
               deploymentResult?.success ? 'Deployed!' : 'Deploy to Camera'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};