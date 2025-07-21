import React, { useState, useEffect } from 'react';
import { Box, Container } from '@mui/material';
import WelcomePage from './pages/WelcomePage';
import AuthenticationPage from './pages/AuthenticationPage';
import ConfigurationPage from './pages/ConfigurationPage';
import DeploymentPage from './pages/DeploymentPage';
import CompletionPage from './pages/CompletionPage';
import { DeploymentState, DeploymentConfig, GCPProject } from '../types';

type Page = 'welcome' | 'auth' | 'config' | 'deployment' | 'completion';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('welcome');
  const [existingDeployment, setExistingDeployment] = useState<DeploymentState | null>(null);
  const [selectedProject, setSelectedProject] = useState<GCPProject | null>(null);
  const [deploymentConfig, setDeploymentConfig] = useState<DeploymentConfig | null>(null);
  const [deploymentResult, setDeploymentResult] = useState<any>(null);

  useEffect(() => {
    // Subscribe to deployment events
    window.electronAPI.deployment.subscribe();
  }, []);

  const handleNewDeployment = () => {
    setExistingDeployment(null);
    setCurrentPage('auth');
  };

  const handleCheckExisting = async () => {
    // This would be triggered from the auth page after project selection
    if (selectedProject) {
      const existing = await window.electronAPI.state.checkExisting(selectedProject.projectId);
      if (existing) {
        setExistingDeployment(existing);
        setCurrentPage('deployment');
      }
    }
  };

  const handleProjectSelected = (project: GCPProject) => {
    setSelectedProject(project);
    setCurrentPage('config');
  };

  const handleConfigComplete = (config: DeploymentConfig) => {
    setDeploymentConfig(config);
    setCurrentPage('deployment');
  };

  const handleDeploymentComplete = (result: any) => {
    setDeploymentResult(result);
    setCurrentPage('completion');
  };

  const handleBack = () => {
    switch (currentPage) {
      case 'auth':
        setCurrentPage('welcome');
        break;
      case 'config':
        setCurrentPage('auth');
        break;
      case 'deployment':
        if (!existingDeployment) {
          setCurrentPage('config');
        }
        break;
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Container maxWidth="md" sx={{ py: 4 }}>
        {currentPage === 'welcome' && (
          <WelcomePage
            onNewDeployment={handleNewDeployment}
            onCheckExisting={handleCheckExisting}
          />
        )}
        
        {currentPage === 'auth' && (
          <AuthenticationPage
            onProjectSelected={handleProjectSelected}
            onBack={handleBack}
          />
        )}
        
        {currentPage === 'config' && selectedProject && (
          <ConfigurationPage
            project={selectedProject}
            onComplete={handleConfigComplete}
            onBack={handleBack}
          />
        )}
        
        {currentPage === 'deployment' && (
          <DeploymentPage
            project={selectedProject!}
            config={deploymentConfig}
            existingDeployment={existingDeployment}
            onComplete={handleDeploymentComplete}
            onBack={handleBack}
          />
        )}
        
        {currentPage === 'completion' && (
          <CompletionPage
            result={deploymentResult}
            onNewDeployment={handleNewDeployment}
          />
        )}
      </Container>
    </Box>
  );
}

export default App;