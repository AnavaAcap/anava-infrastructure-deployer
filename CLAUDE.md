# CLAUDE.md - Anava Installer

## Repository Information
- **GitHub**: https://github.com/AnavaAcap/anava-infrastructure-deployer
- **Organization**: AnavaAcap
- **Product Name**: Anava Installer (formerly Anava Vision)
- **Public Releases**: Installers published to https://github.com/AnavaAcap/acap-releases

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
    "vertexApiGatewayUrl": "...", // Vertex AI endpoint
    "vertexApiGatewayKey": "...",
    "vertexGcpProjectId": "...",
    "vertexGcpRegion": "us-central1",
    "vertexGcsBucketName": "..."
  },
  "anavaKey": "...",
  "customerId": "..."
}
```

**Speaker Configuration** (v0.9.123+):
- Passed to `getSceneDescription` API when camera has speaker configured
- Fields: `speakerIp`, `speakerUser`, `speakerPass`

## Legacy Notes (v0.9.63)

### ✅ Code Signing & Distribution Fixed (Aug 1, 2025)
- Fixed "damaged and can't be opened" error on macOS
- Proper Developer ID certificate integration in GitHub Actions
- Windows builds now correctly include rollup modules
- All builds are properly signed and notarized

### Build Outputs (v0.9.169+)
- **macOS Intel**: `Anava.Installer-{version}.dmg`
- **macOS Apple Silicon**: `Anava.Installer-{version}-arm64.dmg`
- **Windows**: `Anava.Installer.Setup.{version}.exe` (supports x64 & ia32)
- Files distributed in native formats (no additional compression needed)
- Automatically published to AnavaAcap/acap-releases latest release

### GitHub Actions Secrets Required
- `CSC_LINK`: Base64 encoded .p12 certificate file
- `CSC_KEY_PASSWORD`: Password for the .p12 file
- `APPLE_ID`: Apple Developer account email (ryan@anava.ai)
- `APPLE_ID_PASSWORD`: App-specific password
- `APPLE_TEAM_ID`: Apple Developer Team ID (3JVZNWGRYT)
- `PUBLIC_REPO_TOKEN`: GitHub PAT for publishing to acap-releases repo

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

## Current State (v0.9.169+)

### Recent Updates
#### v0.9.169
- **Rebrand to Anava Installer**: Changed from "Anava Vision" to "Anava Installer"
- **Private Cloud Setup**: Renamed from "GCP Infrastructure" and repositioned in navigation
- **Organization Transfer**: Repository moved to AnavaAcap organization
- **Public Release Integration**: Installers automatically published to public ACAP releases repo
- **Fixed Firestore Permissions**: Service accounts now have proper write permissions (roles/datastore.owner)

#### v0.9.168
- **Fixed Critical 403 Errors**: Cameras can now write to Firestore
- **Token Refresh Issue**: Resolved - cameras properly refresh tokens to get new permissions

### Camera Setup Architecture

#### Global Camera State Management (v0.9.145+)
**New**: Centralized camera tracking system using React Context
- **CameraContext** (`/src/renderer/contexts/CameraContext.tsx`): Global state for all cameras
- **CameraManagementPage** (`/src/renderer/pages/CameraManagementPage.tsx`): Dashboard view of all cameras
- **CameraSetupWizard** (`/src/renderer/components/CameraSetupWizard.tsx`): Modal-based configuration
- **Persistent State**: All camera configurations saved across sessions
- **Non-linear Navigation**: Click any step to jump directly to it
- **Smart Step Detection**: Automatically determines which steps are complete

#### Camera Setup Flow (`/src/renderer/pages/CameraSetupPage.tsx`)
1. **Step 0**: Enter Camera Credentials
   - Select from previously configured cameras OR
   - Enter credentials for new camera setup
   - Previously configured cameras jump directly to needed step
2. **Step 1**: Find Your Camera - Network scan or manual IP entry
3. **Step 2**: Deploy Anava - Push ACAP and configuration
   - Shows installed ACAP filename after deployment
   - "Skip to Speaker Config" button for cameras with ACAP already installed
4. **Step 3**: Configure Speaker (Optional) - Add speaker IP/credentials for audio output
   - Automatically pushes speaker config to camera via setInstallerConfig
5. **Step 4**: Complete - Summary and navigation options

#### Camera State Structure (v0.9.145+)
Each camera tracked in global state includes:
```typescript
interface ManagedCamera {
  id: string;              // Unique identifier
  name: string;            // Display name
  ip: string;              // Camera IP address
  model?: string;          // Camera model
  status: {
    credentials: { completed: boolean, username?: string, password?: string },
    discovery: { completed: boolean, ip?: string, model?: string, firmwareVersion?: string },
    deployment: { completed: boolean, hasACAP?: boolean, isLicensed?: boolean, deployedFile?: string },
    speaker: { completed: boolean, configured?: boolean, ip?: string, username?: string, password?: string },
    verification: { completed: boolean, sceneAnalysis?: {...} }
  },
  lastUpdated: Date;
  projectId?: string;      // Associated GCP project
  customerId?: string;
  anavaKey?: string;
}
```

#### Speaker Configuration
- **Integrated into Camera Setup**: No longer a separate page (v0.9.123+)
- **Optional Step**: Users can skip if no speaker attached
- **Auto-push to Camera**: Speaker config automatically pushed via setInstallerConfig
- **Data Structure**: Speaker config saved with camera as:
  ```javascript
  {
    hasSpeaker: boolean,
    speaker: {
      ip: string,
      username: string,
      password: string
    }
  }
  ```

#### License Key Handling
1. **Trial License**: Auto-generates email, uses Firebase function
2. **Manual License**: Direct entry, stored via `setManualLicenseKey()`
3. **Automatic Activation**: Uses Axis SDK to convert keys to signed XML

### Recent Changes
#### v0.9.145
- **Global Camera State Management**: Complete rewrite using React Context for centralized tracking
- **Camera Management Dashboard**: New page showing all cameras with progress indicators
- **Non-linear Step Navigation**: Click any step to edit previous or skip to future steps
- **Previously Configured Cameras**: Select and edit from step 0
- **Smart Navigation**: Automatically jumps to most relevant step based on camera state
- **Fixed Speaker Step Access**: Can now click to speaker config when camera has ACAP
- **ACAP Filename Display**: Shows deployed file name after installation
- **Skip Buttons**: Skip deployment for cameras with ACAP, skip to speaker config
- **Persistent State**: All camera configurations saved and restored across sessions

#### v0.9.123+
- **Speaker Configuration Integrated**: Moved from separate page to optional step in Camera Setup
- **GCP Infrastructure Focused on Vertex AI**: Removed AI Studio selection from deployment flow
- **Enhanced Text Cleaning**: Detection Test page now removes quotes and markdown formatting
- **Improved UX**: Test Auth Flow dialog auto-starts when opened

#### v0.9.105
- **Automatic license activation**: Using Axis public SDK to convert keys to XML
- **Fixed stream abort errors**: Replaced failing digest auth library
- **Added retry logic**: Handles ThreadPool errors when app is starting
- **Comprehensive logging**: Every step of license activation is logged

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

### Camera HTTPS Support (v0.9.170+)
- **Automatic Protocol Detection**: Cameras now support both HTTPS and HTTP
- **HTTPS-First**: Always tries HTTPS first, falls back to HTTP if unavailable
- **Self-Signed Certificates**: Accepts self-signed certificates for camera HTTPS
- **Fixes 15-Second Timeout**: Resolves issue where HTTPS-only cameras caused app to freeze
- **Cached Protocol**: Remembers which protocol works for each camera IP
- **License Retry**: Failed license activations now show retry buttons in UI

### Key Features
- **Production-Ready Vertex AI**: Full infrastructure deployment with enterprise security
- **Non-linear Navigation**: Jump between sections via sidebar
- **Camera Discovery**: Network scanning with VAPIX authentication
- **Integrated Speaker Config**: Optional audio output configuration in camera setup
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
# - macOS: Anava.Installer-{version}.dmg (Intel & Apple Silicon)
# - Windows: Anava.Installer.Setup.{version}.exe (x64 & ia32)

# 4. Publish to ACAP releases (manual, will be automated)
./scripts/publish-to-acap-releases.sh
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
- **Global Camera State**: `/src/renderer/contexts/CameraContext.tsx` - Central state management
- **Camera Dashboard**: `/src/renderer/pages/CameraManagementPage.tsx` - Overview of all cameras
- **Setup Wizard**: `/src/renderer/components/CameraSetupWizard.tsx` - Modal configuration
- **Camera Setup UI**: `/src/renderer/pages/CameraSetupPage.tsx` - Non-linear stepper with integrated speaker config
- **Detection Test**: `/src/renderer/pages/DetectionTestPage.tsx` - Text cleaning, speaker support
- **IPC Handlers**: `/src/main/services/camera/optimizedCameraDiscoveryService.ts:110-115`
- **Auth Logic**: `/src/main/services/camera/optimizedCameraDiscoveryService.ts:565-625`
- **ACAP Deployment**: `/src/main/services/camera/acapDeploymentService.ts` - Auto-selection of correct ACAP file

### Detection Test Page (v0.9.123+)
- **Text Cleaning**: Automatically removes quotes, escaped quotes, and markdown formatting
- **Speaker Support**: Passes `selectedCamera.hasSpeaker` to enable audio output on speakers
- **Clean Description Function**: Handles `\"text\"` → `text`, removes `**bold**`, `*italic*`, etc.