import React, { useState } from 'react';
import { Box, Typography, Paper, Stack, Alert, CircularProgress } from '@mui/material';
import { Google as GoogleIcon, Key as KeyIcon } from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import anavaLogo from '../assets/anava-logo.png';
import { GoogleSignInSection } from '../components/GoogleSignInButton';
import { GoogleAuthService } from '../services/googleAuthService';

const GradientPaper = styled(Paper)(({ theme }) => ({
  background: 'linear-gradient(135deg, #FFFFFF 0%, #F5F5F5 100%)',
  borderTop: `4px solid ${theme.palette.primary.main}`,
  maxWidth: 500,
  margin: '0 auto',
  marginTop: theme.spacing(8),
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

interface LoginPageProps {
  onLoginSuccess: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get Firebase config
      const firebaseConfig = {
        apiKey: "AIzaSyCJbWAa-zQir1v8kmlye8Kv3kmhPb9r18s",
        authDomain: "anava-ai.firebaseapp.com",
        projectId: "anava-ai",
        storageBucket: "anava-ai.appspot.com",
        messagingSenderId: "392865621461",
        appId: "1:392865621461:web:15db206ae4e9c72f7dc95c"
      };

      // Initialize Google Auth
      const googleAuth = new GoogleAuthService();
      await googleAuth.initialize(firebaseConfig);
      
      // Sign in with Google
      const profile = await googleAuth.signInWithGoogle();
      
      console.log('Google sign-in successful:', profile.email);
      
      // Assign license with Google credentials
      const licenseResult = await window.electronAPI.license.assignWithGoogle({
        idToken: profile.idToken,
        firebaseConfig
      });
      
      if (licenseResult.success) {
        console.log('License assigned:', licenseResult.key);
        // Clean up
        googleAuth.dispose();
        // Navigate to main app
        onLoginSuccess();
      } else {
        throw new Error(licenseResult.error || 'Failed to assign license');
      }
      
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.message === 'Sign-in cancelled') {
        setError('Sign-in was cancelled. Please try again.');
      } else {
        setError(error.message || 'Failed to sign in');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
      <GradientPaper elevation={3} sx={{ p: 6, textAlign: 'center' }}>
        <LogoSection>
          <img 
            src={anavaLogo} 
            alt="Anava Logo" 
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </LogoSection>
        
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
          Welcome to Anava Vision
        </Typography>
        
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Sign in with your Google account to get started with AI-powered camera analytics
        </Typography>

        <GoogleSignInSection 
          onSignIn={handleGoogleSignIn}
          loading={loading}
          error={error}
        />

        <Box sx={{ mt: 2, p: 2, backgroundColor: 'primary.50', borderRadius: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
            <KeyIcon fontSize="small" color="primary" />
            <Typography variant="body2">
              A trial license will be automatically assigned upon sign-in
            </Typography>
          </Stack>
        </Box>
      </GradientPaper>
    </Box>
  );
};

export default LoginPage;