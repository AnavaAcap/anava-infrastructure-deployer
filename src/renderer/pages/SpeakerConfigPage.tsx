import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Grid,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
  Chip,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Divider,
  Tooltip,
  Stack,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Speaker as SpeakerIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  VolumeUp as VolumeUpIcon,
  Settings as SettingsIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
} from '@mui/icons-material';

interface SpeakerConfig {
  id: string;
  cameraIp: string;
  cameraName: string;
  speakerIp: string;
  username: string;
  password: string;
  testResult?: 'success' | 'error' | null;
  error?: string;
}

const SpeakerConfigPage: React.FC = () => {
  const [speakers, setSpeakers] = useState<SpeakerConfig[]>([]);
  const [currentConfig, setCurrentConfig] = useState<SpeakerConfig>({
    id: '',
    cameraIp: '',
    cameraName: '',
    speakerIp: '',
    username: 'root',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  useEffect(() => {
    loadSavedSpeakers();
  }, []);

  const loadSavedSpeakers = async () => {
    try {
      // Load from local storage or config
      const saved = await window.electronAPI?.getConfigValue('speakers');
      if (saved && Array.isArray(saved)) {
        setSpeakers(saved);
      }
    } catch (error) {
      console.error('Failed to load speakers:', error);
    }
  };

  const saveSpeakers = async (updatedSpeakers: SpeakerConfig[]) => {
    try {
      await window.electronAPI?.setConfigValue('speakers', updatedSpeakers);
      setSpeakers(updatedSpeakers);
    } catch (error) {
      console.error('Failed to save speakers:', error);
    }
  };

  const handleAddSpeaker = async () => {
    if (!currentConfig.cameraIp || !currentConfig.speakerIp || !currentConfig.password) {
      return;
    }

    setSaving(true);
    try {
      const newSpeaker: SpeakerConfig = {
        ...currentConfig,
        id: `speaker-${Date.now()}`,
        cameraName: currentConfig.cameraName || `Camera at ${currentConfig.cameraIp}`,
      };

      const updatedSpeakers = [...speakers, newSpeaker];
      await saveSpeakers(updatedSpeakers);

      // Reset form
      setCurrentConfig({
        id: '',
        cameraIp: '',
        cameraName: '',
        speakerIp: '',
        username: 'root',
        password: '',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSpeaker = async (id: string) => {
    const updatedSpeakers = speakers.filter(s => s.id !== id);
    await saveSpeakers(updatedSpeakers);
  };

  const handleTestSpeaker = async (speaker: SpeakerConfig) => {
    setTesting(true);
    setTestingId(speaker.id);

    try {
      // Test speaker connection
      const result = await window.electronAPI?.camera?.testSpeaker?.(
        speaker.speakerIp,
        speaker.username,
        speaker.password
      );

      if (result) {
        // Update speaker with test result
        const updatedSpeakers = speakers.map(s =>
          s.id === speaker.id
            ? { ...s, testResult: 'success' as const }
            : s
        );
        setSpeakers(updatedSpeakers);
      } else {
        throw new Error('Test failed');
      }
    } catch (error: any) {
      // Update speaker with error
      const updatedSpeakers = speakers.map(s =>
        s.id === speaker.id
          ? { ...s, testResult: 'error' as const, error: error.message }
          : s
      );
      setSpeakers(updatedSpeakers);
    } finally {
      setTesting(false);
      setTestingId(null);
    }
  };

  const getTestClipUrl = () => {
    // Return URL to test audio clip
    return '/audio/test-clip-1.wav';
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Speaker Configuration
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Configure Axis speakers for audio talkdown with your cameras
      </Typography>

      <Grid container spacing={3}>
        {/* Add New Speaker Form */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Add New Speaker
              </Typography>
              <Box component="form" sx={{ mt: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Camera IP Address"
                      value={currentConfig.cameraIp}
                      onChange={(e) => setCurrentConfig({ ...currentConfig, cameraIp: e.target.value })}
                      placeholder="192.168.1.100"
                      helperText="IP address of the camera this speaker is associated with"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Camera Name (Optional)"
                      value={currentConfig.cameraName}
                      onChange={(e) => setCurrentConfig({ ...currentConfig, cameraName: e.target.value })}
                      placeholder="Front Entrance Camera"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Speaker IP Address"
                      value={currentConfig.speakerIp}
                      onChange={(e) => setCurrentConfig({ ...currentConfig, speakerIp: e.target.value })}
                      placeholder="192.168.1.101"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Username"
                      value={currentConfig.username}
                      onChange={(e) => setCurrentConfig({ ...currentConfig, username: e.target.value })}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      type={showPassword ? 'text' : 'password'}
                      label="Password"
                      value={currentConfig.password}
                      onChange={(e) => setCurrentConfig({ ...currentConfig, password: e.target.value })}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowPassword(!showPassword)}
                              edge="end"
                            >
                              {showPassword ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      variant="contained"
                      fullWidth
                      onClick={handleAddSpeaker}
                      disabled={!currentConfig.cameraIp || !currentConfig.speakerIp || !currentConfig.password || saving}
                      startIcon={saving ? <CircularProgress size={20} /> : <AddIcon />}
                    >
                      {saving ? 'Saving...' : 'Add Speaker'}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Tips and Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Setup Tips
              </Typography>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircleIcon color="success" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Speaker Placement"
                    secondary="Position speakers near cameras for effective audio deterrence"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircleIcon color="success" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Network Configuration"
                    secondary="Ensure speakers are on the same network as cameras"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircleIcon color="success" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Audio Clips"
                    secondary="Pre-loaded clips will be used for talkdown messages"
                  />
                </ListItem>
              </List>

              <Divider sx={{ my: 2 }} />

              <Alert severity="info">
                <Typography variant="body2">
                  Speakers will automatically play deterrent messages when suspicious activity is detected by the AI.
                </Typography>
              </Alert>
            </CardContent>
          </Card>
        </Grid>

        {/* Configured Speakers List */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Configured Speakers
              </Typography>
              
              {speakers.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center', backgroundColor: 'grey.50' }}>
                  <SpeakerIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
                  <Typography variant="body1" color="text.secondary">
                    No speakers configured yet. Add your first speaker above.
                  </Typography>
                </Paper>
              ) : (
                <List>
                  {speakers.map((speaker) => (
                    <React.Fragment key={speaker.id}>
                      <ListItem>
                        <ListItemIcon>
                          <SpeakerIcon color={speaker.testResult === 'success' ? 'success' : 'inherit'} />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box>
                              <Typography variant="subtitle1">
                                {speaker.cameraName}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Camera: {speaker.cameraIp} • Speaker: {speaker.speakerIp}
                              </Typography>
                            </Box>
                          }
                          secondary={
                            speaker.testResult === 'success' ? (
                              <Chip
                                label="Tested Successfully"
                                size="small"
                                color="success"
                                icon={<CheckCircleIcon />}
                              />
                            ) : speaker.testResult === 'error' ? (
                              <Chip
                                label={speaker.error || 'Test Failed'}
                                size="small"
                                color="error"
                                icon={<ErrorIcon />}
                              />
                            ) : null
                          }
                        />
                        <ListItemSecondaryAction>
                          <Tooltip title="Test Speaker">
                            <IconButton
                              edge="end"
                              onClick={() => handleTestSpeaker(speaker)}
                              disabled={testing}
                            >
                              {testing && testingId === speaker.id ? (
                                <CircularProgress size={24} />
                              ) : (
                                <PlayIcon />
                              )}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              edge="end"
                              onClick={() => handleDeleteSpeaker(speaker.id)}
                              sx={{ ml: 1 }}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </ListItemSecondaryAction>
                      </ListItem>
                      <Divider />
                    </React.Fragment>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Audio Test Section */}
      <Box sx={{ mt: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Test Audio Clips
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              These are the pre-configured audio messages that will play during detections:
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4}>
                <Paper sx={{ p: 2 }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <VolumeUpIcon color="primary" />
                    <Box flex={1}>
                      <Typography variant="subtitle2">Security Alert</Typography>
                      <Typography variant="caption" color="text.secondary">
                        "Security alert. This area is being monitored."
                      </Typography>
                    </Box>
                    <IconButton size="small">
                      <PlayIcon />
                    </IconButton>
                  </Stack>
                </Paper>
              </Grid>
              
              <Grid item xs={12} sm={6} md={4}>
                <Paper sx={{ p: 2 }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <VolumeUpIcon color="primary" />
                    <Box flex={1}>
                      <Typography variant="subtitle2">Weapon Detection</Typography>
                      <Typography variant="caption" color="text.secondary">
                        "Weapon detected. Security has been notified."
                      </Typography>
                    </Box>
                    <IconButton size="small">
                      <PlayIcon />
                    </IconButton>
                  </Stack>
                </Paper>
              </Grid>
              
              <Grid item xs={12} sm={6} md={4}>
                <Paper sx={{ p: 2 }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <VolumeUpIcon color="primary" />
                    <Box flex={1}>
                      <Typography variant="subtitle2">Custom Message</Typography>
                      <Typography variant="caption" color="text.secondary">
                        "Please maintain social distance."
                      </Typography>
                    </Box>
                    <IconButton size="small">
                      <PlayIcon />
                    </IconButton>
                  </Stack>
                </Paper>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default SpeakerConfigPage;