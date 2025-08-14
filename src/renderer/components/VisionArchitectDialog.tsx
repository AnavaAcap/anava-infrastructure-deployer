/**
 * Vision Architect Dialog - Revolutionary AI-driven camera configuration
 * 
 * Simple form that lets users describe what they want and AI does everything
 */

import React, { useState } from 'react';
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

  const handleGenerate = async () => {
    if (!userGoal.trim()) {
      setError('Please describe what you want to achieve');
      return;
    }

    setProcessing(true);
    setError(null);
    setGeneratedSystem(null);

    try {
      // Generate the vision system
      const result = await (window as any).electronAPI.invokeIPC(
        'vision-architect-generate',
        geminiApiKey,
        userGoal,
        imageDescription || undefined
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
      
      // Deploy the generated system (false = real mode, true = mock mode)
      const useMockMode = false; // SET TO TRUE FOR TESTING WITHOUT CAMERA
      
      const result = await (window as any).electronAPI.invokeIPC(
        'vision-architect-deploy',
        cameraIp,
        username,
        password,
        generatedSystem,
        useMockMode
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
                helperText="Help the AI understand your environment for better configuration"
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
              disabled={!userGoal.trim() || processing}
              startIcon={processing ? <CircularProgress size={20} /> : <AIIcon />}
            >
              {processing ? 'AI is architecting your system...' : 'Generate Vision System'}
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