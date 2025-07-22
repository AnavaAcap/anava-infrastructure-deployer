# Project Structure

## Main Process (src/main/)
- **index.ts**: Entry point, IPC handlers, window management
- **preload.ts**: Preload script exposing APIs to renderer
- **services/**:
  - GCP OAuth and authentication services
  - Deployment engine and state management
  - Individual deployers for each GCP service
  - Service usage API management
- **utils/**:
  - Logger utility
  - gcloud path detection

## Renderer Process (src/renderer/)
- **index.tsx**: React app entry point
- **App.tsx**: Main app component with page routing
- **pages/**: Individual page components
  - WelcomePage, AuthenticationPage, ConfigurationPage
  - DeploymentPage, CompletionPage
- **components/**: Reusable UI components
  - TopBar, AppFooter, PostDeploymentChecklist
  - RetroEasterEgg (fun UI element)
- **theme/**: Material-UI theme configuration

## Cloud Functions (functions/)
- Source code for deployed Cloud Functions
- Handles authentication and token vending

## Configuration Files
- **api-gateway-config.yaml**: API Gateway OpenAPI spec
- **oauth-config.json**: OAuth configuration
- **electron-vite.config.ts**: Electron-specific Vite config
- **vite.config.ts**: Renderer Vite config