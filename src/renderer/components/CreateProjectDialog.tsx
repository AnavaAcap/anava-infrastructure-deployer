import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Box,
  Typography,
  FormHelperText,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import {
  Business as BusinessIcon,
  AccountBalance as AccountBalanceIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';

interface CreateProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onProjectCreated: (projectId: string) => void;
}

export const CreateProjectDialog: React.FC<CreateProjectDialogProps> = ({
  open,
  onClose,
  onProjectCreated,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [projectName, setProjectName] = useState('');
  const [selectedOrganization, setSelectedOrganization] = useState<string | null>(null);
  const [selectedBillingAccount, setSelectedBillingAccount] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [billingAccounts, setBillingAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [loadingBilling, setLoadingBilling] = useState(false);

  const steps = ['Project Details', 'Organization & Billing', 'Create Project'];

  useEffect(() => {
    if (open && activeStep === 1) {
      loadOrganizationsAndBilling();
    }
  }, [open, activeStep]);

  const loadOrganizationsAndBilling = async () => {
    // Load organizations
    setLoadingOrgs(true);
    try {
      const { organizations, error } = await window.electronAPI.listOrganizations();
      if (error) {
        console.error('Error loading organizations:', error);
      }
      setOrganizations(organizations || []);
      // Select "No organization" by default
      const noOrg = organizations?.find(org => org.isPersonal);
      if (noOrg) {
        setSelectedOrganization(noOrg.id);
      }
    } catch (error) {
      console.error('Failed to load organizations:', error);
    } finally {
      setLoadingOrgs(false);
    }

    // Load billing accounts
    setLoadingBilling(true);
    try {
      const { accounts, error } = await window.electronAPI.listBillingAccounts();
      if (error) {
        console.error('Error loading billing accounts:', error);
      }
      setBillingAccounts(accounts || []);
      // Select first billing account if available
      if (accounts?.length > 0) {
        setSelectedBillingAccount(accounts[0].id);
      }
    } catch (error) {
      console.error('Failed to load billing accounts:', error);
    } finally {
      setLoadingBilling(false);
    }
  };

  const handleNext = () => {
    if (activeStep === 0 && !projectName.trim()) {
      setError('Please enter a project name');
      return;
    }
    setError(null);
    setActiveStep(prev => prev + 1);
  };

  const handleBack = () => {
    setError(null);
    setActiveStep(prev => prev - 1);
  };

  const handleCreate = async () => {
    setCreating(true);
    setError(null);

    try {
      const config = {
        projectName: projectName.trim(),
        organizationId: selectedOrganization || undefined,
        billingAccountId: selectedBillingAccount || undefined,
      };

      console.log('Creating project with config:', config);

      const result = await window.electronAPI.createProject(config);

      if (result.success && result.projectId) {
        onProjectCreated(result.projectId);
        handleClose();
      } else {
        setError(result.error || 'Failed to create project');
      }
    } catch (error: any) {
      console.error('Error creating project:', error);
      setError(error.message || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setActiveStep(0);
    setProjectName('');
    setSelectedOrganization(null);
    setSelectedBillingAccount(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={creating ? undefined : handleClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>Create New Google Cloud Project</DialogTitle>
      
      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {activeStep === 0 && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Enter a name for your new Google Cloud project. The project ID will be 
              automatically generated based on the name.
            </Typography>
            
            <TextField
              autoFocus
              fullWidth
              label="Project Name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="My Anava Project"
              helperText="Use a descriptive name for your project"
              disabled={creating}
            />
          </Box>
        )}

        {activeStep === 1 && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Select the organization and billing account for your project. 
              A billing account is required to enable paid Google Cloud services.
            </Typography>

            {/* Organization Selection */}
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Organization</InputLabel>
              <Select
                value={selectedOrganization || ''}
                onChange={(e) => setSelectedOrganization(e.target.value || null)}
                disabled={loadingOrgs || creating}
                startAdornment={<BusinessIcon sx={{ mr: 1, color: 'action.active' }} />}
              >
                {organizations.map((org) => (
                  <MenuItem key={org.id || 'personal'} value={org.id || ''}>
                    {org.displayName}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                Choose "No organization" for personal projects
              </FormHelperText>
            </FormControl>

            {/* Billing Account Selection */}
            <FormControl fullWidth>
              <InputLabel>Billing Account</InputLabel>
              <Select
                value={selectedBillingAccount || ''}
                onChange={(e) => setSelectedBillingAccount(e.target.value || null)}
                disabled={loadingBilling || creating}
                startAdornment={<AccountBalanceIcon sx={{ mr: 1, color: 'action.active' }} />}
              >
                <MenuItem value="">
                  <em>No billing account (Free tier only)</em>
                </MenuItem>
                {billingAccounts.map((account) => (
                  <MenuItem key={account.id} value={account.id}>
                    {account.displayName}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                Required for compute resources and API Gateway. You can add billing later if needed.
              </FormHelperText>
            </FormControl>

            {billingAccounts.length === 0 && !loadingBilling && (
              <Alert severity="info" sx={{ mt: 2 }}>
                No billing accounts found. You'll need to set up billing in the Google Cloud Console 
                to use paid services like Compute Engine and API Gateway.
              </Alert>
            )}
          </Box>
        )}

        {activeStep === 2 && (
          <Box textAlign="center" py={3}>
            {creating ? (
              <>
                <CircularProgress size={48} sx={{ mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Creating your project...
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  This may take a few moments. Please don't close this window.
                </Typography>
              </>
            ) : (
              <>
                <CheckCircleIcon color="primary" sx={{ fontSize: 48, mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Ready to create project
                </Typography>
                <Box sx={{ mt: 2, textAlign: 'left', mx: 'auto', maxWidth: 400 }}>
                  <Typography variant="body2" gutterBottom>
                    <strong>Project Name:</strong> {projectName}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Organization:</strong> {
                      organizations.find(org => org.id === selectedOrganization)?.displayName || 
                      'No organization'
                    }
                  </Typography>
                  <Typography variant="body2">
                    <strong>Billing:</strong> {
                      selectedBillingAccount ? 
                      billingAccounts.find(acc => acc.id === selectedBillingAccount)?.displayName :
                      'No billing account'
                    }
                  </Typography>
                </Box>
              </>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button 
          onClick={handleClose} 
          disabled={creating}
        >
          Cancel
        </Button>
        {activeStep > 0 && (
          <Button 
            onClick={handleBack}
            disabled={creating}
          >
            Back
          </Button>
        )}
        {activeStep < 2 && (
          <Button 
            onClick={handleNext}
            variant="contained"
            disabled={creating}
          >
            Next
          </Button>
        )}
        {activeStep === 2 && (
          <Button 
            onClick={handleCreate}
            variant="contained"
            disabled={creating}
          >
            Create Project
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};