import React, { useState } from 'react';
import {
  Box,
  Typography,
  FormControl,
  FormControlLabel,
  Checkbox,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  Chip,
  Grid,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Notifications as NotificationIcon,
  Email as EmailIcon,
  VolumeUp as SpeakerIcon,
  Webhook as WebhookIcon,
  Bookmark as BookmarkIcon,
} from '@mui/icons-material';
import { AgentTemplate, ActionType, ActionPriority } from '../../../../types/visionAgent';

interface ActionConfiguratorProps {
  template?: AgentTemplate;
  onComplete: (actions: any[]) => void;
}

interface ActionConfig {
  type: ActionType;
  enabled: boolean;
  priority: ActionPriority;
  config: Record<string, any>;
}

const ActionConfigurator: React.FC<ActionConfiguratorProps> = ({ template, onComplete }) => {
  const defaultActions: ActionConfig[] = [
    {
      type: ActionType.CREATE_ALERT,
      enabled: true,
      priority: ActionPriority.HIGH,
      config: {
        includeSnapshot: true,
        includeVideo: false,
        videoDuration: 10,
      },
    },
    {
      type: ActionType.SEND_NOTIFICATION,
      enabled: true,
      priority: ActionPriority.MEDIUM,
      config: {
        recipients: ['security-team'],
        title: 'Security Alert',
        body: 'Agent detected an event requiring attention',
      },
    },
    {
      type: ActionType.SPEAK,
      enabled: false,
      priority: ActionPriority.HIGH,
      config: {
        message: 'You are in a restricted area. Please leave immediately.',
        voice: 'authoritative',
        repeat: 1,
      },
    },
    {
      type: ActionType.EMAIL,
      enabled: false,
      priority: ActionPriority.LOW,
      config: {
        recipients: '',
        subject: 'Security Alert from Vision Agent',
        includeSnapshot: true,
      },
    },
    {
      type: ActionType.WEBHOOK,
      enabled: false,
      priority: ActionPriority.MEDIUM,
      config: {
        url: '',
        method: 'POST',
        headers: {},
        includeSnapshot: false,
      },
    },
    {
      type: ActionType.BOOKMARK,
      enabled: true,
      priority: ActionPriority.LOW,
      config: {
        label: 'Agent Event',
        color: 'red',
      },
    },
  ];

  const [actions, setActions] = useState<ActionConfig[]>(
    template?.config.actions 
      ? defaultActions.map(da => {
          const templateAction = template.config.actions?.find(ta => ta.type === da.type);
          return templateAction ? { ...da, ...templateAction, enabled: true } : da;
        })
      : defaultActions
  );

  const handleActionToggle = (index: number) => {
    const newActions = [...actions];
    newActions[index].enabled = !newActions[index].enabled;
    setActions(newActions);
  };

  const handleConfigChange = (index: number, field: string, value: any) => {
    const newActions = [...actions];
    newActions[index].config[field] = value;
    setActions(newActions);
  };

  const handlePriorityChange = (index: number, priority: ActionPriority) => {
    const newActions = [...actions];
    newActions[index].priority = priority;
    setActions(newActions);
  };

  const handleComplete = () => {
    const enabledActions = actions
      .filter(a => a.enabled)
      .map((a, index) => ({
        id: `action-${index}`,
        type: a.type,
        priority: a.priority,
        config: a.config,
      }));

    if (enabledActions.length === 0) {
      alert('Please enable at least one action');
      return;
    }

    onComplete(enabledActions);
  };

  const getActionIcon = (type: ActionType) => {
    switch (type) {
      case ActionType.SEND_NOTIFICATION:
        return <NotificationIcon />;
      case ActionType.EMAIL:
        return <EmailIcon />;
      case ActionType.SPEAK:
        return <SpeakerIcon />;
      case ActionType.WEBHOOK:
        return <WebhookIcon />;
      case ActionType.BOOKMARK:
        return <BookmarkIcon />;
      default:
        return <NotificationIcon />;
    }
  };

  const getActionTitle = (type: ActionType) => {
    switch (type) {
      case ActionType.CREATE_ALERT:
        return 'Create Security Alert';
      case ActionType.SEND_NOTIFICATION:
        return 'Send Push Notification';
      case ActionType.SPEAK:
        return 'Speak Through Camera';
      case ActionType.EMAIL:
        return 'Send Email Alert';
      case ActionType.WEBHOOK:
        return 'Call Webhook';
      case ActionType.BOOKMARK:
        return 'Bookmark Recording';
      default:
        return type;
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom align="center">
        What should happen when conditions are met?
      </Typography>

      <Box sx={{ mt: 3 }}>
        {actions.map((action, index) => (
          <Accordion
            key={index}
            expanded={action.enabled}
            onChange={() => handleActionToggle(index)}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <Checkbox
                  checked={action.enabled}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => handleActionToggle(index)}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  {getActionIcon(action.type)}
                  <Typography sx={{ ml: 2 }}>{getActionTitle(action.type)}</Typography>
                </Box>
                <Chip
                  size="small"
                  label={action.priority}
                  color={
                    action.priority === ActionPriority.CRITICAL ? 'error' :
                    action.priority === ActionPriority.HIGH ? 'warning' :
                    action.priority === ActionPriority.MEDIUM ? 'primary' : 'default'
                  }
                />
              </Box>
            </AccordionSummary>
            
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Priority</InputLabel>
                    <Select
                      value={action.priority}
                      onChange={(e) => handlePriorityChange(index, e.target.value as ActionPriority)}
                      label="Priority"
                    >
                      <MenuItem value={ActionPriority.CRITICAL}>Critical</MenuItem>
                      <MenuItem value={ActionPriority.HIGH}>High</MenuItem>
                      <MenuItem value={ActionPriority.MEDIUM}>Medium</MenuItem>
                      <MenuItem value={ActionPriority.LOW}>Low</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {/* Action-specific configuration */}
                {action.type === ActionType.CREATE_ALERT && (
                  <>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={action.config.includeSnapshot}
                            onChange={(e) => handleConfigChange(index, 'includeSnapshot', e.target.checked)}
                          />
                        }
                        label="Include snapshot image"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={action.config.includeVideo}
                            onChange={(e) => handleConfigChange(index, 'includeVideo', e.target.checked)}
                          />
                        }
                        label="Include video clip"
                      />
                    </Grid>
                    {action.config.includeVideo && (
                      <Grid item xs={12}>
                        <TextField
                          label="Video duration (seconds)"
                          type="number"
                          value={action.config.videoDuration}
                          onChange={(e) => handleConfigChange(index, 'videoDuration', parseInt(e.target.value))}
                          fullWidth
                          size="small"
                        />
                      </Grid>
                    )}
                  </>
                )}

                {action.type === ActionType.SEND_NOTIFICATION && (
                  <>
                    <Grid item xs={12}>
                      <TextField
                        label="Notification title"
                        value={action.config.title}
                        onChange={(e) => handleConfigChange(index, 'title', e.target.value)}
                        fullWidth
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        label="Notification message"
                        value={action.config.body}
                        onChange={(e) => handleConfigChange(index, 'body', e.target.value)}
                        fullWidth
                        multiline
                        rows={2}
                        size="small"
                      />
                    </Grid>
                  </>
                )}

                {action.type === ActionType.SPEAK && (
                  <>
                    <Grid item xs={12}>
                      <TextField
                        label="Message to speak"
                        value={action.config.message}
                        onChange={(e) => handleConfigChange(index, 'message', e.target.value)}
                        fullWidth
                        multiline
                        rows={2}
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Voice tone</InputLabel>
                        <Select
                          value={action.config.voice}
                          onChange={(e) => handleConfigChange(index, 'voice', e.target.value)}
                          label="Voice tone"
                        >
                          <MenuItem value="friendly">Friendly</MenuItem>
                          <MenuItem value="authoritative">Authoritative</MenuItem>
                          <MenuItem value="urgent">Urgent</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        label="Repeat times"
                        type="number"
                        value={action.config.repeat}
                        onChange={(e) => handleConfigChange(index, 'repeat', parseInt(e.target.value))}
                        fullWidth
                        size="small"
                        inputProps={{ min: 1, max: 3 }}
                      />
                    </Grid>
                  </>
                )}

                {action.type === ActionType.EMAIL && (
                  <>
                    <Grid item xs={12}>
                      <TextField
                        label="Email recipients (comma-separated)"
                        value={action.config.recipients}
                        onChange={(e) => handleConfigChange(index, 'recipients', e.target.value)}
                        fullWidth
                        size="small"
                        placeholder="security@company.com, admin@company.com"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        label="Email subject"
                        value={action.config.subject}
                        onChange={(e) => handleConfigChange(index, 'subject', e.target.value)}
                        fullWidth
                        size="small"
                      />
                    </Grid>
                  </>
                )}

                {action.type === ActionType.WEBHOOK && (
                  <>
                    <Grid item xs={12}>
                      <TextField
                        label="Webhook URL"
                        value={action.config.url}
                        onChange={(e) => handleConfigChange(index, 'url', e.target.value)}
                        fullWidth
                        size="small"
                        placeholder="https://api.example.com/webhook"
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel>HTTP Method</InputLabel>
                        <Select
                          value={action.config.method}
                          onChange={(e) => handleConfigChange(index, 'method', e.target.value)}
                          label="HTTP Method"
                        >
                          <MenuItem value="POST">POST</MenuItem>
                          <MenuItem value="GET">GET</MenuItem>
                          <MenuItem value="PUT">PUT</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </>
                )}
              </Grid>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>

      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleComplete}
        >
          Continue
        </Button>
      </Box>
    </Box>
  );
};

export default ActionConfigurator;