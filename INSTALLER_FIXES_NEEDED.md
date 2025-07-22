# Anava Infrastructure Deployer - Required Fixes

Based on testing the deployed infrastructure, the following issues were identified and fixed in the installer application:

## 1. ✅ FIXED: API Gateway OpenAPI Spec Missing JWT Authentication

**Issue**: The API Gateway returns 403 Forbidden errors when trying to call Cloud Functions because the OpenAPI spec doesn't include JWT authentication configuration.

**Fix Applied**: Added `jwt_audience` field to enable JWT authentication in `api-gateway-config.yaml`:
```yaml
x-google-backend:
  address: ${DEVICE_AUTH_URL}
  jwt_audience: ${DEVICE_AUTH_URL}  # MUST be same as address
  deadline: 30.0
```

**Files Updated**:
- `/api-gateway-config.yaml` - Added jwt_audience for both endpoints

## 2. ✅ FIXED: Missing Cloud Run IAM Permission Grant

**Issue**: The installer doesn't grant the API Gateway invoker service account permission to invoke the Cloud Functions (which are backed by Cloud Run services in v2).

**Fix Applied**: Created `CloudRunIAMManager` class to grant invoker permissions using Google Cloud APIs:
```typescript
// Created new service: src/main/services/cloudRunIAMManager.ts
// Added to deploymentEngine.ts after deploying functions:
await this.grantCloudRunInvokerPermissions(
  projectId, region, functions, accounts['apigw-invoker-sa']
);
```

**Files Updated**:
- `/src/main/services/cloudRunIAMManager.ts` - New service for Cloud Run IAM management
- `/src/main/services/deploymentEngine.ts` - Added IAM permission grants after function deployment

## 3. ✅ FIXED: API Gateway Managed Service Not Auto-Enabled

**Issue**: The API Gateway managed service (`anava-api-anava-iot.apigateway.PROJECT.cloud.goog`) is not automatically enabled, causing 403 errors.

**Fix Applied**: Added `enableApiGatewayManagedService` method using Google Service Usage API:
```typescript
// Added to apiGatewayDeployer.ts after gateway creation:
await this.enableApiGatewayManagedService(projectId, serviceName, log);
```

**Files Updated**:
- `/src/main/services/apiGatewayDeployer.ts` - Added managed service enablement after gateway creation

## 4. ⚠️ WARNING: Incorrect Cloud Function URLs in Output

**Issue**: The output configuration shows incorrect Cloud Function URLs:
- Shows: `device-auth-3pgeuyuvqa-uc.a.run.app`
- Actual: `device-auth-776858738694.us-central1.run.app`

**Analysis**: The URLs in the deployment output don't match the actual deployed function URLs. This appears to be hardcoded somewhere or using the wrong project number.

**Fix Required**: Ensure the deployment result uses the actual function URLs from the `deployedFunctions` object in `deploymentEngine.ts`.

## 5. ✅ FIXED: Missing Error Handling for IAM Propagation

**Issue**: IAM permissions can take 30-60 seconds to propagate, but the installer doesn't wait or retry.

**Fix Applied**: Added 30-second wait after granting IAM permissions:
```typescript
// In grantCloudRunInvokerPermissions method:
console.log('Waiting 30 seconds for IAM permissions to propagate...');
await new Promise(resolve => setTimeout(resolve, 30000));
```

**Files Updated**:
- `/src/main/services/deploymentEngine.ts` - Added IAM propagation delay

## 6. ✅ GOOD: Service Account Creation Works Correctly

The installer correctly creates all required service accounts:
- `apigw-invoker-sa` - API Gateway invoker
- `device-auth-sa` - Device authentication function
- `tvm-sa` - Token vending machine function
- `vertex-ai-sa` - Vertex AI access

## 7. ✅ GOOD: Cloud Functions Deploy Successfully

The functions deploy correctly with the right:
- Service accounts
- Environment variables
- Authentication settings (`--no-allow-unauthenticated`)

## Summary of Implemented Changes

All critical issues have been fixed using Google Cloud APIs (not gcloud commands):

1. **✅ Updated `api-gateway-config.yaml`** - Added `jwt_audience` field for JWT authentication
2. **✅ Added Cloud Run IAM permission grants** - Created `CloudRunIAMManager` service to grant invoker permissions
3. **✅ Enabled managed service** - Added automatic enablement of API Gateway managed service
4. **⚠️ Function URLs** - Still need to investigate why wrong URLs appear in output
5. **✅ Added IAM propagation delay** - Added 30-second wait after granting permissions

## Files Modified

- `/api-gateway-config.yaml` - Added JWT authentication configuration
- `/src/main/services/cloudRunIAMManager.ts` - New service for Cloud Run IAM management
- `/src/main/services/deploymentEngine.ts` - Added IAM grants and propagation delay
- `/src/main/services/apiGatewayDeployer.ts` - Added managed service enablement

## Testing Commands

After fixes, these commands should work:

```bash
# Test via API Gateway (should return Firebase custom token)
curl -X POST "https://anava-api-anava-iot-gateway-9wvtmv46.uc.gateway.dev/device-auth/initiate" \
  -H "x-api-key: AIzaSyCSatscRbBjPNEB0crQA7o3NRYKWojSrfA" \
  -H "Content-Type: application/json" \
  -d '{"device_id": "test-device"}'

# Test token vending (requires valid Firebase ID token)
curl -X POST "https://anava-api-anava-iot-gateway-9wvtmv46.uc.gateway.dev/gcp-token/vend" \
  -H "x-api-key: AIzaSyCSatscRbBjPNEB0crQA7o3NRYKWojSrfA" \
  -H "Content-Type: application/json" \
  -d '{"firebase_id_token": "VALID_TOKEN_HERE"}'
```