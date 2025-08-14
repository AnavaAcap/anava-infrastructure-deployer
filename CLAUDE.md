# CLAUDE.md - Anava Installer

## Repository Information
- **GitHub**: https://github.com/AnavaAcap/anava-infrastructure-deployer
- **Organization**: AnavaAcap
- **Product Name**: Anava Installer
- **Public Releases**: https://github.com/AnavaAcap/acap-releases/releases/tag/v3.8.1
- **Current Version**: v0.9.206 (2025-08-14)
- **Electron**: v37.2.6 (latest)
- **Node.js**: v20.x
- **Build System**: Vite v7.x

## Latest Features (v0.9.206) - VISION ARCHITECT ENTERPRISE INTELLIGENCE ✅

### ✅ Advanced Vision Architect System - ENHANCED
- **Anti-Hallucination Protocol**: Decomposes complex requests into specialized skills
- **Ecosystem Design**: Creates 3-6 skills minimum, 2-4 profiles for complete coverage
- **Continuous Monitoring**: Full support with interval and duration guidance
- **Domain Examples**: Retail, Manufacturing, Healthcare, Security, Transportation
- **Question Intelligence**: 5-8 hierarchical questions per skill for deep analysis
- **Model Defaults**: Uses gemini-2.5-flash-lite, empty preFilterModel
- **Files**: `visionArchitect.ts`, `visionArchitectDeployer.ts`

### ✅ Sidebar Navigation Access - NEW
- **Feature**: Vision Architect accessible from sidebar as "Configure Vision AI (NEW!)"
- **Location**: Below divider, above Test AI Detection
- **Manual Entry**: Support for direct IP/username/password input
- **Files**: `VisionArchitectPage.tsx`, `NavigationSidebar.tsx`, `App.tsx`

### ✅ Scene Image Integration - NEW
- **Feature**: Automatically captures scene image before Vision Architect generation
- **Implementation**: Calls getSceneDescription if no image available
- **UI**: Shows capture progress and image status indicator
- **Files**: `VisionArchitectDialog.tsx`, `visionArchitect.ts`

### ✅ Proper ACAP Format Support - FIXED
- **Questions Format**: Correct schema with id, name, text, type, enabled, stateful
- **Object Detection**: Simple string array format
- **Response Criteria**: Detailed conditional instructions
- **Talkdown**: Strategic voice interaction when it adds value
- **Files**: `visionArchitect.ts` system prompt

## Previous Features (v0.9.205) - API KEY MANAGEMENT & MODEL SELECTION ✅

### ✅ Dynamic Model Selection - NEW
- **Feature**: Dropdown to select which Gemini model to use
- **Implementation**: Models fetched dynamically from Google API
- **Default**: gemini-2.0-flash-lite (best for free tier)
- **Files**: `VisionArchitectDialog.tsx`, `visionArchitect.ts`

### ✅ API Key Validation & Management - NEW  
- **Feature**: Validate and manage Gemini API keys with visual feedback
- **Implementation**: Test key by calling models list API
- **UI**: Show/hide toggle, status indicators, error messages
- **Files**: `WelcomePage.tsx`, `visionArchitectIPC.ts`

## Previous Features (v0.9.188) - PRODUCTION VERIFIED ✅

### ✅ CRITICAL FIX: Missing Activator Files in Production - FIXED & VERIFIED
- **Problem**: License activation failing at 60% for all users except developer
- **Root Cause**: `src/main/activator/` files not copied to `dist/` during build
- **Solution**: Added `scripts/copy-activator.js` to build process
- **Verification**: Windows installation confirmed working perfectly (2025-01-15)
- **Impact**: All users can now complete deployment successfully

### ✅ Enhanced Error Display - NEW
- **Feature**: Full raw error responses shown for debugging
- **Implementation**: Errors displayed with JSON data, status codes, stack traces
- **Format**: Monospace/preformatted text for better readability

### ✅ Personalized AI Greetings - NEW
- **Feature**: AI greets users by name during validation tests
- **Implementation**: 
  - Stores user's displayName from Google login in localStorage
  - Passes custom prompts through: frontend → IPC → backend → camera API
  - Fallback to generic greeting if no name available
- **Prompt Format**: "You are Anava... greet [Name] by name..."
- **Files**: `LoginPage.tsx`, `DetectionTestModal.tsx`, `cameraConfigurationService.ts`

### ✅ Pre-fetched Scene Data Reuse - FIXED
- **Problem**: First AI test wasn't using already-fetched data
- **Solution**: Store cameraId and timestamp with pre-fetched data
- **Files**: `CameraSetupPage.tsx` line 868-874, `DetectionTestModal.tsx` line 67-80

