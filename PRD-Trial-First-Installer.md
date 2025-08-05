# Product Requirements Document (PRD)
# Anava Infrastructure Deployer - Trial-First Installer Redesign

## Executive Summary
Transform the existing Anava Infrastructure Deployer to prioritize a streamlined trial experience while maintaining all existing infrastructure deployment capabilities. This redesign focuses on getting users from download to functional camera in minutes, with automatic license management and integrated audio talkdown testing.

## Project Scope
**Modify the existing codebase** to implement new features while preserving all hard-won logic for GCP deployment, camera discovery, and ACAP management. No new repository or rewrite - this is an enhancement of the current system.

## Goals & Objectives
1. **Reduce time-to-value**: Users should see AI-powered camera analytics working within 10 minutes of download
2. **Automate licensing**: Remove manual license key distribution bottleneck
3. **Showcase capabilities**: Demonstrate audio talkdown and AI analysis immediately
4. **Preserve enterprise path**: Keep full GCP/Vertex AI deployment as "production" upgrade path
5. **Scale sales**: Enable mass deployment during webinars and marketing campaigns

## User Personas
1. **Trial User**: First-time user wanting to quickly test Anava capabilities
2. **Enterprise Evaluator**: IT professional evaluating for larger deployment
3. **Existing Customer**: Returning user expanding their deployment

## High-Level User Flow

### Phase 1: Initial Setup (5 minutes)
1. Launch installer → EULA acceptance
2. Google login → Automatic trial license assignment
3. Main navigation screen (reformed welcome page)

### Phase 2: Camera Deployment (5 minutes)
1. Camera Discovery/Manual Entry
2. ACAP deployment with progress tracking
3. Automatic license activation
4. Scene analysis with audio response

### Phase 3: Optional Enhancements
1. Speaker configuration for talkdown
2. Live detection testing
3. Advanced GCP infrastructure setup

## Detailed Feature Specifications

### 1. License Key Management System

#### Backend Architecture
```
Firestore Collections:
├── axis_keys/
│   └── {keyId}/
│       ├── key_string: "XXXX-XXXX-XXXX-XXXX"
│       ├── status: "available" | "assigned"
│       ├── created_at: timestamp
│       ├── assigned_to_email: string (when assigned)
│       ├── assigned_to_uid: string (when assigned)
│       └── assigned_at: timestamp (when assigned)
│
├── users/
│   └── {uid}/
│       ├── email: string
│       ├── assigned_axis_key: string
│       ├── key_assigned_at: timestamp
│       └── deployment_count: number
│
└── admin_config/
    └── license_stats/
        ├── total_keys: number
        ├── available_keys: number
        └── last_updated: timestamp
```

#### Cloud Function: `assignAxisKey`
- **Trigger**: onCall HTTPS function
- **Authentication**: Firebase Auth required
- **Logic**:
  1. Verify user authentication
  2. Check if user already has a key (return existing if found)
  3. Begin Firestore transaction:
     - Query for available key
     - Update key status to "assigned"
     - Update user document with key
  4. Return assigned key or error

#### Security Rules
```javascript
// Firestore rules
match /axis_keys/{keyId} {
  allow read, write: if false; // Backend only
}
match /users/{userId} {
  allow read: if request.auth.uid == userId;
  allow write: if false; // Backend only
}
```

### 2. UI/UX Modifications

#### Remove Components
- `MagicalWelcomePage.tsx`
- `MagicalDiscoveryPage.tsx`
- `MagicalAPIKeyPage.tsx`
- `MagicalNavigationStepper.tsx`

#### Modify NavigationSidebar
```typescript
// New navigation structure
const menuItems = [
  { id: 'welcome', label: 'Home', icon: <DashboardIcon /> },
  { id: 'camera-setup', label: 'Camera Setup', icon: <VideocamIcon />, badge: 'NEW' },
  { id: 'speaker-config', label: 'Speaker Config', icon: <SpeakerIcon /> },
  { id: 'detection-test', label: 'Test Detection', icon: <PlayCircleIcon /> },
  { type: 'divider' },
  { id: 'gcp-setup', label: 'GCP Infrastructure', icon: <CloudIcon />, tag: 'Advanced' },
  { id: 'acap-manager', label: 'ACAP Manager', icon: <DownloadIcon /> },
  { id: 'status', label: 'Status & Logs', icon: <SettingsIcon /> }
];
```

