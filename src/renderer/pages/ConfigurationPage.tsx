import React, { useState } from 'react';
import {
  Button,
  Typography,
  Paper,
  TextField,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  IconButton,
  InputAdornment,
  Box,
} from '@mui/material';
import { ArrowBack, RocketLaunch, Visibility, VisibilityOff } from '@mui/icons-material';
import { GCPProject, DeploymentConfig } from '../../types';
import TopBar from '../components/TopBar';

interface ConfigurationPageProps {
  project: GCPProject;
  onComplete: (config: DeploymentConfig) => void;
  onBack: () => void;
  onLogout?: () => void;
}

const ConfigurationPage: React.FC<ConfigurationPageProps> = ({ project, onComplete, onBack, onLogout }) => {
  const [namePrefix, setNamePrefix] = useState('anava-iot');
  const [region, setRegion] = useState('us-central1');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [anavaKey, setAnavaKey] = useState('');
  const [customerId, setCustomerId] = useState('');

  const handleDeploy = () => {
    // Automatically configure CORS for Anava cameras
    const defaultCorsOrigins = [
      'https://*.axis.com',
      'https://localhost:*',
      'http://localhost:*'
    ];

    const config: DeploymentConfig = {
      projectId: project.projectId,
      region: region,
      namePrefix,
      corsOrigins: defaultCorsOrigins,
      apiKeyRestrictions: defaultCorsOrigins,
      aiMode: 'vertex', // Always use Vertex AI for production
      adminPassword,
      anavaKey,
      customerId,
    };

    onComplete(config);
  };

  return (
    <Paper elevation={3} sx={{ p: 6 }}>
      <TopBar 
        title="Vertex AI Infrastructure Setup" 
        showLogout={!!onLogout}
        onLogout={onLogout}
      />
      
      <Typography variant="h5" gutterBottom sx={{ mb: 2 }}>
        Upgrade to Production-Ready Infrastructure
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          <strong>You've been using AI Studio for testing - now it's time for production!</strong>
        </Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          During camera setup, you used Google AI Studio's simple API key for quick testing and validation. 
          That was perfect for getting started, but now we'll deploy enterprise-grade infrastructure with 
          Google Vertex AI for secure, scalable production use.
        </Typography>
      </Alert>
      
      <Paper elevation={0} sx={{ p: 3, mb: 4, bgcolor: 'background.default' }}>
        <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
          What You're Upgrading From AI Studio to Vertex AI:
        </Typography>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
            <Typography sx={{ mr: 1 }}>🔐</Typography>
            <Box>
              <Typography variant="subtitle2">Enterprise Security</Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>AI Studio:</strong> Single API key that can be leaked<br/>
                <strong>Vertex AI:</strong> IAM-based access control, VPC Service Controls, encrypted endpoints
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
            <Typography sx={{ mr: 1 }}>📈</Typography>
            <Box>
              <Typography variant="subtitle2">Unlimited Scale</Typography>
              <Typography variant="body2" color="text.secondary">
                Auto-scaling endpoints handle 10 to 10,000 cameras seamlessly vs. rate-limited public API
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
            <Typography sx={{ mr: 1 }}>🔄</Typography>
            <Box>
              <Typography variant="subtitle2">MLOps & Governance</Typography>
              <Typography variant="body2" color="text.secondary">
                Model versioning, A/B testing, and audit trails vs. no deployment management
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
            <Typography sx={{ mr: 1 }}>🔌</Typography>
            <Box>
              <Typography variant="subtitle2">Full GCP Integration</Typography>
              <Typography variant="body2" color="text.secondary">
                Native connection to Cloud Storage, BigQuery, Pub/Sub for complete workflows
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
            <Typography sx={{ mr: 1 }}>💰</Typography>
            <Box>
              <Typography variant="subtitle2">Cost Control</Typography>
              <Typography variant="body2" color="text.secondary">
                Granular billing per project/team with resource labeling vs. single API key billing
              </Typography>
            </Box>
          </Box>
        </Stack>
      </Paper>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Deploying to project: <strong>{project.displayName}</strong> ({project.projectId})
      </Typography>
      
      <Stack spacing={3}>
        <TextField
          label="Resource Prefix"
          value={namePrefix}
          onChange={(e) => setNamePrefix(e.target.value)}
          fullWidth
          helperText="Prefix for all created resources"
        />
        
        <FormControl fullWidth variant="outlined">
          <InputLabel id="region-select-label">Deployment Region</InputLabel>
          <Select
            labelId="region-select-label"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            label="Deployment Region"
            MenuProps={{
              PaperProps: {
                style: {
                  maxHeight: 400,
                },
              },
            }}
          >
            <MenuItem value="us-central1">us-central1 (Iowa)</MenuItem>
            <MenuItem value="us-east1">us-east1 (South Carolina)</MenuItem>
            <MenuItem value="us-east4">us-east4 (Northern Virginia)</MenuItem>
            <MenuItem value="us-east5">us-east5 (Columbus)</MenuItem>
            <MenuItem value="us-south1">us-south1 (Dallas)</MenuItem>
            <MenuItem value="us-west1">us-west1 (Oregon)</MenuItem>
            <MenuItem value="us-west2">us-west2 (Los Angeles)</MenuItem>
            <MenuItem value="us-west3">us-west3 (Salt Lake City)</MenuItem>
            <MenuItem value="us-west4">us-west4 (Las Vegas)</MenuItem>
            <MenuItem value="northamerica-northeast1">northamerica-northeast1 (Montreal)</MenuItem>
            <MenuItem value="northamerica-northeast2">northamerica-northeast2 (Toronto)</MenuItem>
            <MenuItem value="southamerica-east1">southamerica-east1 (São Paulo)</MenuItem>
            <MenuItem value="southamerica-west1">southamerica-west1 (Santiago)</MenuItem>
            <MenuItem value="europe-central2">europe-central2 (Warsaw)</MenuItem>
            <MenuItem value="europe-north1">europe-north1 (Finland)</MenuItem>
            <MenuItem value="europe-southwest1">europe-southwest1 (Madrid)</MenuItem>
            <MenuItem value="europe-west1">europe-west1 (Belgium)</MenuItem>
            <MenuItem value="europe-west2">europe-west2 (London)</MenuItem>
            <MenuItem value="europe-west3">europe-west3 (Frankfurt)</MenuItem>
            <MenuItem value="europe-west4">europe-west4 (Netherlands)</MenuItem>
            <MenuItem value="europe-west6">europe-west6 (Zurich)</MenuItem>
            <MenuItem value="europe-west8">europe-west8 (Milan)</MenuItem>
            <MenuItem value="europe-west9">europe-west9 (Paris)</MenuItem>
            <MenuItem value="europe-west10">europe-west10 (Berlin)</MenuItem>
            <MenuItem value="europe-west12">europe-west12 (Turin)</MenuItem>
            <MenuItem value="asia-east1">asia-east1 (Taiwan)</MenuItem>
            <MenuItem value="asia-east2">asia-east2 (Hong Kong)</MenuItem>
            <MenuItem value="asia-northeast1">asia-northeast1 (Tokyo)</MenuItem>
            <MenuItem value="asia-northeast2">asia-northeast2 (Osaka)</MenuItem>
            <MenuItem value="asia-northeast3">asia-northeast3 (Seoul)</MenuItem>
            <MenuItem value="asia-south1">asia-south1 (Mumbai)</MenuItem>
            <MenuItem value="asia-south2">asia-south2 (Delhi)</MenuItem>
            <MenuItem value="asia-southeast1">asia-southeast1 (Singapore)</MenuItem>
            <MenuItem value="asia-southeast2">asia-southeast2 (Jakarta)</MenuItem>
            <MenuItem value="australia-southeast1">australia-southeast1 (Sydney)</MenuItem>
            <MenuItem value="australia-southeast2">australia-southeast2 (Melbourne)</MenuItem>
            <MenuItem value="me-central1">me-central1 (Doha)</MenuItem>
            <MenuItem value="me-central2">me-central2 (Dammam)</MenuItem>
            <MenuItem value="me-west1">me-west1 (Tel Aviv)</MenuItem>
          </Select>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            Select the Google Cloud region where your resources will be deployed
          </Typography>
        </FormControl>
        
        <Paper elevation={0} sx={{ p: 2, mt: 3, mb: 2, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
          <Typography variant="subtitle2" gutterBottom>
            What will be deployed:
          </Typography>
          <Stack spacing={1} sx={{ mt: 1 }}>
            <Typography variant="body2">• API Gateway for secure, scalable access</Typography>
            <Typography variant="body2">• Cloud Functions for device authentication</Typography>
            <Typography variant="body2">• Workload Identity Federation for camera security</Typography>
            <Typography variant="body2">• Firebase Auth & Firestore for user management</Typography>
            <Typography variant="body2">• Cloud Storage for analytics data</Typography>
            <Typography variant="body2">• Vertex AI endpoints with auto-scaling</Typography>
          </Stack>
        </Paper>
        
        <TextField
          fullWidth
          label="Admin Password"
          type={showPassword ? 'text' : 'password'}
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
          required
          error={adminPassword.length > 0 && adminPassword.length < 6}
          helperText={
            adminPassword.length > 0 && adminPassword.length < 6
              ? 'Password must be at least 6 characters'
              : 'Password for the admin user account'
          }
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label="toggle password visibility"
                  onClick={() => setShowPassword(!showPassword)}
                  edge="end"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{ mt: 2 }}
        />
        
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mt: 3 }}>
          Anava Configuration
        </Typography>
        
        <TextField
          fullWidth
          label="Anava Key"
          value={anavaKey}
          onChange={(e) => setAnavaKey(e.target.value)}
          helperText="Your Anava license key (optional)"
          placeholder="Enter your Anava key"
        />
        
        <TextField
          fullWidth
          label="Customer ID"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          helperText="Your customer identifier (optional)"
          placeholder="Enter your customer ID"
        />
      </Stack>
      
      <Stack direction="row" spacing={2} justifyContent="space-between" sx={{ mt: 4 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBack />}
          onClick={onBack}
        >
          Previous
        </Button>
        
        <Button
          variant="contained"
          startIcon={<RocketLaunch />}
          onClick={handleDeploy}
          disabled={!namePrefix || !adminPassword || adminPassword.length < 6}
          size="large"
        >
          Deploy
        </Button>
      </Stack>
    </Paper>
  );
};

export default ConfigurationPage;