### ✅ Speaker Config Loading State - NEW
- **Feature**: Loading overlay during 10-second speaker configuration
- **Implementation**: Full-screen overlay with progress indicator
- **Files**: `CameraSetupPage.tsx` lines 1475-1502, state at line 153

## Critical Production Fixes

### ✅ White Screen Issue - FIXED
- **Problem**: React app not mounting in production builds
- **Solution**: Custom Vite plugin to move script tag to body
- **File**: `vite.config.ts` - Added `moveScriptToBody()` plugin
- **Key**: Script must load AFTER `<div id="root">` exists

### ✅ License Activation - FIXED  
- **Problem**: Hardcoded MAC address (B8A44F45D624) for all cameras
- **Solution**: Pass actual camera.mac from discovery through entire chain
- **Files**: `ACAPDeploymentPage.tsx` line 369, `CameraSetupPage.tsx` line 337
- **Critical**: MAC flows: scanner → formattedCameras → selectedCamera → license activation

### ✅ Security Vulnerabilities - FIXED
- **Problem**: node-ssdp had vulnerable dependencies
- **Solution**: Removed node-ssdp completely, using only Bonjour/mDNS
- **Result**: 0 npm audit vulnerabilities

### ✅ Camera Detection - CRITICAL
- **Key**: Newer Axis devices require POST with propertyList array in params
- **File**: `fastNetworkScanner.ts` - Proper POST format and audio endpoint checking

### ✅ License Activation Without Puppeteer - FIXED (v0.9.184)
- **Problem**: Puppeteer was breaking in production builds, needed alternative for license activation
- **Solution**: Use Electron's BrowserWindow to load Axis SDK and get signed license XML
- **Files Changed**:
  - `src/main/services/camera/cameraConfigurationService.ts` - Uses BrowserWindow instead of puppeteer
  - `src/main/activator/activator.html` - Loads Axis SDK and handles license registration
  - `src/main/activator/preload.js` - Secure IPC bridge between main and activator
  - `src/main/activator/axis-sdk.js` - Local copy of Axis SDK (avoids CDN loading issues)
- **Key Points**:
  - BrowserWindow runs completely hidden (show: false) - no user-visible windows
  - SDK loads asynchronously, needs 2-8 second wait time
  - Gets properly signed XML from Axis servers with embedded Bearer token
  - Works on ANY Mac/Windows machine without external dependencies
- **Critical**: The Axis SDK has authentication built-in, must use their SDK to get signed XML

### ✅ License Activation Retry Logic - ADDED (v0.9.185)
- **Problem**: ACAP may restart after deployment causing 503/connection errors during license activation
- **Solution**: Added retry logic with 10-second delays between attempts
- **Files**: `ACAPDeploymentPage.tsx` - Both automatic and manual retry functions

- **Key Features**:
  - Up to 3 retry attempts for license activation
  - 10-second delay between retries when camera is restarting
  - Handles ECONNREFUSED, ETIMEDOUT, and 503 errors gracefully
  - User-friendly messages during retry process


## Build Commands

### Development
```bash
npm run dev                    # Run dev server
npm run build                  # Build for production
npm run lint                   # Lint code (use --no-verify to skip)
npm run test:regression        # Run regression tests (18/18 passing)
npm run test:security          # Run security tests (18/20 passing)
npm run test:integration       # Run integration tests (19/19 passing)
```

### Production Builds
```bash
# macOS Universal (Intel + Apple Silicon)
APPLE_ID="ryan@anava.ai" \
APPLE_ID_PASSWORD="gbdi-fnth-pxfx-aofv" \
APPLE_APP_SPECIFIC_PASSWORD="gbdi-fnth-pxfx-aofv" \
APPLE_TEAM_ID="3JVZNWGRYT" \
CSC_NAME="Ryan Wager (3JVZNWGRYT)" \
npm run dist:mac

# Windows
npm run dist:win
```

## Testing Production Build
```bash
npx electron dist/main/index.js
```
DevTools will NOT auto-open in production builds (disabled for release)

## Production Logs Location
**CRITICAL FOR DEBUGGING**: Production logs are now written to TWO locations:
1. **DEBUG LOGS (ACCESSIBLE)**: `~/anava-debug-logs/anava-vision-{timestamp}.log`
2. **Standard Location**: 
   - **macOS**: `/Users/{username}/Library/Logs/anava-installer/anava-vision-{timestamp}.log`
   - **Windows**: `%USERPROFILE%\AppData\Roaming\anava-installer\logs\anava-vision-{timestamp}.log`

