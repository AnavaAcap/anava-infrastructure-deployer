import { useState, useEffect } from 'react';
import { Box, Container, ThemeProvider, CssBaseline, Typography, Button, CircularProgress } from '@mui/material';
import WelcomePage from './pages/WelcomePage';
import LoginPageUnified from './pages/LoginPageUnified';
import AuthenticationPage from './pages/AuthenticationPage';
import ConfigurationPage from './pages/ConfigurationPage';
import DeploymentPage from './pages/DeploymentPage';
import CompletionPage from './pages/CompletionPage';
import { EnhancedCameraDiscoveryPage } from './pages/camera/EnhancedCameraDiscoveryPage';
import { ACAPDeploymentPage } from './pages/camera/ACAPDeploymentPage';
import { ACAPManager } from './pages/camera/ACAPManager';
import CameraSetupPage from './pages/CameraSetupPage';
import DetectionTestPage from './pages/DetectionTestPage';
import NavigationSidebar, { NavigationView } from './components/NavigationSidebar';
import TopBar from './components/TopBar';
import { anavaTheme } from './theme/anavaTheme';
import AppFooter from './components/AppFooter';
import RetroEasterEgg from './components/RetroEasterEgg';
import EULADialog from './components/EULADialog';
import { DeploymentConfig, GCPProject, CameraInfo } from '../types';
import { CameraProvider } from './contexts/CameraContext';

