import React, { useState, useEffect } from 'react';
import { Box, Container, ThemeProvider, CssBaseline, Typography, Button } from '@mui/material';
import WelcomePage from './pages/WelcomePage';
import AuthenticationPage from './pages/AuthenticationPage';
import ConfigurationPage from './pages/ConfigurationPage';
import DeploymentPage from './pages/DeploymentPage';
import CompletionPage from './pages/CompletionPage';
import { CameraDiscoveryPage } from './pages/camera/CameraDiscoveryPage';
import { ACAPDeploymentPage } from './pages/camera/ACAPDeploymentPage';
import { ACAPManager } from './pages/camera/ACAPManager';
import VisionPage from './pages/vision/VisionPage';
import NavigationSidebar, { NavigationView } from './components/NavigationSidebar';
import TopBar from './components/TopBar';
import { anavaTheme } from './theme/anavaTheme';
import AppFooter from './components/AppFooter';
import RetroEasterEgg from './components/RetroEasterEgg';
import { DeploymentState, DeploymentConfig, GCPProject } from '../types';

function App() {
  const [currentView, setCurrentView] = useState<NavigationView>('welcome');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedProject, setSelectedProject] = useState<GCPProject | null>(null);
  const [deploymentConfig, setDeploymentConfig] = useState<DeploymentConfig | null>(null);
  const [deploymentResult, setDeploymentResult] = useState<any>(null);
  const [selectedCameras, setSelectedCameras] = useState<any[]>([]);
  const [deploymentComplete, setDeploymentComplete] = useState(false);
  const [camerasConfigured, setCamerasConfigured] = useState(false);

  useEffect(() => {
    // Subscribe to deployment events
    window.electronAPI.deployment.subscribe();
    
    // Check authentication status
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const result = await window.electronAPI.auth.check();
    setIsAuthenticated(result.authenticated);
  };

  const handleViewChange = (view: NavigationView) => {
    // Allow navigation to any view
    setCurrentView(view);
    
    // For camera-deployment, ensure we pass deployment result or null
    if (view === 'camera-deployment' && !deploymentResult) {
      // They're navigating directly without GCP deployment
    }
  };

  const handleProjectSelected = (project: GCPProject) => {
    setSelectedProject(project);
    setCurrentView('gcp-setup');
  };

  const handleConfigComplete = (config: DeploymentConfig) => {
    setDeploymentConfig(config);
    // Start deployment automatically
  };

  const handleDeploymentComplete = (result: any) => {
    setDeploymentResult(result);
    setDeploymentComplete(true);
    // Optionally navigate to camera discovery
    // setCurrentView('camera-discovery');
  };

  const handleCamerasSelected = (cameras: any[]) => {
    console.log('Cameras selected:', cameras);
    setSelectedCameras(cameras);
    setCurrentView('camera-deployment');
  };

  const handleCameraDeploymentComplete = () => {
    setCamerasConfigured(true);
  };

  const handleLogout = async () => {
    await window.electronAPI.auth.logout();
    setIsAuthenticated(false);
    setSelectedProject(null);
    setDeploymentConfig(null);
    setDeploymentResult(null);
    setCurrentView('welcome');
  };

  const renderContent = () => {
    switch (currentView) {
      case 'welcome':
        return (
          <WelcomePage
            onNewDeployment={() => setCurrentView('gcp-setup')}
            onCheckExisting={() => setCurrentView('gcp-setup')}
          />
        );

      case 'gcp-setup':
        if (!isAuthenticated) {
          return (
            <AuthenticationPage
              onProjectSelected={handleProjectSelected}
              onBack={() => setCurrentView('welcome')}
              onLogout={handleLogout}
            />
          );
        }
        
        if (!selectedProject) {
          return (
            <AuthenticationPage
              onProjectSelected={handleProjectSelected}
              onBack={() => setCurrentView('welcome')}
              onLogout={handleLogout}
            />
          );
        }

        if (!deploymentConfig) {
          return (
            <ConfigurationPage
              project={selectedProject}
              onComplete={handleConfigComplete}
              onBack={() => setSelectedProject(null)}
              onLogout={handleLogout}
            />
          );
        }

        if (deploymentComplete && deploymentResult) {
          return (
            <CompletionPage
              result={deploymentResult}
              onNewDeployment={() => {
                setDeploymentComplete(false);
                setDeploymentResult(null);
                setDeploymentConfig(null);
              }}
              onBack={() => setCurrentView('welcome')}
              onLogout={handleLogout}
            />
          );
        }

        return (
          <DeploymentPage
            project={selectedProject}
            config={deploymentConfig}
            existingDeployment={null}
            onComplete={handleDeploymentComplete}
            onBack={() => setDeploymentConfig(null)}
            onLogout={handleLogout}
          />
        );

      case 'camera-discovery':
        return (
          <CameraDiscoveryPage
            onCamerasSelected={handleCamerasSelected}
            deploymentConfig={deploymentResult}
            onSkip={() => setCurrentView('welcome')}
            onBack={() => setCurrentView('welcome')}
          />
        );

      case 'acap-manager':
        return <ACAPManager />;

      case 'camera-deployment':
        console.log('Rendering camera-deployment view, selectedCameras:', selectedCameras);
        if (selectedCameras.length === 0) {
          console.warn('No cameras selected, showing message');
          return (
            <Box sx={{ p: 3 }}>
              <Typography variant="h5" gutterBottom>
                No Cameras Selected
              </Typography>
              <Typography variant="body1" paragraph>
                Please select cameras before proceeding to deployment.
              </Typography>
              <Button
                variant="contained"
                onClick={() => setCurrentView('camera-discovery')}
              >
                Go Back to Camera Discovery
              </Button>
            </Box>
          );
        }
        return (
          <ACAPDeploymentPage
            cameras={selectedCameras}
            deploymentConfig={deploymentResult}
            onComplete={handleCameraDeploymentComplete}
            onBack={() => setCurrentView('camera-discovery')}
          />
        );

      case 'vision':
        return (
          <VisionPage
            deploymentConfig={deploymentResult}
            configuredCameras={selectedCameras}
          />
        );

      case 'status':
        return (
          <Box sx={{ p: 3 }}>
            <Typography variant="h4">Status & Logs</Typography>
            <Typography variant="body1" sx={{ mt: 2 }}>
              Coming soon: View deployment status, logs, and diagnostics.
            </Typography>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <ThemeProvider theme={anavaTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <TopBar onLogout={handleLogout} />
        
        <NavigationSidebar
          currentView={currentView}
          onViewChange={handleViewChange}
          deploymentComplete={deploymentComplete}
          camerasConfigured={camerasConfigured}
        />
        
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            bgcolor: 'background.default',
            marginTop: '48px', // Account for TopBar height
            position: 'relative',
          }}
        >
          <Container maxWidth="lg" sx={{ py: 4 }}>
            {renderContent()}
          </Container>
          <AppFooter />
        </Box>
      </Box>
      <RetroEasterEgg trigger="konami" />
    </ThemeProvider>
  );
}

export default App;