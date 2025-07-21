import React from 'react';
import { Box, Button, Typography, Paper, Stack, Chip } from '@mui/material';
import { Add, RestoreOutlined, Security, Cloud, CameraAlt } from '@mui/icons-material';
import { styled } from '@mui/material/styles';

const GradientPaper = styled(Paper)(({ theme }) => ({
  background: 'linear-gradient(135deg, #FFFFFF 0%, #F5F5F5 100%)',
  borderTop: `4px solid ${theme.palette.primary.main}`,
}));

const LogoSection = styled(Box)(({ theme }) => ({
  width: 120,
  height: 120,
  margin: '0 auto',
  marginBottom: theme.spacing(3),
  background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.primary.light} 90%)`,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 4px 20px rgba(25, 118, 210, 0.3)',
}));

interface WelcomePageProps {
  onNewDeployment: () => void;
  onCheckExisting: () => void;
}

const WelcomePage: React.FC<WelcomePageProps> = ({ onNewDeployment, onCheckExisting }) => {
  return (
    <GradientPaper elevation={3} sx={{ p: 6, textAlign: 'center' }}>
      <LogoSection>
        <CameraAlt sx={{ fontSize: 60, color: 'white' }} />
      </LogoSection>
      
      <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
        Anava Infrastructure Deployer
      </Typography>
      
      <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
        Enterprise-grade camera authentication infrastructure for Google Cloud Platform
      </Typography>
      
      <Stack direction="row" spacing={1} justifyContent="center" sx={{ mb: 4 }}>
        <Chip icon={<Security />} label="Secure" size="small" />
        <Chip icon={<Cloud />} label="Cloud-Native" size="small" />
        <Chip label="v0.5.3" size="small" color="primary" />
      </Stack>
      
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
    </GradientPaper>
  );
};

export default WelcomePage;