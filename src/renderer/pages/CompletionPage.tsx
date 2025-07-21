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

interface CompletionPageProps {
  result: DeploymentResult;
  onNewDeployment: () => void;
}

const CompletionPage: React.FC<CompletionPageProps> = ({ result, onNewDeployment }) => {
  const [showApiKey, setShowApiKey] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleExportConfig = () => {
    const config = {
      apiGatewayUrl: result.apiGatewayUrl,
      apiKey: result.apiKey,
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

  return (
    <Paper elevation={3} sx={{ p: 6 }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 4 }}>
        <CheckCircle color="success" sx={{ fontSize: 48 }} />
        <Typography variant="h4" component="h2">
          Deployment Complete!
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
          startIcon={<Add />}
          onClick={onNewDeployment}
        >
          New Deployment
        </Button>
      </Stack>
    </Paper>
  );
};

export default CompletionPage;