function App() {
  const [currentView, setCurrentView] = useState<NavigationView>('welcome');
  const [authState, setAuthState] = useState<'initializing' | 'authenticated' | 'unauthenticated'>('initializing');
  const [selectedAIMode, setSelectedAIMode] = useState<'vertex' | 'ai-studio' | null>(null);
  const [selectedProject, setSelectedProject] = useState<GCPProject | null>(null);
  const [deploymentConfig, setDeploymentConfig] = useState<DeploymentConfig | null>(null);
  const [deploymentResult, setDeploymentResult] = useState<any>(null);
  const [selectedCameras, setSelectedCameras] = useState<any[]>([]);
  const [deploymentComplete, setDeploymentComplete] = useState(false);
  const [camerasConfigured, setCamerasConfigured] = useState(false);
  const [licenseKey, setLicenseKey] = useState<string | null>(null);
  // TEMPORARY: Set to true to bypass EULA during development
  // Change back to false for production
  const [eulaAccepted, setEulaAccepted] = useState(true); // TEMPORARILY BYPASSED

  useEffect(() => {
    // Subscribe to deployment events
    window.electronAPI.deployment.subscribe();
    
    // Check EULA acceptance
    const checkEula = () => {
      const accepted = localStorage.getItem('eulaAccepted') === 'true';
      console.log('EULA acceptance status:', accepted);
      setEulaAccepted(accepted);
    };

    // Initialize authentication state
    const initializeAuth = async () => {
      try {
        // Check for cached license key
        const licenseResult = await window.electronAPI.license.getAssignedKey();
        if (licenseResult.success && licenseResult.key) {
          setLicenseKey(licenseResult.key);
          // If we have a license key, consider authenticated
          setAuthState('authenticated');
        } else {
          // Check standard GCP authentication
          const result = await window.electronAPI.auth.check();
          setAuthState(result.authenticated ? 'authenticated' : 'unauthenticated');
        }
        
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        setAuthState('unauthenticated');
      }
    };
    
    checkEula();
    initializeAuth();
  }, []);

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
      aiMode: selectedAIMode ?? 'vertex'
    });
    // Start deployment automatically
  };

  const handleDeploymentComplete = (result: any) => {
    setDeploymentResult(result);
    setDeploymentComplete(true);
    // Show the completion page
    setCurrentView('gcp-setup');
  };

  const handleCamerasSelected = (cameras: any[]) => {
    console.log('Cameras selected:', cameras);
    setSelectedCameras(cameras);
    setCurrentView('camera-deployment');
  };

  const handleCameraDeploymentComplete = () => {
    setCamerasConfigured(true);
  };

  const loadLicenseKey = async () => {
    try {
      const licenseResult = await window.electronAPI.license.getAssignedKey();
      if (licenseResult.success && licenseResult.key) {
        setLicenseKey(licenseResult.key);
      }
    } catch (error) {
      console.error('Failed to load license key:', error);
    }
  };

  const handleLogout = async () => {
    try {
      // Call the logout API
      await window.electronAPI.auth.logout();
      
      // Reset all state
      setAuthState('unauthenticated');
      setLicenseKey(null);
      setSelectedProject(null);
      setDeploymentConfig(null);
      setDeploymentResult(null);
      setSelectedCameras([]);
      setDeploymentComplete(false);
      setCamerasConfigured(false);
      setSelectedAIMode(null);
      
      // Navigate to welcome page
      setCurrentView('welcome');
      
      console.log('Logout completed, state reset');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const renderContent = () => {
    // Show loading state while auth is initializing
    if (authState === 'initializing') {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            gap: 3,
          }}
        >
          <CircularProgress
            size={60}
            sx={{
              color: 'primary.main',
              animation: 'pulse 2s ease-in-out infinite',
              '@keyframes pulse': {
                '0%': { opacity: 0.6 },
                '50%': { opacity: 1 },
                '100%': { opacity: 0.6 },
              },
            }}
          />
          <Typography variant="h6" color="text.secondary">
            Initializing...
          </Typography>
        </Box>
      );
    }
    
    switch (currentView) {
      case 'welcome':
        return (
          <WelcomePage
            key={licenseKey || 'no-license'} // Force re-render when license changes
            onNewDeployment={() => setCurrentView('gcp-setup')}
            onCheckExisting={() => setCurrentView('gcp-setup')}
            onNavigate={(view) => setCurrentView(view as NavigationView)}
          />
        );

      case 'gcp-setup':
        if (authState !== 'authenticated') {
          return (
            <AuthenticationPage
              onProjectSelected={handleProjectSelected}
              onBack={() => setCurrentView('welcome')}
              onLogout={handleLogout}
            />
          );
        }
        
        // Always use Vertex AI for production deployments
        if (!selectedAIMode) {
          setSelectedAIMode('vertex');
          return null; // Will re-render with selectedAIMode set
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


      case 'camera-setup':
        return <CameraSetupPage onNavigate={(view) => setCurrentView(view as NavigationView)} />;


      case 'detection-test':
        return <DetectionTestPage />;

      default:
        return null;
    }
  };

  // Use the standard theme
  const theme = anavaTheme;

  // Show login page if not authenticated and not initializing
  if (authState === 'unauthenticated' && !licenseKey) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <EULADialog 
          open={!eulaAccepted} 
          onAccept={() => setEulaAccepted(true)} 
        />
        <LoginPageUnified 
          onLoginSuccess={() => {
            setAuthState('authenticated');
            loadLicenseKey();
          }}
        />
        <RetroEasterEgg trigger="konami" />
      </ThemeProvider>
    );
  }

  return (
    <CameraProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <EULADialog 
          open={!eulaAccepted} 
          onAccept={() => setEulaAccepted(true)} 
        />
        <Box sx={{ display: 'flex', minHeight: '100vh', flexDirection: 'column' }}>
          <TopBar title="Anava Vision Installer" onLogout={handleLogout} />
        
        <Box sx={{ display: 'flex', flex: 1 }}>
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
              display: 'flex',
              flexDirection: 'column',
              height: 'calc(100vh - 48px)',
            }}
          >
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              {renderContent()}
            </Box>
            <AppFooter />
          </Box>
        </Box>
      </Box>
      <RetroEasterEgg trigger="konami" />
    </ThemeProvider>
    </CameraProvider>
  );
}

export default App;