import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { Logout } from '@mui/icons-material';
import anavaLogo from '../assets/anava-logo.png';

interface TopBarProps {
  title: string;
  showLogout?: boolean;
  onLogout?: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ title, showLogout = true, onLogout }) => {
  const handleLogout = async () => {
    if (onLogout) {
      await window.electronAPI.auth.logout();
      onLogout();
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box
          component="img"
          src={anavaLogo}
          alt="Anava Logo"
          sx={{ width: 48, height: 48 }}
        />
        <Typography variant="h4" component="h2">
          {title}
        </Typography>
      </Box>
      
      {showLogout && onLogout && (
        <Button
          variant="outlined"
          startIcon={<Logout />}
          onClick={handleLogout}
          size="small"
          sx={{ ml: 'auto' }}
        >
          Logout
        </Button>
      )}
    </Box>
  );
};

export default TopBar;