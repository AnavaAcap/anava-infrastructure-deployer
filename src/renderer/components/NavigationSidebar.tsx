import React, { useState, useEffect } from 'react';
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
  PlayCircleOutline as PlayCircleIcon,
} from '@mui/icons-material';

export type NavigationView = 
  | 'welcome' 
  | 'camera-setup'
  | 'detection-test'
  | 'gcp-setup' 
  | 'camera-discovery' 
  | 'acap-manager'
  | 'camera-deployment';

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
  const [version, setVersion] = useState<string>('0.9.71');

  useEffect(() => {
    const getVersion = async () => {
      try {
        const v = await window.electronAPI?.app?.getVersion();
        if (v) setVersion(v);
      } catch (error) {
        console.error('Failed to get version:', error);
      }
    };
    getVersion();
  }, []);
  const menuItems = [
    { 
      id: 'welcome' as NavigationView, 
      label: 'Home', 
      icon: <DashboardIcon />,
      alwaysEnabled: true 
    },
    { 
      id: 'camera-setup' as NavigationView, 
      label: 'Camera Setup', 
      icon: <VideocamIcon />,
      alwaysEnabled: true,
      badge: 'NEW' as const
    },
    { 
      id: 'detection-test' as NavigationView, 
      label: 'Test Detection', 
      icon: <PlayCircleIcon />,
      alwaysEnabled: true 
    },
    { type: 'divider' },
    { 
      id: 'gcp-setup' as NavigationView, 
      label: 'GCP Infrastructure', 
      icon: <CloudIcon />,
      alwaysEnabled: true,
      status: deploymentComplete ? 'complete' : undefined,
      tag: 'Advanced' as const
    },
    { 
      id: 'acap-manager' as NavigationView, 
      label: 'ACAP Manager', 
      icon: <DownloadIcon />,
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
        {menuItems.map((item, index) => {
          if ('type' in item && item.type === 'divider') {
            return <Divider key={`divider-${index}`} sx={{ my: 1 }} />;
          }
          
          return (
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
                {item.badge && (
                  <Chip
                    label={item.badge}
                    size="small"
                    color="primary"
                    sx={{
                      height: 20,
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      ml: 1,
                    }}
                  />
                )}
                {item.tag && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      fontSize: '0.7rem',
                      ml: 1,
                    }}
                  >
                    {item.tag}
                  </Typography>
                )}
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
          );
        })}
      </List>
      
      <Box sx={{ flexGrow: 1 }} />
      
      <Box sx={{ p: 2, borderTop: '1px solid #e0e0e0' }}>
        <Typography variant="caption" color="text.secondary">
          Version {version}
        </Typography>
      </Box>
    </Drawer>
  );
};

export default NavigationSidebar;