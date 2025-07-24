import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  CircularProgress,
  Alert,
  Chip,
  FormControlLabel,
  Switch,
  Grid,
  Card,
  CardContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  Send as SendIcon,
  Videocam as VideocamIcon,
  Mic as MicIcon,
  Image as ImageIcon,
  Settings as SettingsIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Check as CheckIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  VolumeUp as VolumeUpIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

interface CameraConnection {
  id: string;
  name: string;
  host: string;
  username: string;
  password: string;
  port?: number;
  secure?: boolean;
  isDefault?: boolean;
  lastUsed?: Date;
}

interface CommandHistory {
  id: string;
  timestamp: Date;
  command: string;
  response: string;
  camera: string;
  success: boolean;
}

interface VisionConnectionPageProps {
  deploymentConfig?: any;
  configuredCameras?: any[];
}

const VisionConnectionPage: React.FC<VisionConnectionPageProps> = ({ deploymentConfig, configuredCameras = [] }) => {
  const [connections, setConnections] = useState<CameraConnection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<string>('');
  const [commandInput, setCommandInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<CommandHistory[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingConnection, setEditingConnection] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [mcpServerStatus, setMcpServerStatus] = useState<'stopped' | 'starting' | 'running' | 'error' | 'not_installed'>('stopped');
  const [installProgress, setInstallProgress] = useState(0);
  const [isInstalling, setIsInstalling] = useState(false);
  
  // Form fields for editing connections
  const [editForm, setEditForm] = useState<Partial<CameraConnection>>({});
  
  const commandInputRef = useRef<HTMLInputElement>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load saved connections
    loadConnections();
    checkMCPServerStatus();
    
    // Check if we have configured cameras from deployment
    if (configuredCameras && configuredCameras.length > 0) {
      const newConnections = configuredCameras.map((cam, index) => ({
        id: `deployed-${cam.ip}`,
        name: cam.name || `Camera ${index + 1}`,
        host: cam.ip,
        username: cam.username || 'root',
        password: cam.password || '',
        port: 443,
        secure: true,
        isDefault: index === 0,
      }));
      
      // Merge with existing connections
      setConnections(prev => {
        const existing = prev.filter(c => !c.id.startsWith('deployed-'));
        return [...existing, ...newConnections];
      });
    }
  }, [configuredCameras]);

  useEffect(() => {
    // Auto-scroll to bottom of history
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [commandHistory]);

  const checkMCPServerStatus = async () => {
    try {
      const status = await window.electronAPI.vision.checkMCPServerInstalled();
      setMcpServerStatus(status.installed ? 'stopped' : 'not_installed');
    } catch (err) {
      console.error('Failed to check MCP server status:', err);
    }
  };

  const handleInstallMCPServer = async () => {
    setIsInstalling(true);
    setInstallProgress(0);
    setError(null);

    try {
      // Simulate installation progress
      const progressInterval = setInterval(() => {
        setInstallProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 500);

      const result = await window.electronAPI.vision.installMCPServer();
      
      clearInterval(progressInterval);
      setInstallProgress(100);

      if (result.success) {
        setMcpServerStatus('stopped');
        addToHistory({
          command: 'install-mcp-server',
          response: 'MCP server installed successfully',
          camera: 'System',
          success: true,
        });
      } else {
        throw new Error(result.error || 'Installation failed');
      }
    } catch (err: any) {
      setError(err.message);
      addToHistory({
        command: 'install-mcp-server',
        response: `Installation failed: ${err.message}`,
        camera: 'System',
        success: false,
      });
    } finally {
      setIsInstalling(false);
      setInstallProgress(0);
    }
  };

  const loadConnections = async () => {
    try {
      const saved = await window.electronAPI.vision.loadConnections();
      
      // Add test camera if no connections exist
      if (saved.length === 0) {
        saved.push({
          id: 'test-camera-1',
          name: 'Test Camera (192.168.50.156)',
          host: '192.168.50.156',
          username: 'root',
          password: 'pass',
          port: 443,
          secure: true,
          isDefault: true,
        });
        await window.electronAPI.vision.saveConnections(saved);
      }
      
      setConnections(saved);
      
      // Select default connection
      const defaultConn = saved.find(c => c.isDefault);
      if (defaultConn) {
        setSelectedConnection(defaultConn.id);
      }
    } catch (err) {
      console.error('Failed to load connections:', err);
    }
  };

  const saveConnections = async () => {
    try {
      await window.electronAPI.vision.saveConnections(connections);
    } catch (err) {
      console.error('Failed to save connections:', err);
    }
  };

  const handleConnect = async () => {
    if (!selectedConnection) {
      setError('Please select a camera connection');
      return;
    }

    const connection = connections.find(c => c.id === selectedConnection);
    if (!connection) return;

    setIsLoading(true);
    setError(null);
    setMcpServerStatus('starting');

    try {
      // Start MCP server with connection details
      const result = await window.electronAPI.vision.startMCPServer({
        host: connection.host,
        username: connection.username,
        password: connection.password,
        port: connection.port,
        secure: connection.secure,
      });

      if (result.success) {
        setIsConnected(true);
        setMcpServerStatus('running');
        addToHistory({
          command: 'connect',
          response: `Connected to ${connection.name} (${connection.host})`,
          camera: connection.name,
          success: true,
        });
      } else {
        throw new Error(result.error || 'Failed to start MCP server');
      }
    } catch (err: any) {
      setError(err.message);
      setMcpServerStatus('error');
      addToHistory({
        command: 'connect',
        response: `Failed to connect: ${err.message}`,
        camera: connection.name,
        success: false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    
    try {
      await window.electronAPI.vision.stopMCPServer();
      setIsConnected(false);
      setMcpServerStatus('stopped');
      addToHistory({
        command: 'disconnect',
        response: 'Disconnected from camera',
        camera: connections.find(c => c.id === selectedConnection)?.name || 'Unknown',
        success: true,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendCommand = async () => {
    if (!commandInput.trim() || !isConnected) return;

    const connection = connections.find(c => c.id === selectedConnection);
    if (!connection) return;

    const command = commandInput.trim();
    setCommandInput('');
    setIsLoading(true);
    setError(null);

    try {
      // Parse command and send to MCP server
      let result;
      
      if (command.toLowerCase().startsWith('capture')) {
        result = await window.electronAPI.vision.captureImage();
      } else if (command.toLowerCase().startsWith('analyze') || command.toLowerCase().startsWith('ask')) {
        const prompt = command.replace(/^(analyze|ask)\s*/i, '').trim() || 'What do you see?';
        result = await window.electronAPI.vision.captureAndAnalyze(prompt);
      } else if (command.toLowerCase().startsWith('speak')) {
        const text = command.replace(/^speak\s*/i, '').trim();
        result = await window.electronAPI.vision.speak(text);
      } else if (command.toLowerCase().startsWith('events')) {
        result = await window.electronAPI.vision.getEvents();
      } else {
        // Send as raw MCP command
        result = await window.electronAPI.vision.sendCommand(command);
      }

      addToHistory({
        command,
        response: result.response || JSON.stringify(result, null, 2),
        camera: connection.name,
        success: true,
      });
    } catch (err: any) {
      addToHistory({
        command,
        response: `Error: ${err.message}`,
        camera: connection.name,
        success: false,
      });
      setError(err.message);
    } finally {
      setIsLoading(false);
      commandInputRef.current?.focus();
    }
  };

  const addToHistory = (entry: Omit<CommandHistory, 'id' | 'timestamp'>) => {
    setCommandHistory(prev => [...prev, {
      ...entry,
      id: Date.now().toString(),
      timestamp: new Date(),
    }]);
  };

  const handleAddConnection = () => {
    const newConnection: CameraConnection = {
      id: Date.now().toString(),
      name: 'New Camera',
      host: '',
      username: 'root',
      password: '',
      port: 443,
      secure: true,
      isDefault: connections.length === 0,
    };
    
    setConnections([...connections, newConnection]);
    setEditingConnection(newConnection.id);
    setEditForm(newConnection);
  };

  const handleSaveConnection = async () => {
    if (!editingConnection) return;

    const updatedConnections = connections.map(c => 
      c.id === editingConnection ? { ...c, ...editForm } : c
    );
    
    setConnections(updatedConnections);
    await saveConnections();
    setEditingConnection(null);
    setEditForm({});
  };

  const handleDeleteConnection = async (id: string) => {
    setConnections(connections.filter(c => c.id !== id));
    await saveConnections();
    
    if (selectedConnection === id) {
      setSelectedConnection('');
    }
  };

  const quickCommands = [
    { label: 'Capture Image', icon: <ImageIcon />, command: 'capture' },
    { label: 'What do you see?', icon: <VideocamIcon />, command: 'analyze' },
    { label: 'Speak: Hello', icon: <VolumeUpIcon />, command: 'speak Hello, how can I help you?' },
    { label: 'Get Events', icon: <InfoIcon />, command: 'events' },
  ];

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {mcpServerStatus === 'not_installed' && (
        <Alert 
          severity="warning" 
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={handleInstallMCPServer}
              disabled={isInstalling}
              startIcon={isInstalling ? <CircularProgress size={16} /> : <DownloadIcon />}
            >
              Install MCP Server
            </Button>
          }
          sx={{ mb: 2 }}
        >
          MCP server is not installed. Install it to connect to cameras.
        </Alert>
      )}

      {isInstalling && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" gutterBottom>
            Installing MCP server...
          </Typography>
          <LinearProgress variant="determinate" value={installProgress} />
        </Box>
      )}

      <Grid container spacing={3} sx={{ flex: 1, overflow: 'hidden' }}>
        {/* Left Panel - Connections */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Camera Connections</Typography>
              <IconButton size="small" onClick={handleAddConnection}>
                <EditIcon />
              </IconButton>
            </Box>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Active Connection</InputLabel>
              <Select
                value={selectedConnection}
                onChange={(e) => setSelectedConnection(e.target.value)}
                disabled={isConnected || mcpServerStatus === 'not_installed'}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {connections.map(conn => (
                  <MenuItem key={conn.id} value={conn.id}>
                    {conn.name} ({conn.host})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box sx={{ mb: 2 }}>
              {!isConnected ? (
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  onClick={handleConnect}
                  disabled={!selectedConnection || isLoading || mcpServerStatus === 'not_installed'}
                  startIcon={isLoading ? <CircularProgress size={20} /> : <PlayIcon />}
                >
                  Connect
                </Button>
              ) : (
                <Button
                  fullWidth
                  variant="outlined"
                  color="error"
                  onClick={handleDisconnect}
                  disabled={isLoading}
                  startIcon={<StopIcon />}
                >
                  Disconnect
                </Button>
              )}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Chip
                size="small"
                label={mcpServerStatus.replace('_', ' ')}
                color={
                  mcpServerStatus === 'running' ? 'success' :
                  mcpServerStatus === 'error' ? 'error' :
                  mcpServerStatus === 'not_installed' ? 'warning' :
                  'default'
                }
                icon={
                  mcpServerStatus === 'running' ? <CheckIcon /> :
                  mcpServerStatus === 'error' ? <ErrorIcon /> :
                  undefined
                }
              />
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Connection List */}
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              <List dense>
                {connections.map(conn => (
                  <ListItem
                    key={conn.id}
                    secondaryAction={
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => {
                          setEditingConnection(conn.id);
                          setEditForm(conn);
                          setShowSettings(true);
                        }}
                      >
                        <EditIcon />
                      </IconButton>
                    }
                  >
                    <ListItemText
                      primary={conn.name}
                      secondary={`${conn.host}:${conn.port || 443}`}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          </Paper>
        </Grid>

        {/* Right Panel - Command Interface */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Quick Commands */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Quick Commands
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {quickCommands.map(cmd => (
                  <Chip
                    key={cmd.label}
                    label={cmd.label}
                    icon={cmd.icon}
                    onClick={() => {
                      setCommandInput(cmd.command);
                      commandInputRef.current?.focus();
                    }}
                    disabled={!isConnected}
                    clickable
                  />
                ))}
              </Box>
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Command History */}
            <Box sx={{ flex: 1, overflow: 'auto', mb: 2 }}>
              <List>
                {commandHistory.map(entry => (
                  <ListItem key={entry.id} alignItems="flex-start">
                    <ListItemIcon>
                      {entry.success ? (
                        <CheckIcon color="success" />
                      ) : (
                        <ErrorIcon color="error" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box>
                          <Typography variant="body2" component="span" sx={{ fontWeight: 'bold' }}>
                            {entry.camera} &gt; {entry.command}
                          </Typography>
                          <Typography variant="caption" component="span" sx={{ ml: 1, color: 'text.secondary' }}>
                            {entry.timestamp.toLocaleTimeString()}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Typography
                          variant="body2"
                          component="pre"
                          sx={{
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'monospace',
                            fontSize: '0.875rem',
                            color: entry.success ? 'text.primary' : 'error.main',
                          }}
                        >
                          {entry.response}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
                <div ref={historyEndRef} />
              </List>
            </Box>

            {/* Command Input */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Enter command (e.g., 'analyze', 'speak Hello', 'capture')"
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSendCommand();
                  }
                }}
                disabled={!isConnected || isLoading}
                inputRef={commandInputRef}
              />
              <Button
                variant="contained"
                color="primary"
                onClick={handleSendCommand}
                disabled={!isConnected || isLoading || !commandInput.trim()}
                startIcon={isLoading ? <CircularProgress size={20} /> : <SendIcon />}
              >
                Send
              </Button>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Edit Connection Dialog */}
      {showSettings && editingConnection && (
        <Paper
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 400,
            p: 3,
            zIndex: 1000,
          }}
          elevation={10}
        >
          <Typography variant="h6" gutterBottom>
            Edit Connection
          </Typography>
          
          <TextField
            fullWidth
            label="Name"
            value={editForm.name || ''}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            sx={{ mb: 2 }}
          />
          
          <TextField
            fullWidth
            label="Host"
            value={editForm.host || ''}
            onChange={(e) => setEditForm({ ...editForm, host: e.target.value })}
            sx={{ mb: 2 }}
          />
          
          <TextField
            fullWidth
            label="Username"
            value={editForm.username || ''}
            onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
            sx={{ mb: 2 }}
          />
          
          <TextField
            fullWidth
            label="Password"
            type="password"
            value={editForm.password || ''}
            onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
            sx={{ mb: 2 }}
          />
          
          <TextField
            fullWidth
            label="Port"
            type="number"
            value={editForm.port || 443}
            onChange={(e) => setEditForm({ ...editForm, port: parseInt(e.target.value) })}
            sx={{ mb: 2 }}
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={editForm.secure || false}
                onChange={(e) => setEditForm({ ...editForm, secure: e.target.checked })}
              />
            }
            label="Use HTTPS"
            sx={{ mb: 2 }}
          />
          
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button onClick={() => {
              setShowSettings(false);
              setEditingConnection(null);
              setEditForm({});
            }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={() => {
                handleSaveConnection();
                setShowSettings(false);
              }}
            >
              Save
            </Button>
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default VisionConnectionPage;