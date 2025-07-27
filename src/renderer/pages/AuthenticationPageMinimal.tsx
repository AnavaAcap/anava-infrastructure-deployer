import React, { useState, useEffect } from 'react';
import { Box, Button, Typography, Paper, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { GCPProject } from '../../types';

interface Props {
  onProjectSelected: (project: GCPProject) => void;
  onBack: () => void;
  onLogout?: () => void;
}

const AuthenticationPageMinimal: React.FC<Props> = ({ onProjectSelected, onBack }) => {
  const [projects, setProjects] = useState<GCPProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      console.log('Loading projects...');
      const projectList = await window.electronAPI.auth.getProjects();
      console.log('Got projects:', projectList.length);
      
      // Debug: only take first 5 projects
      const limitedProjects = projectList.slice(0, 5);
      setProjects(limitedProjects);
    } catch (err: any) {
      console.error('Error loading projects:', err);
      setError(err.message);
    }
  };

  return (
    <Paper sx={{ p: 4 }}>
      <Typography variant="h5">Select Project (Test)</Typography>
      
      {error && (
        <Typography color="error" sx={{ my: 2 }}>
          Error: {error}
        </Typography>
      )}
      
      <FormControl fullWidth sx={{ my: 2 }}>
        <InputLabel>Project</InputLabel>
        <Select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          label="Project"
        >
          {projects.map((p) => (
            <MenuItem key={p.projectId} value={p.projectId}>
              {p.projectId}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button onClick={onBack}>Back</Button>
        <Button 
          variant="contained"
          disabled={!selectedProject}
          onClick={() => {
            const project = projects.find(p => p.projectId === selectedProject);
            if (project) onProjectSelected(project);
          }}
        >
          Next
        </Button>
      </Box>
    </Paper>
  );
};

export default AuthenticationPageMinimal;