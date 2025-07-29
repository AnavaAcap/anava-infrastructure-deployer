import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  LinearProgress,
  Stack,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse,
  keyframes,
} from '@mui/material';
import {
  CheckCircle,
  RadioButtonUnchecked,
  Error,
  RotateRight,
  Pause,
  ViewInAr,
} from '@mui/icons-material';
import { GCPProject, DeploymentConfig, DeploymentState, DeploymentProgress } from '../../types';
import TopBar from '../components/TopBar';

const rotate = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

interface DeploymentPageProps {
  project: GCPProject;
  config: DeploymentConfig | null;
  existingDeployment: DeploymentState | null;
  onComplete: (result: any) => void;
  onBack: () => void;
  onLogout?: () => void;
}

interface StepDefinition {
  key: string;
  label: string;
  note?: string;
  subSteps?: Array<{
    key: string;
    label: string;
  }>;
}

// Get deployment steps based on AI mode
const getDeploymentSteps = (config: DeploymentConfig | null): StepDefinition[] => {
  if (config?.aiMode === 'ai-studio') {
    // Minimal steps for AI Studio mode
    return [
      { key: 'authenticate', label: 'Authentication' },
      { key: 'enableApis', label: 'Enable AI Studio API' },
      { key: 'createAiStudioKey', label: 'Create AI Studio API Key' },
    ];
  }

  // Full deployment steps for Vertex AI mode - FIXED ORDER
  return [
    { key: 'authenticate', label: 'Authentication' },
    { key: 'enableApis', label: 'Enable APIs' },
    { key: 'createServiceAccounts', label: 'Create Service Accounts' },
    { key: 'assignIamRoles', label: 'Assign IAM Roles' },
    { key: 'deployCloudFunctions', label: 'Deploy Cloud Functions', note: 'This step typically takes 5-7 minutes' },
    { 
      key: 'createApiGateway', 
      label: 'Create API Gateway', 
      note: 'This step typically takes 10-15 minutes',
      subSteps: [
        { key: 'managed-service', label: 'Creating managed service' },
        { key: 'api-config', label: 'Creating API configuration' },
        { key: 'gateway', label: 'Creating API Gateway instance' }
      ]
    },
    { key: 'configureWorkloadIdentity', label: 'Configure Identity Federation' },
    { key: 'setupFirestore', label: 'Setup Firestore & Authentication' },
    { key: 'createFirebaseWebApp', label: 'Create Firebase Web App' },
  ];
};

interface StepStatus {
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  progress: number;
  message?: string;
  subStep?: string;
  elapsedTime?: number;
  lastUpdate?: number;
}

