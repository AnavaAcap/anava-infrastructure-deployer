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
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    console.log('Google Sign-In button clicked!');
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

      // Initialize Google Auth with Firebase
      const { GoogleAuthService } = await import('../services/googleAuthService');
      const googleAuth = new GoogleAuthService();
      await googleAuth.initialize(firebaseConfig);
      
      // Sign in with Google popup (Firebase)
      const profile = await googleAuth.signInWithGoogle();
      
      console.log('Google sign-in successful:', profile.email);
      
      // Store user's display name in localStorage for later use
      if (profile.displayName) {
        localStorage.setItem('userDisplayName', profile.displayName);
        console.log('Stored user display name:', profile.displayName);
      }
      
      // Assign license with Google credentials using Firebase
      // Use the Firebase-specific method that handles both tokens
      const licenseResult = await window.electronAPI.license.assignWithFirebaseGoogle({
        googleIdToken: profile.idToken,
        googleAccessToken: profile.accessToken || '',
        firebaseConfig
      });
      
      if (licenseResult.success) {
        console.log('License assigned:', licenseResult.key);
        
        // Store the user's email for later GCP OAuth hint
        if (profile.email) {
          await window.electronAPI.setConfigValue('userEmail', profile.email);
        }
        
        // Don't generate API key here - it will happen on-demand when needed
        // This follows the principle of least privilege
        console.log('Login successful. API key will be generated when needed.');
        
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