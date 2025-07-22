import React, { useState, useEffect } from 'react';
import { Box, Container, ThemeProvider, CssBaseline } from '@mui/material';
import WelcomePage from './pages/WelcomePage';
import AuthenticationPage from './pages/AuthenticationPage';
import ConfigurationPage from './pages/ConfigurationPage';
import DeploymentPage from './pages/DeploymentPage';
import CompletionPage from './pages/CompletionPage';
import { anavaTheme } from './theme/anavaTheme';
import AppFooter from './components/AppFooter';
import RetroEasterEgg from './components/RetroEasterEgg';
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

  const handleCheckExisting = () => {
    // Go to auth page to select project and check for existing deployment
    setExistingDeployment(null);
    setCurrentPage('auth');
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

  const handleLogout = () => {
    // Reset all state
    setExistingDeployment(null);
    setSelectedProject(null);
    setDeploymentConfig(null);
    setDeploymentResult(null);
    setCurrentPage('welcome');
  };

  return (
    <ThemeProvider theme={anavaTheme}>
      <CssBaseline />
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
              onLogout={handleLogout}
            />
          )}
          
          {currentPage === 'config' && selectedProject && (
            <ConfigurationPage
              project={selectedProject}
              onComplete={handleConfigComplete}
              onBack={handleBack}
              onLogout={handleLogout}
            />
          )}
          
          {currentPage === 'deployment' && (
            <DeploymentPage
              project={selectedProject!}
              config={deploymentConfig}
              existingDeployment={existingDeployment}
              onComplete={handleDeploymentComplete}
              onBack={handleBack}
              onLogout={handleLogout}
            />
          )}
          
          {currentPage === 'completion' && (
            <CompletionPage
              result={deploymentResult}
              onNewDeployment={handleNewDeployment}
              onLogout={handleLogout}
            />
          )}
        </Container>
        <AppFooter />
      </Box>
      <RetroEasterEgg trigger="konami" />
    </ThemeProvider>
  );
}

export default App;