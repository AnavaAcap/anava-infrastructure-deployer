# CLAUDE.md - Anava Installer

## Repository Information
- **GitHub**: https://github.com/AnavaAcap/anava-infrastructure-deployer
- **Organization**: AnavaAcap
- **Product Name**: Anava Installer
- **Public Releases**: https://github.com/AnavaAcap/acap-releases/releases/tag/v3.8.1
- **Current Version**: v0.9.179 (2025-01-11)
- **Electron**: v37.2.6 (latest)
- **Node.js**: v20.x
- **Build System**: Vite v7.x

## Critical Fixes Applied (v0.9.179)

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

### ✅ AI Mode Deployment - FIXED
- **Problem**: AI Studio mode was skipping service account creation
- **Solution**: Removed conditional logic - all steps run regardless of AI mode
- **File**: `deploymentEngine.ts` - Removed `if (!isAiStudioMode)` checks

### ✅ Camera Detection - FIXED (2025-01-11)
- **Problem**: Scanner incorrectly identified devices (.121 as speaker, .156 not detected)
- **Solution**: Fixed POST request format with propertyList, added speaker detection
- **File**: `fastNetworkScanner.ts` - Proper POST format and audio endpoint checking
- **Key**: Newer devices require POST with propertyList array in params

### ✅ Camera Setup State Persistence - FIXED (2025-01-11)
- **Problem**: Camera setup state lost when AI Vision modal closed
- **Solution**: Added localStorage persistence for camera setup state
- **File**: `CameraSetupPage.tsx` - Save/restore state to/from localStorage
- **Key**: State persists across component unmounts, "Start Fresh Setup" button added

### ✅ Speaker Configuration Completion - FIXED (2025-01-11)
- **Problem**: Step 4 (speaker config) not marked as completed visually
- **Solution**: Added setCompleted call when speaker configuration finishes
- **File**: `CameraSetupPage.tsx` line 1705

### ✅ AI Vision Audio Playback - FIXED (2025-01-11)
- **Problem**: Pre-fetched AI Vision test audio not playing on first load
- **Solution**: Store audioBase64 and audioFormat fields in pre-fetched data
- **Files**: `CameraSetupPage.tsx` lines 771-773, `DetectionTestModal.tsx` lines 76-92
- **Key**: Support both legacy MP3 and new PCM audio formats

## Build Commands

### Development
```bash
npm run dev                    # Run dev server
npm run build                  # Build for production
npm run lint                   # Lint code (use --no-verify to skip)
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
- Always use digest authentication

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
| White screen in production | Check DevTools console, verify script in body |
| License activation fails | Check MAC address is passed through entire chain, not hardcoded |
| Camera not detected | Check POST request format, ensure propertyList in params |
| Speaker showing as camera | Verify audio endpoint detection logic |
| Wrong progress count | Remove denominator or calculate total IPs correctly |
| 403 errors from cameras | Token needs refresh, check permissions |
| npm audit vulnerabilities | Run `npm audit fix` or check specific packages |
| Build fails on Windows | Run as Administrator |
| Notarization fails | Check Apple credentials are current |

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

## Important Files

- `vite.config.ts` - Build configuration with script placement fix
- `src/main/index.ts` - Main process with DevTools auto-open
- `src/renderer/pages/camera/ACAPDeploymentPage.tsx` - License activation (line 369)
- `src/renderer/pages/CameraSetupPage.tsx` - Camera discovery UI (MAC pass at line 337)
- `src/main/services/camera/fastNetworkScanner.ts` - Device detection logic
- `src/main/services/deploymentEngine.ts` - GCP deployment logic
- `package.json` - Version and dependencies
- `src/__tests__/regression-tests.spec.ts` - Regression tests for camera detection

## DO NOT
- Use hardcoded MAC addresses for license activation
- Skip service account creation for any AI mode
- Add node-ssdp back (security vulnerability)
- Put script tags in HTML head for Electron
- Deploy without testing locally first
- Forget to update version before release
- Forget to pass MAC through entire chain (scanner → UI → license)
- Show speakers in "Found Cameras" list
- Use GET for newer Axis devices (they require POST)
- Forget to run `npm run build:renderer` after UI changes