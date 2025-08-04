import { useState, useEffect } from 'react';
import { Box, Container, ThemeProvider, CssBaseline, Typography, Button, CircularProgress } from '@mui/material';
import WelcomePage from './pages/WelcomePage';
import UnifiedWelcomePage from './pages/UnifiedWelcomePage';
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
import MagicalNavigationStepper, { MagicalStep } from './components/MagicalNavigationStepper';
import TopBar from './components/TopBar';
import { anavaTheme, magicalUnifiedTheme } from './theme/anavaTheme';
import AppFooter from './components/AppFooter';
import RetroEasterEgg from './components/RetroEasterEgg';
import { DeploymentConfig, GCPProject, CameraInfo } from '../types';

function App() {
  const [currentView, setCurrentView] = useState<NavigationView>('magical-welcome');
  const [authState, setAuthState] = useState<'initializing' | 'authenticated' | 'unauthenticated'>('initializing');
  const [selectedAIMode, setSelectedAIMode] = useState<'vertex' | 'ai-studio' | null>(null);
  const [selectedProject, setSelectedProject] = useState<GCPProject | null>(null);
  const [deploymentConfig, setDeploymentConfig] = useState<DeploymentConfig | null>(null);
  const [deploymentResult, setDeploymentResult] = useState<any>(null);
  const [selectedCameras, setSelectedCameras] = useState<any[]>([]);
  const [deploymentComplete, setDeploymentComplete] = useState(false);
  const [camerasConfigured, setCamerasConfigured] = useState(false);
  const [magicalMode, setMagicalMode] = useState(true);
  const [magicalCamera, setMagicalCamera] = useState<CameraInfo | null>(null);
  const [useDarkTheme, setUseDarkTheme] = useState(true); // Start with dark theme for magical experience
  const [flowOrigin, setFlowOrigin] = useState<'magical' | 'traditional'>('magical');
  const [magicalApiKey, setMagicalApiKey] = useState<string | null>(null);

  useEffect(() => {
    // Subscribe to deployment events
    window.electronAPI.deployment.subscribe();
    
    // Initialize authentication state
    const initializeAuth = async () => {
      try {
        // First check for magical transition state
        const savedTransition = sessionStorage.getItem('magicalTransition');
        if (savedTransition) {
          const transition = JSON.parse(savedTransition);
          if (transition.flowOrigin === 'magical' && transition.apiKey) {
            // Found magical flow credentials
            setUseDarkTheme(true);
            setFlowOrigin('magical');
            setSelectedAIMode('ai-studio');
            setMagicalApiKey(transition.apiKey);
            
            if (transition.camera) {
              setMagicalCamera(transition.camera);
              setSelectedCameras([transition.camera]);
            }
            
            // Restore API key to window
            (window as any).__magicalApiKey = transition.apiKey;
            
            // Consider authenticated with API key
            setAuthState('authenticated');
            
            // Navigate directly to appropriate view if needed
            if (currentView === 'magical-welcome') {
              setCurrentView('gcp-setup');
              setMagicalMode(false);
            }
            return;
          }
        }
        
        // Check standard authentication
        const result = await window.electronAPI.auth.check();
        setAuthState(result.authenticated ? 'authenticated' : 'unauthenticated');
        
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        setAuthState('unauthenticated');
      }
    };
    
    initializeAuth();

    // Listen for navigation from magical mode to infrastructure mode
    const handleNavigateToInfrastructure = (event: any) => {
      const { fromMagicalMode, apiKey, cameraIp, camera } = event.detail;
      if (fromMagicalMode) {
        // Preserve magical state when transitioning
        const magicalTransition = {
          apiKey,
          cameraIp,
          camera: camera || magicalCamera,
          flowOrigin: 'magical',
          theme: 'dark'
        };
        sessionStorage.setItem('magicalTransition', JSON.stringify(magicalTransition));
        
        // Store API key in state
        setMagicalApiKey(apiKey);
        (window as any).__magicalApiKey = apiKey;
        
        // Set AI mode to AI Studio since we already have the API key
        setSelectedAIMode('ai-studio');
        
        // If we have a camera, add it to selected cameras for camera deployment
        if (camera || magicalCamera) {
          setSelectedCameras([camera || magicalCamera]);
          setMagicalCamera(camera || magicalCamera);
        }
        
        // Keep dark theme and navigate to auth/project selection
        setUseDarkTheme(true);
        setFlowOrigin('magical');
        setMagicalMode(false);
        setAuthState('authenticated'); // Mark as authenticated
        setCurrentView('gcp-setup');
      }
    };

    window.addEventListener('navigate-to-infrastructure', handleNavigateToInfrastructure);
    
    return () => {
      window.removeEventListener('navigate-to-infrastructure', handleNavigateToInfrastructure);
    };
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
    
    // If we have pre-selected cameras from magical flow, go directly to camera deployment
    if (flowOrigin === 'magical' && selectedCameras.length > 0) {
      setCurrentView('camera-deployment');
    } else {
      // Otherwise show the completion page
      setCurrentView('gcp-setup');
    }
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
    setAuthState('unauthenticated');
    setMagicalApiKey(null);
    setSelectedProject(null);
    setDeploymentConfig(null);
    setDeploymentResult(null);
    setMagicalCamera(null);
    setSelectedCameras([]);
    sessionStorage.removeItem('magicalTransition');
    (window as any).__magicalApiKey = null;
    setCurrentView('welcome');
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
        // Use unified welcome page when coming from magical flow
        if (flowOrigin === 'magical' && useDarkTheme) {
          return (
            <UnifiedWelcomePage
              onNewDeployment={() => setCurrentView('gcp-setup')}
              onCheckExisting={() => setCurrentView('gcp-setup')}
              flowOrigin={flowOrigin}
              magicalCamera={magicalCamera}
            />
          );
        }
        return (
          <WelcomePage
            onNewDeployment={() => setCurrentView('gcp-setup')}
            onCheckExisting={() => setCurrentView('gcp-setup')}
          />
        );

      case 'gcp-setup':
        // Skip authentication if coming from magical flow with API key
        if (authState !== 'authenticated' && !magicalApiKey) {
          return (
            <AuthenticationPage
              onProjectSelected={handleProjectSelected}
              onBack={() => setCurrentView('welcome')}
              onLogout={handleLogout}
            />
          );
        }
        
        // Skip AI mode selection if already set (e.g., from magical flow)
        if (!selectedAIMode) {
          // Only show AI mode selection if not coming from magical flow
          if (flowOrigin !== 'magical') {
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
        }
        
        if (!selectedProject) {
          // For magical flow with AI Studio mode, we can skip project selection
          if (flowOrigin === 'magical' && selectedAIMode === 'ai-studio' && magicalApiKey) {
            // Create a "no project" placeholder and auto-proceed
            const noProject: GCPProject = {
              projectId: 'no-project',
              projectNumber: '',
              displayName: 'AI Studio Mode (No GCP Project)',
              state: 'ACTIVE',
            };
            handleProjectSelected(noProject);
            return null; // Will re-render with project selected
          }
          
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

  // Map navigation views to magical steps
  const getMagicalStep = (): MagicalStep => {
    switch (currentView) {
      case 'magical-welcome':
        return 'welcome';
      case 'magical-api-key':
        return 'api-key';
      case 'magical-discovery':
        return 'discovery';
      default:
        return 'welcome';
    }
  };

  // Handle magical step navigation
  const handleMagicalStepClick = (step: MagicalStep) => {
    const viewMap: Record<MagicalStep, NavigationView> = {
      'welcome': 'magical-welcome',
      'api-key': 'magical-api-key',
      'discovery': 'magical-discovery',
      'complete': 'magical-discovery',
    };
    setCurrentView(viewMap[step]);
  };

  // Choose theme based on current state
  const theme = useDarkTheme ? magicalUnifiedTheme : anavaTheme;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', minHeight: '100vh', flexDirection: 'column' }}>
        {!magicalMode && <TopBar title="Anava Vision Installer" onLogout={handleLogout} />}
        
        {magicalMode && (
          <MagicalNavigationStepper
            currentStep={getMagicalStep()}
            onStepClick={handleMagicalStepClick}
          />
        )}
        
        <Box sx={{ display: 'flex', flex: 1 }}>
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
              bgcolor: 'background.default',
              marginTop: !magicalMode ? '48px' : 0, // Account for TopBar height
              position: 'relative',
            }}
          >
            {magicalMode ? (
              renderContent()
            ) : (
              <>
                <Box sx={{ height: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}>
                  {renderContent()}
                </Box>
                <AppFooter />
              </>
            )}
          </Box>
        </Box>
      </Box>
      <RetroEasterEgg trigger="konami" />
    </ThemeProvider>
  );
}

export default App;