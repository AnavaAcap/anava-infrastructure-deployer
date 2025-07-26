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
import { CheckCircle, ArrowBack, ArrowForward, Refresh, Add } from '@mui/icons-material';
import { AuthStatus, GCPProject } from '../../types';
import TopBar from '../components/TopBar';
import { CreateProjectDialog } from '../components/CreateProjectDialog';

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
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [preparingProject, setPreparingProject] = useState(false);
  const [preparingProjectId, setPreparingProjectId] = useState<string | null>(null);

  // Helper function to format project display name
  const formatProjectName = (project: GCPProject): string => {
    // Truncate display name if too long (max 40 characters)
    const truncatedName = project.displayName.length > 40 
      ? project.displayName.substring(0, 37) + '...' 
      : project.displayName;
    
    return `${truncatedName} - ${project.projectId}`;
  };

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

  const handleProjectCreated = async (projectId: string) => {
    try {
      // Close dialog first
      setCreateDialogOpen(false);
      
      // Show preparing state
      setPreparingProject(true);
      setPreparingProjectId(projectId);
      
      // Give the project a moment to fully initialize
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Refresh the project list to get the full project info
      const projectList = await window.electronAPI.auth.getProjects();
      setProjects(projectList);
      
      // Find the newly created project
      const newProject = projectList.find(p => p.projectId === projectId);
      
      if (newProject) {
        // Proceed directly to deployment with the new project
        setPreparingProject(false);
        setPreparingProjectId(null);
        onProjectSelected(newProject);
      } else {
        // Project not found yet, retry a few times
        let retries = 0;
        const maxRetries = 5;
        
        while (retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const retryProjectList = await window.electronAPI.auth.getProjects();
          const foundProject = retryProjectList.find(p => p.projectId === projectId);
          
          if (foundProject) {
            setProjects(retryProjectList);
            setPreparingProject(false);
            setPreparingProjectId(null);
            onProjectSelected(foundProject);
            return;
          }
          
          retries++;
        }
        
        // Fallback: set it as selected and let user click Next
        setProjects(projectList);
        setSelectedProject(projectId);
        setPreparingProject(false);
        setPreparingProjectId(null);
        setError('Project created successfully but may take a few minutes to appear in the list. You can proceed with deployment.');
      }
    } catch (error) {
      console.error('Error preparing project:', error);
      setPreparingProject(false);
      setPreparingProjectId(null);
      setError('Project created but failed to prepare for deployment. Please refresh and select it manually.');
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

  if (preparingProject) {
    return (
      <Paper elevation={3} sx={{ p: 6, textAlign: 'center' }}>
        <TopBar 
          title="Google Cloud Authentication" 
          showLogout={authStatus?.authenticated && !!onLogout}
          onLogout={onLogout}
        />
        
        <Box sx={{ mt: 4 }}>
          <CircularProgress size={48} />
          <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
            Preparing Project
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Setting up project {preparingProjectId} for deployment...
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This will only take a moment.
          </Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <>
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
                renderValue={(value) => {
                  const project = projects.find(p => p.projectId === value);
                  return project ? formatProjectName(project) : value;
                }}
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
                      <Typography>
                        {formatProjectName(project)}
                      </Typography>
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
          
          <Box sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              startIcon={<Add />}
              onClick={() => setCreateDialogOpen(true)}
              fullWidth
            >
              Create New Project
            </Button>
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
      
      {/* Create Project Dialog */}
      <CreateProjectDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onProjectCreated={handleProjectCreated}
      />
    </>
  );
};

export default AuthenticationPage;