import React from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Videocam as VideocamIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

interface CameraSelectorProps {
  cameras: any[];
  selectedCameraId?: string;
  onSelect: (cameraId: string) => void;
}

const CameraSelector: React.FC<CameraSelectorProps> = ({ cameras, selectedCameraId, onSelect }) => {
  const [loading, setLoading] = React.useState<string | null>(null);
  const [previews, setPreviews] = React.useState<Record<string, string>>({});

  const loadCameraPreview = async (cameraId: string) => {
    setLoading(cameraId);
    try {
      // TODO: Call API to get camera snapshot
      // For now, simulate with placeholder
      await new Promise(resolve => setTimeout(resolve, 1000));
      setPreviews(prev => ({
        ...prev,
        [cameraId]: `/api/placeholder/camera/${cameraId}/snapshot.jpg`
      }));
    } catch (error) {
      console.error('Failed to load preview:', error);
    } finally {
      setLoading(null);
    }
  };

  React.useEffect(() => {
    // Load previews for all cameras
    cameras.forEach(camera => {
      if (!previews[camera.id]) {
        loadCameraPreview(camera.id);
      }
    });
  }, [cameras]);

  if (cameras.length === 0) {
    return (
      <Alert severity="info">
        No cameras available. Please ensure cameras are connected and configured.
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom align="center" sx={{ mb: 4 }}>
        Select a camera for your agent to monitor
      </Typography>

      <Grid container spacing={3}>
        {cameras.map((camera) => (
          <Grid item xs={12} sm={6} md={4} key={camera.id}>
            <Card
              sx={{
                cursor: 'pointer',
                border: selectedCameraId === camera.id ? 2 : 0,
                borderColor: 'primary.main',
                transition: 'all 0.3s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4,
                },
              }}
              onClick={() => onSelect(camera.id)}
            >
              <Box sx={{ position: 'relative', paddingTop: '56.25%' }}>
                {loading === camera.id ? (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'grey.100',
                    }}
                  >
                    <CircularProgress />
                  </Box>
                ) : previews[camera.id] ? (
                  <CardMedia
                    component="img"
                    image={previews[camera.id]}
                    alt={camera.name}
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'grey.200',
                    }}
                  >
                    <VideocamIcon sx={{ fontSize: 48, color: 'grey.500' }} />
                  </Box>
                )}
                
                {selectedCameraId === camera.id && (
                  <CheckCircleIcon
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      color: 'primary.main',
                      bgcolor: 'white',
                      borderRadius: '50%',
                    }}
                  />
                )}

                <IconButton
                  sx={{
                    position: 'absolute',
                    bottom: 8,
                    right: 8,
                    bgcolor: 'white',
                    '&:hover': { bgcolor: 'grey.100' },
                  }}
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    loadCameraPreview(camera.id);
                  }}
                >
                  <RefreshIcon />
                </IconButton>
              </Box>

              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {camera.name || `Camera ${camera.id}`}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {camera.ip || camera.host}
                </Typography>
                <Box sx={{ mt: 1 }}>
                  {camera.location && (
                    <Chip size="small" label={camera.location} sx={{ mr: 1 }} />
                  )}
                  {camera.model && (
                    <Chip size="small" label={camera.model} variant="outlined" />
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default CameraSelector;