import React, { useState, useEffect } from 'react';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  Typography,
  Paper,
  Container,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActionArea,
  IconButton,
  Fade,
  Slide,
  CircularProgress,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Shield as ShieldIcon,
  Videocam as VideocamIcon,
  Schedule as ScheduleIcon,
  NotificationsActive as NotificationsIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Check as CheckIcon,
  Security as SecurityIcon,
  LocalShipping as ShippingIcon,
  DirectionsCar as CarIcon,
  Group as GroupIcon,
  Warning as WarningIcon,
  Analytics as AnalyticsIcon,
} from '@mui/icons-material';
import { 
  VisionAgent, 
  AgentTemplate, 
  TemplateCategory,
  AgentWizardState,
  RegionOfInterest,
  AgentStatus,
} from '../../../types/visionAgent';
import CameraSelector from './components/CameraSelector';
import ROIDrawer from './components/ROIDrawer';
import ScheduleBuilder from './components/ScheduleBuilder';
import ActionConfigurator from './components/ActionConfigurator';
import AgentReview from './components/AgentReview';

interface AgentCanvasProps {
  onClose: () => void;
  onAgentCreated: (agent: VisionAgent) => void;
  cameras: any[]; // Camera list from deployment
}

const steps = [
  'Choose Your Mission',
  'Select Camera',
  'Define Area',
  'Set Rules',
  'Configure Actions',
  'Review & Deploy',
];

// Agent template definitions
const agentTemplates: AgentTemplate[] = [
  {
    id: 'perimeter-guard',
    name: 'Perimeter Guard',
    description: 'Detect when someone crosses a virtual fence line',
    icon: 'shield',
    category: TemplateCategory.SECURITY,
    popularity: 95,
    config: {
      triggers: [{
        id: 'motion',
        type: 'object_detected',
        config: { objectTypes: ['person', 'vehicle'] }
      }],
      conditions: [{
        id: 'line-cross',
        type: 'line_crossed',
        operator: 'and',
        config: { direction: 'both' }
      }],
      actions: [{
        id: 'alert',
        type: 'create_alert',
        priority: 'high',
        config: { includeSnapshot: true }
      }],
    },
    requiredInputs: [{
      id: 'perimeter-line',
      label: 'Draw the perimeter line',
      type: 'roi',
      required: true,
    }],
  },
  {
    id: 'secure-zone',
    name: 'Secure Zone Monitor',
    description: 'Alert when someone enters a restricted area',
    icon: 'security',
    category: TemplateCategory.SECURITY,
    popularity: 90,
    config: {
      triggers: [{
        id: 'motion',
        type: 'object_detected',
        config: { objectTypes: ['person'] }
      }],
      conditions: [{
        id: 'in-zone',
        type: 'object_in_zone',
        operator: 'and',
        config: {}
      }],
      actions: [{
        id: 'alert',
        type: 'create_alert',
        priority: 'critical',
        config: { includeSnapshot: true }
      }, {
        id: 'speak',
        type: 'speak',
        priority: 'high',
        config: { message: 'Unauthorized access detected. Security has been notified.' }
      }],
    },
    requiredInputs: [{
      id: 'secure-area',
      label: 'Draw the secure zone',
      type: 'roi',
      required: true,
    }, {
      id: 'schedule',
      label: 'When should this be active?',
      type: 'time',
      required: false,
      defaultValue: 'always',
    }],
  },
  {
    id: 'delivery-manager',
    name: 'Delivery Manager',
    description: 'Monitor loading dock arrivals and departures',
    icon: 'shipping',
    category: TemplateCategory.OPERATIONS,
    popularity: 85,
    config: {
      triggers: [{
        id: 'vehicle',
        type: 'object_detected',
        config: { objectTypes: ['vehicle'] }
      }],
      conditions: [{
        id: 'in-dock',
        type: 'object_in_zone',
        operator: 'and',
        config: {}
      }],
      actions: [{
        id: 'notify',
        type: 'send_notification',
        priority: 'medium',
        config: { 
          title: 'Delivery Arrival',
          message: 'A vehicle has arrived at the loading dock'
        }
      }, {
        id: 'bookmark',
        type: 'bookmark',
        priority: 'low',
        config: { label: 'Delivery' }
      }],
    },
    requiredInputs: [{
      id: 'loading-zone',
      label: 'Draw the loading dock area',
      type: 'roi',
      required: true,
    }],
  },
  {
    id: 'loitering-detector',
    name: 'Loitering Detector',
    description: 'Alert if someone stays in an area too long',
    icon: 'warning',
    category: TemplateCategory.SECURITY,
    popularity: 80,
    config: {
      triggers: [{
        id: 'person',
        type: 'object_detected',
        config: { objectTypes: ['person'] }
      }],
      conditions: [{
        id: 'time-check',
        type: 'time_in_zone',
        operator: 'greater_than',
        config: { seconds: 180 } // 3 minutes
      }],
      actions: [{
        id: 'alert',
        type: 'create_alert',
        priority: 'medium',
        config: { 
          title: 'Loitering Detected',
          includeSnapshot: true 
        }
      }],
    },
    requiredInputs: [{
      id: 'watch-zone',
      label: 'Draw the area to monitor',
      type: 'roi',
      required: true,
    }, {
      id: 'duration',
      label: 'Maximum time allowed (seconds)',
      type: 'number',
      required: true,
      defaultValue: 180,
    }],
  },
];

