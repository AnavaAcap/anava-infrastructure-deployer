# Camera Management System Documentation

## Overview (v0.9.145+)

The Anava Vision Installer now features a comprehensive global camera management system that tracks all cameras across the application, providing persistent state management and flexible navigation.

## Architecture

### Global State Management

The camera management system uses React Context API to maintain a centralized state for all cameras:

```typescript
// Core components
CameraContext.tsx         // Global state provider
CameraManagementPage.tsx  // Dashboard view
CameraSetupWizard.tsx     // Modal configuration dialog
CameraSetupPage.tsx       // Main setup interface with stepper
```

### Data Structure

Each camera in the system is tracked with comprehensive status information:

```typescript
interface ManagedCamera {
  // Identification
  id: string;              // Unique identifier (e.g., "192.168.1.100_AXIS-P3245")
  name: string;            // User-friendly display name
  ip: string;              // Camera IP address
  model?: string;          // Camera model (e.g., "AXIS P3245-LVE")
  
  // Configuration Status
  status: {
    credentials: {
      completed: boolean;
      username?: string;
      password?: string;
    },
    discovery: {
      completed: boolean;
      ip?: string;
      model?: string;
      firmwareVersion?: string;
      accessible?: boolean;
    },
    deployment: {
      completed: boolean;
      hasACAP?: boolean;        // ACAP installed
      isLicensed?: boolean;     // License activated
      acapVersion?: string;     // Version of installed ACAP
      deployedFile?: string;    // Filename of deployed ACAP
      licenseKey?: string;
    },
    speaker: {
      completed: boolean;
      configured?: boolean;
      ip?: string;
      username?: string;
      password?: string;
    },
    verification: {
      completed: boolean;
      sceneAnalysis?: {
        description: string;
        imageBase64: string;
        audioBase64?: string;
      };
    }
  },
  
  // Metadata
  lastUpdated: Date;
  projectId?: string;      // Associated GCP project
  customerId?: string;
  anavaKey?: string;
}
```

## Features

### 1. Camera Management Dashboard

The dashboard provides an at-a-glance view of all configured cameras:

- **Visual Progress Indicators**: Progress bar showing configuration completion percentage
- **Status Chips**: 
  - ✅ Fully Configured (100% complete)
  - ⚠️ Partially Configured (60-99% complete)
  - ⚙️ Setup Required (<60% complete)
- **Feature Icons**:
  - 🔒 Licensed
  - ☁️ ACAP Installed
  - 🔊 Speaker Configured
- **Quick Actions**: Edit configuration, remove camera

### 2. Non-Linear Navigation

The setup stepper now supports flexible navigation:

- **Click Any Step**: Jump directly to any step by clicking on it
- **Smart Prerequisites**: 
  - New cameras require sequential completion
  - Existing cameras can jump to any step
- **Visual Indicators**: Completed steps show checkmarks
- **Skip Options**: Optional steps can be skipped

### 3. Previously Configured Cameras

Step 0 now shows all previously configured cameras:

- **Quick Selection**: Click on any camera to load its configuration
- **Smart Navigation**: Automatically jumps to the most relevant step
- **State Restoration**: All settings are restored (credentials, speaker config, etc.)
- **Visual Status**: Shows IP, model, and configuration status

### 4. Intelligent Step Management

The system automatically determines step completion and navigation:

```javascript
// Example: When selecting a previously configured camera
if (camera.hasACAP) {
  // Camera already has ACAP, allow skipping deployment
  showSkipButton = true;
  allowSpeakerConfig = true;
}

if (camera.hasSpeaker) {
  // Speaker already configured, restore settings
  speakerConfig = camera.speaker;
}

// Navigate to most logical step
if (!camera.hasACAP) {
  navigateTo('deployment');
} else if (!camera.hasSpeaker) {
  navigateTo('speaker_config');
} else {
  navigateTo('complete');
}
```

## User Workflows

### Adding a New Camera

1. Click "Add New Camera" from dashboard or Step 0
2. Enter camera credentials
3. Find camera via network scan or manual IP
4. Deploy ACAP and apply license
5. (Optional) Configure speaker
6. Complete setup

### Editing Existing Camera

1. Click on camera card in dashboard OR
2. Select camera from list in Step 0
3. System loads all saved configuration
4. Click directly on the step you want to modify
5. Make changes and save

### Common Scenarios

#### Just Update Speaker Configuration
1. Select camera from Step 0
2. Click directly on "Configure Audio Speaker" step
3. Update speaker settings
4. Configuration automatically pushed to camera

#### Re-deploy ACAP
1. Select camera from Step 0
2. Click on "Deploy Anava" step
3. Click "Re-deploy ACAP" button
4. System automatically selects correct ACAP file based on firmware

#### Check Camera Status
1. View dashboard for all cameras
2. See progress bars and status indicators
3. Click on camera for detailed view

## Persistence

All camera configurations are automatically saved to local storage:

- **Auto-save**: Changes are saved immediately
- **Cross-session**: Data persists across app restarts
- **Storage Location**: Uses Electron's config storage
- **Key**: `managedCameras` in app configuration

## Technical Implementation

### Context Provider

```jsx
// App.tsx
import { CameraProvider } from './contexts/CameraContext';

function App() {
  return (
    <CameraProvider>
      <ThemeProvider theme={theme}>
        {/* App content */}
      </ThemeProvider>
    </CameraProvider>
  );
}
```

### Using Camera Context

```jsx
import { useCameraContext } from '../contexts/CameraContext';

function MyComponent() {
  const { 
    cameras,           // All managed cameras
    selectedCamera,    // Currently selected camera
    addCamera,         // Add new camera
    updateCamera,      // Update existing camera
    updateCameraStep,  // Update specific step status
    selectCamera,      // Select a camera for editing
    removeCamera       // Remove a camera
  } = useCameraContext();
  
  // Use the context functions...
}
```

## Best Practices

1. **Always Update State**: When modifying camera configuration, always update the global state
2. **Check Prerequisites**: Verify step dependencies before allowing navigation
3. **Provide Feedback**: Show clear status indicators and progress
4. **Handle Errors Gracefully**: Don't lose user progress on errors
5. **Save Frequently**: Auto-save configuration changes

## Troubleshooting

### Camera Not Appearing in List
- Check if camera was properly saved after initial setup
- Verify `managedCameras` in app config storage
- Ensure camera has unique ID

### Can't Navigate to Step
- Check if prerequisites are met
- Verify camera is selected
- Ensure previous steps are marked complete

### Configuration Not Persisting
- Check console for save errors
- Verify storage permissions
- Check available disk space

## Future Enhancements

- Bulk operations on multiple cameras
- Camera grouping and tagging
- Configuration templates
- Import/export camera configurations
- Camera health monitoring dashboard