# Anava Infrastructure Deployer - Developer Handoff Document

**Date**: August 9, 2025  
**Current Version**: 0.9.171  
**Branch**: master  
**Status**: Critical fixes in progress - deployment pipeline has known issues

---

## 1. Current Critical Issue Summary

### Primary Issues Identified
1. **Cloud Functions Deployment Failures** - "Unable to retrieve repository metadata" errors
2. **Service Account Permission Timing Issues** - Google Cloud IAM eventual consistency problems
3. **AI Studio Mode Logic Removed** - Service accounts now always created regardless of AI mode
4. **HTTPS Support Implementation** - New protocol detection for cameras with HTTP disabled

### Impact
- Deployments may fail silently during Cloud Functions step
- Camera discovery timeouts (15+ seconds) for HTTPS-only cameras
- Null reference errors in completion page when service accounts missing

---

## 2. What Was Changed Today (Recent Commits)

### Commit 397303a (Latest) - "fix: remove obsolete AI Studio mode logic"
- **Files Modified**: `deploymentEngine.ts`, `CompletionPage.tsx`, camera services
- **Changes**: 
  - Service accounts now always created for both Vertex AI and AI Studio modes
  - All APIs enabled including `generativelanguage.googleapis.com`
  - Fixed null reference errors in CompletionPage
  - Version bump to 0.9.171

### Commit aeccafa - "CRITICAL FIX: Cloud Functions service agent permissions"
- **Files Modified**: `deploymentEngine.ts`
- **Changes**:
  - Added 5-second wait for Cloud Functions service agent creation
  - Added `artifactregistry.writer` permission
  - Made permission failures STOP deployment (no silent failures)
  - Increased IAM propagation wait to 15 seconds

### Commit 1a3e55a - "fix: critical HTTPS support and license activation"
- **Files Added**: `cameraProtocolUtils.ts`
- **Files Modified**: Camera services, ACAP deployment
- **Changes**:
  - Automatic HTTPS detection with HTTP fallback
  - Fixed 15-second timeout for HTTPS-only cameras  
  - License activation error handling and retry mechanism

---

## 3. Root Cause Analysis

### Cloud Functions Deployment Issues
**Root Cause**: Cloud Functions v2 builds run as COMPUTE service account, not Cloud Build SA
- **Service Account**: `{projectNumber}-compute@developer.gserviceaccount.com`
- **Missing Permissions**: `roles/artifactregistry.admin`, `roles/storage.objectViewer`
- **Repository**: `{region}-docker.pkg.dev/{projectId}/gcf-artifacts` needs admin access

### IAM Eventual Consistency
**Root Cause**: Service accounts need 2-20 seconds to replicate globally
- **Symptoms**: Random deployment failures, permission denied errors
- **Current Fix**: 15-second wait after IAM changes, but may need adjustment

### Camera Protocol Detection
**Root Cause**: Cameras with HTTP disabled caused 15-second timeouts
- **New Implementation**: Try HTTPS first, fallback to HTTP
- **Cache**: Protocol preferences cached per camera IP

---

## 4. What Still Needs Fixing

### High Priority
1. **Service Account Validation** (CRITICAL)
   - Lines 684, 939 in `deploymentEngine.ts` added null checks
   - Need to ensure service accounts exist before Cloud Functions/API Gateway steps
   - Consider adding pre-deployment validation

2. **Permission Timing** (HIGH)
   - Current 15-second wait may be insufficient
   - Need exponential backoff for IAM operations
   - Consider polling service account existence before proceeding

3. **Error Handling** (HIGH)
   - Silent deployment failures in parallel execution
   - Need better error propagation from Cloud Functions deployment
   - API Gateway step fails silently if prerequisites missing

### Medium Priority
1. **License Activation Retry Logic**
   - Current retry mechanism in place but may need refinement
   - Error surface to UI needs testing

2. **Protocol Detection Caching**
   - Current cache is in-memory only
   - Consider persisting protocol preferences

---

## 5. Important Code Locations

### Core Deployment Logic
- **`/src/main/services/deploymentEngine.ts`** (Lines 681-750, 932-950)
  - Service account validation logic added
  - Cloud Functions permission handling
  - **CRITICAL**: Lines 695-730 handle service agent permissions

### Camera Services  
- **`/src/main/services/camera/cameraProtocolUtils.ts`** (NEW FILE)
  - HTTPS/HTTP protocol detection
  - Protocol caching logic
  - Base URL generation for camera communication

### UI Components
- **`/src/renderer/pages/CompletionPage.tsx`**
  - Displays deployment results
  - **ISSUE**: Null reference handling for missing service accounts
  - Fixed in latest commit but needs testing

### Permission Management
- **`deploymentEngine.ts:1384-1460`**
  - Artifact Registry permission grants
  - Cloud Functions service agent handling
  - **CRITICAL**: Compute SA permissions for v2 builds

---

## 6. Testing Steps

### Before Deployment Testing
```bash
# 1. Verify version bump
cat package.json | grep version

# 2. Check for console.log statements (should be minimal)
grep -r "console\.log" src/ --include="*.ts" | wc -l

# 3. Build and start dev environment  
npm run build
npm run dev:renderer
```

### Deployment Testing
```bash
# 1. Test with new GCP project
# Create project through UI, verify:
# - Service accounts created successfully
# - IAM propagation (check after 15+ seconds)
# - Cloud Functions deploy without "repository metadata" errors

# 2. Test camera discovery
# - HTTPS-only camera (should not timeout)
# - HTTP-only camera (should fallback correctly)
# - Mixed environment

# 3. Monitor deployment logs
# Check for:
# - "CRITICAL" messages in console
# - Service account null errors
# - Permission denied errors
```

### Post-Deployment Validation
```bash
# 1. Check Cloud Functions status
gcloud functions list --region=us-central1 --project=PROJECT_ID

# 2. Verify API Gateway
curl -X POST "https://GATEWAY-URL/device-auth/initiate" \
  -H "x-api-key: KEY" -H "Content-Type: application/json" \
  -d '{"device_id": "test"}' -v

# 3. Test camera configuration push
# Use Camera Setup wizard, verify VAPIX endpoint responds
```

### Known Good State Indicators
- ✅ Service accounts created within 30 seconds
- ✅ No "Unable to retrieve repository metadata" errors
- ✅ Cloud Functions deploy successfully in parallel
- ✅ Camera discovery completes under 5 seconds per camera
- ✅ CompletionPage displays without null reference errors

### Known Failure Indicators  
- ❌ 15+ second timeouts during camera discovery
- ❌ "Service accounts not found" errors during deployment
- ❌ Cloud Functions deployment stuck/failed  
- ❌ Permission denied errors in deployment logs
- ❌ Blank/error state in CompletionPage

---

## Additional Notes

### Build System
- Windows builds require `@rollup/rollup-win32-x64-msvc` patch
- Code signing certificates required for distribution
- Auto-publish to `AnavaAcap/acap-releases` repo configured

### Architecture Changes  
- Firebase Storage removed (v0.9.50+) - cameras use direct GCS
- AI Studio mode still supported but uses same infrastructure as Vertex AI
- License activation fully automated using Axis public SDK

### Monitoring
- All deployment steps logged to console and file
- Critical errors marked with "CRITICAL" prefix
- Service account issues now throw errors instead of silent failure

---

**Next Developer Action Items:**
1. Test deployment end-to-end with new validation logic
2. Consider increasing IAM propagation wait if failures persist  
3. Add comprehensive error recovery for service account creation
4. Verify CompletionPage null reference fixes work correctly
5. Monitor Cloud Functions deployment success rate