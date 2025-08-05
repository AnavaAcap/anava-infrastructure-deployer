import React, { useState, useEffect } from 'react';
import { Box, Button, Typography, Paper, Stack, Chip, Alert, Card, CardContent, Grid, Divider } from '@mui/material';
import { Add, RestoreOutlined, Security, Cloud, Videocam, Key as KeyIcon, Rocket as RocketIcon } from '@mui/icons-material';
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
  const [licenseEmail, setLicenseEmail] = useState<string | null>(null);

  useEffect(() => {
    // Get app version from main process
    window.electronAPI?.app?.getVersion().then((v: string) => {
      setVersion(v);
    }).catch(() => {
      // Fallback to default if not available
    });

    // Get license key if assigned
    loadLicenseKey();
  }, []);

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
        AI-Powered Camera Analytics Made Simple
      </Typography>
      
      <Stack direction="row" spacing={1} justifyContent="center" sx={{ mb: 4 }}>
        <Chip icon={<Security />} label="Secure" size="small" />
        <Chip icon={<Cloud />} label="Cloud-Native" size="small" />
        <Chip label={`v${version}`} size="small" color="primary" />
      </Stack>

      {licenseKey && (
        <Card sx={{ mb: 4, maxWidth: 600, mx: 'auto', backgroundColor: 'primary.50' }}>
          <CardContent>
            <Stack direction="row" spacing={2} alignItems="center" justifyContent="center">
              <KeyIcon color="primary" />
              <Box textAlign="left">
                <Typography variant="subtitle2" color="text.secondary">
                  Your Trial License Key
                </Typography>
                <Typography variant="h6" fontFamily="monospace">
                  {licenseKey}
                </Typography>
                {licenseEmail && (
                  <Typography variant="caption" color="text.secondary">
                    Assigned to: {licenseEmail}
                  </Typography>
                )}
              </Box>
            </Stack>
          </CardContent>
        </Card>
      )}
      
      <Grid container spacing={3} sx={{ mb: 4, maxWidth: 800, mx: 'auto' }}>
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

      <Divider sx={{ mb: 3 }} />
      
      <Box sx={{ mt: 3 }}>
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
  );
};

export default WelcomePage;