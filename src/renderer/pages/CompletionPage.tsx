import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Stack,
  Alert,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  Divider,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import {
  CheckCircle,
  ContentCopy,
  Visibility,
  VisibilityOff,
  Add,
  Download,
} from '@mui/icons-material';
import { DeploymentResult } from '../../types';
import TopBar from '../components/TopBar';
import PostDeploymentChecklist from '../components/PostDeploymentChecklist';

interface CompletionPageProps {
  result: DeploymentResult;
  onNewDeployment: () => void;
  onLogout?: () => void;
}

const CompletionPage: React.FC<CompletionPageProps> = ({ result, onNewDeployment, onLogout }) => {
  const [showApiKey, setShowApiKey] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleExportConfig = () => {
    const config = {
      apiGatewayUrl: result.apiGatewayUrl,
      apiKey: result.apiKey,
      firebaseConfig: result.firebaseConfig,
      resources: result.resources,
      timestamp: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'anava-deployment-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!result.success) {
    return (
      <Paper elevation={3} sx={{ p: 6 }}>
        <TopBar 
          title="Deployment Status" 
          showLogout={!!onLogout}
          onLogout={onLogout}
        />
        
        <Alert severity="error" sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Deployment Failed
          </Typography>
          <Typography>
            {result.error || 'An unknown error occurred during deployment.'}
          </Typography>
        </Alert>
        
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={onNewDeployment}
          fullWidth
        >
          Try New Deployment
        </Button>
      </Paper>
    );
  }

  const steps = ['Deployment Complete', 'Firebase Setup'];

  const handleChecklistComplete = () => {
    setActiveStep(2); // Move to final step
  };

  return (
    <Paper elevation={3} sx={{ p: 6 }}>
      <TopBar 
        title="Deployment Status" 
        showLogout={!!onLogout}
        onLogout={onLogout}
      />
      
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {activeStep === 0 && (
        <>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
            <CheckCircle color="success" sx={{ fontSize: 36 }} />
            <Typography variant="h6" color="success.main">
              All systems deployed successfully
            </Typography>
          </Stack>
      
      <List sx={{ mb: 4 }}>
        <ListItem>
          <ListItemText
            primary="API Gateway URL"
            secondary={
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {result.apiGatewayUrl}
                </Typography>
                <Tooltip title={copied === 'url' ? 'Copied!' : 'Copy'}>
                  <IconButton
                    size="small"
                    onClick={() => handleCopy(result.apiGatewayUrl!, 'url')}
                  >
                    <ContentCopy fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            }
          />
        </ListItem>
        
        <Divider />
        
        <ListItem>
          <ListItemText
            primary="API Key"
            secondary={
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {showApiKey ? result.apiKey : '••••••••-••••-••••'}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                </IconButton>
                <Tooltip title={copied === 'key' ? 'Copied!' : 'Copy'}>
                  <IconButton
                    size="small"
                    onClick={() => handleCopy(result.apiKey!, 'key')}
                  >
                    <ContentCopy fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            }
          />
        </ListItem>
        
        {result.firebaseConfig && (
          <>
            <Divider sx={{ my: 2 }} />
            <ListItem>
              <ListItemText
                primary="Firebase Auth Domain"
                secondary={
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="mono" sx={{ fontFamily: 'monospace' }}>
                      {result.firebaseConfig.authDomain}
                    </Typography>
                    <Tooltip title={copied === 'authDomain' ? 'Copied!' : 'Copy'}>
                      <IconButton
                        size="small"
                        onClick={() => handleCopy(result.firebaseConfig!.authDomain, 'authDomain')}
                      >
                        <ContentCopy fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                }
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Firebase App ID"
                secondary={
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="mono" sx={{ fontFamily: 'monospace' }}>
                      {result.firebaseConfig.appId}
                    </Typography>
                    <Tooltip title={copied === 'appId' ? 'Copied!' : 'Copy'}>
                      <IconButton
                        size="small"
                        onClick={() => handleCopy(result.firebaseConfig!.appId, 'appId')}
                      >
                        <ContentCopy fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                }
              />
            </ListItem>
          </>
        )}
      </List>
      
      <Box sx={{ bgcolor: 'grey.50', p: 3, borderRadius: 2, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Next Steps:
        </Typography>
        <List dense>
          <ListItem>
            <ListItemText primary="1. Configure cameras with the API Gateway URL" />
          </ListItem>
          <ListItem>
            <ListItemText primary="2. Set API key in ACAP application settings" />
          </ListItem>
          <ListItem>
            <ListItemText primary="3. Test authentication flow with a camera" />
          </ListItem>
        </List>
      </Box>
      
          <Stack direction="row" spacing={2} justifyContent="center">
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={handleExportConfig}
            >
              Export Config
            </Button>
            
            <Button
              variant="contained"
              onClick={() => setActiveStep(1)}
            >
              Continue to Firebase Setup
            </Button>
          </Stack>
        </>
      )}

      {activeStep === 1 && (
        <PostDeploymentChecklist
          projectId={result.resources?.createServiceAccounts?.accounts ? 
            result.resources.createServiceAccounts.accounts['device-auth-sa']?.split('@')[1]?.split('.')[0] : 
            'unknown'
          }
          firebaseConfig={result.firebaseConfig}
          onComplete={handleChecklistComplete}
        />
      )}

      {activeStep === 2 && (
        <Box textAlign="center">
          <CheckCircle color="success" sx={{ fontSize: 64, mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Setup Complete!
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Your Anava Vision authentication infrastructure is fully configured and ready to use.
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={onNewDeployment}
            size="large"
          >
            New Deployment
          </Button>
        </Box>
      )}
    </Paper>
  );
};

export default CompletionPage;