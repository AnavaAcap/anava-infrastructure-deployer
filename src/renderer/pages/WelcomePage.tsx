import React, { useState, useEffect } from 'react';
import { Box, Button, Typography, Paper, Stack, Chip } from '@mui/material';
import { Add, RestoreOutlined, Security, Cloud } from '@mui/icons-material';
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
}

const WelcomePage: React.FC<WelcomePageProps> = ({ onNewDeployment, onCheckExisting }) => {
  const [version, setVersion] = useState('0.8.0');

  useEffect(() => {
    // Get app version from main process
    window.electronAPI?.app?.getVersion().then((v: string) => {
      setVersion(v);
    }).catch(() => {
      // Fallback to default if not available
    });
  }, []);

  return (
    <GradientPaper elevation={3} sx={{ p: 6, textAlign: 'center' }}>
      <LogoSection>
        <img 
          src={anavaLogo} 
          alt="Anava Logo" 
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </LogoSection>
      
      <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
        Anava Vision
      </Typography>
      
      <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
        Enterprise-grade camera authentication infrastructure for Google Cloud Platform
      </Typography>
      
      <Stack direction="row" spacing={1} justifyContent="center" sx={{ mb: 4 }}>
        <Chip icon={<Security />} label="Secure" size="small" />
        <Chip icon={<Cloud />} label="Cloud-Native" size="small" />
        <Chip label={`v${version}`} size="small" color="primary" />
      </Stack>
      
      <Stack direction="column" spacing={2} alignItems="center">
        <Button
          variant="contained"
          size="large"
          startIcon={<Add />}
          onClick={onNewDeployment}
          sx={{ px: 6, py: 2, fontSize: '1.1rem' }}
        >
          Start Deployment
        </Button>
        
        <Button
          variant="text"
          size="small"
          startIcon={<RestoreOutlined />}
          onClick={onCheckExisting}
          sx={{ opacity: 0.7 }}
        >
          Resume Previous Deployment
        </Button>
      </Stack>
      
      <Box sx={{ mt: 6 }}>
        <Typography variant="body2" color="text.secondary">
          This tool will create and configure all necessary GCP resources for Anava's
          camera authentication system, including Cloud Functions, API Gateway,
          Firestore, and IAM configurations.
        </Typography>
      </Box>
    </GradientPaper>
  );
};

export default WelcomePage;