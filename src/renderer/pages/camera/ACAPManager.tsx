import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Alert,
  Paper,
  Grid,
} from '@mui/material';
import {
  OpenInNew as OpenInNewIcon,
  Download as DownloadIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

export const ACAPManager: React.FC = () => {
  const handleOpenDownloadSite = () => {
    window.open('https://downloads.anava.ai', '_blank');
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        ACAP Package Manager
      </Typography>
      
      <Typography variant="body2" color="text.secondary" paragraph>
        Download ACAP packages from the official Anava repository to deploy to your cameras.
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <DownloadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            
            <Typography variant="h6" gutterBottom>
              Download ACAP Packages
            </Typography>
            
            <Typography variant="body2" color="text.secondary" paragraph>
              Visit the Anava downloads portal to get the latest ACAP packages for your camera architecture.
            </Typography>
            
            <Button
              variant="contained"
              size="large"
              startIcon={<OpenInNewIcon />}
              onClick={handleOpenDownloadSite}
              sx={{ mt: 2 }}
            >
              Open Downloads Portal
            </Button>
            
            <Typography variant="caption" display="block" sx={{ mt: 2 }} color="text.secondary">
              downloads.anava.ai
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Alert severity="info" icon={<InfoIcon />}>
        <Typography variant="body2">
          <strong>Available Architectures:</strong>
        </Typography>
        <Box sx={{ mt: 1 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="subtitle2" color="primary">aarch64</Typography>
                <Typography variant="caption" color="text.secondary">
                  64-bit ARM (ARTPEC-8, newer cameras)
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="subtitle2" color="secondary.main">armv7hf</Typography>
                <Typography variant="caption" color="text.secondary">
                  32-bit ARM (ARTPEC-6/7, older cameras)
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="subtitle2" color="success.main">x86_64</Typography>
                <Typography variant="caption" color="text.secondary">
                  Intel/AMD 64-bit (specialized models)
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      </Alert>

      <Box sx={{ mt: 3 }}>
        <Typography variant="body2" color="text.secondary">
          <strong>Note:</strong> The Camera Setup wizard automatically downloads and installs the correct ACAP version 
          for your camera during the deployment process. Manual downloads are only needed for advanced use cases.
        </Typography>
      </Box>
    </Box>
  );
};