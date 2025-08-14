import React, { useState, useEffect } from 'react';
import { Box, Button, Typography, Paper, Stack, Chip, Alert, Card, CardContent, Grid, Divider, CircularProgress, TextField, IconButton, InputAdornment, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Add, RestoreOutlined, Security, Cloud, Videocam, Key as KeyIcon, Rocket as RocketIcon, CheckCircle, Warning, Error as ErrorIcon, Visibility, VisibilityOff, Refresh as RefreshIcon, Settings as SettingsIcon } from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import anavaLogo from '../assets/anava-logo.png';

const GradientPaper = styled(Paper)(({ theme }) => ({
  background: 'linear-gradient(135deg, #FFFFFF 0%, #F5F5F5 100%)',
  borderTop: `4px solid ${theme.palette.primary.main}`,
}));

const LogoSection = styled(Box)(({ theme }) => ({
  width: 120,
  height: 120,
  margin: '0 auto',
  marginBottom: theme.spacing(3),
  borderRadius: '20px',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 4px 20px rgba(25, 118, 210, 0.2)',
  backgroundColor: '#FFFFFF',
  padding: theme.spacing(1),
}));

interface WelcomePageProps {
  onNewDeployment: () => void;
  onCheckExisting: () => void;
  onNavigate?: (view: string) => void;
}

