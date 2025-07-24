import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  LinearProgress,
  Alert,
  Button,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import { 
  VisionAgent, 
  AgentEvent, 
  AgentEventType,
} from '../../../../types/visionAgent';
import { format } from 'date-fns';

interface AgentMonitorProps {
  agent: VisionAgent;
  onClose: () => void;
}

const AgentMonitor: React.FC<AgentMonitorProps> = ({ agent, onClose }) => {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const eventListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadEvents();
    
    // Subscribe to real-time events
    const unsubscribe = window.electronAPI.agent.onEvent((event: AgentEvent) => {
      if (event.agentId === agent.id) {
        handleNewEvent(event);
      }
    });

    // Auto-refresh interval
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(loadEvents, 5000);
    }

    return () => {
      unsubscribe();
      if (interval) clearInterval(interval);
    };
  }, [agent.id, autoRefresh]);

  useEffect(() => {
    // Auto-scroll to bottom when new events arrive
    if (eventListRef.current) {
      eventListRef.current.scrollTop = eventListRef.current.scrollHeight;
    }
  }, [events]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const loadedEvents = await window.electronAPI.agent.getEvents(agent.id, 100);
      setEvents(loadedEvents);
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewEvent = (event: AgentEvent) => {
    setEvents(prev => [...prev, event]);
  };

  const exportEvents = () => {
    const data = events.map(e => ({
      timestamp: e.timestamp,
      type: e.type,
      data: e.data,
    }));
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-${agent.id}-events-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getEventIcon = (type: AgentEventType) => {
    switch (type) {
      case AgentEventType.ACTIVATED:
        return <SuccessIcon color="success" />;
      case AgentEventType.CONDITION_MET:
        return <InfoIcon color="info" />;
      case AgentEventType.ACTION_TAKEN:
        return <WarningIcon color="warning" />;
      case AgentEventType.ERROR:
        return <ErrorIcon color="error" />;
      case AgentEventType.LEARNING_UPDATE:
        return <TimelineIcon color="primary" />;
      default:
        return <InfoIcon />;
    }
  };

  const getEventColor = (type: AgentEventType): any => {
    switch (type) {
      case AgentEventType.ACTIVATED:
        return 'success';
      case AgentEventType.CONDITION_MET:
        return 'info';
      case AgentEventType.ACTION_TAKEN:
        return 'warning';
      case AgentEventType.ERROR:
        return 'error';
      case AgentEventType.LEARNING_UPDATE:
        return 'primary';
      default:
        return 'default';
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { height: '80vh' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6">{agent.name} - Live Monitor</Typography>
            <Typography variant="caption" color="text.secondary">
              Real-time agent activity and performance
            </Typography>
          </Box>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Grid container spacing={2} sx={{ height: '100%' }}>
          {/* Stats Panel */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Performance Metrics
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Response Time
                </Typography>
                <Typography variant="h6">
                  {agent.stats.performance.avgResponseTime}ms
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  CPU Usage
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LinearProgress 
                    variant="determinate" 
                    value={agent.stats.performance.cpuUsage} 
                    sx={{ flex: 1 }}
                  />
                  <Typography variant="body2">
                    {agent.stats.performance.cpuUsage}%
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Memory Usage
                </Typography>
                <Typography variant="h6">
                  {agent.stats.performance.memoryUsage}MB
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Accuracy
                </Typography>
                <Typography variant="h6">
                  {agent.learning.accuracy ? 
                    `${Math.round(agent.learning.accuracy * 100)}%` : 
                    'Learning...'
                  }
                </Typography>
              </Box>
            </Paper>

            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Agent Configuration
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Camera
                </Typography>
                <Typography variant="body2">
                  {agent.cameraId}
                </Typography>
              </Box>

              <Box sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Priority
                </Typography>
                <Typography variant="body2">
                  {agent.config.priority}/10
                </Typography>
              </Box>

              <Box sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Triggers
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                  {agent.config.triggers.map((trigger, i) => (
                    <Chip key={i} size="small" label={trigger.type} />
                  ))}
                </Box>
              </Box>

              <Box>
                <Typography variant="body2" color="text.secondary">
                  Actions
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                  {agent.config.actions.map((action, i) => (
                    <Chip key={i} size="small" label={action.type} variant="outlined" />
                  ))}
                </Box>
              </Box>
            </Paper>
          </Grid>

          {/* Events Panel */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle2">
                    Live Events ({events.length})
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      startIcon={<RefreshIcon />}
                      onClick={loadEvents}
                      disabled={loading}
                    >
                      Refresh
                    </Button>
                    <Button
                      size="small"
                      startIcon={<DownloadIcon />}
                      onClick={exportEvents}
                      disabled={events.length === 0}
                    >
                      Export
                    </Button>
                  </Box>
                </Box>
              </Box>

              <Box 
                ref={eventListRef}
                sx={{ 
                  flex: 1, 
                  overflow: 'auto',
                  p: 2,
                }}
              >
                {loading && events.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : events.length === 0 ? (
                  <Alert severity="info">
                    No events recorded yet. The agent will log events as it monitors.
                  </Alert>
                ) : (
                  <List>
                    {events.map((event) => (
                      <ListItem key={event.id} alignItems="flex-start">
                        <ListItemIcon>
                          {getEventIcon(event.type)}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip 
                                size="small" 
                                label={event.type.replace('_', ' ')}
                                color={getEventColor(event.type)}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {format(new Date(event.timestamp), 'HH:mm:ss.SSS')}
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <Box sx={{ mt: 1 }}>
                              {event.data.message && (
                                <Typography variant="body2">
                                  {event.data.message}
                                </Typography>
                              )}
                              {event.data.error && (
                                <Alert severity="error" sx={{ mt: 1 }}>
                                  {event.data.error}
                                </Alert>
                              )}
                              {event.thumbnail && (
                                <Box 
                                  component="img" 
                                  src={event.thumbnail}
                                  sx={{ 
                                    mt: 1, 
                                    maxWidth: 200, 
                                    borderRadius: 1,
                                    border: 1,
                                    borderColor: 'divider',
                                  }}
                                />
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </DialogContent>
    </Dialog>
  );
};

export default AgentMonitor;