const AgentCanvas: React.FC<AgentCanvasProps> = ({ onClose, onAgentCreated, cameras }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [wizardState, setWizardState] = useState<AgentWizardState>({
    currentStep: 0,
    agent: {
      status: AgentStatus.DRAFT,
      created: new Date(),
      lastModified: new Date(),
      config: {
        triggers: [],
        conditions: [],
        actions: [],
        priority: 5,
      },
      stats: {
        activations: 0,
        alerts: 0,
        falsePositives: 0,
        uptime: 0,
        performance: {
          avgResponseTime: 0,
          cpuUsage: 0,
          memoryUsage: 0,
        },
      },
      learning: {
        feedbackCount: 0,
        accuracy: 0,
        improvements: [],
      },
    },
    regions: [],
    testMode: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      // Deploy the agent
      deployAgent();
    } else {
      setActiveStep((prevStep) => prevStep + 1);
      setWizardState((prev) => ({ ...prev, currentStep: activeStep + 1 }));
    }
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
    setWizardState((prev) => ({ ...prev, currentStep: activeStep - 1 }));
  };

  const handleTemplateSelect = (template: AgentTemplate) => {
    setWizardState((prev) => ({
      ...prev,
      template,
      agent: {
        ...prev.agent,
        name: template.name,
        description: template.description,
        templateId: template.id,
        config: {
          ...prev.agent.config,
          ...template.config,
        },
      },
    }));
    handleNext();
  };

  const handleCameraSelect = (cameraId: string) => {
    setWizardState((prev) => ({
      ...prev,
      agent: {
        ...prev.agent,
        cameraId,
      },
    }));
    handleNext();
  };

  const handleROIComplete = (regions: RegionOfInterest[]) => {
    setWizardState((prev) => ({
      ...prev,
      regions,
    }));
    handleNext();
  };

  const handleScheduleComplete = (schedule: any) => {
    setWizardState((prev) => ({
      ...prev,
      agent: {
        ...prev.agent,
        config: {
          ...prev.agent.config!,
          schedule,
        },
      },
    }));
    handleNext();
  };

  const handleActionsComplete = (actions: any[]) => {
    setWizardState((prev) => ({
      ...prev,
      agent: {
        ...prev.agent,
        config: {
          ...prev.agent.config!,
          actions,
        },
      },
    }));
    handleNext();
  };

  const deployAgent = async () => {
    setLoading(true);
    setError(null);

    try {
      // Generate unique ID
      const agentId = `agent-${Date.now()}`;
      
      // Create the complete agent object
      const newAgent: VisionAgent = {
        id: agentId,
        name: wizardState.agent.name || 'Unnamed Agent',
        description: wizardState.agent.description || '',
        templateId: wizardState.agent.templateId,
        cameraId: wizardState.agent.cameraId!,
        status: AgentStatus.ACTIVE,
        created: new Date(),
        lastModified: new Date(),
        config: wizardState.agent.config!,
        stats: wizardState.agent.stats!,
        learning: wizardState.agent.learning!,
      };

      // TODO: Call backend API to deploy agent
      // For now, we'll simulate the deployment
      await new Promise(resolve => setTimeout(resolve, 2000));

      onAgentCreated(newAgent);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to deploy agent');
    } finally {
      setLoading(false);
    }
  };

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Fade in timeout={500}>
            <Box>
              <Typography variant="h5" gutterBottom align="center" sx={{ mb: 4 }}>
                What would you like your agent to do?
              </Typography>
              
              <Grid container spacing={3}>
                {agentTemplates.map((template) => (
                  <Grid item xs={12} sm={6} md={4} key={template.id}>
                    <Card 
                      sx={{ 
                        height: '100%',
                        cursor: 'pointer',
                        transition: 'all 0.3s',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: 4,
                        },
                      }}
                      onClick={() => handleTemplateSelect(template)}
                    >
                      <CardActionArea sx={{ height: '100%' }}>
                        <CardContent sx={{ textAlign: 'center', p: 3 }}>
                          <Box sx={{ mb: 2 }}>
                            {getTemplateIcon(template.icon)}
                          </Box>
                          <Typography variant="h6" gutterBottom>
                            {template.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {template.description}
                          </Typography>
                          <Box sx={{ mt: 2 }}>
                            <Chip 
                              size="small" 
                              label={template.category}
                              color={template.category === TemplateCategory.SECURITY ? 'error' : 'primary'}
                            />
                          </Box>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Fade>
        );

      case 1:
        return (
          <CameraSelector
            cameras={cameras}
            selectedCameraId={wizardState.agent.cameraId}
            onSelect={handleCameraSelect}
          />
        );

      case 2:
        return (
          <ROIDrawer
            cameraId={wizardState.agent.cameraId!}
            template={wizardState.template}
            onComplete={handleROIComplete}
          />
        );

      case 3:
        return (
          <ScheduleBuilder
            template={wizardState.template}
            onComplete={handleScheduleComplete}
          />
        );

      case 4:
        return (
          <ActionConfigurator
            template={wizardState.template}
            onComplete={handleActionsComplete}
          />
        );

      case 5:
        return (
          <AgentReview
            wizardState={wizardState}
            onDeploy={deployAgent}
          />
        );

      default:
        return 'Unknown step';
    }
  };

  const getTemplateIcon = (iconName: string) => {
    const iconProps = { sx: { fontSize: 48 } };
    
    switch (iconName) {
      case 'shield':
        return <ShieldIcon {...iconProps} color="primary" />;
      case 'security':
        return <SecurityIcon {...iconProps} color="error" />;
      case 'shipping':
        return <ShippingIcon {...iconProps} color="success" />;
      case 'warning':
        return <WarningIcon {...iconProps} color="warning" />;
      default:
        return <VideocamIcon {...iconProps} />;
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          height: '90vh',
          maxHeight: 900,
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h5">Create Vision Agent</Typography>
          <IconButton onClick={onClose}>
            <ArrowBackIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ width: '100%', mt: 2 }}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
          
          <Box sx={{ mt: 4, minHeight: 400 }}>
            {getStepContent(activeStep)}
          </Box>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button
          disabled={activeStep === 0 || loading}
          onClick={handleBack}
          startIcon={<ArrowBackIcon />}
        >
          Back
        </Button>
        
        <Box sx={{ flex: 1 }} />
        
        <Button
          variant="contained"
          onClick={handleNext}
          disabled={loading}
          endIcon={
            loading ? (
              <CircularProgress size={20} />
            ) : activeStep === steps.length - 1 ? (
              <CheckIcon />
            ) : (
              <ArrowForwardIcon />
            )
          }
        >
          {activeStep === steps.length - 1 ? 'Deploy Agent' : 'Next'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AgentCanvas;