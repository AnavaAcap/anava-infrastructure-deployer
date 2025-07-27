import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  VpnKey as VpnKeyIcon,
  CloudQueue as CloudIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';

interface TestConfigurationDialogProps {
  open: boolean;
  onClose: () => void;
  deploymentConfig: any;
}

interface TestStep {
  label: string;
  description: string;
  status: 'pending' | 'running' | 'success' | 'error';
  details?: string;
  error?: string;
}

export const TestConfigurationDialog: React.FC<TestConfigurationDialogProps> = ({
  open,
  onClose,
  deploymentConfig
}) => {
  const [testing, setTesting] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [testSteps, setTestSteps] = useState<TestStep[]>([
    {
      label: 'Request Firebase Custom Token',
      description: 'Authenticate device with API Gateway',
      status: 'pending'
    },
    {
      label: 'Exchange for Firebase ID Token',
      description: 'Convert custom token to Firebase authentication',
      status: 'pending'
    },
    {
      label: 'Request GCP Access Token',
      description: 'Exchange Firebase token for GCP access via Workload Identity Federation',
      status: 'pending'
    },
    {
      label: 'Verify GCP Permissions',
      description: 'Test access to GCP services',
      status: 'pending'
    }
  ]);

  const updateStep = (index: number, update: Partial<TestStep>) => {
    setTestSteps(prev => prev.map((step, i) => 
      i === index ? { ...step, ...update } : step
    ));
  };

  const runTest = async () => {
    setTesting(true);
    setActiveStep(0);
    
    // Reset all steps
    setTestSteps(prev => prev.map(step => ({ ...step, status: 'pending', details: undefined, error: undefined })));

    try {
      // Step 1: Get Firebase custom token
      updateStep(0, { status: 'running' });
      
      const deviceId = `test-device-${Date.now()}`;
      const customTokenResponse = await window.electronAPI.testAuthStep({
        step: 'custom-token',
        apiGatewayUrl: deploymentConfig.apiGatewayUrl,
        apiKey: deploymentConfig.apiKey,
        deviceId
      });

      if (customTokenResponse.success) {
        updateStep(0, { 
          status: 'success', 
          details: `Device ID: ${deviceId.substring(0, 20)}...`
        });
        setActiveStep(1);
      } else {
        throw new Error(customTokenResponse.error || 'Failed to get custom token');
      }

      // Step 2: Exchange for Firebase ID token
      updateStep(1, { status: 'running' });
      
      const idTokenResponse = await window.electronAPI.testAuthStep({
        step: 'id-token',
        customToken: customTokenResponse.customToken,
        firebaseApiKey: deploymentConfig.firebaseConfig?.apiKey
      });

      if (idTokenResponse.success) {
        updateStep(1, { 
          status: 'success',
          details: `Expires in: ${idTokenResponse.expiresIn}s`
        });
        setActiveStep(2);
      } else {
        throw new Error(idTokenResponse.error || 'Failed to get ID token');
      }

      // Step 3: Exchange for GCP access token
      updateStep(2, { status: 'running' });
      
      const gcpTokenResponse = await window.electronAPI.testAuthStep({
        step: 'gcp-token',
        apiGatewayUrl: deploymentConfig.apiGatewayUrl,
        apiKey: deploymentConfig.apiKey,
        idToken: idTokenResponse.idToken
      });

      if (gcpTokenResponse.success) {
        updateStep(2, { 
          status: 'success',
          details: `Token expires in: ${gcpTokenResponse.expiresIn}s`
        });
        setActiveStep(3);
      } else {
        throw new Error(gcpTokenResponse.error || 'Failed to get GCP token');
      }

      // Step 4: Verify GCP permissions
      updateStep(3, { status: 'running' });
      
      const verifyResponse = await window.electronAPI.testAuthStep({
        step: 'verify',
        gcpToken: gcpTokenResponse.gcpToken,
        projectId: deploymentConfig.firebaseConfig?.projectId
      });

      if (verifyResponse.success) {
        updateStep(3, { 
          status: 'success',
          details: `Service Account: ${verifyResponse.serviceAccount}`
        });
        setActiveStep(4);
      } else {
        throw new Error(verifyResponse.error || 'Failed to verify permissions');
      }

    } catch (error: any) {
      const failedStep = testSteps.findIndex(step => step.status === 'running');
      if (failedStep >= 0) {
        updateStep(failedStep, { 
          status: 'error', 
          error: error.message 
        });
      }
    } finally {
      setTesting(false);
    }
  };

  const allStepsComplete = testSteps.every(step => step.status === 'success');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Test Authentication Configuration</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          This test simulates the complete authentication flow that cameras will use to access GCP services.
        </Typography>

        {!deploymentConfig?.apiGatewayUrl && (
          <Alert severity="error" sx={{ mb: 2 }}>
            No deployment configuration found. Please complete the GCP deployment first.
          </Alert>
        )}

        {!deploymentConfig?.firebaseConfig?.apiKey && deploymentConfig?.apiGatewayUrl && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Firebase API key not found. Some test steps may fail.
          </Alert>
        )}

        <Card variant="outlined" sx={{ mb: 3, bgcolor: 'grey.50' }}>
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>Configuration</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CloudIcon fontSize="small" color="action" />
                <Typography variant="body2">
                  API Gateway: <Chip label={deploymentConfig?.apiGatewayUrl?.split('//')[1]?.split('/')[0] || 'Not configured'} size="small" />
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <VpnKeyIcon fontSize="small" color="action" />
                <Typography variant="body2">
                  API Key: <Chip label="••••••••" size="small" />
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SecurityIcon fontSize="small" color="action" />
                <Typography variant="body2">
                  Project: <Chip label={deploymentConfig?.firebaseConfig?.projectId || 'Not configured'} size="small" />
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Stepper activeStep={activeStep} orientation="vertical">
          {testSteps.map((step, index) => (
            <Step key={index}>
              <StepLabel
                icon={
                  step.status === 'running' ? (
                    <CircularProgress size={24} />
                  ) : step.status === 'success' ? (
                    <CheckCircleIcon color="success" />
                  ) : step.status === 'error' ? (
                    <ErrorIcon color="error" />
                  ) : (
                    index + 1
                  )
                }
              >
                {step.label}
              </StepLabel>
              <StepContent>
                <Typography variant="body2" color="text.secondary">
                  {step.description}
                </Typography>
                {step.details && (
                  <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 1 }}>
                    {step.details}
                  </Typography>
                )}
                {step.error && (
                  <Alert severity="error" sx={{ mt: 1 }}>
                    {step.error}
                  </Alert>
                )}
              </StepContent>
            </Step>
          ))}
        </Stepper>

        {allStepsComplete && (
          <Alert severity="success" sx={{ mt: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              ✅ Authentication configuration verified successfully!
            </Typography>
            <Typography variant="body2">
              Cameras can now authenticate and access GCP services.
            </Typography>
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button 
          variant="contained" 
          onClick={runTest}
          disabled={!deploymentConfig?.apiGatewayUrl || testing}
          startIcon={testing ? <CircularProgress size={20} /> : null}
        >
          {testing ? 'Testing...' : 'Run Test'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};