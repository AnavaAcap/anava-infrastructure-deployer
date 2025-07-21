import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  TextField,
  Stack,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
} from '@mui/material';
import { ArrowBack, RocketLaunch } from '@mui/icons-material';
import { GCPProject, DeploymentConfig } from '../../types';

interface ConfigurationPageProps {
  project: GCPProject;
  onComplete: (config: DeploymentConfig) => void;
  onBack: () => void;
}

const ConfigurationPage: React.FC<ConfigurationPageProps> = ({ project, onComplete, onBack }) => {
  const [namePrefix, setNamePrefix] = useState('anava-iot');
  const [region, setRegion] = useState('us-central1');
  const [firebaseSetup, setFirebaseSetup] = useState<'new' | 'existing'>('new');
  const [firebaseApiKey, setFirebaseApiKey] = useState('');
  const [corsOrigins, setCorsOrigins] = useState('');

  const handleDeploy = () => {
    const config: DeploymentConfig = {
      projectId: project.projectId,
      region: region,
      namePrefix,
      corsOrigins: corsOrigins.split('\n').filter(origin => origin.trim()),
      apiKeyRestrictions: corsOrigins.split('\n').filter(origin => origin.trim()),
    };

    if (firebaseSetup === 'existing' && firebaseApiKey) {
      config.firebaseApiKey = firebaseApiKey;
    }

    onComplete(config);
  };

  return (
    <Paper elevation={3} sx={{ p: 6 }}>
      <Typography variant="h4" component="h2" gutterBottom>
        Deployment Configuration
      </Typography>
      
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
        
        <FormControl fullWidth>
          <InputLabel>Region</InputLabel>
          <Select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            label="Region"
          >
            <MenuItem value="us-central1">us-central1</MenuItem>
            <MenuItem value="us-east1">us-east1</MenuItem>
            <MenuItem value="us-west1">us-west1</MenuItem>
            <MenuItem value="europe-west1">europe-west1</MenuItem>
            <MenuItem value="asia-northeast1">asia-northeast1</MenuItem>
          </Select>
        </FormControl>
        
        <Divider />
        
        <Box>
          <Typography variant="h6" gutterBottom>
            Firebase Setup
          </Typography>
          
          <RadioGroup
            value={firebaseSetup}
            onChange={(e) => setFirebaseSetup(e.target.value as 'new' | 'existing')}
          >
            <FormControlLabel
              value="new"
              control={<Radio />}
              label="Create new Firebase Web App"
            />
            <FormControlLabel
              value="existing"
              control={<Radio />}
              label="Use existing (paste API key)"
            />
          </RadioGroup>
          
          {firebaseSetup === 'existing' && (
            <TextField
              label="Firebase API Key"
              value={firebaseApiKey}
              onChange={(e) => setFirebaseApiKey(e.target.value)}
              fullWidth
              sx={{ mt: 2 }}
              placeholder="AIzaSy..."
            />
          )}
        </Box>
        
        <TextField
          label="CORS Origins (one per line)"
          value={corsOrigins}
          onChange={(e) => setCorsOrigins(e.target.value)}
          multiline
          rows={4}
          fullWidth
          placeholder="https://example.com&#10;https://app.example.com"
          helperText="Allowed origins for API access"
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
          disabled={!namePrefix || (firebaseSetup === 'existing' && !firebaseApiKey)}
          size="large"
        >
          Deploy
        </Button>
      </Stack>
    </Paper>
  );
};

export default ConfigurationPage;