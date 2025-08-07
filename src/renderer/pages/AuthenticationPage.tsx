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
  TextField,
  Divider,
  FormHelperText,
} from '@mui/material';
import { 
  CheckCircle, 
  ArrowBack, 
  ArrowForward, 
  Refresh, 
  Add,
  Error as ErrorIcon,
  Warning as WarningIcon 
} from '@mui/icons-material';
import { AuthStatus, GCPProject } from '../../types';
import TopBar from '../components/TopBar';
import { CreateProjectDialog } from '../components/CreateProjectDialog';
import BillingGuidanceDialog from '../components/BillingGuidanceDialog';

interface AuthenticationPageProps {
  onProjectSelected: (project: GCPProject) => void;
  onBack: () => void;
  onLogout?: () => void;
  aiMode?: 'vertex' | 'ai-studio';
}

const AuthenticationPage: React.FC<AuthenticationPageProps> = ({ onProjectSelected, onBack, onLogout, aiMode }) => {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [projects, setProjects] = useState<GCPProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [preparingProject, setPreparingProject] = useState(false);
  const [preparingProjectId, setPreparingProjectId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Billing check states
  const [checkingBilling, setCheckingBilling] = useState(false);
  const [billingStatus, setBillingStatus] = useState<{
    enabled: boolean;
    error?: string;
  } | null>(null);
  const [billingGuidanceOpen, setBillingGuidanceOpen] = useState(false);

  // Helper function to format project display name
  const formatProjectName = (project: GCPProject): string => {
    // If no display name or display name is same as project ID, just return project ID
    if (!project.displayName || project.displayName === project.projectId) {
      return project.projectId;
    }
    
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
        console.log('Getting project list...');
        const projectList = await window.electronAPI.auth.getProjects();
        console.log(`Received ${projectList.length} projects`);
        
        // Validate project data
        const validProjects = projectList.filter(p => {
          if (!p || typeof p !== 'object') {
            console.error('Invalid project object:', p);
            return false;
          }
          if (!p.projectId) {
            console.error('Project missing projectId:', p);
            return false;
          }
          return true;
        });
        
        console.log(`${validProjects.length} valid projects after filtering`);
        setProjects(validProjects);
      }
    } catch (err) {
      console.error('Authentication check error:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const checkProjectBilling = async (projectId: string) => {
    if (projectId === 'no-project') {
      // No billing check needed for AI Studio mode
      setBillingStatus({ enabled: true });
      return true;
    }

    setCheckingBilling(true);
    setBillingStatus(null);
    setError(null);

    try {
      const result = await window.electronAPI.billing.checkProject(projectId);
      
      setBillingStatus({
        enabled: result.enabled,
        error: result.error
      });

      if (!result.enabled && !result.error) {
        // Billing is disabled but no specific error - show guidance
        setBillingGuidanceOpen(true);
      }

      return result.enabled;
    } catch (err) {
      console.error('Failed to check billing:', err);
      setBillingStatus({
        enabled: false,
        error: 'Failed to check billing status'
      });
      return false;
    } finally {
      setCheckingBilling(false);
    }
  };

  const handleProjectChange = async (projectId: string) => {
    setSelectedProject(projectId);
    setBillingStatus(null);
    
    if (projectId) {
      await checkProjectBilling(projectId);
    }
  };

  const handleNext = () => {
    if (!billingStatus?.enabled) {
      // Don't proceed if billing is not enabled
      setBillingGuidanceOpen(true);
      return;
    }

    if (selectedProject === 'no-project') {
      // For AI Studio with no project, create a special project object
      const noProjectOption: GCPProject = {
        projectId: 'no-project',
        projectNumber: '',
        displayName: 'Personal API Key',
        state: 'ACTIVE'
      };
      onProjectSelected(noProjectOption);
    } else {
      const project = projects.find(p => p.projectId === selectedProject);
      if (project) {
        onProjectSelected(project);
      }
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
        // Project not found yet, retry for up to 3 minutes with increasing delays
        let retries = 0;
        const maxRetries = 36; // 36 retries to cover 3 minutes
        let retryDelay = 2000; // Start with 2 seconds
        
        console.log(`Project ${projectId} not found in initial list, starting extended retry loop...`);
        
        while (retries < maxRetries) {
          // Increase delay after first 10 retries
          if (retries === 10) {
            retryDelay = 3000; // 3 seconds
            console.log('Increasing retry delay to 3 seconds...');
          } else if (retries === 20) {
            retryDelay = 5000; // 5 seconds
            console.log('Increasing retry delay to 5 seconds...');
          }
          
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          
          const elapsedSeconds = Math.floor(
            (retries < 10 ? (retries + 1) * 2 : 
             retries < 20 ? 20 + (retries - 9) * 3 :
             20 + 30 + (retries - 19) * 5) / 1000
          );
          
          console.log(`Retry ${retries + 1}/${maxRetries}: Checking for project ${projectId}... (${elapsedSeconds}s elapsed)`);
          
          // Force a fresh fetch with no caching
          try {
            const retryProjectList = await window.electronAPI.auth.getProjects();
            console.log(`Found ${retryProjectList.length} projects in retry ${retries + 1}`);
            
            const foundProject = retryProjectList.find(p => p.projectId === projectId);
            
            if (foundProject) {
              console.log(`✅ Project ${projectId} found after ${elapsedSeconds} seconds!`);
              setProjects(retryProjectList);
              setPreparingProject(false);
              setPreparingProjectId(null);
              onProjectSelected(foundProject);
              return;
            }
            
            // Also check if project exists but with different casing
            const foundProjectCaseInsensitive = retryProjectList.find(p => 
              p.projectId.toLowerCase() === projectId.toLowerCase()
            );
            
            if (foundProjectCaseInsensitive) {
              console.log(`✅ Project found with different casing: ${foundProjectCaseInsensitive.projectId}`);
              setProjects(retryProjectList);
              setPreparingProject(false);
              setPreparingProjectId(null);
              onProjectSelected(foundProjectCaseInsensitive);
              return;
            }
          } catch (retryError) {
            console.error(`Error in retry ${retries + 1}:`, retryError);
            // Continue retrying even if one attempt fails
          }
          
          retries++;
        }
        
        // Final attempt: One last try after all retries
        console.log('Making final attempt to find project...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        try {
          const finalProjectList = await window.electronAPI.auth.getProjects();
          const finalProject = finalProjectList.find(p => p.projectId === projectId);
          
          if (finalProject) {
            console.log(`✅ Project ${projectId} found in final attempt!`);
            setProjects(finalProjectList);
            setPreparingProject(false);
            setPreparingProjectId(null);
            onProjectSelected(finalProject);
            return;
          }
        } catch (finalError) {
          console.error('Final attempt failed:', finalError);
        }
        
        // Fallback: set it as selected and let user proceed manually
        console.log(`❌ Project ${projectId} not found after extended retry (3+ minutes)`);
        setProjects(projectList);
        setSelectedProject(projectId);
        setPreparingProject(false);
        setPreparingProjectId(null);
        
        // Create a "fake" project entry so user can proceed
        const fakeProject: GCPProject = {
          projectId: projectId,
          projectNumber: '',
          displayName: projectId,
          state: 'ACTIVE'
        };
        
        // Add it to the list and select it
        const updatedList = [...projectList, fakeProject];
        setProjects(updatedList);
        
        setError('✅ Project created successfully! It may take 2-3 minutes to appear in the list. You can proceed with deployment or wait for it to show up.');
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
          title="Vertex AI Infrastructure - Project Selection" 
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
        title="Vertex AI Infrastructure - Project Selection" 
        showLogout={authStatus?.authenticated && !!onLogout}
        onLogout={onLogout}
      />
      
      {authStatus?.authenticated ? (
        <>
          <Alert severity="info" sx={{ mb: 4 }}>
            <Typography variant="subtitle2" gutterBottom>
              <strong>Time to upgrade from testing to production!</strong>
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              You've been using Google AI Studio for testing your cameras - that was perfect for validation. 
              Now we'll deploy enterprise-grade Vertex AI infrastructure for secure, scalable production use.
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              <strong>Key improvements:</strong> Enterprise security (IAM vs API keys), unlimited scale, 
              complete audit trails, and full GCP integration.
            </Typography>
          </Alert>

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
          
          {projects.length > 10 && (
            <TextField
              fullWidth
              size="small"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ mb: 2 }}
            />
          )}
          
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 4 }}>
            <FormControl fullWidth>
              <InputLabel>Project</InputLabel>
              <Select
                value={selectedProject}
                onChange={(e) => handleProjectChange(e.target.value)}
                label="Project"
                disabled={refreshing || checkingBilling}
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
                  (() => {
                    const filteredProjects = projects.filter((project) => {
                      if (!searchQuery) return true;
                      const query = searchQuery.toLowerCase();
                      const displayName = (project.displayName || '').toLowerCase();
                      const projectId = project.projectId.toLowerCase();
                      return displayName.includes(query) || projectId.includes(query);
                    });
                    
                    const displayProjects = filteredProjects.slice(0, 200);
                    const hasMore = filteredProjects.length > 200;
                    
                    return [
                      // Add "No Project" option for AI Studio mode
                      aiMode === 'ai-studio' && (
                        <MenuItem key="no-project" value="no-project">
                          <Stack>
                            <Typography>No Project - Personal API Key</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Use my personal Google account quota
                            </Typography>
                          </Stack>
                        </MenuItem>
                      ),
                      aiMode === 'ai-studio' && <MenuItem key="divider" disabled><Divider /></MenuItem>,
                      // Regular project list
                      ...displayProjects.map((project) => {
                        try {
                          return (
                            <MenuItem key={project.projectId} value={project.projectId}>
                              <Typography>
                                {formatProjectName(project)}
                              </Typography>
                            </MenuItem>
                          );
                        } catch (err) {
                          console.error('Error rendering project:', project, err);
                          return null;
                        }
                      }).filter(Boolean),
                      ...(hasMore ? [
                        <MenuItem key="__more__" disabled>
                          <Typography color="text.secondary" variant="caption">
                            {filteredProjects.length - 200} more projects... Use search to filter
                          </Typography>
                        </MenuItem>
                      ] : [])
                    ];
                  })()
                )}
              </Select>
              {/* Billing status indicator */}
              {checkingBilling && (
                <FormHelperText>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={16} />
                    Verifying project settings...
                  </Box>
                </FormHelperText>
              )}
              {!checkingBilling && billingStatus && (
                <FormHelperText>
                  {billingStatus.enabled ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'success.main' }}>
                      <CheckCircle fontSize="small" />
                      ✓ Project is ready. Billing is enabled.
                    </Box>
                  ) : billingStatus.error ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'warning.main' }}>
                      <WarningIcon fontSize="small" />
                      {billingStatus.error}
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
                      <ErrorIcon fontSize="small" />
                      Billing not enabled
                    </Box>
                  )}
                </FormHelperText>
              )}
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
          
          {/* Billing error alert */}
          {billingStatus && !billingStatus.enabled && selectedProject && selectedProject !== 'no-project' && (
            <Alert 
              severity="error" 
              sx={{ mb: 3 }}
              action={
                <Stack direction="row" spacing={1}>
                  <Button 
                    size="small" 
                    variant="contained"
                    onClick={() => setBillingGuidanceOpen(true)}
                  >
                    Guide Me: Enable Billing
                  </Button>
                  <Button 
                    size="small" 
                    variant="outlined"
                    onClick={() => setSelectedProject('')}
                  >
                    Select Different Project
                  </Button>
                  <Button 
                    size="small" 
                    variant="text"
                    onClick={() => checkProjectBilling(selectedProject)}
                  >
                    Re-check Status
                  </Button>
                </Stack>
              }
            >
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Billing Not Enabled
              </Typography>
              <Typography variant="body2">
                To create the necessary infrastructure, the selected project ({selectedProject}) must be linked to a billing account. 
                This is required by Google Cloud even for resources that fall within the free tier.
              </Typography>
            </Alert>
          )}
          
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
          disabled={!selectedProject || checkingBilling || (billingStatus && !billingStatus.enabled && selectedProject !== 'no-project')}
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
      
      {/* Billing Guidance Dialog */}
      <BillingGuidanceDialog
        open={billingGuidanceOpen}
        projectId={selectedProject}
        onClose={() => setBillingGuidanceOpen(false)}
        onRecheck={() => checkProjectBilling(selectedProject)}
      />
    </>
  );
};

export default AuthenticationPage;