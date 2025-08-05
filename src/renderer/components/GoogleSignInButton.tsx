import React from 'react';
import { Button, Box, Typography, CircularProgress, Alert } from '@mui/material';

interface GoogleSignInButtonProps {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({ 
  onClick, 
  loading = false, 
  disabled = false 
}) => {
  return (
    <Button
      variant="contained"
      fullWidth
      size="large"
      onClick={onClick}
      disabled={disabled || loading}
      sx={{
        backgroundColor: '#4285f4',
        color: 'white',
        textTransform: 'none',
        py: 1.5,
        '&:hover': {
          backgroundColor: '#357ae8',
        },
        '&:disabled': {
          backgroundColor: '#cccccc',
        },
      }}
      startIcon={
        !loading && (
          <Box
            component="img"
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
            sx={{ width: 20, height: 20 }}
          />
        )
      }
    >
      {loading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={20} color="inherit" />
          <span>Signing in...</span>
        </Box>
      ) : (
        'Sign in with Google'
      )}
    </Button>
  );
};

export const GoogleSignInSection: React.FC<{
  onSignIn: () => void;
  loading?: boolean;
  error?: string | null;
}> = ({ onSignIn, loading = false, error }) => {
  return (
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
        onClick={onSignIn} 
        loading={loading}
      />

      <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
        By signing in, you agree to our Terms of Service and Privacy Policy
      </Typography>
    </Box>
  );
};

export default GoogleSignInButton;