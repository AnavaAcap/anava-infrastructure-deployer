# Installer Update Plan

## 1. Update Function Templates

Replace placeholder functions with actual implementations:

### Device Auth Function (main.py):
```python
import functions_framework
import firebase_admin
from firebase_admin import auth

# Initialize Firebase Admin SDK
if not firebase_admin._apps:
    firebase_admin.initialize_app()

@functions_framework.http
def device_authenticator(request):
    if not firebase_admin._apps: 
        return ("Firebase SDK not init", 500)
    if request.method != 'POST': 
        return ('Method Not Allowed', 405)
    try:
        req_json = request.get_json(silent=True)
        if not req_json: 
            return ("Bad Request: No JSON", 400)
        device_id = req_json.get("device_id")
        if not device_id: 
            return ("Bad Request: 'device_id' missing", 400)
        print(f"DeviceAuthFn: Req for device_id: {device_id}")
        custom_token = auth.create_custom_token(uid=str(device_id)).decode('utf-8')
        print(f"DeviceAuthFn: Firebase Custom Token created for {device_id}")
        return ({"firebase_custom_token": custom_token}, 200)
    except Exception as e: 
        print(f"DeviceAuthFn ERROR: {e}")
        return ("Token gen error", 500)
```

### Token Vending Machine Function (main.py):
```python
import functions_framework
import os
import requests
import json

STS_ENDPOINT = "https://sts.googleapis.com/v1/token"
IAM_ENDPOINT_TEMPLATE = "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/{sa_email}:generateAccessToken"

@functions_framework.http
def token_vendor_machine(request):
    # Full implementation as shown in vertexSetup_gcp.sh
    # ... (include the complete TVM code)
```

## 2. Update OpenAPI Template

The `api-gateway-config.yaml` template already has the JWT fix applied:
- ✅ Added `jwt_audience` field to both endpoints

## 3. Fix Cloud Run IAM Manager

The `CloudRunIAMManager` is already implemented correctly:
- ✅ Grants `roles/run.invoker` to API Gateway invoker SA

## 4. Update Deployment Engine

### In `deploymentEngine.ts`:

1. **Use actual function code instead of placeholders**:
```typescript
private generatePythonFunctionCode(functionName: string, entryPoint: string): string {
  // Load from template files instead of inline placeholders
  const templatePath = path.join(
    app.isPackaged ? process.resourcesPath : app.getAppPath(),
    'function-templates',
    functionName,
    'main.py'
  );
  return fs.readFileSync(templatePath, 'utf-8');
}
```

2. **Ensure correct environment variables for TVM**:
- Already implemented correctly in the deployment configuration

3. **Wait for IAM propagation**:
- ✅ Already added 30-second wait

## 5. Add Function Templates to Project

Create these directories and files:
```
function-templates/
├── device-auth/
│   ├── main.py
│   └── requirements.txt
└── token-vending-machine/
    ├── main.py
    └── requirements.txt
```

## 6. Ensure Managed Service is Enabled

The `apiGatewayDeployer.ts` already has this fix:
- ✅ Calls `enableApiGatewayManagedService` after gateway creation

## Summary

The installer is very close to working correctly. The main missing piece is deploying the actual function code instead of placeholders. All the infrastructure fixes (JWT auth, IAM permissions, managed service) are already implemented.

With these function template updates, the installer should work for any future project!