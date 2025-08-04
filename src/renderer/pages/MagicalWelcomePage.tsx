import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  Container,
  Fade,
  CircularProgress
} from '@mui/material';
import { keyframes } from '@mui/system';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

// Shimmer animation for the button
const shimmer = keyframes`
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
`;

// Particle floating animation
const float = keyframes`
  0%, 100% {
    transform: translateY(0) translateX(0);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: translateY(-100vh) translateX(50px);
    opacity: 0;
  }
`;

interface Particle {
  id: number;
  left: number;
  delay: number;
  duration: number;
}

interface MagicalWelcomePageProps {
  onTryMagic: () => void;
  onTraditionalSetup: () => void;
}

export const MagicalWelcomePage: React.FC<MagicalWelcomePageProps> = ({
  onTryMagic,
  onTraditionalSetup
}) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    // Generate particles
    const newParticles: Particle[] = [];
    for (let i = 0; i < 20; i++) {
      newParticles.push({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 10,
        duration: 15 + Math.random() * 10
      });
    }
    setParticles(newParticles);
  }, []);

  const handleTryMagic = async () => {
    setIsAuthenticating(true);
    try {
      // First check if already authenticated
      const authStatus = await window.electronAPI.auth.check();
      
      if (!authStatus.authenticated) {
        // Need to authenticate
        const loginResult = await window.electronAPI.auth.login();
        if (!loginResult) {
          // User cancelled login
          setIsAuthenticating(false);
          return;
        }
      }
      
      // Now authenticated, proceed to magic
      onTryMagic();
    } catch (error) {
      console.error('Authentication failed:', error);
      setIsAuthenticating(false);
    }
  };

  return (
    <Container maxWidth="md">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(180deg, #0A0E27 0%, #1a1f3a 100%)',
        }}
      >
        {/* Particle effects */}
        {particles.map((particle) => (
          <Box
            key={particle.id}
            sx={{
              position: 'absolute',
              width: '4px',
              height: '4px',
              backgroundColor: '#00D4FF',
              borderRadius: '50%',
              left: `${particle.left}%`,
              bottom: 0,
              animation: `${float} ${particle.duration}s linear ${particle.delay}s infinite`,
              boxShadow: '0 0 6px #00D4FF',
            }}
          />
        ))}

        <Fade in timeout={1000}>
          <Box sx={{ textAlign: 'center', zIndex: 1 }}>
            {/* Logo with glow */}
            <Box
              sx={{
                mb: 4,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <AutoAwesomeIcon 
                sx={{ 
                  fontSize: 80, 
                  color: '#0066FF',
                  filter: 'drop-shadow(0 0 20px rgba(0, 102, 255, 0.5))',
                  animation: 'pulse 2s ease-in-out infinite',
                  '@keyframes pulse': {
                    '0%, 100%': {
                      transform: 'scale(1)',
                      filter: 'drop-shadow(0 0 20px rgba(0, 102, 255, 0.5))',
                    },
                    '50%': {
                      transform: 'scale(1.05)',
                      filter: 'drop-shadow(0 0 30px rgba(0, 102, 255, 0.8))',
                    },
                  },
                }} 
              />
            </Box>

            {/* Title */}
            <Typography 
              variant="h2" 
              sx={{ 
                color: '#FFFFFF',
                fontWeight: 700,
                mb: 2,
                textShadow: '0 2px 20px rgba(0, 102, 255, 0.3)',
              }}
            >
              Anava Vision
            </Typography>

            {/* Subtitle */}
            <Typography 
              variant="h5" 
              sx={{ 
                color: '#8892B0',
                mb: 6,
                fontWeight: 400,
              }}
            >
              Transform your cameras into intelligent eyes
            </Typography>

            {/* Main CTA Button */}
            <Button
              variant="contained"
              size="large"
              onClick={handleTryMagic}
              disabled={isAuthenticating}
              startIcon={<AutoAwesomeIcon />}
              sx={{
                py: 2,
                px: 6,
                fontSize: '1.25rem',
                fontWeight: 600,
                borderRadius: 3,
                textTransform: 'none',
                position: 'relative',
                overflow: 'hidden',
                background: 'linear-gradient(135deg, #0066FF 0%, #00D4FF 100%)',
                color: '#FFFFFF',
                boxShadow: '0 4px 20px rgba(0, 102, 255, 0.4)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 30px rgba(0, 102, 255, 0.6)',
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
                  backgroundSize: '200% 100%',
                  animation: `${shimmer} 3s linear infinite`,
                },
                '&:disabled': {
                  background: '#333',
                  color: '#666',
                },
              }}
            >
              {isAuthenticating ? (
                <CircularProgress size={24} sx={{ color: '#FFF' }} />
              ) : (
                'Try AI on My Network'
              )}
            </Button>

            {/* Traditional setup link */}
            <Typography 
              variant="body1" 
              sx={{ 
                color: '#8892B0',
                mt: 4,
                cursor: 'pointer',
                '&:hover': {
                  color: '#FFFFFF',
                  textDecoration: 'underline',
                },
              }}
              onClick={onTraditionalSetup}
            >
              Already have an account? Traditional setup →
            </Typography>
          </Box>
        </Fade>
      </Box>
    </Container>
  );
};