const WelcomePage: React.FC<WelcomePageProps> = ({ onNewDeployment, onCheckExisting, onNavigate }) => {
  const [version, setVersion] = useState('0.8.0');
  const [licenseKey, setLicenseKey] = useState<string | null>(null);
  const [axisLicenseKey, setAxisLicenseKey] = useState<string | null>(null);
  const [licenseEmail, setLicenseEmail] = useState<string | null>(null);
  const [apiKeyStatus, setApiKeyStatus] = useState<'loading' | 'present' | 'missing' | 'invalid'>('loading');
  const [authStatus, setAuthStatus] = useState<any>(null);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [validatingKey, setValidatingKey] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  useEffect(() => {
    // Get app version from main process
    window.electronAPI?.app?.getVersion().then((v: string) => {
      setVersion(v);
    }).catch(() => {
      // Fallback to default if not available
    });

    // Load all credentials and status
    loadCredentials();
  }, []);
  
  const loadCredentials = async () => {
    try {
      // Load auth status
      const status = await window.electronAPI?.getConfigValue('authStatus');
      setAuthStatus(status);
      
      // Load license keys
      const anavaKey = await window.electronAPI?.getConfigValue('licenseKey');
      const axisKey = await window.electronAPI?.getConfigValue('axisLicenseKey');
      const email = await window.electronAPI?.getConfigValue('licenseEmail');
      
      if (anavaKey) {
        setLicenseKey(anavaKey);
        setLicenseEmail(email);
      }
      if (axisKey) {
        setAxisLicenseKey(axisKey);
      }
      
      // Check API key status
      const savedApiKey = await window.electronAPI?.getConfigValue('geminiApiKey');
      if (savedApiKey) {
        setApiKey(savedApiKey);
        // Validate the saved key
        await validateApiKey(savedApiKey);
      } else {
        setApiKeyStatus('missing');
        // Try to generate one
        await checkAuthAndGenerateApiKey();
        // Re-check after generation attempt
        const newApiKey = await window.electronAPI?.getConfigValue('geminiApiKey');
        if (newApiKey) {
          setApiKey(newApiKey);
          await validateApiKey(newApiKey);
        }
      }
    } catch (error) {
      console.error('Failed to load credentials:', error);
      setApiKeyStatus('missing');
    }
  };
  
  const checkAuthAndGenerateApiKey = async () => {
    try {
      // Check if we already have an API key
      const existingApiKey = await window.electronAPI?.getConfigValue('geminiApiKey');
      if (existingApiKey) {
        console.log('API key already exists');
        return;
      }
      
      // Check if user is authenticated with Google
      const authCheck = await window.electronAPI?.auth?.check();
      if (!authCheck?.authenticated) {
        console.log('User not authenticated, prompting for Google login...');
        // Prompt for Google login
        const loginResult = await window.electronAPI?.auth?.login();
        if (!loginResult?.success) {
          console.log('Google login cancelled or failed');
          return;
        }
        console.log('Google login successful');
      }
      
      // Now generate the API key
      console.log('Generating AI Studio API key...');
      const apiKeyResult = await window.electronAPI?.magical?.generateApiKey();
      if (apiKeyResult?.success && apiKeyResult.apiKey) {
        console.log('AI Studio API key generated successfully');
        await window.electronAPI?.setConfigValue('geminiApiKey', apiKeyResult.apiKey);
        if (apiKeyResult.projectId) {
          await window.electronAPI?.setConfigValue('aiStudioProjectId', apiKeyResult.projectId);
        }
      } else if (apiKeyResult?.needsManual) {
        console.log('Manual API key creation needed');
        // The AI Studio console will open for manual creation
      } else {
        console.warn('API key generation failed:', apiKeyResult?.error);
      }
    } catch (error) {
      console.error('Error in auth/API key generation:', error);
    }
  };

  const loadLicenseKey = async () => {
    try {
      const result = await window.electronAPI?.license?.getAssignedKey();
      if (result?.success && result.key) {
        setLicenseKey(result.key);
        setLicenseEmail(result.email || null);
      }
    } catch (error) {
      console.error('Failed to load license key:', error);
    }
  };

  const validateApiKey = async (key: string) => {
    if (!key) {
      setApiKeyStatus('missing');
      return;
    }
    
    setValidatingKey(true);
    setApiKeyError(null);
    
    try {
      const result = await window.electronAPI?.invokeIPC('vision-architect-validate-key', key);
      if (result?.valid) {
        setApiKeyStatus('present');
        setApiKeyError(null);
        // Save the valid key
        await window.electronAPI?.setConfigValue('geminiApiKey', key);
      } else {
        setApiKeyStatus('invalid');
        setApiKeyError(result?.error || 'Invalid API key');
      }
    } catch (error: any) {
      console.error('Failed to validate API key:', error);
      setApiKeyStatus('invalid');
      setApiKeyError(error.message || 'Failed to validate API key');
    } finally {
      setValidatingKey(false);
    }
  };

  const handleApiKeySubmit = async () => {
    await validateApiKey(apiKey);
    if (apiKeyStatus === 'present') {
      setShowApiKeyDialog(false);
    }
  };

  const generateNewApiKey = async () => {
    // Open AI Studio to generate a new key
    window.open('https://aistudio.google.com/apikey', '_blank');
  };

  const getApiKeyStatusColor = () => {
    switch (apiKeyStatus) {
      case 'present': return 'success';
      case 'invalid': return 'error';
      case 'missing': return 'warning';
      default: return 'default';
    }
  };

  const getApiKeyStatusIcon = () => {
    if (validatingKey || apiKeyStatus === 'loading') {
      return <CircularProgress size={24} />;
    }
    switch (apiKeyStatus) {
      case 'present': return <CheckCircle color="success" />;
      case 'invalid': return <ErrorIcon color="error" />;
      case 'missing': return <Warning color="warning" />;
      default: return <CircularProgress size={24} />;
    }
  };

  const getApiKeyStatusText = () => {
    if (validatingKey) return 'Validating...';
    switch (apiKeyStatus) {
      case 'loading': return 'Checking...';
      case 'present': return 'Valid & Configured';
      case 'invalid': return 'Invalid Key';
      case 'missing': return 'Not Configured';
      default: return 'Unknown';
    }
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <GradientPaper elevation={3} sx={{ p: 6, maxWidth: 1200, width: '100%', mx: 'auto' }}>
        <LogoSection>
        <img 
          src={anavaLogo} 
          alt="Anava Logo" 
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </LogoSection>
      
      <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 700, textAlign: 'center' }}>
        Anava Vision
      </Typography>
      
      <Typography variant="h6" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
        AI-Powered Camera Analytics Made Simple
      </Typography>
      
      <Stack direction="row" spacing={1} justifyContent="center" sx={{ mb: 4 }}>
        <Chip icon={<Security />} label="Secure" size="small" />
        <Chip icon={<Cloud />} label="Cloud-Native" size="small" />
        <Chip label={`v${version}`} size="small" color="primary" />
      </Stack>

      {/* Status Cards */}
      <Grid container spacing={2} sx={{ mb: 4, maxWidth: 800, mx: 'auto', justifyContent: 'center' }}>
        {/* API Key Status */}
        <Grid item xs={12} md={6}>
          <Card sx={{ 
            backgroundColor: apiKeyStatus === 'present' ? 'success.50' : 
                           apiKeyStatus === 'invalid' ? 'error.50' : 'warning.50',
            borderLeft: `4px solid ${apiKeyStatus === 'present' ? '#4caf50' : 
                                    apiKeyStatus === 'invalid' ? '#f44336' : '#ff9800'}`,
            cursor: 'pointer'
          }} onClick={() => setShowApiKeyDialog(true)}>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                {getApiKeyStatusIcon()}
                <Box flex={1}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Gemini API Key
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {getApiKeyStatusText()}
                  </Typography>
                  {apiKeyStatus === 'invalid' && apiKeyError && (
                    <Typography variant="caption" color="error.main">
                      {apiKeyError}
                    </Typography>
                  )}
                  {apiKeyStatus === 'missing' && (
                    <Typography variant="caption" color="warning.main">
                      Click to configure
                    </Typography>
                  )}
                </Box>
                <IconButton size="small">
                  <SettingsIcon fontSize="small" />
                </IconButton>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        
        {/* License Key Status */}
        <Grid item xs={12} md={6}>
          <Card sx={{ 
            backgroundColor: (licenseKey || axisLicenseKey) ? 'success.50' : 'warning.50',
            borderLeft: `4px solid ${(licenseKey || axisLicenseKey) ? '#4caf50' : '#ff9800'}`
          }}>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                {(licenseKey || axisLicenseKey) ? (
                  <CheckCircle color="success" />
                ) : (
                  <Warning color="warning" />
                )}
                <Box flex={1}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Axis Camera License
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {axisLicenseKey ? 'Trial License Ready' : 
                     licenseKey ? 'License Available' : 'Not Configured'}
                  </Typography>
                  {axisLicenseKey && (
                    <Typography variant="caption" fontFamily="monospace" sx={{ 
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {axisLicenseKey}
                    </Typography>
                  )}
                  {!licenseKey && !axisLicenseKey && (
                    <Typography variant="caption" color="warning.main">
                      Will be fetched during deployment
                    </Typography>
                  )}
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Warning Alert if items missing */}
      {authStatus?.missingItems?.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3, maxWidth: 600, mx: 'auto' }}>
          <Typography variant="body2">
            Some items could not be automatically configured:
          </Typography>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
            {authStatus.missingItems.map((item: string) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <Typography variant="body2" sx={{ mt: 1 }}>
            These will be configured during the deployment process.
          </Typography>
        </Alert>
      )}

      {licenseEmail && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mb: 2 }}>
          Authenticated as: {licenseEmail}
        </Typography>
      )}
      
      <Box sx={{ maxWidth: 800, mx: 'auto', mb: 4 }}>
        <Grid container spacing={3} justifyContent="center">
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%', cursor: 'pointer', transition: 'all 0.3s', '&:hover': { transform: 'translateY(-4px)', boxShadow: 3 } }}
                onClick={() => onNavigate?.('camera-setup')}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Videocam sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h5" gutterBottom>
                Setup First Camera
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Get your camera running with AI analytics in under 10 minutes
              </Typography>
              <Button variant="contained" sx={{ mt: 2 }} startIcon={<RocketIcon />}>
                Quick Start
              </Button>
            </CardContent>
          </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%', cursor: 'pointer', transition: 'all 0.3s', '&:hover': { transform: 'translateY(-4px)', boxShadow: 3 } }}
                onClick={onNewDeployment}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Cloud sx={{ fontSize: 48, color: 'grey.600', mb: 2 }} />
              <Typography variant="h5" gutterBottom>
                Advanced Deployment
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Full GCP infrastructure setup with Vertex AI integration
              </Typography>
              <Button variant="outlined" sx={{ mt: 2 }} startIcon={<Add />}>
                Advanced Setup
              </Button>
            </CardContent>
          </Card>
          </Grid>
        </Grid>
      </Box>

      <Divider sx={{ mb: 3, maxWidth: 800, mx: 'auto' }} />
      
      <Box sx={{ mt: 3, maxWidth: 800, mx: 'auto', textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary" paragraph>
          New to Anava Vision? Start with <strong>Camera Setup</strong> to see AI analytics in action immediately.
        </Typography>
        
        <Button
          variant="text"
          size="small"
          startIcon={<RestoreOutlined />}
          onClick={onCheckExisting}
          sx={{ opacity: 0.7 }}
        >
          Resume Previous Deployment
        </Button>
      </Box>
    </GradientPaper>
    
    {/* API Key Configuration Dialog */}
    <Dialog open={showApiKeyDialog} onClose={() => setShowApiKeyDialog(false)} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <KeyIcon />
          <Typography variant="h6">Configure Gemini API Key</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 2 }}>
          <TextField
            fullWidth
            label="Gemini API Key"
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            error={apiKeyStatus === 'invalid'}
            helperText={apiKeyError || 'Enter your Gemini API key from AI Studio'}
            disabled={validatingKey}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowApiKey(!showApiKey)}
                    edge="end"
                  >
                    {showApiKey ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          
          {apiKeyStatus === 'invalid' && (
            <Alert severity="error">
              <Typography variant="body2">
                This API key is invalid or has been revoked.
              </Typography>
            </Alert>
          )}
          
          {apiKeyStatus === 'present' && (
            <Alert severity="success">
              <Typography variant="body2">
                API key is valid and working!
              </Typography>
            </Alert>
          )}
          
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Don't have an API key?
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={generateNewApiKey}
              startIcon={<Add />}
            >
              Generate New API Key in AI Studio
            </Button>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowApiKeyDialog(false)}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleApiKeySubmit}
          disabled={!apiKey || validatingKey}
          startIcon={validatingKey ? <CircularProgress size={20} /> : <CheckCircle />}
        >
          {validatingKey ? 'Validating...' : 'Save & Validate'}
        </Button>
      </DialogActions>
    </Dialog>
    </Box>
  );
};

export default WelcomePage;