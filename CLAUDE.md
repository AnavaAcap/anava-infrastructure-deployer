# CLAUDE.md - Anava Installer

## Repository Information
- **GitHub**: https://github.com/AnavaAcap/anava-infrastructure-deployer
- **Organization**: AnavaAcap
- **Product Name**: Anava Installer (formerly Anava Vision)
- **Public Releases**: Installers published to https://github.com/AnavaAcap/acap-releases

## CRITICAL ISSUE (2025-08-09)

### Deployment Failure: "Cannot read properties of null (reading 'device-auth')"
**Status**: ACTIVE ISSUE - Version 0.9.171

**Problem**: Service accounts or Cloud Functions resources are null when API Gateway tries to access them.

**Root Cause**: 
- Old AI Studio mode logic was conditionally skipping steps based on `isAiStudioMode`
- Lines 301-333 in deploymentEngine.ts were skipping createServiceAccounts, deployCloudFunctions, etc. when aiMode === 'ai-studio'
- This was legacy code from when AI Studio and Vertex AI were separate paths
- Now the system supports BOTH in a single deployment, so ALL steps must run

**What Was Fixed Today**:
1. Removed all `if (!isAiStudioMode)` conditionals that were skipping critical steps
2. Added null checks with descriptive error messages in deployCloudFunctions and createApiGateway
3. Fixed CompletionPage.tsx to handle null resources gracefully
4. Added generativelanguage.googleapis.com to the API list

**What Still Needs Investigation**:
- Verify service accounts are actually being created and saved to state
- Check if deployCloudFunctions is successfully saving function URLs to resources
- Test full deployment to confirm all steps run correctly

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
- 15s wait after IAM role assignments before Cloud Functions deployment

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

## Build & Release

### Automated CI/CD
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

## Current State (v0.9.171)

### Recent Updates
#### v0.9.171 (2025-08-09)
- **Fixed AI Mode Logic**: Removed obsolete conditionals that were skipping service account creation
- **All Steps Now Run**: Service accounts, Cloud Functions, API Gateway all deploy regardless of AI mode
- **Added Null Checks**: Better error messages when resources are missing
- **Fixed CompletionPage**: Handles null resources gracefully

#### v0.9.170
- **Fixed Critical 403 Errors**: Cameras can now write to Firestore
- **Token Refresh Issue**: Resolved - cameras properly refresh tokens to get new permissions
- **HTTPS Support**: Added automatic protocol detection for cameras

### What's Automated
- GCP project setup and API enablement (including generativelanguage.googleapis.com)
- Service account creation with proper IAM roles
- Cloud Storage bucket creation (direct GCS, not Firebase Storage)
- Firebase Auth initialization (email/password)
- Firestore database, security rules, and indexes
- Cloud Functions deployment (BOTH Vertex AI functions)
- API Gateway configuration
- Workload Identity Federation setup
- Camera discovery and configuration
- ACAP deployment to cameras
- **License activation** (v0.9.105+) - Fully automatic using Axis SDK

### What's Manual
- Google Sign-In OAuth client configuration (optional)
- Domain verification for custom domains

### Common Pitfalls
1. Don't assume Cloud Build SA runs function builds - it's compute SA
2. Don't upload source to bucket subfolders - use root with timestamps
3. Don't forget service account propagation delays (15+ seconds)
4. Don't deploy rules before databases/buckets exist
5. Don't try to create `.appspot.com` buckets without domain verification
6. Don't set `identity: null` in package.json - it disables code signing
7. Don't forget to export Developer ID certificate as .p12 for CI/CD
8. Don't compress .dmg or .exe files - they're already optimized
9. Don't try to upload plain license keys - they must be converted to signed XML format
10. Don't skip the retry logic for ThreadPool errors - apps need time to start
11. **Don't use AI Studio mode conditionals** - the system now supports both paths simultaneously

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

# Check deployment state
cat ~/.anava-deployer/state_*.json | jq '.steps.createServiceAccounts.resources'
```

## Debugging Current Issue

### Check if service accounts were created:
1. Look in deployment logs for "Service accounts created successfully"
2. Check state file: `~/.anava-deployer/state_*.json`
3. Verify `.steps.createServiceAccounts.resources.accounts` exists

### Check if Cloud Functions deployed:
1. Look for "Cloud Functions deployed successfully" in logs
2. Check state file: `.steps.deployCloudFunctions.resources.functions`
3. Should have URLs for 'device-auth' and 'token-vending-machine'

### Key Files for Debugging
- **Deployment Engine**: `/src/main/services/deploymentEngine.ts`
  - Lines 301-333: Where AI Studio conditionals were removed
  - Lines 681-686: Service account null check
  - Lines 939-945: Cloud Functions null check
- **Completion Page**: `/src/renderer/pages/CompletionPage.tsx`
  - Lines 104-106, 138-140: Fixed null reference handling