import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  Container,
  TextField,
  CircularProgress,
  Alert,
  Paper,
  Fade
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import KeyIcon from '@mui/icons-material/Key';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

interface MagicalAPIKeyPageProps {
  onKeyGenerated: (apiKey: string) => void;
  onBack: () => void;
}

export const MagicalAPIKeyPage: React.FC<MagicalAPIKeyPageProps> = ({
  onKeyGenerated,
  onBack
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [manualKey, setManualKey] = useState('');
  const [needsManual, setNeedsManual] = useState(false);
  const [error, setError] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    // Start automatic key generation
    generateAPIKey();
  }, []);

  const generateAPIKey = async () => {
    setIsGenerating(true);
    setError('');
    
    try {
      const result = await window.electronAPI.magical.generateApiKey();
      
      if (result.success && result.apiKey) {
        // Successfully generated key
        setProjectId(result.projectId || null);
        // Small delay for visual feedback
        setTimeout(() => {
          onKeyGenerated(result.apiKey!);
        }, 1000);
      } else if (result.needsManual) {
        // Need manual key creation - only when explicitly requested
        setNeedsManual(true);
        setIsGenerating(false);
      } else {
        // Error occurred - show error but allow retry
        setError(result.error || 'Failed to generate API key automatically');
        setIsGenerating(false);
        // Don't immediately show manual option - wait 3 seconds
        setTimeout(() => {
          setNeedsManual(true);
        }, 3000);
      }
    } catch (error: any) {
      console.error('Failed to generate API key:', error);
      setError(error.message || 'An unexpected error occurred');
      setNeedsManual(true);
      setIsGenerating(false);
    }
  };

  const handleManualKey = () => {
    if (manualKey.trim()) {
      onKeyGenerated(manualKey.trim());
    }
  };

  const openAIStudio = () => {
    window.electronAPI.openExternal('https://aistudio.google.com/app/apikey');
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          py: 4,
        }}
      >
        <Fade in timeout={500}>
          <Paper
            sx={{
              p: 4,
              width: '100%',
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 2,
            }}
          >
            {/* Header */}
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <KeyIcon
                sx={{
                  fontSize: 60,
                  color: 'primary.main',
                  mb: 2,
                  filter: 'drop-shadow(0 0 20px rgba(0, 102, 255, 0.5))',
                }}
              />
              <Typography variant="h4" sx={{ color: 'text.primary', mb: 1 }}>
                Setting up AI Magic
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                {isGenerating 
                  ? 'Creating your AI Studio API key...'
                  : needsManual
                  ? 'Please create an API key manually'
                  : 'Your API key is ready!'}
              </Typography>
            </Box>

            {/* Content */}
            {isGenerating ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress size={60} />
                <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
                  This may take a few seconds...
                </Typography>
              </Box>
            ) : needsManual ? (
              <Box>
                {error && (
                  <Alert 
                    severity="error" 
                    sx={{ mb: 3 }}
                    action={
                      <Button 
                        color="inherit" 
                        size="small" 
                        onClick={() => {
                          setError('');
                          setNeedsManual(false);
                          generateAPIKey();
                        }}
                      >
                        Retry
                      </Button>
                    }
                  >
                    {error}
                  </Alert>
                )}
                
                <Typography variant="body1" sx={{ mb: 3, color: 'text.primary' }}>
                  To continue, you'll need to create an AI Studio API key:
                </Typography>
                
                <Box sx={{ mb: 3 }}>
                  <Button
                    fullWidth
                    variant="outlined"
                    size="large"
                    onClick={openAIStudio}
                    endIcon={<OpenInNewIcon />}
                    sx={{ mb: 2 }}
                  >
                    Open AI Studio Console
                  </Button>
                  
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    1. Sign in with your Google account<br />
                    2. Click "Create API key"<br />
                    3. {projectId ? `Select project: ${projectId}` : 'Select "Create API key in new project"'}<br />
                    4. Copy the key and paste it below
                  </Typography>
                </Box>

                <TextField
                  fullWidth
                  label="AI Studio API Key"
                  placeholder="Paste your API key here"
                  value={manualKey}
                  onChange={(e) => setManualKey(e.target.value)}
                  sx={{ mb: 3 }}
                  InputProps={{
                    sx: { fontFamily: 'monospace' }
                  }}
                />

                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="text"
                    onClick={onBack}
                    sx={{ flex: 1 }}
                  >
                    Back
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleManualKey}
                    disabled={!manualKey.trim()}
                    startIcon={<AutoAwesomeIcon />}
                    sx={{ flex: 2 }}
                  >
                    Continue with Magic
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="h6" sx={{ color: 'success.main' }}>
                  API key generated successfully!
                </Typography>
              </Box>
            )}
          </Paper>
        </Fade>
      </Box>
    </Container>
  );
};