const DeploymentPage: React.FC<DeploymentPageProps> = ({
  project,
  config,
  existingDeployment,
  onComplete,
  onBack,
  onLogout,
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState<DeploymentProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  
  // Get deployment steps based on AI mode
  const deploymentSteps = getDeploymentSteps(config);
  
  // Track step statuses separately to maintain order
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>(() => {
    const initial: Record<string, StepStatus> = {};
    deploymentSteps.forEach(step => {
      initial[step.key] = { status: 'pending', progress: 0 };
    });
    return initial;
  });
  
  const stepTimersRef = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    // Set up event listeners
    window.electronAPI.deployment.onProgress((prog) => {
      setProgress(prog);
      
      // Update step statuses based on progress
      if (prog.currentStep) {
        setStepStatuses(prev => {
          const updated = { ...prev };
          
          // Mark all previous steps as completed
          let foundCurrent = false;
          deploymentSteps.forEach(step => {
            if (step.key === prog.currentStep) {
              foundCurrent = true;
              updated[step.key] = {
                status: 'in_progress',
                progress: prog.stepProgress || 0,
                message: prog.message || prog.detail,
                subStep: prog.subStep,
                lastUpdate: Date.now()
              };
              
              // Start elapsed time tracking
              if (!stepTimersRef.current[step.key]) {
                const startTime = Date.now();
                stepTimersRef.current[step.key] = setInterval(() => {
                  setStepStatuses(s => ({
                    ...s,
                    [step.key]: {
                      ...s[step.key],
                      elapsedTime: Math.floor((Date.now() - startTime) / 1000)
                    }
                  }));
                }, 1000);
              }
            } else if (!foundCurrent && updated[step.key].status !== 'completed') {
              // Mark previous steps as completed
              updated[step.key] = {
                status: 'completed',
                progress: 100,
                message: updated[step.key].message
              };
              // Clear timer
              if (stepTimersRef.current[step.key]) {
                clearInterval(stepTimersRef.current[step.key]);
                delete stepTimersRef.current[step.key];
              }
            }
          });
          
          return updated;
        });
      }
    });

    window.electronAPI.deployment.onLog((message) => {
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
    });

    window.electronAPI.deployment.onError((err) => {
      setError(err.message || 'An error occurred during deployment');
      
      // Mark current step as error
      if (progress?.currentStep) {
        setStepStatuses(prev => ({
          ...prev,
          [progress.currentStep]: {
            ...prev[progress.currentStep],
            status: 'error',
            message: err.message
          }
        }));
      }
    });

    window.electronAPI.deployment.onComplete((result) => {
      // Mark all steps as completed
      setStepStatuses(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(key => {
          updated[key] = { ...updated[key], status: 'completed', progress: 100 };
        });
        return updated;
      });
      
      // Clear all timers
      Object.values(stepTimersRef.current).forEach(timer => clearInterval(timer));
      stepTimersRef.current = {};
      
      onComplete(result);
    });

    // Start deployment
    if (config && !existingDeployment) {
      window.electronAPI.deployment.start(config);
    } else if (existingDeployment) {
      window.electronAPI.deployment.resume(existingDeployment.id);
    }

    return () => {
      // Cleanup timers
      Object.values(stepTimersRef.current).forEach(timer => clearInterval(timer));
    };
  }, [config, existingDeployment, onComplete]);

  const handlePause = () => {
    if (isPaused) {
      window.electronAPI.deployment.resume(existingDeployment?.id || '');
    } else {
      window.electronAPI.deployment.pause();
    }
    setIsPaused(!isPaused);
  };

  const formatElapsedTime = (seconds?: number): string => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s elapsed`;
  };

  const getStepIcon = (status: StepStatus['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle color="success" />;
      case 'in_progress':
        return (
          <RotateRight 
            color="primary" 
            sx={{ animation: `${rotate} 2s linear infinite` }}
          />
        );
      case 'error':
        return <Error color="error" />;
      default:
        return <RadioButtonUnchecked color="disabled" />;
    }
  };

  return (
    <Paper sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom>
        Deploying Infrastructure
      </Typography>
      
      <Typography variant="body2" color="text.secondary" paragraph>
        Setting up your GCP infrastructure for project <strong>{project.projectId}</strong>
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Overall Progress: {Math.round(progress?.totalProgress || 0)}%
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={progress?.totalProgress || 0}
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Box>
      
      <List>
        {deploymentSteps.map((step) => {
          const stepStatus = stepStatuses[step.key];
          const isCurrentStep = stepStatus.status === 'in_progress';
          
          return (
            <React.Fragment key={step.key}>
              <ListItem>
                <ListItemIcon>{getStepIcon(stepStatus.status)}</ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {step.label}
                      {isCurrentStep && stepStatus.elapsedTime && (
                        <Typography variant="caption" color="text.secondary">
                          ({formatElapsedTime(stepStatus.elapsedTime)})
                        </Typography>
                      )}
                    </Box>
                  }
                  secondary={
                    <React.Fragment>
                      {isCurrentStep && step.note && (
                        <Typography 
                          variant="caption" 
                          color="info.main"
                          sx={{ display: 'block', fontStyle: 'italic', mb: 0.5 }}
                        >
                          {step.note}
                        </Typography>
                      )}
                      {stepStatus.message}
                    </React.Fragment>
                  }
                  primaryTypographyProps={{
                    fontWeight: isCurrentStep ? 'bold' : 'normal',
                  }}
                />
                {isCurrentStep && (
                  <Box sx={{ minWidth: 100 }}>
                    <LinearProgress
                      variant="determinate"
                      value={stepStatus.progress}
                      sx={{ height: 4, borderRadius: 2 }}
                    />
                  </Box>
                )}
              </ListItem>
              
              {/* Show sub-steps for API Gateway */}
              {isCurrentStep && step.subSteps && stepStatus.subStep && (
                <Box sx={{ pl: 9, pr: 2 }}>
                  {step.subSteps.map((subStep) => {
                    const isCurrentSubStep = stepStatus.subStep === subStep.key;
                    const subStepIndex = step.subSteps!.findIndex(s => s.key === stepStatus.subStep);
                    const currentSubStepIndex = step.subSteps!.findIndex(s => s.key === subStep.key);
                    const subStepStatus = isCurrentSubStep ? 'in_progress' : 
                      (subStepIndex > currentSubStepIndex ? 'completed' : 'pending');
                    
                    return (
                      <ListItem key={subStep.key} dense>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          {getStepIcon(subStepStatus as StepStatus['status'])}
                        </ListItemIcon>
                        <ListItemText
                          primary={subStep.label}
                          primaryTypographyProps={{
                            variant: 'body2',
                            fontWeight: isCurrentSubStep ? 'medium' : 'normal',
                            color: isCurrentSubStep ? 'primary' : 'text.secondary',
                          }}
                        />
                        {isCurrentSubStep && (
                          <Box sx={{ minWidth: 80 }}>
                            <LinearProgress
                              variant="determinate"
                              value={stepStatus.progress}
                              sx={{ height: 3, borderRadius: 2 }}
                            />
                          </Box>
                        )}
                      </ListItem>
                    );
                  })}
                </Box>
              )}
            </React.Fragment>
          );
        })}
      </List>
      
      <Box sx={{ mt: 4, mb: 2 }}>
        <Button
          variant="outlined"
          size="small"
          onClick={() => setShowLogs(!showLogs)}
          startIcon={<ViewInAr />}
        >
          {showLogs ? 'Hide' : 'View'} Logs
        </Button>
      </Box>
      
      <Collapse in={showLogs}>
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            maxHeight: 200,
            overflow: 'auto',
            bgcolor: 'grey.50',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
          }}
        >
          {logs.map((log, index) => (
            <div key={index}>{log}</div>
          ))}
        </Paper>
      </Collapse>
      
      <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 4 }}>
        <Button
          variant="contained"
          startIcon={<Pause />}
          onClick={handlePause}
          disabled={error !== null}
        >
          {isPaused ? 'Resume' : 'Pause'}
        </Button>
      </Stack>
      
    </Paper>
  );
};

export default DeploymentPage;