#### New Welcome Page Flow
- Show assigned license key prominently
- Quick action buttons: "Setup First Camera" and "Advanced Deployment"
- Progress indicator showing trial status

### 3. Camera Setup Page

#### Component: `CameraSetupPage.tsx`
```typescript
interface CameraSetupState {
  mode: 'manual' | 'scan';
  cameras: CameraInfo[];
  credentials: { username: string; password: string };
  selectedCamera: CameraInfo | null;
  deploymentStatus: 'idle' | 'deploying' | 'licensing' | 'analyzing' | 'complete' | 'error';
  sceneAnalysis: {
    description: string;
    imageBase64: string;
    audioMP3Base64: string;
  } | null;
}
```

#### Key Features:
1. **Credential Input First**: Username/password required before scanning
2. **Dual Mode**: Manual IP entry or network scan
3. **Smart Discovery**: Mark cameras as "accessible" or "found but locked"
4. **One-Click Deploy**: Single button to deploy, license, and analyze

### 4. ACAP Deployment Enhanced

#### Modification to `deployACAPQuickly` method:
1. Download latest ACAP from GitHub releases
2. Deploy to camera
3. **NEW**: Apply license key via VAPIX
4. **NEW**: Start application via VAPIX
5. **NEW**: Call getSceneDescription with audio

#### VAPIX Integration Commands:
```typescript
// Apply license
POST /axis-cgi/applications/control.cgi
action=license&package=BatonAnalytic&key={licenseKey}

// Start application
POST /axis-cgi/applications/control.cgi
action=start&package=BatonAnalytic

// Get scene with audio
POST /local/BatonAnalytic/baton_analytic.cgi?command=getSceneDescription
{
  "viewArea": 1,
  "GeminiApiKey": "...",
  "replyMP3": true,
  "customPrompt": "Describe any security concerns in this image"
}
```

### 5. Audio Player Component

#### Component: `AudioPlayer.tsx`
```typescript
interface AudioPlayerProps {
  audioBase64: string;
  onPlay?: () => void;
  onComplete?: () => void;
}

// Features:
// - Play/pause button
// - Progress bar
// - Volume control
// - Download option
```

### 6. Speaker Configuration Page

#### Component: `SpeakerConfigPage.tsx`
- Input fields: IP, Username, Password
- Test button: Play first clip from speaker library
- Save configuration per camera
- Optional step with clear skip option

#### Test Speaker Command:
```typescript
// VAPIX call to test speaker
POST /axis-cgi/audio/transmit.cgi
audiofile=clip1.wav
```

### 7. Detection Test Page

#### Component: `DetectionTestPage.tsx`
```typescript
interface DetectionTestState {
  countdown: number;
  isRunning: boolean;
  testResults: {
    triggered: boolean;
    talkdownPlayed: boolean;
    timestamp: string;
  } | null;
}
```

#### Test Sequence:
1. Show instruction: "Walk in front of camera and hold up 2 fingers"
2. 10-second countdown with visual timer
3. Trigger virtual input via VAPIX
4. Monitor for events
5. Show results with link to ACAP UI

#### VAPIX Virtual Trigger:
```typescript
// Enable virtual trigger
GET /axis-cgi/io/virtualinput.cgi?action=6%3A%2F

// Disable virtual trigger
GET /axis-cgi/io/virtualinput.cgi?action=6%3A%5C
```

### 8. EULA Integration

#### Component: `EULADialog.tsx`
- Modal dialog on first launch
- Scrollable text area with "PLACEHOLDER" content
- Checkbox: "I accept the terms"
- Store acceptance in localStorage
- Block access until accepted

### 9. Configuration Management

