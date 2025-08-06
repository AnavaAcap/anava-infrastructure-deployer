# CLAUDE.md - Anava Infrastructure Deployer

## Development Guidelines
- Always iterate the version tag when ready for testing
- Test changes manually before claiming they work
- Check actual Cloud Build logs with gcloud for deployment issues
- Create manual test configs first to verify API Gateway fixes

## Critical Knowledge

### Cloud Functions v2 Deployment
**Root Cause**: Cloud Functions v2 builds run as COMPUTE service account (`{projectNumber}-compute@developer.gserviceaccount.com`), NOT Cloud Build SA.

**Required Permissions**:
1. **Compute Service Account**:
   - `roles/storage.objectViewer`
   - `roles/artifactregistry.admin`
   - `roles/logging.logWriter`

2. **Cloud Build Service Account**:
   - `roles/cloudfunctions.developer`
   - `roles/storage.objectAdmin`
   - `roles/cloudbuild.builds.editor`
   - `roles/artifactregistry.admin`
   - Permission to act as function service accounts

3. **gcf-artifacts Repository**:
   - Both compute SA and Cloud Build SA need admin access
   - Located at `{region}-docker.pkg.dev/{projectId}/gcf-artifacts`

### Cloud Functions Source Upload
- Upload format: `gs://gcf-v2-sources-{projectNumber}-{region}/{functionName}-{timestamp}.zip`
- ZIP must contain `main.py` at root
- Pass only filename to API in `buildConfig.source.storageSource.object`

### Google Cloud IAM Eventual Consistency
**#1 cause of flaky deployments** - Service accounts need 2-20 seconds to replicate globally.

**Solution**:
- Verify service account exists with polling (up to 20s)
- Retry IAM role assignments with exponential backoff
- Add 10s global propagation delay after creating all service accounts

### API Gateway Authentication Fix
**Problem**: 401 errors when API Gateway calls Cloud Functions
**Solution**: Use global regex replacement for OpenAPI spec placeholders: `.replace(/\${DEVICE_AUTH_URL}/g, deviceAuthUrl)`

### Firebase Automation (v0.9.26+)
- Terraform's `google_identity_platform_config` resource initializes Firebase Auth programmatically
- Firebase Storage is NOT used - cameras use direct GCS with Workload Identity
- Email/password authentication is fully automated
- Google Sign-In requires manual OAuth setup in Firebase Console

### Camera Configuration
**VAPIX Endpoint**: `POST http://{camera-ip}/local/BatonAnalytic/baton_analytic.cgi?command=setInstallerConfig`

**Required Fields**:
```json
{
  "firebase": {
    "apiKey": "...",
    "authDomain": "...",
    "projectId": "...",
    "storageBucket": "...",
    "messagingSenderId": "...",
    "appId": "...",
    "databaseId": "(default)"
  },
  "gemini": {
    "apiKey": "", // AI Studio mode
    "vertexApiGatewayUrl": "...", // Vertex AI mode
    "vertexApiGatewayKey": "...",
    "vertexGcpProjectId": "...",
    "vertexGcpRegion": "us-central1",
    "vertexGcsBucketName": "..."
  },
  "anavaKey": "...",
  "customerId": "..."
}
```

## Legacy Notes (v0.9.63)

### ✅ Code Signing & Distribution Fixed (Aug 1, 2025)
- Fixed "damaged and can't be opened" error on macOS
- Proper Developer ID certificate integration in GitHub Actions
- Windows builds now correctly include rollup modules
- All builds are properly signed and notarized

### Build Outputs
- **macOS Intel**: `Anava.Vision-{version}.dmg`
- **macOS Apple Silicon**: `Anava.Vision-{version}-arm64.dmg`
- **Windows**: `Anava.Vision.Setup.{version}.exe` (supports x64 & ia32)
- Files distributed in native formats (no additional compression needed)

### GitHub Actions Secrets Required
- `CSC_LINK`: Base64 encoded .p12 certificate file
- `CSC_KEY_PASSWORD`: Password for the .p12 file
- `APPLE_ID`: Apple Developer account email
- `APPLE_ID_PASSWORD`: App-specific password
- `APPLE_TEAM_ID`: Your Apple Developer Team ID (e.g., "3JVZNWGRYT")

## License Activation Solution (v0.9.105+)

### Automatic License Activation
**Breakthrough**: Axis provides a public JavaScript SDK that converts license keys to signed XML format!

**Implementation**:
- Uses Puppeteer to load `https://www.axis.com/app/acap/sdk.js`
- Calls `ACAP.registerLicenseKey()` with applicationId, deviceId, and licenseCode
- Returns properly signed XML with cryptographic signature
- No authentication or API keys required

**Key Code** (`cameraConfigurationService.ts`):
```typescript
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
// Load Axis SDK and call registerLicenseKey
const result = await page.evaluate(() => 
  window.ACAP.registerLicenseKey({ applicationId, deviceId, licenseCode })
);
```

**Error Handling**:
- Retry logic for "ThreadPool" errors (app still starting)
- 3-second initial delay after ACAP deployment
- Comprehensive logging throughout the process

## Current State (v0.9.105)

### Camera Setup Architecture

#### Manual IP Connection Flow (`/src/renderer/pages/CameraSetupPage.tsx`)
1. User enters IP and credentials → `handleManualConnect()` (line 110)
2. Calls IPC `quickScanCamera` → returns camera array with auth status
3. **Key Logic**: Check `discoveredCamera.status === 'accessible' || discoveredCamera.authenticated === true`
4. **Common Issues**: 
   - Auth succeeds but UI doesn't update (check console logs)
   - Camera object missing `accessible` property
   - Error messages not visible in current step

