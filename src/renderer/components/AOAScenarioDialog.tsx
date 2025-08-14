import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Chip,
  Stack,
} from '@mui/material';
import {
  SmartToy as AIIcon,
  CheckCircle as SuccessIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';

interface Props {
  open: boolean;
  cameraIp: string;
  username: string;
  password: string;
  geminiApiKey: string;
  onComplete: () => void;
  onSkip?: () => void;
}

export const AOAScenarioDialog: React.FC<Props> = ({
  open,
  cameraIp,
  username,
  password,
  geminiApiKey,
  onComplete,
  onSkip
}) => {
  const [description, setDescription] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [scenarioDetails, setScenarioDetails] = useState<any>(null);

  const handleDeploy = async () => {
    if (!description.trim()) {
      setError('Please describe what you want to detect');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Deploy the NL scenario
      const result = await (window as any).electronAPI.invokeIPC(
        'aoa-deploy-nl-scenario',
        cameraIp,
        username,
        password,
        geminiApiKey,
        description,
        'camera monitoring'  // Default context
      );

      if (result.success) {
        setSuccess(true);
        setScenarioDetails(result.details);
        
        // Auto-complete after 2 seconds
        setTimeout(() => {
          onComplete();
        }, 2000);
      } else {
        setError(result.message || 'Failed to create scenario');
      }
    } catch (error: any) {
      console.error('AOA deployment error:', error);
      setError(error.message || 'Failed to deploy scenario');
    } finally {
      setProcessing(false);
    }
  };

  const examplePrompts = [
    "Someone loitering for more than 30 seconds",
    "Cars parking in the loading zone",
    "People running through the area",
    "3 or more people gathering",
  ];

  return (
    <Dialog 
      open={open} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <AIIcon color="primary" fontSize="large" />
          <Box>
            <Typography variant="h6">
              AI Detection Setup
            </Typography>
            <Typography variant="body2" color="text.secondary">
              What would you like to know about when seen by this camera?
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 2 }}>
          {!success ? (
            <>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Describe what you want to detect"
                placeholder="E.g., 'Someone standing at the door for more than 10 seconds' or 'Cars parking illegally'"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={processing}
                autoFocus
                helperText="Use plain English to describe the behavior or situation"
              />

              <Box>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Example scenarios:
                </Typography>
                <Box display="flex" flexWrap="wrap" gap={1} mt={1}>
                  {examplePrompts.map((prompt) => (
                    <Chip
                      key={prompt}
                      label={prompt}
                      size="small"
                      onClick={() => setDescription(prompt)}
                      variant="outlined"
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                </Box>
              </Box>

              {error && (
                <Alert severity="error" icon={<WarningIcon />}>
                  {error}
                </Alert>
              )}
            </>
          ) : (
            <Alert severity="success" icon={<SuccessIcon />}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Detection scenario created successfully!
              </Typography>
              {scenarioDetails?.scenario && (
                <Box mt={1}>
                  <Typography variant="body2">
                    <strong>Name:</strong> {scenarioDetails.scenario.name}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Type:</strong> {scenarioDetails.scenario.type}
                  </Typography>
                  {scenarioDetails.explanation && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {scenarioDetails.explanation}
                    </Typography>
                  )}
                </Box>
              )}
            </Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        {!success && (
          <>
            {onSkip && (
              <Button onClick={onSkip} disabled={processing}>
                Skip
              </Button>
            )}
            <Button
              variant="contained"
              onClick={handleDeploy}
              disabled={!description.trim() || processing}
              startIcon={processing ? <CircularProgress size={20} /> : <AIIcon />}
            >
              {processing ? 'Creating scenario...' : 'Create Detection'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};