#### Enhanced State Management:
```typescript
interface DeploymentConfig {
  // Existing fields preserved
  projectId?: string;
  apiKey?: string;
  
  // New fields
  axisLicenseKey: string;
  cameras: {
    [cameraId: string]: {
      ip: string;
      username: string;
      model: string;
      acapVersion: string;
      speaker?: {
        ip: string;
        username: string;
      };
    };
  };
  lastDeployment: {
    cameraId: string;
    timestamp: string;
    success: boolean;
  };
}
```

### 10. Error Handling & Recovery

#### Error States:
1. **License Exhaustion**: "No trial licenses available. Contact sales@anava.com"
2. **Deployment Failure**: Show retry button with specific error
3. **Network Issues**: "Camera unreachable. Check network connection"
4. **Auth Failure**: "Invalid credentials for camera"

#### Retry Logic:
- Manual retry buttons at each step
- Clear error messages with actionable next steps
- Preserve progress (don't restart entire flow)

## Technical Implementation Details

### Modified Files Structure:
```
src/
├── main/
│   ├── services/
│   │   ├── licenseKeyService.ts (NEW)
│   │   ├── fastStartService.ts (MODIFY - remove magical logic)
│   │   └── cameraConfigurationService.ts (MODIFY - add speaker support)
│   └── index.ts (MODIFY - add license key IPC handlers)
│
├── renderer/
│   ├── pages/
│   │   ├── WelcomePage.tsx (MODIFY - show license key)
│   │   ├── CameraSetupPage.tsx (NEW)
│   │   ├── SpeakerConfigPage.tsx (NEW)
│   │   ├── DetectionTestPage.tsx (NEW)
│   │   └── [Remove magical pages]
│   │
│   ├── components/
│   │   ├── AudioPlayer.tsx (NEW)
│   │   ├── EULADialog.tsx (NEW)
│   │   └── NavigationSidebar.tsx (MODIFY)
│   │
│   └── App.tsx (MODIFY - update routing)
│
└── firebase/
    ├── functions/
    │   └── assignAxisKey.ts (NEW)
    └── firestore.rules (MODIFY)
```

### IPC Communication Updates:
```typescript
// New IPC channels
'license:get-assigned-key': () => Promise<{key: string, email: string}>
'license:check-availability': () => Promise<{available: number, total: number}>
'camera:test-speaker': (ip, user, pass) => Promise<boolean>
'camera:trigger-detection-test': (cameraIp) => Promise<TestResult>
```

### Data Migration:
- Preserve existing cached configurations
- Add new fields with defaults
- No breaking changes to existing flows

## Success Metrics
1. **Time to First Camera**: < 10 minutes from download
2. **Trial Conversion Rate**: Track trial-to-paid conversions
3. **Error Rate**: < 5% deployment failures
4. **User Engagement**: % completing detection test

## Future Enhancements (Out of Scope)
1. Stripe integration for purchasing additional licenses
2. Multi-camera bulk deployment
3. Cloud-based configuration backup
4. Mobile app for remote monitoring
5. Automated email campaigns for trial users

## Development Phases

### Phase 1: Core Trial Experience (Week 1-2)
- License key management system
- Simplified camera setup flow
- Basic audio playback

### Phase 2: Enhanced Features (Week 3)
- Speaker configuration
- Detection testing
- EULA integration

### Phase 3: Polish & Testing (Week 4)
- Error handling improvements
- UI/UX refinements
- Cross-platform testing

## Security Considerations
1. License keys only accessible via authenticated Cloud Functions
2. Camera credentials stored encrypted in memory only
3. Firebase App Check for API abuse prevention
4. Audit logging for all license assignments

## Rollout Strategy
1. Internal testing with 10 test licenses
2. Beta release to selected customers
3. Webinar demonstration
4. Public release with marketing campaign

## Implementation Notes

### Key Preservation Requirements
- ALL existing GCP deployment logic must remain functional
- Camera discovery algorithms stay unchanged
- ACAP deployment service modifications must be minimal
- Authentication flow remains Google OAuth based

### Critical Success Factors
1. Zero regression on existing features
2. Trial experience completes in under 10 minutes
3. Audio talkdown demonstrates value immediately
4. Clear upgrade path to enterprise deployment

This PRD preserves all existing functionality while adding the trial-first experience. The modular approach allows for incremental development without breaking existing features.