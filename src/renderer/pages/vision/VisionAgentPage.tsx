import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Chip,
  LinearProgress,
  Menu,
  MenuItem,
  Alert,
  Fab,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Add as AddIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreIcon,
  Visibility as ViewIcon,
  Assessment as StatsIcon,
} from '@mui/icons-material';
import { 
  VisionAgent, 
  AgentStatus, 
  AgentEvent,
  AgentEventType,
} from '../../../types/visionAgent';
import AgentCanvas from './AgentCanvas';
import AgentMonitor from './components/AgentMonitor';

interface VisionAgentPageProps {
  deploymentConfig?: any;
  configuredCameras?: any[];
}

const VisionAgentPage: React.FC<VisionAgentPageProps> = ({ 
  deploymentConfig, 
  configuredCameras = [] 
}) => {
  const [agents, setAgents] = useState<VisionAgent[]>([]);
  const [showAgentCanvas, setShowAgentCanvas] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<VisionAgent | null>(null);
  const [showMonitor, setShowMonitor] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedAgentMenu, setSelectedAgentMenu] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAgents();
    
    // Subscribe to agent events
    const unsubscribe = window.electronAPI.agent.onEvent((event: AgentEvent) => {
      handleAgentEvent(event);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const response = await window.electronAPI.agent.list();
      setAgents(response.agents);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAgentEvent = (event: AgentEvent) => {
    // Update agent status based on events
    if (event.type === AgentEventType.ACTIVATED) {
      setAgents(prev => prev.map(a => 
        a.id === event.agentId 
          ? { ...a, lastActive: new Date() }
          : a
      ));
    }
  };

  const handleAgentCreated = async (agent: VisionAgent) => {
    await loadAgents();
    setShowAgentCanvas(false);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, agentId: string) => {
    setAnchorEl(event.currentTarget);
    setSelectedAgentMenu(agentId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedAgentMenu(null);
  };

  const handleAgentAction = async (action: string, agentId: string) => {
    handleMenuClose();
    
    try {
      switch (action) {
        case 'pause':
          await window.electronAPI.agent.pause(agentId);
          break;
        case 'resume':
          await window.electronAPI.agent.resume(agentId);
          break;
        case 'delete':
          if (confirm('Are you sure you want to delete this agent?')) {
            await window.electronAPI.agent.delete(agentId);
          }
          break;
        case 'view':
          const agent = agents.find(a => a.id === agentId);
          if (agent) {
            setSelectedAgent(agent);
            setShowMonitor(true);
          }
          break;
      }
      
      await loadAgents();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getStatusColor = (status: AgentStatus) => {
    switch (status) {
      case AgentStatus.ACTIVE:
        return 'success';
      case AgentStatus.PAUSED:
        return 'warning';
      case AgentStatus.ERROR:
        return 'error';
      case AgentStatus.LEARNING:
        return 'info';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: AgentStatus) => {
    switch (status) {
      case AgentStatus.ACTIVE:
        return <PlayIcon />;
      case AgentStatus.PAUSED:
        return <PauseIcon />;
      case AgentStatus.ERROR:
        return <StopIcon />;
      default:
        return null;
    }
  };

  if (loading) {
    return <LinearProgress />;
  }

  return (
    <Box sx={{ p: 3, position: 'relative', minHeight: '80vh' }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Vision Agents
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Autonomous AI agents that monitor, understand, and respond to camera events
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {agents.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            No agents configured yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Create your first Vision Agent to start intelligent monitoring
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<AddIcon />}
            onClick={() => setShowAgentCanvas(true)}
          >
            Create Your First Agent
          </Button>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {agents.map((agent) => (
            <Grid item xs={12} sm={6} md={4} key={agent.id}>
              <Card 
                sx={{ 
                  height: '100%',
                  position: 'relative',
                  transition: 'all 0.3s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  },
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Badge
                        overlap="circular"
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        badgeContent={getStatusIcon(agent.status)}
                        sx={{
                          '& .MuiBadge-badge': {
                            bgcolor: `${getStatusColor(agent.status)}.main`,
                            color: 'white',
                            p: 0.5,
                          },
                        }}
                      >
                        <ViewIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
                      </Badge>
                    </Box>
                    
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, agent.id)}
                    >
                      <MoreIcon />
                    </IconButton>
                  </Box>

                  <Typography variant="h6" gutterBottom>
                    {agent.name}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {agent.description}
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    <Chip 
                      size="small" 
                      label={agent.status}
                      color={getStatusColor(agent.status)}
                    />
                    {agent.templateId && (
                      <Chip 
                        size="small" 
                        label={agent.templateId.replace('-', ' ')}
                        variant="outlined"
                      />
                    )}
                  </Box>

                  <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2, mt: 2 }}>
                    <Grid container spacing={1} sx={{ textAlign: 'center' }}>
                      <Grid item xs={4}>
                        <Typography variant="h6">
                          {agent.stats.activations}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Activations
                        </Typography>
                      </Grid>
                      <Grid item xs={4}>
                        <Typography variant="h6">
                          {agent.stats.alerts}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Alerts
                        </Typography>
                      </Grid>
                      <Grid item xs={4}>
                        <Typography variant="h6">
                          {agent.learning.accuracy ? 
                            `${Math.round(agent.learning.accuracy * 100)}%` : 
                            'N/A'
                          }
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Accuracy
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Agent action menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {selectedAgentMenu && agents.find(a => a.id === selectedAgentMenu)?.status === AgentStatus.ACTIVE ? (
          <MenuItem onClick={() => handleAgentAction('pause', selectedAgentMenu!)}>
            <PauseIcon sx={{ mr: 1 }} /> Pause Agent
          </MenuItem>
        ) : (
          <MenuItem onClick={() => handleAgentAction('resume', selectedAgentMenu!)}>
            <PlayIcon sx={{ mr: 1 }} /> Resume Agent
          </MenuItem>
        )}
        <MenuItem onClick={() => handleAgentAction('view', selectedAgentMenu!)}>
          <ViewIcon sx={{ mr: 1 }} /> Monitor Agent
        </MenuItem>
        <MenuItem onClick={() => handleAgentAction('edit', selectedAgentMenu!)}>
          <EditIcon sx={{ mr: 1 }} /> Edit Agent
        </MenuItem>
        <MenuItem onClick={() => handleAgentAction('delete', selectedAgentMenu!)}>
          <DeleteIcon sx={{ mr: 1 }} /> Delete Agent
        </MenuItem>
      </Menu>

      {/* Floating action button */}
      <Tooltip title="Create New Agent">
        <Fab
          color="primary"
          aria-label="add"
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
          }}
          onClick={() => setShowAgentCanvas(true)}
        >
          <AddIcon />
        </Fab>
      </Tooltip>

      {/* Agent creation dialog */}
      {showAgentCanvas && (
        <AgentCanvas
          onClose={() => setShowAgentCanvas(false)}
          onAgentCreated={handleAgentCreated}
          cameras={configuredCameras}
        />
      )}

      {/* Agent monitoring dialog */}
      {showMonitor && selectedAgent && (
        <AgentMonitor
          agent={selectedAgent}
          onClose={() => {
            setShowMonitor(false);
            setSelectedAgent(null);
          }}
        />
      )}
    </Box>
  );
};

export default VisionAgentPage;