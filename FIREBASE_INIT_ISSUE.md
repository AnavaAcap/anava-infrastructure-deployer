# Firebase Authentication and Storage Initialization Issue

## Current Problem Summary

When the Anava Infrastructure Deployer tries to programmatically initialize Firebase Authentication and Storage, both fail with different errors:

### 1. Firebase Authentication Failure
```
❌ Failed to enable auth providers: CONFIGURATION_NOT_FOUND
⚠️  IMPORTANT: Firebase Authentication could not be configured programmatically
```

**Root Causes:**
1. Identity Toolkit API (`identitytoolkit.googleapis.com`) is not being enabled by our tool
2. The API endpoint returns 404 because the configuration doesn't exist yet
3. Our JSON payload structure was incorrect (using `google` field instead of proper structure)

### 2. Firebase Storage Failure
```
⚠️  buckets:addFirebase failed (403), trying defaultBucket:finalize...
⚠️  Warning: Could not link Firebase Storage bucket: Request failed with status code 404
⚠️  The bucket exists but may not be fully integrated with Firebase
```

**Root Causes:**
1. Firebase Storage service agent (`service-{projectNumber}@gcp-sa-firebasestorage.iam.gserviceaccount.com`) doesn't have Storage Admin role
2. We're using the wrong API endpoints for bucket creation/linking
3. The bucket exists as a GCS bucket but isn't linked to Firebase

## What Needs to Be Done

### Step 1: Enable Required APIs
The deployment engine currently enables these APIs:
```
firebase.googleapis.com
firebasestorage.googleapis.com
```

But it's MISSING this critical one:
```
identitytoolkit.googleapis.com  # Required for Firebase Auth configuration
```

### Step 2: Grant Service Agent Permissions
The Firebase Storage service agent needs permissions BEFORE trying to link buckets:
```bash
# This needs to happen during IAM role assignment
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:service-PROJECT_NUMBER@gcp-sa-firebasestorage.iam.gserviceaccount.com" \
  --role="roles/storage.admin"
```

### Step 3: Use Correct API Sequence for Auth
1. Enable `identitytoolkit.googleapis.com`
2. Wait for propagation (10-15 seconds)
3. Use PATCH method on `/v2/projects/{projectId}/config`
4. Use correct field structure (not `google` field)

### Step 4: Use Correct API Sequence for Storage
1. Ensure Firebase Storage service agent has permissions
2. For default bucket (`{projectId}.appspot.com`):
   - Use `projects/{projectId}/defaultBucket:add` API
3. For custom buckets:
   - Create bucket first
   - Use `buckets/{bucketName}:addFirebase` API to link it

## Manual Testing Script

Here's what needs to work manually before we update the code:

```bash
#!/bin/bash
PROJECT_ID="test-project-id"
PROJECT_NUMBER="123456789"  # Get from project

# 1. Enable Identity Toolkit API
gcloud services enable identitytoolkit.googleapis.com --project=$PROJECT_ID
sleep 15  # Wait for propagation

# 2. Grant Storage service agent permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-firebasestorage.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

# 3. Test Auth initialization
ACCESS_TOKEN=$(gcloud auth print-access-token)
curl -X PATCH \
  "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired,signIn.anonymous.enabled" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "signIn": {
      "email": {"enabled": true, "passwordRequired": true},
      "anonymous": {"enabled": true}
    }
  }'

# 4. Test Storage initialization (default bucket)
curl -X POST \
  "https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}/defaultBucket:add" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Success Criteria

Before implementing in code, we need to verify:

1. **Auth Success**: The PATCH request returns 200 OK and Firebase Console shows Email/Password enabled
2. **Storage Success**: Either:
   - Default bucket creation returns 200 OK, OR
   - Custom bucket linking with `:addFirebase` returns 200 OK
3. **No Manual Steps**: User should NOT need to click "Get Started" in Firebase Console

## Code Changes Needed (After Manual Validation)

1. **Add `identitytoolkit.googleapis.com` to enabled APIs list**
2. **Add Firebase Storage service agent to IAM role assignments**
3. **Fix Auth API call structure (remove `google` field)**
4. **Use correct Storage API endpoints**
5. **Add proper wait times for API propagation**

## Current Status

- Version 0.9.25 has partial fixes but NOT the critical ones:
  - ❌ Still missing Identity Toolkit API enablement
  - ✅ Added Storage service agent to IAM (but needs testing)
  - ✅ Fixed Auth field structure (but API not enabled)
  - ✅ Added better error messages

## Next Steps

1. Create a new test project
2. Run the manual testing script above
3. Verify both Auth and Storage work without manual intervention
4. Only then update the deployment engine code
5. Test with a fresh project to ensure it works end-to-end