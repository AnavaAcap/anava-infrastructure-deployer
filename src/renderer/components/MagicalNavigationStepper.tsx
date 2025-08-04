import React from 'react';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  Typography,
  Paper,
  styled,
  stepConnectorClasses,
  StepIconProps,
} from '@mui/material';
import {
  AutoFixHigh as WandIcon,
  Key as KeyIcon,
  RemoveRedEye as EyeIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';

const ColorlibConnector = styled(StepConnector)(({ theme }) => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: {
    top: 22,
  },
  [`&.${stepConnectorClasses.active}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      backgroundImage: 'linear-gradient(95deg, #00D4FF 0%, #0066FF 50%, #8B5CF6 100%)',
    },
  },
  [`&.${stepConnectorClasses.completed}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      backgroundImage: 'linear-gradient(95deg, #00D4FF 0%, #0066FF 50%, #8B5CF6 100%)',
    },
  },
  [`& .${stepConnectorClasses.line}`]: {
    height: 3,
    border: 0,
    backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : '#eaeaf0',
    borderRadius: 1,
  },
}));

const ColorlibStepIconRoot = styled('div')<{
  ownerState: { completed?: boolean; active?: boolean };
}>(({ theme, ownerState }) => ({
  backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[700] : '#ccc',
  zIndex: 1,
  color: '#fff',
  width: 50,
  height: 50,
  display: 'flex',
  borderRadius: '50%',
  justifyContent: 'center',
  alignItems: 'center',
  ...(ownerState.active && {
    backgroundImage: 'linear-gradient(136deg, #00D4FF 0%, #0066FF 100%)',
    boxShadow: '0 4px 10px 0 rgba(0,0,0,.25)',
  }),
  ...(ownerState.completed && {
    backgroundImage: 'linear-gradient(136deg, #00D4FF 0%, #8B5CF6 100%)',
  }),
}));

function ColorlibStepIcon(props: StepIconProps) {
  const { active, completed, className } = props;

  const icons: { [index: string]: React.ReactElement } = {
    1: <WandIcon />,
    2: <KeyIcon />,
    3: <EyeIcon />,
    4: <CheckIcon />,
  };

  return (
    <ColorlibStepIconRoot ownerState={{ completed, active }} className={className}>
      {icons[String(props.icon)]}
    </ColorlibStepIconRoot>
  );
}

export type MagicalStep = 'welcome' | 'api-key' | 'discovery' | 'complete';

interface MagicalNavigationStepperProps {
  currentStep: MagicalStep;
  onStepClick?: (step: MagicalStep) => void;
  hideOnComplete?: boolean;
}

const steps = [
  { id: 'welcome' as MagicalStep, label: 'Welcome' },
  { id: 'api-key' as MagicalStep, label: 'AI Setup' },
  { id: 'discovery' as MagicalStep, label: 'Camera Magic' },
  { id: 'complete' as MagicalStep, label: 'Vision Active' },
];

const MagicalNavigationStepper: React.FC<MagicalNavigationStepperProps> = ({
  currentStep,
  onStepClick,
  hideOnComplete = false,
}) => {
  const activeStepIndex = steps.findIndex(step => step.id === currentStep);

  if (hideOnComplete && currentStep === 'complete') {
    return null;
  }

  return (
    <Paper
      elevation={0}
      sx={{
        background: 'linear-gradient(180deg, rgba(10, 14, 39, 0.95) 0%, rgba(26, 31, 58, 0.95) 100%)',
        borderBottom: '1px solid rgba(0, 212, 255, 0.2)',
        px: 3,
        py: 1,
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(10px)',
      }}
    >
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        
        <Stepper
          alternativeLabel
          activeStep={activeStepIndex}
          connector={<ColorlibConnector />}
        >
          {steps.map((step, index) => (
            <Step key={step.id}>
              <StepLabel
                StepIconComponent={ColorlibStepIcon}
                onClick={() => {
                  // Allow navigation to previous steps or any step in dev mode
                  if (onStepClick && (index <= activeStepIndex || process.env.NODE_ENV === 'development')) {
                    onStepClick(step.id);
                  }
                }}
                sx={{
                  cursor: index <= activeStepIndex || process.env.NODE_ENV === 'development' ? 'pointer' : 'default',
                  '& .MuiStepLabel-label': {
                    color: index <= activeStepIndex ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.4)',
                    fontWeight: index === activeStepIndex ? 600 : 400,
                    mt: 1,
                  },
                  '&:hover': {
                    '& .MuiStepLabel-label': {
                      color: index <= activeStepIndex ? 'white' : 'rgba(255, 255, 255, 0.4)',
                    },
                  },
                }}
              >
                {step.label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>
    </Paper>
  );
};

export default MagicalNavigationStepper;