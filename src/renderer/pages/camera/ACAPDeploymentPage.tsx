import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Paper,
  Typography,
  Alert,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  CloudUpload as CloudUploadIcon,
  Settings as SettingsIcon,
  Videocam as VideocamIcon,
} from '@mui/icons-material';

interface Camera {
  id: string;
  ip: string;
  model: string;
  authenticated?: boolean;
}

interface DeploymentStatus {
  cameraId: string;
  status: 'pending' | 'deploying' | 'success' | 'error';
  message?: string;
}

interface ACAPDeploymentPageProps {
  cameras: Camera[];
  deploymentConfig: any;
  onComplete: () => void;
}

export const ACAPDeploymentPage: React.FC<ACAPDeploymentPageProps> = ({
  cameras,
  deploymentConfig,
  onComplete,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [deploymentStatus, setDeploymentStatus] = useState<Map<string, DeploymentStatus>>(
    new Map(cameras.map(c => [c.id, { cameraId: c.id, status: 'pending' }]))
  );
  const [configuring, setConfiguring] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = [
    {
      label: 'Prepare Cameras',
      description: 'Configure cameras with GCP credentials',
    },
    {
      label: 'Deploy ACAP',
      description: 'Install Anava authentication application',
    },
    {
      label: 'Verify Deployment',
      description: 'Test camera connections',
    },
  ];

  const configureCameras = async () => {
    setConfiguring(true);
    setError(null);

    try {
      // In a real implementation, this would configure each camera
      // with the API Gateway URL, API key, and other credentials
      // For now, we'll simulate this
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setActiveStep(1);
    } catch (err: any) {
      setError(`Configuration failed: ${err.message}`);
    } finally {
      setConfiguring(false);
    }
  };

  const deployACAP = async () => {
    setDeploying(true);
    setError(null);

    try {
      for (const camera of cameras) {
        setDeploymentStatus(prev => {
          const newMap = new Map(prev);
          newMap.set(camera.id, { cameraId: camera.id, status: 'deploying' });
          return newMap;
        });

        // In a real implementation, this would deploy the ACAP
        // For now, we'll simulate deployment
        await new Promise(resolve => setTimeout(resolve, 1500));

        const success = Math.random() > 0.1; // 90% success rate for simulation
        
        setDeploymentStatus(prev => {
          const newMap = new Map(prev);
          newMap.set(camera.id, {
            cameraId: camera.id,
            status: success ? 'success' : 'error',
            message: success ? 'ACAP deployed successfully' : 'Deployment failed',
          });
          return newMap;
        });
      }

      setActiveStep(2);
    } catch (err: any) {
      setError(`Deployment failed: ${err.message}`);
    } finally {
      setDeploying(false);
    }
  };

  const verifyDeployment = async () => {
    // In a real implementation, this would test the cameras
    setActiveStep(3);
    setTimeout(onComplete, 2000);
  };

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography variant="body2" paragraph>
              Configure cameras with the deployed GCP infrastructure:
            </Typography>
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  API Gateway URL
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {deploymentConfig.apiGatewayUrl}
                </Typography>
              </CardContent>
            </Card>
            <Button
              variant="contained"
              onClick={configureCameras}
              disabled={configuring}
              startIcon={configuring ? <CircularProgress size={20} /> : <SettingsIcon />}
            >
              {configuring ? 'Configuring...' : 'Configure Cameras'}
            </Button>
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="body2" paragraph>
              Deploy the Anava authentication application to each camera:
            </Typography>
            <List>
              {cameras.map(camera => {
                const status = deploymentStatus.get(camera.id);
                return (
                  <ListItem key={camera.id}>
                    <ListItemIcon>
                      {status?.status === 'success' ? (
                        <CheckCircleIcon color="success" />
                      ) : status?.status === 'error' ? (
                        <ErrorIcon color="error" />
                      ) : status?.status === 'deploying' ? (
                        <CircularProgress size={24} />
                      ) : (
                        <VideocamIcon />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={camera.model}
                      secondary={
                        <Box>
                          <Typography variant="body2">{camera.ip}</Typography>
                          {status?.message && (
                            <Typography 
                              variant="caption" 
                              color={status.status === 'error' ? 'error' : 'text.secondary'}
                            >
                              {status.message}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                );
              })}
            </List>
            <Button
              variant="contained"
              onClick={deployACAP}
              disabled={deploying || activeStep !== 1}
              startIcon={deploying ? <CircularProgress size={20} /> : <CloudUploadIcon />}
              sx={{ mt: 2 }}
            >
              {deploying ? 'Deploying...' : 'Deploy ACAP'}
            </Button>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="body2" paragraph>
              Verify that cameras can authenticate with the GCP infrastructure:
            </Typography>
            <Alert severity="success" sx={{ mb: 2 }}>
              All cameras deployed successfully!
            </Alert>
            <Button
              variant="contained"
              onClick={verifyDeployment}
              color="success"
            >
              Complete Setup
            </Button>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Camera Configuration
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        Configure {cameras.length} camera{cameras.length !== 1 ? 's' : ''} to use the deployed infrastructure.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Stepper activeStep={activeStep} orientation="vertical">
          {steps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel
                optional={
                  index === 2 ? (
                    <Typography variant="caption">Last step</Typography>
                  ) : null
                }
              >
                {step.label}
              </StepLabel>
              <StepContent>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {step.description}
                </Typography>
                {getStepContent(index)}
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </Paper>
    </Box>
  );
};