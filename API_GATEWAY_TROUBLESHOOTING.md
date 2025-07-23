# API Gateway Authentication Troubleshooting Guide

## Current Issue Status (as of v0.8.29)

### The Problem
Cameras are getting 401 Unauthorized errors when calling the API Gateway endpoints, even though:
- IAM permissions are correctly configured
- Service accounts exist and have proper roles
- Cloud Functions work when called directly

### Root Cause ACTUALLY Identified (v0.8.29)
The OpenAPI spec placeholders were only PARTIALLY replaced:
- ✅ `address: https://device-auth-xxx.run.app` (correct)
- ❌ `jwt_audience: ${DEVICE_AUTH_URL}` (still had placeholder!)

This caused API Gateway to send incorrect JWT tokens with wrong audience, resulting in 401 errors.

### Fixes Applied
- **v0.8.28**: Attempted regex fix (didn't work)
- **v0.8.29**: Changed to while loops + extensive debugging + auto actAs permission grant

## How to Test if the Fix Works

### 1. Check What Was Deployed
```bash
# Switch to the test project
gcloud config set project PROJECT_ID

# List API configs to see what's deployed
gcloud api-gateway api-configs list --api=anava-api-anava-iot

# Check which config the gateway is using
gcloud api-gateway gateways describe anava-api-anava-iot-gateway \
  --location=us-central1 \
  --format="value(apiConfig)"
```

### 2. Test the Endpoints
```bash
# Get the gateway URL and API key from the exported config
GATEWAY_URL="https://anava-api-anava-iot-gateway-XXXXX.uc.gateway.dev"
API_KEY="AIzaSy..."

# Test device-auth endpoint
curl -X POST "$GATEWAY_URL/device-auth/initiate" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"device_id": "test-device"}' -v

# Should return: {"firebase_custom_token": "eyJ..."}
# If you get 401, the fix didn't work
```

### 3. Check Cloud Functions Logs
```bash
# Check device-auth logs
gcloud functions logs read device-auth --limit=20 --region=us-central1

# Look for these error messages:
# "The request was not authorized to invoke this service"
# This means API Gateway can't authenticate to Cloud Run
```

## What v0.8.29 Logs Will Show

### Success Case:
```
Config template has 2 instances of ${DEVICE_AUTH_URL}
Config template has 2 instances of ${TVM_URL}
Replaced 2 instances of ${DEVICE_AUTH_URL}
Replaced 2 instances of ${TVM_URL}
✓ All placeholders successfully replaced
Backend configuration sample:
  address: https://device-auth-xxx.run.app
  jwt_audience: https://device-auth-xxx.run.app
```

### Failure Case:
```
ERROR: Invalid URLs provided - deviceAuthUrl: undefined, tvmUrl: undefined
-- OR --
WARNING: Placeholders still exist in config after replacement!
Line 30 still has placeholder: jwt_audience: ${DEVICE_AUTH_URL}
```

## If the Fix Didn't Work

### Check the Deployment Logs
The v0.8.29 version has extensive logging that will show:
1. How many placeholders were found initially
2. How many replacements were made
3. Whether any placeholders remain
4. A sample of the final backend configuration

### Manual Fix Process (Proven to Work)
```bash
# 1. Create a fixed OpenAPI spec file
cat > /tmp/api-config-fixed.yaml << 'EOF'
swagger: "2.0"
info:
  title: Anava API Gateway
  version: "1.0.0"
paths:
  /device-auth/initiate:
    post:
      x-google-backend:
        address: https://device-auth-XXXXX-uc.a.run.app  # REPLACE WITH ACTUAL URL
        jwt_audience: https://device-auth-XXXXX-uc.a.run.app  # SAME URL
        deadline: 30.0
      # ... rest of config
EOF

# 2. Get the actual Cloud Run URLs
gcloud run services list --region=us-central1

# 3. Replace XXXXX with actual service IDs in the yaml file

# 4. Create new API config
gcloud api-gateway api-configs create config-fixed-manual \
  --api=anava-api-anava-iot \
  --openapi-spec=/tmp/api-config-fixed.yaml \
  --backend-auth-service-account=apigw-invoker-sa@PROJECT_ID.iam.gserviceaccount.com

# 5. Update gateway to use new config
gcloud api-gateway gateways update anava-api-anava-iot-gateway \
  --api=anava-api-anava-iot \
  --api-config=config-fixed-manual \
  --location=us-central1
```

## Other Potential Issues to Check

### 1. Service Account Format
The API config creation expects just the email, not a resource path:
- ✅ Correct: `apigw-invoker-sa@project.iam.gserviceaccount.com`
- ❌ Wrong: `projects/PROJECT/serviceAccounts/apigw-invoker-sa@project.iam.gserviceaccount.com`

### 2. IAM Permissions
Verify the API Gateway service account has Cloud Run invoker permission:
```bash
gcloud run services get-iam-policy device-auth --region=us-central1
# Should show apigw-invoker-sa with roles/run.invoker
```

### 3. API Key Restrictions
Check if the API key has proper restrictions:
```bash
gcloud services api-keys list --filter="displayName:Anava*"
gcloud services api-keys describe KEY_NAME
# Should only have API service restrictions, no browser/referrer restrictions
```

## Debugging Commands

```bash
# Test Cloud Function directly (bypass API Gateway)
TOKEN=$(gcloud auth print-identity-token)
curl -X POST "https://device-auth-XXXXX-uc.a.run.app" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"device_id": "test"}' -v

# Check API Gateway service status
gcloud api-gateway apis describe anava-api-anava-iot
gcloud api-gateway gateways describe anava-api-anava-iot-gateway --location=us-central1

# Monitor Cloud Function logs in real-time
gcloud functions logs read device-auth --region=us-central1 --follow
```

## Key Insights from v0.8.29 Investigation

1. **Partial replacement bug** - The regex was replacing `address` fields but NOT `jwt_audience` fields in the same YAML block. This is bizarre but confirmed by examining the deployed configs.

2. **jwt_audience is CRITICAL** - If `jwt_audience` has a placeholder while `address` has the real URL, Cloud Run will reject the request with 401.

3. **actAs permission required** - The deployer needs `roles/iam.serviceAccountUser` on the API Gateway service account. Without this, the API config silently ignores the `gatewayServiceAccount` field.

4. **While loops are more reliable** - Changed from regex `/g` flag to while loops to ensure ALL occurrences are replaced.

5. **Debugging is essential** - v0.8.29 adds logging to show exactly what's being replaced and what the final config looks like.

## Next Steps if v0.8.29 Still Doesn't Work

### 1. Check the Deployment Console Logs
Look for these specific log lines:
- "Config template has X instances of ${DEVICE_AUTH_URL}"
- "Replaced X instances of ${DEVICE_AUTH_URL}"
- "Backend configuration sample:"

### 2. Examine the Deployed Config
```bash
# Get the latest config ID
gcloud api-gateway api-configs list --api=anava-api-anava-iot --limit=1

# Extract the OpenAPI spec
gcloud api-gateway api-configs describe [CONFIG_ID] \
  --api=anava-api-anava-iot \
  --format=json | jq -r '.openapiDocuments[0].document.contents' | base64 -d | grep -A2 -B2 jwt_audience
```

### 3. Check for Edge Cases
- Unicode/encoding issues in the YAML file
- Windows vs Unix line endings
- Hidden characters in the template
- Multiple YAML documents in one file

### 4. Nuclear Option
If all else fails, bypass the template entirely and generate the OpenAPI spec programmatically in TypeScript rather than using string replacement.

## Contact for Help

If you're still stuck:
- The issue is specifically with the OpenAPI spec template replacement during deployment
- The fix in v0.8.28 should work, but if not, the manual process above is proven to work
- Check `/src/main/services/apiGatewayDeployer.ts` lines 158-161 for the replacement logic