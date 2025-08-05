import React, { useState } from 'react';
import { Box, Typography, Paper, Stack, Alert, CircularProgress, Button } from '@mui/material';
import { Google as GoogleIcon, Key as KeyIcon } from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import anavaLogo from '../assets/anava-logo.png';
import { GoogleSignInButton } from '../components/GoogleSignInButton';

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

const LoginPageUnified: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    console.log('Google Sign-In button clicked!');
    setLoading(true);
    setError(null);

    try {
      // Use unified authentication
      const authResult = await window.electronAPI.auth.unifiedGoogle();
      
      if (!authResult.success) {
        throw new Error(authResult.error || 'Authentication failed');
      }

      console.log('Unified auth successful:', authResult.user?.email);
      
      // Get Firebase config (same as before)
      const firebaseConfig = {
        apiKey: "AIzaSyCJbWAa-zQir1v8kmlye8Kv3kmhPb9r18s",
        authDomain: "anava-ai.firebaseapp.com",
        projectId: "anava-ai",
        storageBucket: "anava-ai.appspot.com",
        messagingSenderId: "392865621461",
        appId: "1:392865621461:web:15db206ae4e9c72f7dc95c"
      };
      
      // Assign license with the authenticated user's ID token
      const licenseResult = await window.electronAPI.license.assignWithGoogle({
        idToken: authResult.user!.idToken,
        firebaseConfig
      });
      
      if (licenseResult.success) {
        console.log('License assigned:', licenseResult.key);
        onLoginSuccess();
      } else {
        throw new Error(licenseResult.error || 'Failed to assign license');
      }
      
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.message === 'Authentication cancelled') {
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

        <Box sx={{ textAlign: 'center', py: 3 }}>
          <Typography variant="h6" gutterBottom>
            Get Your Trial License
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Sign in with your Google account to receive a trial license.
            We'll use your account to track your trial and provide support.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <GoogleSignInButton 
            onClick={handleGoogleSignIn}
            loading={loading}
          />
          
          <Button 
            variant="outlined" 
            onClick={() => console.log('Test button clicked!')}
            sx={{ mt: 2 }}
          >
            Test Button (Check Console)
          </Button>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            By signing in, you agree to our Terms of Service and Privacy Policy
          </Typography>
          
          {/* Debug button to reset EULA */}
          <Button 
            variant="text" 
            size="small"
            onClick={() => {
              localStorage.removeItem('eulaAccepted');
              console.log('EULA acceptance cleared - reload the app to see EULA dialog');
            }}
            sx={{ mt: 1, fontSize: '0.75rem', color: 'text.secondary' }}
          >
            Reset EULA (Debug)
          </Button>
        </Box>

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

export default LoginPageUnified;