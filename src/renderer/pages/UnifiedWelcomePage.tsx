import React from 'react';
import { 
  Box, 
  Typography, 
  Container,
  Paper,
  Fade,
  Chip,
  Grid
} from '@mui/material';
import CloudIcon from '@mui/icons-material/Cloud';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';

interface UnifiedWelcomePageProps {
  onNewDeployment: () => void;
  onCheckExisting: () => void;
  flowOrigin?: 'magical' | 'traditional';
  magicalCamera?: any;
}

const UnifiedWelcomePage: React.FC<UnifiedWelcomePageProps> = ({
  onNewDeployment,
  onCheckExisting,
  flowOrigin = 'traditional',
  magicalCamera
}) => {
  return (
    <Fade in timeout={800}>
      <Container maxWidth="md" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ 
          py: 2,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          justifyContent: 'center'
        }}>
          {flowOrigin === 'magical' && (
            <Chip
              icon={<AutoFixHighIcon />}
              label="Magical Flow Active"
              color="secondary"
              sx={{ 
                mb: 3,
                animation: 'pulse 2s ease-in-out infinite'
              }}
            />
          )}
          
          <Typography 
            variant="h4" 
            gutterBottom
            sx={{ 
              fontWeight: 700,
              background: flowOrigin === 'magical' 
                ? 'linear-gradient(135deg, #00D4FF 0%, #A855F7 100%)'
                : 'linear-gradient(135deg, #1976D2 0%, #42A5F5 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 1
            }}
          >
            {flowOrigin === 'magical' 
              ? 'Ready to Build Your Infrastructure'
              : 'Anava Vision Infrastructure Deployer'
            }
          </Typography>
          
          <Typography 
            variant="body1" 
            sx={{ 
              mb: 4,
              color: 'text.secondary',
              maxWidth: 600,
              mx: 'auto'
            }}
          >
            {flowOrigin === 'magical'
              ? 'Your camera is connected and ready. Now let\'s set up the cloud infrastructure to power your analytics.'
              : 'Deploy and configure your Anava Vision analytics infrastructure with ease.'
            }
          </Typography>

          <Grid container spacing={3} justifyContent="center">
            <Grid item xs={12} sm={6}>
              <Paper
                elevation={3}
                sx={{
                  p: 3,
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  border: '1px solid',
                  borderColor: 'primary.main',
                  background: 'rgba(255, 255, 255, 0.02)',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: theme => `0 8px 32px ${theme.palette.primary.main}40`,
                    borderColor: 'primary.light',
                  }
                }}
                onClick={onNewDeployment}
              >
                <RocketLaunchIcon 
                  sx={{ 
                    fontSize: 48, 
                    color: 'primary.main',
                    mb: 2,
                    filter: 'drop-shadow(0 0 8px rgba(0, 212, 255, 0.5))'
                  }} 
                />
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
                  {flowOrigin === 'magical' ? 'Continue Setup' : 'New Deployment'}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {flowOrigin === 'magical'
                    ? 'Continue with Google Cloud setup to enable cloud analytics'
                    : 'Set up a new Google Cloud project with all required services'
                  }
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Paper
                elevation={3}
                sx={{
                  p: 3,
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  background: 'rgba(255, 255, 255, 0.02)',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: theme => `0 8px 32px ${theme.palette.secondary.main}40`,
                    borderColor: 'secondary.light',
                  }
                }}
                onClick={onCheckExisting}
              >
                <CloudIcon 
                  sx={{ 
                    fontSize: 48, 
                    color: 'secondary.main',
                    mb: 2,
                    filter: 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.5))'
                  }} 
                />
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
                  Check Existing
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Verify or update an existing deployment configuration
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {flowOrigin === 'magical' && magicalCamera && (
            <Box sx={{ mt: 3, p: 2, background: 'rgba(0, 212, 255, 0.1)', borderRadius: 2 }}>
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CameraAltIcon sx={{ fontSize: 20 }} />
                Camera discovered and ready: {magicalCamera.name || 'Unknown'} at {magicalCamera.ip || 'your network'}
              </Typography>
            </Box>
          )}
        </Box>
      </Container>
    </Fade>
  );
};

export default UnifiedWelcomePage;