#### Camera Discovery Service (`/src/main/services/camera/optimizedCameraDiscoveryService.ts`)
- `quickScanSpecificCamera()` (line 434): Returns camera array with error details
- `checkAxisCameraWithError()` (line 499): Returns `{camera, error}` for better debugging
- `digestAuthWithError()` (line 565): Returns auth errors with specific messages
- **Auth Flow**: 401 challenge → Digest auth → 200 success (normal pattern)

#### License Key Handling
1. **Trial License**: Auto-generates email, uses Firebase function
2. **Manual License**: Direct entry, stored via `setManualLicenseKey()`
3. **UI Flow**: No license → Prompt appears → User selects mode → Key applied

### Known UI/UX Issues (v0.9.83)
- ❌ Manual connection success not clearly shown in UI
- ❌ Error alerts may appear outside visible step area
- ❌ "Connecting..." state doesn't always clear on error
- ❌ Need better logging for IPC responses

### Recent Changes
#### v0.9.105
- **Automatic license activation**: Using Axis public SDK to convert keys to XML
- **Fixed stream abort errors**: Replaced failing digest auth library
- **Added retry logic**: Handles ThreadPool errors when app is starting
- **Comprehensive logging**: Every step of license activation is logged

#### v0.9.83
- **Removed hardcoded credentials**: No more fallback `root:pass` 
- **Added manual license key entry**: Users can enter existing licenses
- **Improved error handling**: Auth errors now return specific messages
- **Fixed Stack import**: Added missing MUI import in SpeakerConfigPage

### What's Automated
- GCP project setup and API enablement
- Service account creation with proper IAM roles
- Cloud Storage bucket creation (direct GCS, not Firebase Storage)
- Firebase Auth initialization (email/password)
- Firestore database, security rules, and indexes
- Cloud Functions deployment (Vertex AI mode)
- API Gateway configuration (Vertex AI mode)
- Workload Identity Federation setup
- Camera discovery and configuration
- ACAP deployment to cameras
- **License activation** (v0.9.105+) - Fully automatic using Axis SDK

### What's Manual
- Google Sign-In OAuth client configuration (optional)
- Domain verification for custom domains

### Key Features
- **Two AI Modes**: Vertex AI (full infrastructure) or AI Studio (simplified)
- **Non-linear Navigation**: Jump between sections via sidebar
- **Camera Discovery**: Network scanning with VAPIX authentication
- **Configuration Caching**: Auto-saves deployments by user email
- **Windows/Mac Support**: Cross-platform builds with GitHub Actions

### Building & Releasing

#### Automated CI/CD
```bash
# 1. Update version in package.json
npm version patch

# 2. Commit and push changes
git add package.json package-lock.json
git commit -m "chore: bump version to X.X.X"
git push origin master

# 3. Create and push tag (triggers builds)
git tag v0.9.XX
git push origin v0.9.XX

# Builds automatically create signed installers:
# - macOS: .dmg files (Intel & Apple Silicon)
# - Windows: .exe installer (x64 & ia32)
```

#### Local Testing (macOS only)
```bash
# Run validation before building
./scripts/pre-build-check.sh

# Build locally (requires env vars)
APPLE_ID="email" APPLE_ID_PASSWORD="pass" APPLE_TEAM_ID="team" npm run dist:mac
```

### Common Pitfalls
1. Don't assume Cloud Build SA runs function builds - it's compute SA
2. Don't upload source to bucket subfolders - use root with timestamps
3. Don't forget service account propagation delays
4. Don't deploy rules before databases/buckets exist
5. Don't try to create `.appspot.com` buckets without domain verification
6. Don't set `identity: null` in package.json - it disables code signing
7. Don't forget to export Developer ID certificate as .p12 for CI/CD
8. Don't compress .dmg or .exe files - they're already optimized
9. Don't try to upload plain license keys - they must be converted to signed XML format
10. Don't skip the retry logic for ThreadPool errors - apps need time to start

### Testing Commands
```bash
# Check build service account
gcloud builds describe BUILD_ID --region=REGION --format=json | jq '.serviceAccount'

# Check Artifact Registry permissions
gcloud artifacts repositories get-iam-policy gcf-artifacts --location=REGION

# Test auth flow
curl -X POST "https://YOUR-GATEWAY-URL/device-auth/initiate" \
  -H "x-api-key: YOUR-API-KEY" \
  -H "Content-Type: application/json" \
  -d '{"device_id": "test-device"}' -v
```

## Debugging Camera Connection Issues

### Check Console for IPC Results
```javascript
// In CameraSetupPage handleManualConnect(), after quickScanCamera:
console.log('Quick scan result:', {
  result,
  hasResult: !!result,
  length: result?.length,
  firstItem: result?.[0],
  accessible: result?.[0]?.accessible,
  authenticated: result?.[0]?.authenticated,
  status: result?.[0]?.status,
  error: result?.[0]?.error
});
```

### Test Camera Auth Manually
```bash
# Test digest auth with curl
curl -v --digest -u anava:baton \
  "http://192.168.50.156/axis-cgi/param.cgi?action=list&group=Brand"
```

### Common Authentication Patterns
- **Success**: 401 → Auth challenge → 200 with data
- **Wrong credentials**: 401 → Auth challenge → 401 again
- **Network issue**: Connection timeout or refused

### Key Files for Debugging
- **UI Logic**: `/src/renderer/pages/CameraSetupPage.tsx:110-210`
- **IPC Handlers**: `/src/main/services/camera/optimizedCameraDiscoveryService.ts:110-115`
- **Auth Logic**: `/src/main/services/camera/optimizedCameraDiscoveryService.ts:565-625`