import React, { useState } from 'react';
import { Box, Typography, Paper, Stack, Alert, CircularProgress } from '@mui/material';
import { Key as KeyIcon } from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import anavaLogo from '../assets/anava-logo.png';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken } from 'firebase/auth';

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

interface UnifiedLoginPageProps {
  onLoginSuccess: () => void;
}

const UnifiedLoginPage: React.FC<UnifiedLoginPageProps> = ({ onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupProgress, setSetupProgress] = useState<string>('Setting up your account...');

  const handleUnifiedLogin = async () => {
    console.log('Starting unified login flow...');
    setLoading(true);
    setError(null);

    try {
      // Step 1: Initiate GCP OAuth flow
      console.log('Step 1: Initiating GCP OAuth...');
      setSetupProgress('Authenticating with Google Cloud...');
      const authResult = await window.electronAPI.auth.unifiedGCPAuth();
      
      if (!authResult.success || !authResult.code) {
        throw new Error(authResult.error || 'OAuth flow cancelled');
      }
      
      console.log('OAuth authorization code received');
      
      // Step 2: Exchange code for all tokens via our Cloud Function
      console.log('Step 2: Exchanging code for tokens...');
      setSetupProgress('Setting up authentication tokens...');
      const response = await fetch('https://unified-auth-p2kamosfwq-uc.a.run.app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: authResult.code
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }
      
      const unifiedAuth = await response.json();
      // console.log('Full unified auth response:', unifiedAuth);
      // console.log('Unified auth response summary:', {
      //   hasGCPToken: !!unifiedAuth.gcp_access_token,
      //   hasFirebaseToken: !!unifiedAuth.firebase_token,
      //   hasApiKey: !!unifiedAuth.gemini_api_key,
      //   hasLicense: !!unifiedAuth.license,
      //   licenseStructure: typeof unifiedAuth.license === 'object' ? 'object' : typeof unifiedAuth.license,
      //   user: unifiedAuth.user?.email,
      //   allKeys: Object.keys(unifiedAuth)
      // });
      
      if (!unifiedAuth.success) {
        throw new Error(unifiedAuth.error || 'Authentication failed');
      }
      
      // Step 3: Store all credentials
      console.log('Step 3: Storing credentials...');
      
      // Store GCP tokens
      setSetupProgress('Saving Google Cloud credentials...');
      await window.electronAPI.setConfigValue('gcpAccessToken', unifiedAuth.gcp_access_token);
      await window.electronAPI.setConfigValue('gcpRefreshToken', unifiedAuth.gcp_refresh_token);
      
      // Store user info
      await window.electronAPI.setConfigValue('userEmail', unifiedAuth.user.email);
      await window.electronAPI.setConfigValue('userId', unifiedAuth.user.id);
      await window.electronAPI.setConfigValue('userName', unifiedAuth.user.name);
      
      // Store or generate AI Studio API key
      setSetupProgress('Configuring AI Studio access...');
      if (unifiedAuth.gemini_api_key) {
        await window.electronAPI.setConfigValue('geminiApiKey', unifiedAuth.gemini_api_key);
        console.log('✅ AI Studio API key stored from cloud function');
        console.log('   Key prefix:', unifiedAuth.gemini_api_key.substring(0, 10) + '...');
      } else {
        console.warn('No AI Studio API key received from cloud function');
        // Always try to generate one as fallback
        console.log('Generating AI Studio API key...');
        try {
          const apiKeyResult = await window.electronAPI.magical?.generateApiKey?.();
          console.log('API key generation result:', apiKeyResult);
          
          if (apiKeyResult?.success && apiKeyResult?.apiKey) {
            await window.electronAPI.setConfigValue('geminiApiKey', apiKeyResult.apiKey);
            console.log('✅ AI Studio API key generated and stored successfully');
          } else if (apiKeyResult?.needsManual) {
            console.log('Manual API key creation needed - opening AI Studio console');
            // Store a placeholder to prevent repeated attempts
            await window.electronAPI.setConfigValue('geminiApiKeyStatus', 'manual_needed');
          } else {
            console.error('Failed to generate AI Studio API key:', apiKeyResult?.error);
            await window.electronAPI.setConfigValue('geminiApiKeyStatus', 'failed');
          }
        } catch (err) {
          console.error('Error generating API key:', err);
          await window.electronAPI.setConfigValue('geminiApiKeyStatus', 'error');
        }
      }
      
      // Store or fetch license (handle both object and string formats)
      setSetupProgress('Checking trial license...');
      if (unifiedAuth.license && unifiedAuth.license.key) {
        const licenseKey = typeof unifiedAuth.license === 'object' ? unifiedAuth.license.key : unifiedAuth.license;
        const licenseEmail = typeof unifiedAuth.license === 'object' ? (unifiedAuth.license.email || unifiedAuth.user?.email) : unifiedAuth.user?.email;
        
        // Verify it's a real license (not ANAVA-prefixed fake)
        if (licenseKey && !licenseKey.startsWith('ANAVA-')) {
          await window.electronAPI.setConfigValue('licenseKey', licenseKey);
          await window.electronAPI.setConfigValue('licenseEmail', licenseEmail);
          await window.electronAPI.setConfigValue('axisLicenseKey', licenseKey);
          console.log('✅ Real Axis license stored from cloud function:', licenseKey);
          console.log('   License email:', licenseEmail);
        } else if (licenseKey && licenseKey.startsWith('ANAVA-')) {
          console.error('❌ FAKE LICENSE DETECTED:', licenseKey);
          throw new Error('Invalid license key received. The system detected a fake license. Please contact support.');
        }
      } else if (unifiedAuth.license && unifiedAuth.license.error) {
        console.error('❌ License error from cloud function:', unifiedAuth.license.error);
        throw new Error(unifiedAuth.license.error || 'No trial licenses available');
      } else {
        console.warn('No license received from cloud function');
        // Always fetch an Axis trial license for the user
        console.log('Fetching Axis trial license for user...');
        setSetupProgress('Fetching trial license...');
        try {
          // First, try the assignAxisKey endpoint
          const axisResponse = await fetch('https://us-central1-anava-ai.cloudfunctions.net/assignAxisKey', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: unifiedAuth.user.email,
              name: unifiedAuth.user.name,
              uid: unifiedAuth.user.id
            })
          });
          
          if (axisResponse.ok) {
            const axisData = await axisResponse.json();
            console.log('Axis license response:', axisData);
            if (axisData.licenseKey || axisData.key) {
              const key = axisData.licenseKey || axisData.key;
              await window.electronAPI.setConfigValue('axisLicenseKey', key);
              await window.electronAPI.setConfigValue('licenseKey', key);
              await window.electronAPI.setConfigValue('licenseEmail', unifiedAuth.user.email);
              console.log('✅ Axis trial license fetched and stored:', key);
            }
          } else {
            console.error('Failed to fetch Axis license:', axisResponse.status);
          }
        } catch (err) {
          console.error('❌ CRITICAL: Failed to fetch Axis license:', err);
          // DO NOT use fallback keys - this installer is all or nothing
          throw new Error('Failed to obtain a valid trial license. Please contact support@anava.ai');
        }
      }
      
      // Step 4: Initialize Firebase with custom token
      console.log('Step 4: Initializing Firebase...');
      setSetupProgress('Initializing Firebase services...');
      const firebaseConfig = {
        apiKey: "AIzaSyCJbWAa-zQir1v8kmlye8Kv3kmhPb9r18s",
        authDomain: "anava-ai.firebaseapp.com",
        projectId: "anava-ai",
        storageBucket: "anava-ai.appspot.com",
        messagingSenderId: "392865621461",
        appId: "1:392865621461:web:15db206ae4e9c72f7dc95c"
      };
      
      const app = initializeApp(firebaseConfig, 'unified-auth-app');
      const auth = getAuth(app);
      
      // Sign in to Firebase with custom token
      await signInWithCustomToken(auth, unifiedAuth.firebase_token);
      console.log('Firebase authentication successful');
      
      // Store user's display name for personalized greetings
      if (unifiedAuth.user.name) {
        localStorage.setItem('userDisplayName', unifiedAuth.user.name);
      }
      
      // Check what we have
      const finalApiKey = await window.electronAPI.getConfigValue('geminiApiKey');
      const finalLicense = await window.electronAPI.getConfigValue('licenseKey');
      const finalAxisLicense = await window.electronAPI.getConfigValue('axisLicenseKey');
      
      // Track missing items
      const missingItems = [];
      if (!finalApiKey) missingItems.push('AI Studio API Key');
      if (!finalLicense && !finalAxisLicense) missingItems.push('License Key');
      
      // Success!
      console.log('✅ Unified login complete!');
      console.log('User has:', {
        identity: unifiedAuth.user.email,
        license: finalLicense || finalAxisLicense || 'MISSING',
        aiStudioAccess: !!finalApiKey,
        gcpAccess: true,
        firebaseAccess: true,
        missingItems
      });
      
      // Store status for home screen
      await window.electronAPI.setConfigValue('authStatus', {
        authenticated: true,
        hasApiKey: !!finalApiKey,
        hasLicense: !!(finalLicense || finalAxisLicense),
        missingItems,
        userEmail: unifiedAuth.user.email
      });
      
      // Navigate to main app
      setSetupProgress('Setup complete!');
      onLoginSuccess();
      
      // Show warning if items are missing
      if (missingItems.length > 0) {
        setTimeout(() => {
          alert(`Warning: The following items could not be automatically configured:\n\n${missingItems.join('\n')}\n\nYou may need to configure these manually.`);
        }, 1000);
      }
      
    } catch (error: any) {
      console.error('Unified login error:', error);
      
      if (error.message === 'OAuth flow cancelled') {
        setError('Sign-in was cancelled. Please try again.');
      } else if (error.message.includes('Network')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError(error.message || 'Failed to sign in. Please try again.');
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
            One Login, Everything You Need
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Sign in once to get your trial license, AI Studio access, and cloud deployment capabilities.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <CircularProgress />
              <Typography variant="body2" color="text.secondary">
                {setupProgress}
              </Typography>
            </Box>
          ) : (
            <GoogleSignInButton 
              onClick={handleUnifiedLogin}
              loading={loading}
            />
          )}

          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            By signing in, you agree to our Terms of Service and Privacy Policy
          </Typography>
        </Box>

        <Box sx={{ mt: 2, p: 2, backgroundColor: 'primary.50', borderRadius: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
            <KeyIcon fontSize="small" color="primary" />
            <Typography variant="body2">
              Your trial includes AI analytics, cloud deployment, and full support
            </Typography>
          </Stack>
        </Box>
      </GradientPaper>
    </Box>
  );
};

export default UnifiedLoginPage;