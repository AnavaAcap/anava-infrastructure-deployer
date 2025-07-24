import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Button,
  Divider,
  Alert,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon,
  LocationOn as LocationIcon,
  NotificationsActive as ActionIcon,
  Videocam as CameraIcon,
  PlayArrow as PlayIcon,
} from '@mui/icons-material';
import { AgentWizardState, ActionType } from '../../../../types/visionAgent';

interface AgentReviewProps {
  wizardState: AgentWizardState;
  onDeploy: () => void;
}

const AgentReview: React.FC<AgentReviewProps> = ({ wizardState, onDeploy }) => {
  const { agent, regions, template } = wizardState;

  const getActionSummary = (action: any) => {
    switch (action.type) {
      case ActionType.CREATE_ALERT:
        return `Create ${action.priority} priority alert${action.config.includeSnapshot ? ' with snapshot' : ''}`;
      case ActionType.SEND_NOTIFICATION:
        return `Send push notification: "${action.config.title}"`;
      case ActionType.SPEAK:
        return `Speak: "${action.config.message}"`;
      case ActionType.EMAIL:
        return `Email to: ${action.config.recipients || 'configured recipients'}`;
      case ActionType.WEBHOOK:
        return `Call webhook: ${action.config.url || 'configured URL'}`;
      case ActionType.BOOKMARK:
        return `Bookmark recording as "${action.config.label}"`;
      default:
        return action.type;
    }
  };

  const getScheduleSummary = () => {
    if (!agent.config?.schedule) {
      return 'Always active (24/7)';
    }

    const rules = agent.config.schedule.rules;
    if (rules.length === 0) {
      return 'Always active (24/7)';
    }

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return rules.map(rule => {
      const daysList = rule.days.map(d => days[d]).join(', ');
      return `${daysList}: ${rule.startTime} - ${rule.endTime}`;
    }).join('; ');
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom align="center">
        Review Your Agent Configuration
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        Please review your agent configuration before deployment. Once deployed, the agent will begin monitoring immediately.
      </Alert>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Agent Details
            </Typography>
            
            <List dense>
              <ListItem>
                <ListItemIcon>
                  <CheckIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="Name"
                  secondary={agent.name || 'Unnamed Agent'}
                />
              </ListItem>
              
              <ListItem>
                <ListItemIcon>
                  <CheckIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="Template"
                  secondary={template?.name || 'Custom'}
                />
              </ListItem>
              
              <ListItem>
                <ListItemIcon>
                  <CameraIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="Camera"
                  secondary={agent.cameraId}
                />
              </ListItem>
              
              <ListItem>
                <ListItemIcon>
                  <ScheduleIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary="Schedule"
                  secondary={getScheduleSummary()}
                />
              </ListItem>
            </List>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Detection Areas
            </Typography>
            
            <List dense>
              {regions.map((region, index) => (
                <ListItem key={region.id}>
                  <ListItemIcon>
                    <LocationIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={region.name}
                    secondary={`${region.type} with ${region.points.length} points`}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Actions When Triggered
            </Typography>
            
            <List dense>
              {agent.config?.actions?.map((action, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    <ActionIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={getActionSummary(action)}
                    secondary={
                      <Chip
                        size="small"
                        label={action.priority}
                        color={
                          action.priority === 'critical' ? 'error' :
                          action.priority === 'high' ? 'warning' :
                          action.priority === 'medium' ? 'primary' : 'default'
                        }
                      />
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3, bgcolor: 'grey.50' }}>
            <Typography variant="h6" gutterBottom>
              Plain English Summary
            </Typography>
            <Typography variant="body1" sx={{ fontStyle: 'italic' }}>
              "{agent.name} will monitor {agent.cameraId} 
              {agent.config?.schedule ? ` during ${getScheduleSummary()}` : ' continuously'}. 
              When a {template?.config.triggers?.[0]?.config?.objectTypes?.join(' or ') || 'person'} 
              {regions[0]?.type === 'line_crossed' ? ' crosses the defined line' : ' enters the defined zone'}, 
              the agent will {agent.config?.actions?.map(a => getActionSummary(a).toLowerCase()).join(', ')}.
              This helps ensure {template?.description?.toLowerCase() || 'security monitoring'}."
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          startIcon={<PlayIcon />}
          onClick={onDeploy}
          sx={{ px: 4 }}
        >
          Deploy Agent
        </Button>
      </Box>
    </Box>
  );
};

export default AgentReview;