To find and read the most recent log:
```bash
# READ DEBUG LOGS FROM HOME DIRECTORY
ls -lt ~/anava-debug-logs/*.log | head -1
tail -1000 ~/anava-debug-logs/anava-vision-*.log | grep -A5 -B5 "ERROR\|Failed\|deploy"

# Get most recent log file
LATEST_LOG=$(ls -t ~/anava-debug-logs/*.log 2>/dev/null | head -1)
tail -f "$LATEST_LOG"  # Follow log in real-time
```

## Critical Technical Knowledge

### Cloud Functions v2
- Builds run as COMPUTE service account: `{projectNumber}-compute@developer.gserviceaccount.com`
- Needs: `roles/artifactregistry.admin`, `roles/storage.objectViewer`
- Must have admin access to `gcf-artifacts` repository

### IAM Eventual Consistency
- Service accounts need 2-20 seconds to propagate
- Always use retry logic with exponential backoff
- Add 10-15s delay after creating service accounts

### Camera Configuration
```json
{
  "firebase": { /* auth config */ },
  "gemini": {
    "vertexApiGatewayUrl": "...",
    "vertexApiGatewayKey": "...",
    "vertexGcpProjectId": "...",
    "vertexGcpRegion": "us-central1",
    "vertexGcsBucketName": "..."
  },
  "anavaKey": "LICENSE_KEY",
  "customerId": "CUSTOMER_ID"
}
```

### VAPIX Endpoints
- Config: `POST http://{ip}/local/BatonAnalytic/baton_analytic.cgi?command=setInstallerConfig`
- License: `POST http://{ip}/local/{appName}/license.cgi`
- AOA Control: `POST http://{ip}/local/objectanalytics/control.cgi`
- Scene: `POST http://{ip}/local/BatonAnalytic/baton_analytic.cgi?command=getSceneDescription`
- AOA Trigger: `POST http://{ip}/local/BatonAnalytic/baton_analytic.cgi?command=generateFromDescription`
- Always use digest authentication

### Vision Architect System Architecture
**Revolutionary AI-driven camera analytics configuration system**

**Core Principles**:
1. **Anti-Hallucination**: Break complex requests into specialized skills (not monolithic)
2. **Complete Ecosystems**: Generate multiple complementary skills and profiles
3. **Continuous Monitoring**: Support for ongoing analysis with intervals and durations
4. **Hierarchical Intelligence**: Objects → Questions → Insights → Actions

**Skill Design**:
- Each skill focuses on ONE specific aspect
- 5-8 questions building hierarchical intelligence
- Detailed responseCriteria with conditions and actions
- Strategic talkdownActivated for voice interaction

**Profile Strategy**:
- Different profiles for times of day (BusinessHours, AfterHours)
- Sensitivity levels (High_Security, Standard, Minimal)
- activeMonitoring for continuous analysis (loitering, queues, safety)
- Proper trigger configuration with AOA scenarios

**Domain Coverage**:
- Security & Loss Prevention
- Retail Analytics & Customer Insights
- Manufacturing Safety & Efficiency
- Healthcare Patient Monitoring
- Transportation & Logistics

### AOA Natural Language Processing (NEW)
**Converts plain English descriptions to AOA scenarios automatically**

- **Usage**: User types "Someone loitering near the ATM" → Creates AOA motion scenario with timeInArea filter
- **AI Integration**: Uses Gemini to understand intent and map to AOA capabilities
- **ACAP Integration**: After creating AOA scenario, sends trigger name and description to ACAP
- **Endpoint**: `generateFromDescription` with `{ trigger: "scenario_name", description: "original_text" }`

**Examples**:
- "People running" → Motion detection with shortLivedLimit (1-2s)
- "Cars parking" → Vehicle detection with timeInArea (10-30s)
- "Crowd forming" → Occupancy scenario with threshold

**Test Script**: `node test-aoa-nl-acap.js`

### ✅ Axis Object Analytics (AOA) Integration - NEW (2025-01-16)
**Feature**: Programmatic control of AOA scenarios via VAPIX APIs
- **Location**: `src/main/services/aoa/`
- **Files**: 
  - `aoaService.ts` - Core VAPIX implementation
  - `aoaIntegration.ts` - High-level integration for installer
  - `AOA_API_DOCUMENTATION.md` - Complete API documentation

