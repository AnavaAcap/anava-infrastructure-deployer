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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  ListItemIcon,
} from '@mui/material';
import {
  CheckCircle,
  ContentCopy,
  Visibility,
  VisibilityOff,
  Add,
  Download,
  ArrowBack,
  PlayCircle,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { DeploymentResult } from '../../types';
import TopBar from '../components/TopBar';
import PostDeploymentChecklist from '../components/PostDeploymentChecklist';

interface CompletionPageProps {
  result: DeploymentResult;
  onNewDeployment: () => void;
  onBack?: () => void;
  onLogout?: () => void;
}

const CompletionPage: React.FC<CompletionPageProps> = ({ result, onNewDeployment, onBack, onLogout }) => {
  const [showApiKey, setShowApiKey] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [validationOpen, setValidationOpen] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);

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

  const steps = ['Deployment Complete', 'Firebase Setup', 'Ready to Export'];

  const handleChecklistComplete = () => {
    setActiveStep(2); // Move to final step
  };

  const handleValidate = async () => {
    if (!result.apiGatewayUrl || !result.apiKey || !result.firebaseConfig?.apiKey) {
      alert('Missing required configuration. Please ensure Firebase API key is available.');
      return;
    }

    setValidating(true);
    setValidationResult(null);
    setValidationOpen(true);

    try {
      const validationResult = await window.electronAPI!.validateDeployment({
        apiGatewayUrl: result.apiGatewayUrl,
        apiKey: result.apiKey,
        firebaseApiKey: result.firebaseConfig.apiKey
      });

      setValidationResult(validationResult);
    } catch (error: any) {
      setValidationResult({
        success: false,
        steps: [],
        error: error.message || 'Validation failed'
      });
    } finally {
      setValidating(false);
    }
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
            {!result.firebaseConfig.apiKey && (
              <ListItem>
                <Alert severity="warning" sx={{ width: '100%' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Firebase API Key Not Retrieved
                  </Typography>
                  <Typography variant="body2">
                    The Firebase API key could not be automatically retrieved. You'll need to:
                  </Typography>
                  <List dense sx={{ mt: 1 }}>
                    <ListItem>1. Go to the Firebase Console</ListItem>
                    <ListItem>2. Select your project</ListItem>
                    <ListItem>3. Go to Project Settings → General</ListItem>
                    <ListItem>4. Copy the Web API Key</ListItem>
                  </List>
                </Alert>
              </ListItem>
            )}
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
      
      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <Button
          variant="contained"
          size="large"
          onClick={() => setActiveStep(1)}
        >
          Continue to Firebase Setup
        </Button>
      </Box>
        </>
      )}

      {activeStep === 1 && (
        <>
          <PostDeploymentChecklist
            projectId={result.resources?.createServiceAccounts?.accounts ? 
              result.resources.createServiceAccounts.accounts['device-auth-sa']?.split('@')[1]?.split('.')[0] : 
              'unknown'
            }
            firebaseConfig={result.firebaseConfig}
            onComplete={handleChecklistComplete}
          />
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={() => setActiveStep(0)}
            >
              Back to Summary
            </Button>
          </Box>
        </>
      )}

      {activeStep === 2 && (
        <Box textAlign="center">
          <CheckCircle color="success" sx={{ fontSize: 64, mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Setup Complete! 🎉
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Your Anava Vision authentication infrastructure is fully configured and ready to use.
          </Typography>
          
          <Paper elevation={1} sx={{ p: 3, mb: 4, maxWidth: 600, mx: 'auto', textAlign: 'left' }}>
            <Typography variant="h6" gutterBottom>
              Configuration Details
            </Typography>
            <List dense>
              <ListItem>
                <ListItemText 
                  primary="API Gateway URL"
                  secondary={result.apiGatewayUrl}
                />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary="Firebase Project"
                  secondary={result.firebaseConfig?.projectId || 'N/A'}
                />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary="Authentication"
                  secondary="Email/Password enabled with admin user created"
                />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary="Storage"
                  secondary="Firebase Storage initialized"
                />
              </ListItem>
            </List>
          </Paper>
          
          <Typography variant="h6" gutterBottom>
            Next Steps for Camera Configuration
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Use the exported configuration file to set up your Anava cameras:
          </Typography>
          
          <Stack direction="row" spacing={2} justifyContent="center" sx={{ mb: 2 }}>
            <Button
              variant="contained"
              startIcon={<Download />}
              onClick={handleExportConfig}
              size="large"
            >
              Export Configuration
            </Button>
            <Button
              variant="outlined"
              startIcon={<Add />}
              onClick={onNewDeployment}
            >
              New Deployment
            </Button>
          </Stack>
          
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Button
              variant="outlined"
              color="success"
              startIcon={<PlayCircle />}
              onClick={handleValidate}
              disabled={!result.firebaseConfig?.apiKey}
            >
              Test Deployment
            </Button>
            {!result.firebaseConfig?.apiKey && (
              <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                Firebase API key required for testing
              </Typography>
            )}
          </Box>
        </Box>
      )}
      
      {/* Validation Dialog */}
      <Dialog
        open={validationOpen}
        onClose={() => !validating && setValidationOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={2}>
            <PlayCircle color="primary" />
            <Typography variant="h6">Testing Deployment</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {validating && !validationResult && (
            <Box textAlign="center" py={4}>
              <CircularProgress size={48} />
              <Typography variant="body1" sx={{ mt: 2 }}>
                Running authentication workflow test...
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                This simulates the complete camera authentication flow
              </Typography>
            </Box>
          )}
          
          {validationResult && (
            <>
              {validationResult.error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {validationResult.error}
                </Alert>
              )}
              
              <List>
                {validationResult.steps?.map((step: any, index: number) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      {step.success ? (
                        <CheckCircle color="success" />
                      ) : (
                        <ErrorIcon color="error" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={step.name}
                      secondary={
                        <>
                          <Typography variant="body2">{step.message}</Typography>
                          {step.details && (
                            <Typography variant="caption" component="div" sx={{ mt: 1, fontFamily: 'monospace' }}>
                              {Object.entries(step.details).map(([key, value]) => (
                                <div key={key}>{key}: {String(value)}</div>
                              ))}
                            </Typography>
                          )}
                        </>
                      }
                    />
                  </ListItem>
                ))}
              </List>
              
              {validationResult.success && validationResult.summary && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Deployment Validated Successfully!
                  </Typography>
                  <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                    {validationResult.summary}
                  </Typography>
                </Alert>
              )}
              
              {!validationResult.success && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  <Typography variant="subtitle2">
                    Validation Failed
                  </Typography>
                  <Typography variant="body2">
                    Please check the deployment configuration and ensure all services are properly configured.
                  </Typography>
                </Alert>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setValidationOpen(false)} 
            disabled={validating}
          >
            Close
          </Button>
          {!validating && !validationResult?.success && (
            <Button
              onClick={handleValidate}
              variant="contained"
              startIcon={<PlayCircle />}
            >
              Retry Test
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default CompletionPage;