import React, { useState, useEffect } from 'react';
import { Box, Container, ThemeProvider, CssBaseline, Typography, Button } from '@mui/material';
import WelcomePage from './pages/WelcomePage';
import AuthenticationPage from './pages/AuthenticationPage';
import AIModeSelectionPage from './pages/AIModeSelectionPage';
import ConfigurationPage from './pages/ConfigurationPage';
import DeploymentPage from './pages/DeploymentPage';
import CompletionPage from './pages/CompletionPage';
import { EnhancedCameraDiscoveryPage } from './pages/camera/EnhancedCameraDiscoveryPage';
import { ACAPDeploymentPage } from './pages/camera/ACAPDeploymentPage';
import { ACAPManager } from './pages/camera/ACAPManager';
import { MagicalWelcomePage } from './pages/MagicalWelcomePage';
import { MagicalDiscoveryPage } from './pages/MagicalDiscoveryPage';
import { MagicalAPIKeyPage } from './pages/MagicalAPIKeyPage';
import NavigationSidebar, { NavigationView } from './components/NavigationSidebar';
import TopBar from './components/TopBar';
import { anavaTheme } from './theme/anavaTheme';
import AppFooter from './components/AppFooter';
import RetroEasterEgg from './components/RetroEasterEgg';
import { DeploymentState, DeploymentConfig, GCPProject, CameraInfo } from '../types';

function App() {
  const [currentView, setCurrentView] = useState<NavigationView>('magical-welcome');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedAIMode, setSelectedAIMode] = useState<'vertex' | 'ai-studio' | null>(null);
  const [selectedProject, setSelectedProject] = useState<GCPProject | null>(null);
  const [deploymentConfig, setDeploymentConfig] = useState<DeploymentConfig | null>(null);
  const [deploymentResult, setDeploymentResult] = useState<any>(null);
  const [selectedCameras, setSelectedCameras] = useState<any[]>([]);
  const [deploymentComplete, setDeploymentComplete] = useState(false);
  const [camerasConfigured, setCamerasConfigured] = useState(false);
  const [magicalMode, setMagicalMode] = useState(true);
  const [magicalCamera, setMagicalCamera] = useState<CameraInfo | null>(null);

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
    // Ensure AI mode is included in the config
    setDeploymentConfig({
      ...config,
      aiMode: selectedAIMode || 'vertex'
    });
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
        
        // Show AI mode selection after authentication
        if (!selectedAIMode) {
          return (
            <AIModeSelectionPage
              onSelectMode={(mode) => {
                setSelectedAIMode(mode);
                // For AI Studio, we can optionally skip project selection
                if (mode === 'ai-studio') {
                  // We'll still show project selection but with "No Project" option
                }
              }}
              onLogout={handleLogout}
            />
          );
        }
        
        if (!selectedProject) {
          return (
            <AuthenticationPage
              onProjectSelected={handleProjectSelected}
              onBack={() => setSelectedAIMode(null)}
              onLogout={handleLogout}
              aiMode={selectedAIMode}
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
                setSelectedProject(null);
                setSelectedAIMode(null);
                setCurrentView('welcome');
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
          <EnhancedCameraDiscoveryPage
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

      case 'status':
        return (
          <Box sx={{ p: 3 }}>
            <Typography variant="h4">Status & Logs</Typography>
            <Typography variant="body1" sx={{ mt: 2 }}>
              Coming soon: View deployment status, logs, and diagnostics.
            </Typography>
          </Box>
        );

      case 'magical-welcome':
        return (
          <MagicalWelcomePage
            onTryMagic={() => setCurrentView('magical-api-key')}
            onTraditionalSetup={() => {
              setMagicalMode(false);
              setCurrentView('welcome');
            }}
          />
        );

      case 'magical-api-key':
        return (
          <MagicalAPIKeyPage
            onKeyGenerated={(apiKey) => {
              // Store the API key in window for the discovery page to use
              (window as any).__magicalApiKey = apiKey;
              setCurrentView('magical-discovery');
            }}
            onBack={() => setCurrentView('magical-welcome')}
          />
        );

      case 'magical-discovery':
        return (
          <MagicalDiscoveryPage
            onComplete={(camera) => {
              setMagicalCamera(camera);
              // Could transition to a magical completion view
            }}
            onError={(error) => {
              console.error('Magical discovery failed:', error);
              // Could show error state
            }}
            onCancel={() => {
              setMagicalMode(false);
              setCurrentView('welcome');
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <ThemeProvider theme={anavaTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        {!magicalMode && <TopBar onLogout={handleLogout} />}
        
        {!magicalMode && (
          <NavigationSidebar
            currentView={currentView}
            onViewChange={handleViewChange}
            deploymentComplete={deploymentComplete}
            camerasConfigured={camerasConfigured}
          />
        )}
        
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            bgcolor: magicalMode ? '#0A0E27' : 'background.default',
            marginTop: magicalMode ? 0 : '48px', // Account for TopBar height
            position: 'relative',
          }}
        >
          {magicalMode ? (
            renderContent()
          ) : (
            <>
              <Container maxWidth="lg" sx={{ py: 4 }}>
                {renderContent()}
              </Container>
              <AppFooter />
            </>
          )}
        </Box>
      </Box>
      <RetroEasterEgg trigger="konami" />
    </ThemeProvider>
  );
}

export default App;