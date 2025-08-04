import React from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Box,
  Chip,
} from '@mui/material';
import {
  Cloud as CloudIcon,
  Videocam as VideocamIcon,
  CloudUpload as CloudUploadIcon,
  Dashboard as DashboardIcon,
  CheckCircle as CheckCircleIcon,
  Settings as SettingsIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';

export type NavigationView = 
  | 'welcome' 
  | 'gcp-setup' 
  | 'camera-discovery' 
  | 'acap-manager'
  | 'camera-deployment' 
  | 'status'
  | 'magical-welcome'
  | 'magical-api-key'
  | 'magical-discovery';

interface NavigationSidebarProps {
  currentView: NavigationView;
  onViewChange: (view: NavigationView) => void;
  deploymentComplete: boolean;
  camerasConfigured: boolean;
}

const NavigationSidebar: React.FC<NavigationSidebarProps> = ({ 
  currentView, 
  onViewChange,
  deploymentComplete,
  camerasConfigured 
}) => {
  const menuItems = [
    { 
      id: 'welcome' as NavigationView, 
      label: 'Home', 
      icon: <DashboardIcon />,
      alwaysEnabled: true 
    },
    { 
      id: 'gcp-setup' as NavigationView, 
      label: 'GCP Infrastructure', 
      icon: <CloudIcon />,
      alwaysEnabled: true,
      status: deploymentComplete ? 'complete' : undefined
    },
    { 
      id: 'camera-discovery' as NavigationView, 
      label: 'Camera Discovery', 
      icon: <VideocamIcon />,
      alwaysEnabled: true 
    },
    { 
      id: 'acap-manager' as NavigationView, 
      label: 'ACAP Manager', 
      icon: <DownloadIcon />,
      alwaysEnabled: true 
    },
    { 
      id: 'camera-deployment' as NavigationView, 
      label: 'ACAP Deployment', 
      icon: <CloudUploadIcon />,
      alwaysEnabled: true,
      status: camerasConfigured ? 'complete' : undefined
    },
    { 
      id: 'status' as NavigationView, 
      label: 'Status & Logs', 
      icon: <SettingsIcon />,
      alwaysEnabled: true 
    },
  ];

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: 240,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: 240,
          boxSizing: 'border-box',
          backgroundColor: theme => theme.palette.mode === 'dark' ? theme.palette.background.paper : '#f5f5f5',
          borderRight: theme => `1px solid ${theme.palette.divider}`,
          marginTop: '48px', // Account for TopBar
        },
      }}
    >
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
          Anava Vision
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Unified Installer
        </Typography>
      </Box>
      
      <Divider />
      
      <List sx={{ px: 1, py: 2 }}>
        {menuItems.map((item) => (
          <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              selected={currentView === item.id}
              onClick={() => onViewChange(item.id)}
              sx={{
                borderRadius: 1,
                '&.Mui-selected': {
                  backgroundColor: theme => theme.palette.mode === 'dark' ? 'rgba(0, 212, 255, 0.08)' : 'primary.light',
                  '&:hover': {
                    backgroundColor: theme => theme.palette.mode === 'dark' ? 'rgba(0, 212, 255, 0.12)' : 'primary.light',
                  },
                },
              }}
            >
              <ListItemIcon 
                sx={{ 
                  color: currentView === item.id ? 'primary.main' : 'text.secondary',
                  minWidth: 40,
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText 
                primary={item.label}
                primaryTypographyProps={{
                  fontSize: '0.875rem',
                  fontWeight: currentView === item.id ? 600 : 400,
                }}
              />
              {item.status === 'complete' && (
                <CheckCircleIcon 
                  sx={{ 
                    fontSize: 18, 
                    color: 'success.main',
                    ml: 'auto' 
                  }} 
                />
              )}
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      
      <Box sx={{ flexGrow: 1 }} />
      
      <Box sx={{ p: 2, borderTop: '1px solid #e0e0e0' }}>
        <Typography variant="caption" color="text.secondary">
          Version 0.9.2
        </Typography>
      </Box>
    </Drawer>
  );
};

export default NavigationSidebar;