import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  Stack,
  Checkbox,
  FormControlLabel,
  LinearProgress,
  Chip,
} from '@mui/material';
import { Key as KeyIcon, CheckCircle, Warning } from '@mui/icons-material';

interface LicenseKeyStepProps {
  onComplete: (licenseKey?: string) => void;
  onBack?: () => void;
  cachedLicenseKey?: string;
  skipOption?: boolean;
}

export const LicenseKeyStep: React.FC<LicenseKeyStepProps> = ({
  onComplete,
  onBack,
  cachedLicenseKey = '',
  skipOption = true,
}) => {
  const [licenseKey, setLicenseKey] = useState(cachedLicenseKey);
  const [skipLicense, setSkipLicense] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Basic license key format validation
  const validateLicenseKey = (key: string): boolean => {
    if (!key) return true; // Empty is valid if skipping
    
    // Basic format check - adjust based on actual Anava key format
    // Assuming format like XXXX-XXXX-XXXX-XXXX or similar
    const keyPattern = /^[A-Z0-9]{4,}-?[A-Z0-9]{4,}-?[A-Z0-9]{4,}-?[A-Z0-9]{4,}$/i;
    return keyPattern.test(key.replace(/\s/g, ''));
  };

  const handleContinue = () => {
    if (skipLicense) {
      onComplete(undefined);
      return;
    }

    if (!licenseKey) {
      setError('Please enter a license key or choose to skip');
      return;
    }

    if (!validateLicenseKey(licenseKey)) {
      setError('Invalid license key format. Expected format: XXXX-XXXX-XXXX-XXXX');
      return;
    }

    onComplete(licenseKey.trim());
  };

  const handleKeyChange = (value: string) => {
    setLicenseKey(value);
    setError(null);
    if (value) {
      setSkipLicense(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <KeyIcon sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
          <Box>
            <Typography variant="h5" gutterBottom>
              Anava License Key
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Enter your Anava license key to activate BatonAnalytic features
            </Typography>
          </Box>
        </Box>

        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            A license key is required to enable all BatonAnalytic features. If you don't have a license key yet, 
            you can skip this step and add it later through the camera's web interface.
          </Typography>
        </Alert>

        <Stack spacing={3}>
          <TextField
            fullWidth
            label="License Key"
            value={licenseKey}
            onChange={(e) => handleKeyChange(e.target.value)}
            error={!!error}
            helperText={error || "Enter your Anava license key (e.g., XXXX-XXXX-XXXX-XXXX)"}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            disabled={skipLicense}
            InputProps={{
              startAdornment: <KeyIcon sx={{ mr: 1, color: 'action.active' }} />,
            }}
          />

          {skipOption && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={skipLicense}
                  onChange={(e) => {
                    setSkipLicense(e.target.checked);
                    if (e.target.checked) {
                      setError(null);
                    }
                  }}
                />
              }
              label={
                <Box>
                  <Typography variant="body1">Skip license activation for now</Typography>
                  <Typography variant="caption" color="text.secondary">
                    You can add the license key later through the camera interface
                  </Typography>
                </Box>
              }
            />
          )}

          {cachedLicenseKey && licenseKey === cachedLicenseKey && (
            <Alert severity="success" icon={<CheckCircle />}>
              Using previously saved license key
            </Alert>
          )}

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 4 }}>
            {onBack && (
              <Button onClick={onBack} size="large">
                Back
              </Button>
            )}
            <Button
              variant="contained"
              onClick={handleContinue}
              size="large"
              disabled={!skipLicense && !licenseKey}
            >
              {skipLicense ? 'Skip' : 'Continue'}
            </Button>
          </Box>
        </Stack>

        <Box sx={{ mt: 4, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            What happens next?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {skipLicense ? (
              "The ACAP will be installed without a license. Some features may be limited until a valid license is applied."
            ) : (
              "After the ACAP is deployed, we'll automatically apply your license key to activate all features."
            )}
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};