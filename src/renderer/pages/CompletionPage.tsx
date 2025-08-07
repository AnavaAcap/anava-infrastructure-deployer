import React, { useState, useEffect } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  ListItemIcon,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  CheckCircle,
  ContentCopy,
  Visibility,
  VisibilityOff,
  Add,
  Download,
  Error as ErrorIcon,
  Science as ScienceIcon,
  Person,
  Videocam as VideocamIcon,
  Send as SendIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { DeploymentResult } from '../../types';
import TopBar from '../components/TopBar';
import { TestConfigurationDialog } from '../components/TestConfigurationDialog';

interface CompletionPageProps {
  result: DeploymentResult;
  onNewDeployment: () => void;
  onBack?: () => void;
  onLogout?: () => void;
}

const CompletionPage: React.FC<CompletionPageProps> = ({ result, onNewDeployment, onBack, onLogout }) => {
  const [showApiKey, setShowApiKey] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userCreated, setUserCreated] = useState(false);
  
  // Camera-related state
  const [cameras, setCameras] = useState<any[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [scanningCameras, setScanningCameras] = useState(false);
  const [pushingSettings, setPushingSettings] = useState(false);
  const [pushResult, setPushResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    // Save the deployment for future reference
    saveDeployment();
  }, []);

  const saveDeployment = async () => {
    if (result.success && result.apiGatewayUrl && result.firebaseConfig) {
      try {
        const projectId = result.firebaseConfig.projectId;
        const savedDeployments = await (window.electronAPI as any).getConfigValue?.('deployments') || {};
        
        // Save the deployment with all necessary information
        savedDeployments[projectId] = {
          ...result,
          timestamp: new Date().toISOString(),
          region: result.resources?.region || 'us-central1'
        };
        
        await (window.electronAPI as any).setConfigValue?.('deployments', savedDeployments);
      } catch (error) {
        console.error('Failed to save deployment:', error);
      }
    }
  };

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleExportConfig = async () => {
    try {
      const config = {
        projectId: result.resources?.createServiceAccounts?.accounts ? 
          result.resources.createServiceAccounts.accounts['device-auth-sa']?.split('@')[1]?.split('.')[0] : 
          'unknown',
        apiGatewayUrl: result.apiGatewayUrl,
        apiKey: result.apiKey,
        firebaseConfig: result.firebaseConfig,
        adminEmail: result.adminEmail,
        aiMode: result.aiMode,
        aiStudioApiKey: result.aiStudioApiKey,
        timestamp: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `anava-config-${config.projectId}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Failed to export config:', err);
    }
  };

  const handleCreateUser = async () => {
    if (!userEmail || !userPassword || !result.firebaseConfig?.apiKey) {
      setError('Missing required information');
      return;
    }

    setCreatingUser(true);
    setError(null);

    try {
      const projectId = result.resources?.createServiceAccounts?.accounts ? 
        result.resources.createServiceAccounts.accounts['device-auth-sa']?.split('@')[1]?.split('.')[0] : 
        'unknown';

      const response = await window.electronAPI.createFirebaseUser({
        projectId,
        email: userEmail,
        password: userPassword,
        apiKey: result.firebaseConfig.apiKey
      });

      if (response.success) {
        setUserCreated(true);
        setCreateUserOpen(false);
        setUserEmail('');
        setUserPassword('');
      } else {
        setError(response.error || 'Failed to create user');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    } finally {
      setCreatingUser(false);
    }
  };

  const loadConfiguredCameras = async () => {
    setScanningCameras(true);
    setPushResult(null);
    try {
      // Load cameras that have been configured previously
      const configuredCameras = await (window.electronAPI as any).getConfigValue?.('configuredCameras') || [];
      setCameras(configuredCameras);
      if (configuredCameras.length > 0 && !selectedCamera) {
        setSelectedCamera(configuredCameras[0].id || `${configuredCameras[0].ip}_${configuredCameras[0].model}`);
      }
    } catch (err: any) {
      console.error('Failed to load configured cameras:', err);
    } finally {
      setScanningCameras(false);
    }
  };

  const handlePushSettings = async () => {
    if (!selectedCamera) return;

    const camera = cameras.find(c => (c.id || `${c.ip}_${c.model}`) === selectedCamera);
    if (!camera) return;

    setPushingSettings(true);
    setPushResult(null);

    try {
      // Get the GCS bucket name
      const bucketName = result.gcsBucketName || `${result.firebaseConfig?.projectId || 'unknown'}-anava-analytics`;
      
      // Prepare the systemConfig payload matching the expected format
      const systemConfig = {
        firebase: result.firebaseConfig ? {
          apiKey: result.firebaseConfig.apiKey,
          authDomain: result.firebaseConfig.authDomain || `${result.firebaseConfig.projectId}.firebaseapp.com`,
          projectId: result.firebaseConfig.projectId,
          storageBucket: result.firebaseConfig.storageBucket || `${result.firebaseConfig.projectId}.appspot.com`,
          messagingSenderId: result.firebaseConfig.messagingSenderId || '',
          appId: result.firebaseConfig.appId || '',
          databaseId: '(default)'
        } : {},
        gemini: result.aiMode === 'ai-studio' ? {
          apiKey: result.aiStudioApiKey || '',
          vertexApiGatewayUrl: '',
          vertexApiGatewayKey: '',
          vertexGcpProjectId: result.firebaseConfig?.projectId || '',
          vertexGcpRegion: 'us-central1',
          vertexGcsBucketName: bucketName
        } : {
          apiKey: '',
          vertexApiGatewayUrl: result.apiGatewayUrl || '',
          vertexApiGatewayKey: result.apiKey || '',
          vertexGcpProjectId: result.firebaseConfig?.projectId || '',
          vertexGcpRegion: 'us-central1',
          vertexGcsBucketName: bucketName
        },
        axis: camera.hasSpeaker && camera.speaker ? {
          speakerIp: camera.speaker.ip || '',
          speakerUser: camera.speaker.username || '',
          speakerPass: camera.speaker.password || ''
        } : undefined,
        anavaKey: result.anavaKey || '',
        customerId: result.customerId || ''
      };

      // Use the correct IPC handler
      const response = await (window.electronAPI as any).pushSystemConfig({
        cameraIp: camera.ip,
        username: camera.username || 'anava',
        password: camera.password || 'baton',
        systemConfig
      });

      if (response.success) {
        setPushResult({ success: true, message: 'Configuration pushed successfully to camera!' });
      } else {
        setPushResult({ success: false, message: response.error || 'Failed to push configuration' });
      }
    } catch (err: any) {
      setPushResult({ success: false, message: err.message || 'Failed to push configuration' });
    } finally {
      setPushingSettings(false);
    }
  };

  // Load configured cameras when component mounts
  useEffect(() => {
    saveDeployment();
    loadConfiguredCameras();
  }, []);

  return (
    <Paper elevation={3} sx={{ p: 6 }}>
      <TopBar 
        title="Deployment Complete" 
        showLogout={!!onLogout}
        onLogout={onLogout}
      />
      
      <Box textAlign="center" sx={{ mb: 4 }}>
        <CheckCircle color="success" sx={{ fontSize: 64, mb: 2 }} />
        <Typography variant="h4" gutterBottom>
          {result.aiMode === 'ai-studio' 
            ? 'AI Studio Setup Complete! 🎉'
            : 'Infrastructure Deployed Successfully! 🎉'
          }
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {result.aiMode === 'ai-studio'
            ? 'Your AI Studio configuration is ready. You can now use the Gemini API directly.'
            : 'Your Anava Vision authentication infrastructure is ready. Authentication has been automatically configured.'
          }
        </Typography>
      </Box>

      <Paper elevation={1} sx={{ p: 3, mb: 4, backgroundColor: 'background.default' }}>
        <Typography variant="h6" gutterBottom>
          Deployment Summary
        </Typography>
        
        <List>
          {result.aiMode === 'ai-studio' ? (
            <>
              <ListItem>
                <ListItemText
                  primary="AI Mode"
                  secondary="Google AI Studio - Direct API access to Gemini models"
                />
              </ListItem>
              
              <Divider />
              {result.aiStudioApiKey ? (
                <ListItem>
                  <ListItemText
                    primary="AI Studio API Key"
                    secondary={
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {showApiKey ? result.aiStudioApiKey : '••••••••-••••-••••'}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => setShowApiKey(!showApiKey)}
                        >
                          {showApiKey ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                        <Tooltip title={copied === 'ai-key' ? 'Copied!' : 'Copy'}>
                          <IconButton
                            size="small"
                            onClick={() => handleCopy(result.aiStudioApiKey!, 'ai-key')}
                          >
                            <ContentCopy fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    }
                  />
                </ListItem>
              ) : (
                <ListItem>
                  <ListItemText
                    primary="AI Studio API Key"
                    secondary={
                      <Stack spacing={1}>
                        <Typography variant="body2" color="text.secondary">
                          Please create an API key manually at:
                        </Typography>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontFamily: 'monospace',
                            color: 'primary.main',
                            cursor: 'pointer',
                            '&:hover': { textDecoration: 'underline' }
                          }}
                          onClick={() => window.electronAPI.shell.openExternal('https://aistudio.google.com/app/apikey')}
                        >
                          https://aistudio.google.com/app/apikey
                        </Typography>
                      </Stack>
                    }
                  />
                </ListItem>
              )}
            </>
          ) : (
            <>
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
            </>
          )}
          
          {result.firebaseConfig && (
            <>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="Firebase Project"
                  secondary={result.firebaseConfig.projectId}
                />
              </ListItem>
              
              <Divider />
              <ListItem>
                <ListItemText
                  primary="Authentication Status"
                  secondary="✅ Email/Password authentication enabled"
                />
              </ListItem>
            </>
          )}
        </List>
      </Paper>

      {/* Camera Configuration Section */}
      {(result.apiGatewayUrl || result.aiStudioApiKey) && (
        <Paper elevation={1} sx={{ p: 3, mb: 4, backgroundColor: 'background.default' }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <VideocamIcon />
            Push Configuration to Cameras
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select a camera below and push the Vertex AI configuration directly to it. This will configure the camera
            to use your newly deployed infrastructure.
          </Typography>
          
          <Box sx={{ mt: 2 }}>
            <Stack direction="row" spacing={2} alignItems="flex-end">
              <FormControl fullWidth sx={{ flex: 1 }}>
                <InputLabel>Select Camera</InputLabel>
                <Select
                  value={selectedCamera}
                  onChange={(e) => setSelectedCamera(e.target.value)}
                  disabled={scanningCameras || cameras.length === 0}
                  label="Select Camera"
                >
                  {cameras.map((camera) => {
                    const cameraId = camera.id || `${camera.ip}_${camera.model}`;
                    return (
                      <MenuItem key={cameraId} value={cameraId}>
                        {camera.name || camera.model} - {camera.ip}
                        {camera.hasSpeaker && ' (with speaker)'}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
              
              <Button
                variant="outlined"
                startIcon={scanningCameras ? <CircularProgress size={20} /> : <RefreshIcon />}
                onClick={loadConfiguredCameras}
                disabled={scanningCameras}
              >
                {scanningCameras ? 'Loading...' : 'Refresh'}
              </Button>
              
              <Button
                variant="contained"
                startIcon={pushingSettings ? <CircularProgress size={20} /> : <SendIcon />}
                onClick={handlePushSettings}
                disabled={!selectedCamera || pushingSettings}
              >
                {pushingSettings ? 'Pushing...' : 'Push to Camera'}
              </Button>
            </Stack>
            
            {cameras.length === 0 && !scanningCameras && (
              <Alert severity="info" sx={{ mt: 2 }}>
                No cameras configured yet. Please set up cameras first using the Camera Setup page.
              </Alert>
            )}
            
            {pushResult && (
              <Alert severity={pushResult.success ? 'success' : 'error'} sx={{ mt: 2 }}>
                {pushResult.message}
              </Alert>
            )}
          </Box>
        </Paper>
      )}

      {result.aiMode !== 'ai-studio' && (
        <>
          {result.adminEmail && (
            <Alert severity="success" sx={{ mb: 3 }}>
              <Typography variant="subtitle2">Admin User Created</Typography>
              <Typography variant="body2">
                Admin email: {result.adminEmail}
              </Typography>
            </Alert>
          )}

          {!result.adminEmail && !userCreated && (
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="subtitle2">Create Admin User</Typography>
              <Typography variant="body2">
                You should create an admin user for secure access to Firestore.
              </Typography>
            </Alert>
          )}
        </>
      )}

      <Box sx={{ mt: 4 }}>
        <Stack direction="row" spacing={2} justifyContent="center">
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={handleExportConfig}
          >
            Export Configuration
          </Button>
          
          {result.aiMode !== 'ai-studio' && (
            <Button
              variant="outlined"
              startIcon={<ScienceIcon />}
              onClick={() => setTestDialogOpen(true)}
            >
              Test Auth Flow
            </Button>
          )}
          
          {result.aiMode !== 'ai-studio' && !result.adminEmail && !userCreated && (
            <Button
              variant="outlined"
              startIcon={<Person />}
              onClick={() => setCreateUserOpen(true)}
            >
              Create Admin User
            </Button>
          )}
          
          <Button
            variant="contained"
            size="large"
            onClick={onNewDeployment}
          >
            New Deployment
          </Button>
        </Stack>
      </Box>

      {/* Create User Dialog */}
      <Dialog open={createUserOpen} onClose={() => setCreateUserOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Admin User</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
            <TextField
              label="Email"
              type="email"
              fullWidth
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              disabled={creatingUser}
            />
            <TextField
              label="Password"
              type="password"
              fullWidth
              value={userPassword}
              onChange={(e) => setUserPassword(e.target.value)}
              disabled={creatingUser}
              helperText="At least 6 characters"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateUserOpen(false)} disabled={creatingUser}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateUser} 
            variant="contained"
            disabled={creatingUser || !userEmail || !userPassword}
            startIcon={creatingUser && <CircularProgress size={20} />}
          >
            Create User
          </Button>
        </DialogActions>
      </Dialog>

      {/* Test Configuration Dialog */}
      <TestConfigurationDialog
        open={testDialogOpen}
        onClose={() => setTestDialogOpen(false)}
        deploymentConfig={{
          apiGatewayUrl: result.apiGatewayUrl,
          apiKey: result.apiKey,
          firebaseConfig: result.firebaseConfig,
          aiMode: result.aiMode,
          aiStudioApiKey: result.aiStudioApiKey
        }}
      />
    </Paper>
  );
};

export default CompletionPage;