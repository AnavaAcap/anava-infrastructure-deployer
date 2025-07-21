import React from 'react';
import { Box, Button, Typography, Paper, Stack } from '@mui/material';
import { Add, RestoreOutlined } from '@mui/icons-material';

interface WelcomePageProps {
  onNewDeployment: () => void;
  onCheckExisting: () => void;
}

const WelcomePage: React.FC<WelcomePageProps> = ({ onNewDeployment, onCheckExisting }) => {
  return (
    <Paper elevation={3} sx={{ p: 6, textAlign: 'center' }}>
      <Typography variant="h3" component="h1" gutterBottom>
        Anava Infrastructure Deployer
      </Typography>
      
      <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
        Deploy camera authentication infrastructure to your GCP project in minutes.
      </Typography>
      
      <Typography variant="caption" color="text.secondary" sx={{ mb: 4, display: 'block' }}>
        Version 0.3.1
      </Typography>
      
      <Stack direction="row" spacing={3} justifyContent="center">
        <Button
          variant="outlined"
          size="large"
          startIcon={<RestoreOutlined />}
          onClick={onCheckExisting}
          sx={{ px: 4, py: 1.5 }}
        >
          Check Existing
        </Button>
        
        <Button
          variant="contained"
          size="large"
          startIcon={<Add />}
          onClick={onNewDeployment}
          sx={{ px: 4, py: 1.5 }}
        >
          New Deployment
        </Button>
      </Stack>
      
      <Box sx={{ mt: 6 }}>
        <Typography variant="body2" color="text.secondary">
          This tool will create and configure all necessary GCP resources for Anava's
          camera authentication system, including Cloud Functions, API Gateway,
          Firestore, and IAM configurations.
        </Typography>
      </Box>
    </Paper>
  );
};

export default WelcomePage;