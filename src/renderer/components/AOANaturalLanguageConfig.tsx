/**
 * AOA Natural Language Configuration Component
 * Allows users to describe what they want to detect in plain English
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Paper,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  SmartToy as AIIcon,
  Psychology as ProcessIcon,
  CameraAlt as CameraIcon,
  CheckCircle as SuccessIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon,
  ContentCopy as CopyIcon,
  Lightbulb as IdeaIcon,
  Send as SendIcon,
} from '@mui/icons-material';

interface NLScenarioResult {
  success: boolean;
  scenario?: {
    name: string;
    type: string;
    objectTypes: {
      humans?: boolean;
      vehicles?: boolean;
      vehicleSubTypes?: string[];
    };
    filters?: any;
    area?: Array<[number, number]>;
  };
  explanation?: string;
  confidence?: number;
  error?: string;
}

interface CommonScenarioTemplate {
  name: string;
  description: string;
  icon?: React.ReactNode;
}

const commonTemplates: CommonScenarioTemplate[] = [
  {
    name: 'Loitering Detection',
    description: 'People standing around or waiting for more than 30 seconds',
    icon: <WarningIcon />
  },
  {
    name: 'Vehicle Parking',
    description: 'Cars parking in the parking lot',
    icon: <CameraIcon />
  },
  {
    name: 'Entrance Counter',
    description: 'Count people entering through the main door',
    icon: <SuccessIcon />
  },
  {
    name: 'Delivery Detection',
    description: 'Delivery trucks stopping at the loading dock',
    icon: <CameraIcon />
  },
  {
    name: 'Running Detection',
    description: 'People running through the area',
    icon: <WarningIcon />
  },
  {
    name: 'Crowd Formation',
    description: 'Groups of people gathering together',
    icon: <WarningIcon />
  },
  {
    name: 'Queue Monitoring',
    description: 'People waiting in line',
    icon: <InfoIcon />
  },
  {
    name: 'Pet Detection',
    description: 'People walking with their dogs',
    icon: <CameraIcon />
  }
];

interface Props {
  cameraIp: string;
  username: string;
  password: string;
  geminiApiKey?: string;
  onScenarioCreated?: (scenario: any) => void;
}

export const AOANaturalLanguageConfig: React.FC<Props> = ({
  cameraIp,
  username,
  password,
  geminiApiKey,
  onScenarioCreated
}) => {
  const [description, setDescription] = useState('');
  const [context, setContext] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<NLScenarioResult | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const handleProcess = async () => {
    if (!description.trim() || !geminiApiKey) {
      return;
    }

    setProcessing(true);
    setResult(null);

    try {
      const response = await window.electron.ipcRenderer.invoke(
        'aoa-process-natural-language',
        geminiApiKey,
        description,
        context
      );

      setResult(response);
      setShowDetails(true);
    } catch (error) {
      console.error('Failed to process natural language:', error);
      setResult({
        success: false,
        error: 'Failed to process description'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleDeploy = async () => {
    if (!result?.scenario || !geminiApiKey) {
      return;
    }

    setDeploying(true);

    try {
      const response = await window.electron.ipcRenderer.invoke(
        'aoa-deploy-nl-scenario',
        cameraIp,
        username,
        password,
        geminiApiKey,
        description,
        context
      );

      if (response.success) {
        onScenarioCreated?.(response.details?.scenario);
        
        // Show success message
        setResult({
          ...result,
          explanation: `✅ Successfully deployed: ${response.message}`
        });
      } else {
        throw new Error(response.message);
      }
    } catch (error: any) {
      console.error('Failed to deploy scenario:', error);
      setResult({
        ...result,
        error: `Failed to deploy: ${error.message}`
      });
    } finally {
      setDeploying(false);
    }
  };

  const handleTemplateSelect = (template: CommonScenarioTemplate) => {
    setDescription(template.description);
    setSelectedTemplate(template.name);
  };

  const handleCopyConfig = () => {
    if (result?.scenario) {
      navigator.clipboard.writeText(JSON.stringify(result.scenario, null, 2));
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Card>
        <CardContent>
          <Stack spacing={3}>
            {/* Header */}
            <Box display="flex" alignItems="center" gap={2}>
              <AIIcon color="primary" fontSize="large" />
              <Box flex={1}>
                <Typography variant="h6">
                  AI-Powered Scenario Configuration
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Describe what you want to detect in plain English
                </Typography>
              </Box>
            </Box>

            {/* Common Templates */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box display="flex" alignItems="center" gap={1}>
                  <IdeaIcon color="action" />
                  <Typography>Common Scenarios</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={1}>
                  {commonTemplates.map((template) => (
                    <Grid item xs={12} sm={6} md={4} key={template.name}>
                      <Chip
                        icon={template.icon as any}
                        label={template.name}
                        onClick={() => handleTemplateSelect(template)}
                        variant={selectedTemplate === template.name ? 'filled' : 'outlined'}
                        color={selectedTemplate === template.name ? 'primary' : 'default'}
                        sx={{ width: '100%', justifyContent: 'flex-start' }}
                      />
                    </Grid>
                  ))}
                </Grid>
              </AccordionDetails>
            </Accordion>

            {/* Input Fields */}
            <TextField
              fullWidth
              multiline
              rows={3}
              label="What do you want to detect?"
              placeholder="E.g., 'Someone loitering near the entrance for more than 30 seconds' or 'Cars parking in the loading zone'"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={processing}
              helperText="Describe the behavior or situation you want to detect"
            />

            <TextField
              fullWidth
              label="Camera Context (Optional)"
              placeholder="E.g., 'parking lot', 'main entrance', 'warehouse'"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              disabled={processing}
              helperText="Helps AI understand the environment"
            />

            {/* Process Button */}
            <Button
              variant="contained"
              color="primary"
              onClick={handleProcess}
              disabled={!description.trim() || !geminiApiKey || processing}
              startIcon={processing ? <CircularProgress size={20} /> : <ProcessIcon />}
              fullWidth
            >
              {processing ? 'Processing with AI...' : 'Generate AOA Configuration'}
            </Button>

            {/* Results */}
            {result && (
              <Paper elevation={2} sx={{ p: 2 }}>
                {result.success && result.scenario ? (
                  <Stack spacing={2}>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Typography variant="subtitle1" fontWeight="bold">
                        Generated Configuration
                      </Typography>
                      <Box display="flex" gap={1}>
                        <Tooltip title="Copy configuration">
                          <IconButton size="small" onClick={handleCopyConfig}>
                            <CopyIcon />
                          </IconButton>
                        </Tooltip>
                        {result.confidence && (
                          <Chip
                            label={`${Math.round(result.confidence * 100)}% confidence`}
                            size="small"
                            color={result.confidence > 0.7 ? 'success' : 'warning'}
                          />
                        )}
                      </Box>
                    </Box>

                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Scenario Name
                        </Typography>
                        <Typography variant="body1" fontWeight="bold">
                          {result.scenario.name}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Type
                        </Typography>
                        <Typography variant="body1">
                          {result.scenario.type}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Detects
                        </Typography>
                        <Stack direction="row" spacing={1}>
                          {result.scenario.objectTypes.humans && (
                            <Chip label="Humans" size="small" />
                          )}
                          {result.scenario.objectTypes.vehicles && (
                            <Chip label="Vehicles" size="small" />
                          )}
                        </Stack>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Filters
                        </Typography>
                        <Stack direction="row" spacing={1}>
                          {result.scenario.filters?.timeInArea && (
                            <Chip 
                              label={`${result.scenario.filters.timeInArea}s loiter`} 
                              size="small" 
                              color="primary"
                            />
                          )}
                          {result.scenario.filters?.minimumSize && (
                            <Chip label="Size filter" size="small" />
                          )}
                        </Stack>
                      </Grid>
                    </Grid>

                    {result.explanation && (
                      <Alert severity="info" icon={<InfoIcon />}>
                        {result.explanation}
                      </Alert>
                    )}

                    {/* Deploy Button */}
                    <Button
                      variant="contained"
                      color="success"
                      onClick={handleDeploy}
                      disabled={deploying}
                      startIcon={deploying ? <CircularProgress size={20} /> : <SendIcon />}
                      fullWidth
                    >
                      {deploying ? 'Deploying to Camera...' : 'Deploy to Camera'}
                    </Button>
                  </Stack>
                ) : (
                  <Alert severity="error">
                    {result.error || 'Failed to generate configuration'}
                  </Alert>
                )}
              </Paper>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};