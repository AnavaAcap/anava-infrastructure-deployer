import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  IconButton,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Alert,
  AlertTitle,
  Fab,
  Tooltip,
  LinearProgress,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Videocam as VideocamIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  MoreVert as MoreVertIcon,
  Speaker as SpeakerIcon,
  Security as SecurityIcon,
  CloudDone as CloudDoneIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useCameraContext, ManagedCamera, CameraStepStatus } from '../contexts/CameraContext';
import CameraSetupWizard from '../components/CameraSetupWizard';

const CameraManagementPage: React.FC = () => {
  const { cameras, selectedCamera, selectCamera, removeCamera, updateCameraStep } = useCameraContext();
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [editingCamera, setEditingCamera] = useState<ManagedCamera | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuCamera, setMenuCamera] = useState<ManagedCamera | null>(null);

  const handleAddCamera = () => {
    setEditingCamera(null);
    setShowSetupWizard(true);
  };

  const handleEditCamera = (camera: ManagedCamera) => {
    setEditingCamera(camera);
    selectCamera(camera.id);
    setShowSetupWizard(true);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, camera: ManagedCamera) => {
    setAnchorEl(event.currentTarget);
    setMenuCamera(camera);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuCamera(null);
  };

  const handleDeleteCamera = (camera: ManagedCamera) => {
    if (confirm(`Are you sure you want to remove ${camera.name}?`)) {
      removeCamera(camera.id);
    }
    handleMenuClose();
  };

  const getStepProgress = (status: CameraStepStatus): number => {
    const steps = ['credentials', 'discovery', 'deployment', 'speaker', 'verification'] as const;
    const completed = steps.filter(step => status[step].completed).length;
    return (completed / steps.length) * 100;
  };

  const getStatusChip = (camera: ManagedCamera) => {
    const progress = getStepProgress(camera.status);
    
    if (progress === 100) {
      return <Chip icon={<CheckCircleIcon />} label="Fully Configured" color="success" size="small" />;
    } else if (progress >= 60) {
      return <Chip icon={<WarningIcon />} label="Partially Configured" color="warning" size="small" />;
    } else {
      return <Chip icon={<SettingsIcon />} label="Setup Required" color="default" size="small" />;
    }
  };

  const getFeatureIcons = (camera: ManagedCamera) => {
    const icons = [];
    
    if (camera.status.deployment.isLicensed) {
      icons.push(
        <Tooltip key="licensed" title="Licensed">
          <SecurityIcon fontSize="small" color="success" />
        </Tooltip>
      );
    }
    
    if (camera.status.deployment.hasACAP) {
      icons.push(
        <Tooltip key="acap" title="ACAP Installed">
          <CloudDoneIcon fontSize="small" color="primary" />
        </Tooltip>
      );
    }
    
    if (camera.status.speaker.configured) {
      icons.push(
        <Tooltip key="speaker" title="Speaker Configured">
          <SpeakerIcon fontSize="small" color="action" />
        </Tooltip>
      );
    }
    
    return icons;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">Camera Management</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddCamera}
          size="large"
        >
          Add New Camera
        </Button>
      </Box>

      {cameras.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <VideocamIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No Cameras Configured
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Get started by adding your first Axis camera to enable AI-powered analytics.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddCamera}
            >
              Add Your First Camera
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {cameras.map((camera) => (
            <Grid item xs={12} md={6} lg={4} key={camera.id}>
              <Card 
                sx={{ 
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    boxShadow: 3,
                    transform: 'translateY(-2px)'
                  }
                }}
                onClick={() => handleEditCamera(camera)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <VideocamIcon color="primary" />
                      <Typography variant="h6" noWrap sx={{ maxWidth: 200 }}>
                        {camera.name}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMenuOpen(e, camera);
                      }}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>

                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {camera.ip} • {camera.model || 'Unknown Model'}
                  </Typography>

                  <Box sx={{ my: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="caption">Configuration Progress</Typography>
                      <Typography variant="caption">{Math.round(getStepProgress(camera.status))}%</Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={getStepProgress(camera.status)} 
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {getStatusChip(camera)}
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {getFeatureIcons(camera)}
                    </Box>
                  </Box>

                  <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                    <Grid container spacing={1}>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">Credentials</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {camera.status.credentials.completed ? (
                            <CheckCircleIcon fontSize="small" color="success" />
                          ) : (
                            <WarningIcon fontSize="small" color="action" />
                          )}
                          <Typography variant="body2">
                            {camera.status.credentials.completed ? 'Set' : 'Not Set'}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">Discovery</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {camera.status.discovery.completed ? (
                            <CheckCircleIcon fontSize="small" color="success" />
                          ) : (
                            <WarningIcon fontSize="small" color="action" />
                          )}
                          <Typography variant="body2">
                            {camera.status.discovery.completed ? 'Found' : 'Pending'}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">ACAP</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {camera.status.deployment.completed ? (
                            <CheckCircleIcon fontSize="small" color="success" />
                          ) : (
                            <WarningIcon fontSize="small" color="action" />
                          )}
                          <Typography variant="body2">
                            {camera.status.deployment.hasACAP ? 'Installed' : 'Not Installed'}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">Speaker</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {camera.status.speaker.configured ? (
                            <CheckCircleIcon fontSize="small" color="success" />
                          ) : (
                            <WarningIcon fontSize="small" color="disabled" />
                          )}
                          <Typography variant="body2">
                            {camera.status.speaker.configured ? 'Configured' : 'Optional'}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>

                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                    Last updated: {new Date(camera.lastUpdated).toLocaleDateString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          if (menuCamera) handleEditCamera(menuCamera);
          handleMenuClose();
        }}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit Configuration</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {
          if (menuCamera) handleDeleteCamera(menuCamera);
        }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Remove Camera</ListItemText>
        </MenuItem>
      </Menu>

      {showSetupWizard && (
        <CameraSetupWizard
          open={showSetupWizard}
          onClose={() => {
            setShowSetupWizard(false);
            setEditingCamera(null);
            selectCamera(null);
          }}
          editingCamera={editingCamera}
        />
      )}
    </Box>
  );
};

export default CameraManagementPage;