import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Typography,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  IconButton,
} from '@mui/material';
import {
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon,
  CloudDownload as CloudDownloadIcon,
} from '@mui/icons-material';

interface ACAPRelease {
  name: string;
  architecture: string;
  size: number;
  downloadUrl: string;
  filename: string;
  isDownloaded: boolean;
}

export const ACAPManager: React.FC = () => {
  const [releases, setReleases] = useState<ACAPRelease[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadReleases();
  }, []);

  const loadReleases = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const availableReleases = await window.electronAPI.acap.getReleases();
      setReleases(availableReleases);
    } catch (err: any) {
      setError(`Failed to load releases: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadRelease = async (release: ACAPRelease) => {
    setDownloading(release.filename);
    setError(null);
    
    try {
      // Download directly to user's Downloads folder
      const result = await window.electronAPI.acap.downloadToUser(release);
      
      if (result.success) {
        // Update the release to show it's downloaded
        setReleases(prev => prev.map(r => 
          r.filename === release.filename 
            ? { ...r, isDownloaded: true }
            : r
        ));
        
        // Show success message with download location
        if (result.path) {
          setSuccess(`Downloaded ${release.filename} to your Downloads folder`);
          setTimeout(() => setSuccess(null), 5000);
        }
      } else {
        setError(`Failed to download ${release.filename}: ${result.error}`);
      }
    } catch (err: any) {
      setError(`Download error: ${err.message}`);
    } finally {
      setDownloading(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const getArchitectureColor = (arch: string): any => {
    switch (arch) {
      case 'aarch64': return 'primary';
      case 'armv7hf': return 'secondary';
      case 'x86_64': return 'success';
      default: return 'default';
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        ACAP Package Manager
      </Typography>
      
      <Typography variant="body2" color="text.secondary" paragraph>
        Download ACAP packages from the official repository to deploy to your cameras.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Available Releases
            </Typography>
            <Button
              startIcon={loading ? <CircularProgress size={20} /> : <CloudDownloadIcon />}
              onClick={loadReleases}
              disabled={loading}
            >
              Refresh
            </Button>
          </Box>

          {loading && releases.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress />
              <Typography variant="body2" sx={{ mt: 2 }}>
                Loading releases...
              </Typography>
            </Box>
          ) : (
            <List>
              {releases.map((release) => (
                <ListItem key={release.filename} divider>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {release.name}
                        {release.isDownloaded && (
                          <CheckCircleIcon color="success" fontSize="small" />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                        <Chip 
                          label={release.architecture} 
                          size="small"
                          color={getArchitectureColor(release.architecture)}
                        />
                        <Chip 
                          label={formatFileSize(release.size)} 
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    {release.isDownloaded ? (
                      <Typography variant="body2" color="success.main">
                        Downloaded
                      </Typography>
                    ) : (
                      <IconButton
                        edge="end"
                        onClick={() => downloadRelease(release)}
                        disabled={downloading === release.filename}
                      >
                        {downloading === release.filename ? (
                          <CircularProgress size={24} />
                        ) : (
                          <DownloadIcon />
                        )}
                      </IconButton>
                    )}
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}

          {releases.length === 0 && !loading && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              No releases found. Click Refresh to check for updates.
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};