**CRITICAL: Time in Area Configuration**
The "Time in Area" toggle in AOA UI requires BOTH:
1. Filter in scenario (`type: 'timeShort'` with milliseconds)
2. Condition in trigger (`type: 'individualTimeInArea'` with seconds)

```typescript
// Example: Create human detection with 3-second Time in Area
import { AOAService } from './services/aoa/aoaService';

const aoa = new AOAService(cameraIp, username, password);
await aoa.createHumanDetectionScenario('Entrance', 3);  // 3 seconds

// Advanced configuration with all options
await aoa.createAdvancedScenario({
  name: 'Parking',
  type: 'motion',
  area: [[-0.9, -0.9], [-0.9, 0.9], [0.9, 0.9], [0.9, -0.9]],
  objectTypes: {
    humans: true,
    vehicles: true,
    vehicleSubTypes: ['car', 'truck']
  },
  filters: {
    timeInArea: 5,  // seconds
    minimumSize: { width: 10, height: 10 }  // percentage
  }
});
```

**Supported Features**:
- Motion detection with area triggers
- Human and vehicle detection (with subtypes)
- Time in Area (loitering detection)
- Object size filtering
- Crossline counting
- Virtual fence detection
- Occupancy monitoring

**Integration during deployment**:
```typescript
// In deployment flow
await AOAIntegration.configureAOA(camera, {
  enableAOA: true,
  scenarios: [{
    name: 'Main Entrance',
    type: 'motion',
    humanDetection: true,
    timeInArea: 3
  }]
});
```

## Release Process

1. **Update version**: `npm version patch`
2. **Commit**: `git commit -m "chore: bump version" --no-verify`
3. **Tag**: `git tag v0.9.XXX`
4. **Push**: `git push origin main --tags`
5. **Build**: Run production build commands above
6. **Upload**: Add to https://github.com/AnavaAcap/acap-releases/releases/tag/v3.8.1

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| White screen in production | Script must load AFTER `<div id="root">` - check vite.config.ts |
| License activation fails | Check MAC flows: scanner → formattedCameras → selectedCamera → activation |
| Camera not detected | POST with propertyList required for newer devices |
| Custom prompt not working | Check localStorage has userDisplayName, verify customPrompt passed through IPC |
| Pre-fetched data not used | Ensure cameraId and timestamp stored with data |

## Troubleshooting Camera Detection

### Quick Checks
1. **Device not found**: Verify POST request includes propertyList parameter
2. **MAC missing**: Extract from SerialNumber field, not MAC field  
3. **Speaker in list**: Filter by `deviceType !== 'speaker'`
4. **Auth failures**: Show warning icon, not green checkmark

### Debug Commands
```bash
# Test device detection
curl -k -X POST https://192.168.50.156/axis-cgi/basicdeviceinfo.cgi \
  -H "Content-Type: application/json" \
  -d '{"apiVersion":"1.0","method":"getProperties","params":{"propertyList":["SerialNumber","ProdType"]}}'

# Check if speaker (should return 401)
curl -k https://192.168.50.121/axis-cgi/audio/transmit.cgi
```

See `CAMERA_DETECTION_TROUBLESHOOTING.md` for detailed debugging guide.

## Key Files

- `vite.config.ts` - Build configuration with script placement fix
- `src/renderer/pages/CameraSetupPage.tsx` - Camera setup, speaker config, pre-fetch logic
- `src/renderer/components/DetectionTestModal.tsx` - AI test with personalized prompts
- `src/main/services/camera/cameraConfigurationService.ts` - getSceneDescription with customPrompt
- `src/main/services/camera/fastNetworkScanner.ts` - Device detection (POST with propertyList)
- `src/main/services/deploymentEngine.ts` - GCP deployment logic
- `src/main/services/aoa/aoaService.ts` - AOA VAPIX implementation with Time in Area support
- `src/main/services/aoa/aoaIntegration.ts` - AOA deployment integration  
- `src/main/services/aoa/aoaNLProcessor.ts` - Natural language to AOA scenario converter with ACAP integration
- `src/renderer/components/AOANaturalLanguageConfig.tsx` - UI for NL-based AOA configuration

## Test Commands
```bash
npm test                       # Run all tests
npm run test:regression        # Regression tests (18/18 passing)
npm run test:integration       # Integration tests (19/19 passing)
```

## Critical DO NOTs
- Use hardcoded MAC addresses for license activation
- Put script tags in HTML head for Electron (breaks production)
- Use GET for newer Axis devices (they require POST with propertyList)
- Ship without testing the production build locally first