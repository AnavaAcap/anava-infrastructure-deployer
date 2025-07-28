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
  RadioGroup,
  FormControlLabel,
  Radio,
  Alert,
} from '@mui/material';
import { ArrowBack, RocketLaunch } from '@mui/icons-material';
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
  const [aiMode, setAiMode] = useState<'vertex' | 'ai-studio'>('vertex');
  const [aiStudioApiKey, setAiStudioApiKey] = useState('');

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
      aiMode,
      aiStudioApiKey: aiMode === 'ai-studio' ? aiStudioApiKey : undefined,
    };

    onComplete(config);
  };

  return (
    <Paper elevation={3} sx={{ p: 6 }}>
      <TopBar 
        title="Deployment Configuration" 
        showLogout={!!onLogout}
        onLogout={onLogout}
      />
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Project: <strong>{project.displayName}</strong> ({project.projectId})
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
        
        <FormControl component="fieldset" sx={{ mt: 2 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
            AI Processing Mode
          </Typography>
          <RadioGroup value={aiMode} onChange={(e) => setAiMode(e.target.value as 'vertex' | 'ai-studio')}>
            <FormControlLabel 
              value="vertex" 
              control={<Radio />} 
              label={
                <Stack>
                  <Typography variant="body1">Vertex AI (via API Gateway)</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Production-ready infrastructure with full GCP integration
                  </Typography>
                </Stack>
              } 
            />
            <FormControlLabel 
              value="ai-studio" 
              control={<Radio />} 
              label={
                <Stack>
                  <Typography variant="body1">Google AI Studio</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Simple API key-based access to Gemini models
                  </Typography>
                </Stack>
              }
            />
          </RadioGroup>
        </FormControl>

        {aiMode === 'ai-studio' && (
          <>
            <Alert severity="info" sx={{ mt: 2 }}>
              We'll help you create a Google AI Studio API key during deployment. This provides direct access to Gemini models without complex infrastructure.
            </Alert>
            <TextField
              fullWidth
              label="Google AI Studio API Key (Optional)"
              variant="outlined"
              value={aiStudioApiKey}
              onChange={(e) => setAiStudioApiKey(e.target.value)}
              sx={{ mt: 2 }}
              helperText="Leave empty to create one during deployment"
              placeholder="Enter existing key or leave empty"
            />
          </>
        )}
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
          disabled={!namePrefix}
          size="large"
        >
          Deploy
        </Button>
      </Stack>
    </Paper>
  );
};

export default ConfigurationPage;