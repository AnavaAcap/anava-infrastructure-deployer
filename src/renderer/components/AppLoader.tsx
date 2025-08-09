import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

interface AppLoaderProps {
  message?: string;
}

export const AppLoader: React.FC<AppLoaderProps> = ({ message = 'Loading Anava Installer...' }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        bgcolor: 'background.default',
      }}
    >
      <CircularProgress size={48} sx={{ mb: 3 }} />
      <Typography variant="h6" color="text.secondary">
        {message}
      </Typography>
      <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
        Please wait...
      </Typography>
    </Box>
  );
};

export default AppLoader;