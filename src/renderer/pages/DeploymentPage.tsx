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
import { useNavigationGuard } from '../hooks/useNavigationGuard';
import NavigationWarningDialog from '../components/NavigationWarningDialog';

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

  // Full deployment steps for Vertex AI mode - ACTUAL EXECUTION ORDER
  return [
    { key: 'authenticate', label: 'Authentication' },
    { key: 'enableApis', label: 'Enable APIs' },
    { key: 'createFirebaseWebApp', label: 'Create Firebase Web App' },
    { key: 'createServiceAccounts', label: 'Create Service Accounts' },
    { key: 'assignIamRoles', label: 'Assign IAM Roles' },
    { key: 'setupFirestore', label: 'Setup Firestore & Authentication' },
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
  const [showLogs, setShowLogs] = useState(true); // Show logs by default
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  
  // Get deployment steps based on AI mode
  const deploymentSteps = getDeploymentSteps(config);
  
  // Check if deployment is in progress
  const isDeploymentActive = progress && 
    progress.totalProgress > 0 && 
    progress.totalProgress < 100 && 
    !error;
  
  // Setup navigation guard
  const {
    showDialog,
    confirmNavigation,
    cancelNavigation,
    guardedNavigate,
    message,
    isProcessing
  } = useNavigationGuard({
    when: isDeploymentActive || false,
    message: `Cloud deployment is ${progress?.totalProgress || 0}% complete. Leaving this page will cancel the deployment and you'll need to start over.`,
    onConfirm: async () => {
      // Cancel the deployment if user confirms navigation
      try {
        const result = await window.electronAPI.deployment.cancel();
        if (!result.success) {
          throw new Error(result.error || 'Failed to cancel deployment');
        }
        console.log(`Deployment ${result.action}: proceeding with navigation`);
      } catch (error) {
        console.error('Failed to cancel deployment:', error);
        // Re-throw to prevent navigation
        throw new Error('Could not cancel the deployment. Please try again.');
      }
    }
  });
  
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
    // Define event handlers
    const handleProgress = (prog: DeploymentProgress) => {
      setProgress(prog);
      
      // Update step statuses based on progress
      if (prog.currentStep) {
        setStepStatuses(prev => {
          const updated = { ...prev };
          
          // Update the current step
          if (updated[prog.currentStep]) {
            // Check if this step is completing (progress === 100)
            const isCompleting = prog.stepProgress === 100 && updated[prog.currentStep].status === 'in_progress';
            
            updated[prog.currentStep] = {
              status: prog.stepProgress === 100 ? 'completed' : 'in_progress',
              progress: prog.stepProgress || 0,
              message: prog.message || prog.detail,
              subStep: prog.subStep,
              lastUpdate: Date.now()
            };
            
            // Start elapsed time tracking for new in-progress steps
            if (prog.stepProgress < 100 && !stepTimersRef.current[prog.currentStep]) {
              const startTime = Date.now();
              stepTimersRef.current[prog.currentStep] = setInterval(() => {
                setStepStatuses(s => ({
                  ...s,
                  [prog.currentStep]: {
                    ...s[prog.currentStep],
                    elapsedTime: Math.floor((Date.now() - startTime) / 1000)
                  }
                }));
              }, 1000);
            }
            
            // Clear timer when step completes
            if (isCompleting && stepTimersRef.current[prog.currentStep]) {
              clearInterval(stepTimersRef.current[prog.currentStep]);
              delete stepTimersRef.current[prog.currentStep];
            }
          }
          
          return updated;
        });
      }
    };

    const handleLog = (message: string) => {
      const timestamp = new Date().toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
      setLogs(prev => {
        const newLogs = [...prev, `[${timestamp}] ${message}`];
        // Keep only last 500 logs to prevent memory issues
        if (newLogs.length > 500) {
          return newLogs.slice(-500);
        }
        return newLogs;
      });
    };

    const handleError = (err: any) => {
      setError(err.message || 'An error occurred during deployment');
      
      // Mark current step as error
      setProgress(prev => {
        if (prev?.currentStep) {
          setStepStatuses(s => ({
            ...s,
            [prev.currentStep]: {
              ...s[prev.currentStep],
              status: 'error',
              message: err.message
            }
          }));
        }
        return prev;
      });
    };

    const handleComplete = (result: any) => {
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
    };

    // Set up event listeners and store cleanup functions
    const unsubscribeProgress = window.electronAPI.deployment.onProgress(handleProgress);
    const unsubscribeLog = window.electronAPI.deployment.onLog(handleLog);
    const unsubscribeError = window.electronAPI.deployment.onError(handleError);
    const unsubscribeComplete = window.electronAPI.deployment.onComplete(handleComplete);

    return () => {
      // Cleanup timers
      Object.values(stepTimersRef.current).forEach(timer => clearInterval(timer));
      // Remove event listeners
      unsubscribeProgress();
      unsubscribeLog();
      unsubscribeError();
      unsubscribeComplete();
    };
  }, []); // Empty dependency array - only run once on mount

  // Separate effect for starting deployment
  useEffect(() => {
    // Start deployment and immediately show that we're starting
    if (config && !existingDeployment) {
      const timestamp = new Date().toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
      setLogs([`[${timestamp}] Initializing deployment for project ${project.projectId}...`]);
      window.electronAPI.deployment.start(config);
    } else if (existingDeployment) {
      const timestamp = new Date().toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
      setLogs([`[${timestamp}] Resuming deployment ${existingDeployment.id}...`]);
      window.electronAPI.deployment.resume(existingDeployment.id);
    }
  }, []); // Also only run once on mount

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

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
        <Stack direction="row" spacing={2} alignItems="center">
          <Button
            variant="outlined"
            size="small"
            onClick={() => setShowLogs(!showLogs)}
            startIcon={<ViewInAr />}
          >
            {showLogs ? 'Hide' : 'Show'} Deployment Logs
          </Button>
          {showLogs && (
            <>
              <Typography variant="caption" color="text.secondary">
                {logs.length} log entries
              </Typography>
              <Button
                variant="text"
                size="small"
                onClick={() => setAutoScroll(!autoScroll)}
                color={autoScroll ? 'primary' : 'inherit'}
              >
                Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
              </Button>
              {logs.length > 0 && (
                <Button
                  variant="text"
                  size="small"
                  onClick={() => setLogs([])}
                >
                  Clear
                </Button>
              )}
            </>
          )}
        </Stack>
      </Box>
      
      <Collapse in={showLogs}>
        <Paper
          variant="outlined"
          sx={{
            position: 'relative',
            bgcolor: '#1e1e1e',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              position: 'sticky',
              top: 0,
              bgcolor: '#2d2d2d',
              borderBottom: '1px solid',
              borderColor: 'divider',
              px: 2,
              py: 1,
              zIndex: 1,
            }}
          >
            <Typography 
              variant="caption" 
              sx={{ 
                fontFamily: 'monospace',
                color: '#9ca3af',
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              Deployment Console
            </Typography>
          </Box>
          <Box
            ref={logsContainerRef}
            sx={{
              p: 2,
              maxHeight: 400,
              minHeight: 200,
              overflow: 'auto',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              fontSize: '0.875rem',
              lineHeight: 1.6,
              color: '#e5e7eb',
              '&::-webkit-scrollbar': {
                width: 8,
              },
              '&::-webkit-scrollbar-track': {
                bgcolor: '#2d2d2d',
              },
              '&::-webkit-scrollbar-thumb': {
                bgcolor: '#4b5563',
                borderRadius: 1,
                '&:hover': {
                  bgcolor: '#6b7280',
                },
              },
            }}
          >
            {logs.length === 0 ? (
              <Typography 
                variant="body2" 
                sx={{ 
                  color: '#6b7280',
                  fontFamily: 'monospace',
                }}
              >
                Waiting for deployment logs...
              </Typography>
            ) : (
              logs.map((log, index) => {
                // Parse log for special formatting
                const isError = log.includes('error') || log.includes('Error') || log.includes('failed');
                const isSuccess = log.includes('✓') || log.includes('✅') || log.includes('successfully');
                const isWarning = log.includes('warning') || log.includes('Warning') || log.includes('⚠');
                const isInfo = log.includes('ℹ') || log.includes('→') || log.includes('•');
                
                let color = '#e5e7eb'; // default
                if (isError) color = '#ef4444';
                else if (isSuccess) color = '#10b981';
                else if (isWarning) color = '#f59e0b';
                else if (isInfo) color = '#3b82f6';
                
                // Extract timestamp and message
                const timestampMatch = log.match(/^\[(\d{2}:\d{2}:\d{2})\]\s*(.*)/);
                const timestamp = timestampMatch ? timestampMatch[1] : '';
                const message = timestampMatch ? timestampMatch[2] : log;
                
                return (
                  <Box 
                    key={index} 
                    sx={{ 
                      display: 'flex',
                      gap: 2,
                      '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 0.02)',
                      },
                      py: 0.25,
                    }}
                  >
                    {timestamp && (
                      <Typography
                        component="span"
                        sx={{
                          color: '#6b7280',
                          fontFamily: 'inherit',
                          fontSize: 'inherit',
                          minWidth: 70,
                        }}
                      >
                        {timestamp}
                      </Typography>
                    )}
                    <Typography
                      component="span"
                      sx={{
                        color,
                        fontFamily: 'inherit',
                        fontSize: 'inherit',
                        wordBreak: 'break-word',
                        flex: 1,
                      }}
                    >
                      {message}
                    </Typography>
                  </Box>
                );
              })
            )}
            <div ref={logsEndRef} />
          </Box>
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
      
      <NavigationWarningDialog
        open={showDialog}
        title="Deployment in Progress"
        message={message}
        severity="warning"
        confirmText="Cancel Deployment & Leave"
        cancelText="Continue Deployment"
        isProcessing={isProcessing}
        onConfirm={confirmNavigation}
        onCancel={cancelNavigation}
      />
      
    </Paper>
  );
};

export default DeploymentPage;