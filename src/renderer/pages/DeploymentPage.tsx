import React, { useState, useEffect } from 'react';
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

const deploymentSteps = [
  { key: 'authenticate', label: 'Authentication' },
  { key: 'enableApis', label: 'Enable APIs' },
  { key: 'createServiceAccounts', label: 'Create Service Accounts' },
  { key: 'assignIamRoles', label: 'Assign IAM Roles' },
  { key: 'deployCloudFunctions', label: 'Deploy Cloud Functions' },
  { key: 'createApiGateway', label: 'Create API Gateway' },
  { key: 'configureWorkloadIdentity', label: 'Configure Identity Federation' },
  { key: 'setupFirestore', label: 'Setup Firestore' },
  { key: 'createFirebaseWebApp', label: 'Create Firebase Web App' },
];

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

  useEffect(() => {
    // Set up event listeners
    window.electronAPI.deployment.onProgress((prog) => {
      setProgress(prog);
      addLog(`${new Date().toLocaleTimeString()} ${prog.message}`);
    });

    window.electronAPI.deployment.onError((err) => {
      setError(err.message || 'An error occurred during deployment');
      addLog(`ERROR: ${err.message}`);
    });

    window.electronAPI.deployment.onComplete((result) => {
      if (result.success) {
        addLog('Deployment completed successfully!');
      }
      onComplete(result);
    });

    // Start deployment
    if (existingDeployment) {
      window.electronAPI.deployment.resume(existingDeployment.deploymentId);
    } else if (config) {
      window.electronAPI.deployment.start({
        ...config,
        projectId: project.projectId,
      });
    }

    return () => {
      // Cleanup would go here
    };
  }, []);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, message]);
  };

  const handlePause = async () => {
    if (isPaused) {
      // Resume
      if (existingDeployment) {
        await window.electronAPI.deployment.resume(existingDeployment.deploymentId);
      }
    } else {
      // Pause
      await window.electronAPI.deployment.pause();
    }
    setIsPaused(!isPaused);
  };

  const getStepStatus = (stepKey: string) => {
    if (!progress) return 'pending';
    if (progress.currentStep === stepKey) return 'in_progress';
    
    const stepIndex = deploymentSteps.findIndex(s => s.key === stepKey);
    const currentIndex = deploymentSteps.findIndex(s => s.key === progress.currentStep);
    
    if (stepIndex < currentIndex) return 'completed';
    return 'pending';
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle color="success" />;
      case 'in_progress':
        return <RotateRight sx={{ animation: `${rotate} 1s linear infinite` }} color="primary" />;
      case 'failed':
        return <Error color="error" />;
      default:
        return <RadioButtonUnchecked color="disabled" />;
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 6 }}>
      <TopBar 
        title="Deployment Progress" 
        showLogout={!!onLogout}
        onLogout={onLogout}
      />
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Overall Progress: {progress?.totalProgress || 0}%
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
          const status = getStepStatus(step.key);
          const isCurrentStep = progress?.currentStep === step.key;
          
          return (
            <ListItem key={step.key}>
              <ListItemIcon>{getStepIcon(status)}</ListItemIcon>
              <ListItemText
                primary={step.label}
                secondary={isCurrentStep ? progress?.detail || progress?.message : null}
                primaryTypographyProps={{
                  fontWeight: isCurrentStep ? 'bold' : 'normal',
                }}
              />
              {isCurrentStep && progress && (
                <Box sx={{ minWidth: 100 }}>
                  <LinearProgress
                    variant="determinate"
                    value={progress.stepProgress}
                    sx={{ height: 4, borderRadius: 2 }}
                  />
                </Box>
              )}
            </ListItem>
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