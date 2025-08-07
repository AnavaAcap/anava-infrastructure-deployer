import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Stepper,
  Step,
  StepLabel,
  StepButton,
  Box,
  Typography,
  Button,
  IconButton,
  Alert,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useCameraContext, ManagedCamera } from '../contexts/CameraContext';

// Import individual step components (we'll create these)
import CredentialsStep from './setup-steps/CredentialsStep';
import DiscoveryStep from './setup-steps/DiscoveryStep';
import DeploymentStep from './setup-steps/DeploymentStep';
import SpeakerStep from './setup-steps/SpeakerStep';
import VerificationStep from './setup-steps/VerificationStep';

interface CameraSetupWizardProps {
  open: boolean;
  onClose: () => void;
  editingCamera?: ManagedCamera | null;
}

const steps = [
  { label: 'Credentials', key: 'credentials' },
  { label: 'Discovery', key: 'discovery' },
  { label: 'Deployment', key: 'deployment' },
  { label: 'Speaker (Optional)', key: 'speaker', optional: true },
  { label: 'Verification', key: 'verification' },
];

const CameraSetupWizard: React.FC<CameraSetupWizardProps> = ({ open, onClose, editingCamera }) => {
  const { addCamera, updateCamera, selectedCamera, updateCameraStep } = useCameraContext();
  const [activeStep, setActiveStep] = useState(0);
  const [completed, setCompleted] = useState<{ [key: number]: boolean }>({});
  const [skipped, setSkipped] = useState<Set<number>>(new Set());

  // Initialize state based on editing camera
  useEffect(() => {
    if (editingCamera) {
      // Set completed steps based on camera status
      const newCompleted: { [key: number]: boolean } = {};
      if (editingCamera.status.credentials.completed) newCompleted[0] = true;
      if (editingCamera.status.discovery.completed) newCompleted[1] = true;
      if (editingCamera.status.deployment.completed) newCompleted[2] = true;
      if (editingCamera.status.speaker.completed) newCompleted[3] = true;
      if (editingCamera.status.verification.completed) newCompleted[4] = true;
      setCompleted(newCompleted);

      // Find the first incomplete step or default to deployment for quick access
      const firstIncomplete = steps.findIndex((_, index) => !newCompleted[index]);
      setActiveStep(firstIncomplete !== -1 ? firstIncomplete : 2);
    } else {
      // New camera setup
      setActiveStep(0);
      setCompleted({});
    }
  }, [editingCamera]);

  const handleStep = (step: number) => {
    // Allow navigation to any step if camera exists and has basic info
    if (editingCamera || selectedCamera) {
      setActiveStep(step);
    } else if (step <= activeStep || completed[step - 1]) {
      // For new cameras, require sequential completion
      setActiveStep(step);
    }
  };

  const handleNext = () => {
    const newCompleted = { ...completed };
    newCompleted[activeStep] = true;
    setCompleted(newCompleted);

    const nextStep = activeStep + 1;
    if (nextStep < steps.length) {
      setActiveStep(nextStep);
    }
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleSkip = () => {
    if (steps[activeStep].optional) {
      setSkipped((prevSkipped) => {
        const newSkipped = new Set(prevSkipped);
        newSkipped.add(activeStep);
        return newSkipped;
      });
      handleNext();
    }
  };

  const isStepComplete = (step: number) => {
    return completed[step];
  };

  const isStepSkipped = (step: number) => {
    return skipped.has(step);
  };

  const canNavigateToStep = (step: number) => {
    // If editing existing camera, allow navigation to any step
    if (editingCamera || selectedCamera) {
      return true;
    }
    // For new cameras, check prerequisites
    if (step === 0) return true;
    return completed[step - 1] || false;
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return <CredentialsStep onNext={handleNext} camera={editingCamera || selectedCamera} />;
      case 1:
        return <DiscoveryStep onNext={handleNext} onBack={handleBack} camera={editingCamera || selectedCamera} />;
      case 2:
        return <DeploymentStep onNext={handleNext} onBack={handleBack} camera={editingCamera || selectedCamera} />;
      case 3:
        return <SpeakerStep onNext={handleNext} onBack={handleBack} onSkip={handleSkip} camera={editingCamera || selectedCamera} />;
      case 4:
        return <VerificationStep onComplete={onClose} onBack={handleBack} camera={editingCamera || selectedCamera} />;
      default:
        return null;
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { height: '80vh', display: 'flex', flexDirection: 'column' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          {editingCamera ? `Configure ${editingCamera.name}` : 'Add New Camera'}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((step, index) => (
            <Step key={step.key} completed={isStepComplete(index)} skipped={isStepSkipped(index)}>
              <StepButton 
                onClick={() => handleStep(index)}
                disabled={!canNavigateToStep(index)}
                optional={step.optional ? <Typography variant="caption">Optional</Typography> : undefined}
              >
                {step.label}
              </StepButton>
            </Step>
          ))}
        </Stepper>

        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {renderStepContent(activeStep)}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default CameraSetupWizard;