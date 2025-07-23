import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import { CheckCircle, ArrowBack, ArrowForward, Refresh } from '@mui/icons-material';
import { AuthStatus, GCPProject } from '../../types';
import TopBar from '../components/TopBar';

interface AuthenticationPageProps {
  onProjectSelected: (project: GCPProject) => void;
  onBack: () => void;
  onLogout?: () => void;
}

const AuthenticationPage: React.FC<AuthenticationPageProps> = ({ onProjectSelected, onBack, onLogout }) => {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [projects, setProjects] = useState<GCPProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const status = await window.electronAPI.auth.check();
      setAuthStatus(status);
      
      if (status.authenticated) {
        const projectList = await window.electronAPI.auth.getProjects();
        setProjects(projectList);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    const project = projects.find(p => p.projectId === selectedProject);
    if (project) {
      onProjectSelected(project);
    }
  };

  const handleRefreshProjects = async () => {
    try {
      setRefreshing(true);
      setError(null);
      const projectList = await window.electronAPI.auth.getProjects();
      setProjects(projectList);
      // Clear selection if the previously selected project is no longer in the list
      if (selectedProject && !projectList.find(p => p.projectId === selectedProject)) {
        setSelectedProject('');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <Paper elevation={3} sx={{ p: 6, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Checking authentication...</Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={3} sx={{ p: 6 }}>
      <TopBar 
        title="Google Cloud Authentication" 
        showLogout={authStatus?.authenticated && !!onLogout}
        onLogout={onLogout}
      />
      
      {authStatus?.authenticated ? (
        <>
          <Box sx={{ mb: 4 }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <CheckCircle color="success" />
              <Typography>Found gcloud credentials</Typography>
            </Stack>
            
            <Stack direction="row" spacing={2} alignItems="center">
              <CheckCircle color="success" />
              <Typography>Authenticated as: {authStatus.user}</Typography>
            </Stack>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 4 }}>
            <FormControl fullWidth>
              <InputLabel>Project</InputLabel>
              <Select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                label="Project"
                disabled={refreshing}
              >
                {projects.length === 0 ? (
                  <MenuItem disabled>
                    <Typography color="text.secondary">
                      No projects found. Click refresh if you just created one.
                    </Typography>
                  </MenuItem>
                ) : (
                  projects.map((project) => (
                    <MenuItem key={project.projectId} value={project.projectId}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography>{project.displayName}</Typography>
                        <Chip label={project.projectId} size="small" />
                      </Box>
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
            <Tooltip title="Refresh project list">
              <IconButton 
                onClick={handleRefreshProjects}
                disabled={refreshing}
                sx={{ mt: 1 }}
              >
                {refreshing ? <CircularProgress size={24} /> : <Refresh />}
              </IconButton>
            </Tooltip>
          </Box>
          
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}
        </>
      ) : (
        <>
          <Alert severity="info" sx={{ mb: 4 }}>
            {authStatus?.error || 'Not authenticated'}
          </Alert>
          
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Button
              variant="contained"
              size="large"
              onClick={async () => {
                try {
                  setLoading(true);
                  await window.electronAPI.auth.login();
                  await checkAuthentication();
                } catch (error) {
                  setError((error as Error).message);
                } finally {
                  setLoading(false);
                }
              }}
              sx={{ px: 4, py: 1.5 }}
            >
              Login with Google
            </Button>
          </Box>
        </>
      )}
      
      <Stack direction="row" spacing={2} justifyContent="space-between">
        <Button
          variant="outlined"
          startIcon={<ArrowBack />}
          onClick={onBack}
        >
          Previous
        </Button>
        
        <Button
          variant="contained"
          endIcon={<ArrowForward />}
          onClick={handleNext}
          disabled={!selectedProject}
        >
          Next
        </Button>
      </Stack>
    </Paper>
  );
};

export default AuthenticationPage;