import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  Alert,
} from '@mui/material';
import { OpenInNew as OpenInNewIcon } from '@mui/icons-material';

interface BillingGuidanceDialogProps {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onRecheck: () => void;
}

const BillingGuidanceDialog: React.FC<BillingGuidanceDialogProps> = ({
  open,
  projectId,
  onClose,
  onRecheck,
}) => {
  const handleOpenBillingPage = () => {
    // Deep link directly to the project's billing page
    const billingUrl = `https://console.cloud.google.com/billing/linkedaccount?project=${projectId}`;
    window.electronAPI?.openExternal(billingUrl);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: 400 }
      }}
    >
      <DialogTitle>
        <Typography variant="h5" component="div">
          How to Enable Billing for Project
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" sx={{ mt: 1 }}>
          <code>{projectId}</code>
        </Typography>
      </DialogTitle>
      
      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 3 }}>
          Google Cloud requires billing to be enabled even for resources that fall within the free tier. 
          You won't be charged unless you exceed the free tier limits.
        </Alert>

        <Typography variant="body1" paragraph>
          Follow these steps in the Google Cloud Console. We'll keep this window open for you.
        </Typography>

        <Stepper orientation="vertical" sx={{ mt: 3 }}>
          <Step active>
            <StepLabel>
              <Typography variant="subtitle1" fontWeight={600}>
                Open the Google Cloud Billing Page
              </Typography>
            </StepLabel>
            <StepContent>
              <Typography variant="body2" color="text.secondary" paragraph>
                Click the button below to go directly to the billing page for your project.
              </Typography>
              <Button
                variant="contained"
                size="large"
                startIcon={<OpenInNewIcon />}
                onClick={handleOpenBillingPage}
                sx={{ mb: 2 }}
              >
                Open GCP Billing Page
              </Button>
              <Typography variant="caption" display="block" color="text.secondary">
                This will open in your default browser
              </Typography>
            </StepContent>
          </Step>

          <Step active>
            <StepLabel>
              <Typography variant="subtitle1" fontWeight={600}>
                Link or Create a Billing Account
              </Typography>
            </StepLabel>
            <StepContent>
              <Typography variant="body2" color="text.secondary" paragraph>
                On the Google Cloud page:
              </Typography>
              <Box component="ul" sx={{ pl: 2, '& li': { mb: 1 } }}>
                <Typography component="li" variant="body2" color="text.secondary">
                  Select an existing billing account from the dropdown, OR
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary">
                  Click "Create billing account" to set up a new one
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary">
                  Google may ask you to verify your payment information
                </Typography>
              </Box>
              <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.50', mt: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  <strong>Note:</strong> If you're using a personal account, you'll get $300 in free credits. 
                  For organization accounts, check with your billing administrator.
                </Typography>
              </Paper>
            </StepContent>
          </Step>

          <Step active>
            <StepLabel>
              <Typography variant="subtitle1" fontWeight={600}>
                Return and Re-check Status
              </Typography>
            </StepLabel>
            <StepContent>
              <Typography variant="body2" color="text.secondary" paragraph>
                Once billing is enabled in Google Cloud Console, return to this installer and click the 
                "Re-check Status" button below.
              </Typography>
              <Button
                variant="outlined"
                onClick={() => {
                  onRecheck();
                  onClose();
                }}
              >
                Re-check Status
              </Button>
            </StepContent>
          </Step>
        </Stepper>

        <Alert severity="warning" sx={{ mt: 3 }}>
          <Typography variant="body2">
            <strong>Troubleshooting:</strong> If you're seeing permission errors, ensure your Google account 
            has the "Billing Account User" or "Billing Account Administrator" role for the organization.
          </Typography>
        </Alert>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Close
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            onRecheck();
            onClose();
          }}
        >
          Re-check Status
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BillingGuidanceDialog;