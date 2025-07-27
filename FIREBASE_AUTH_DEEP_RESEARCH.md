# Firebase Authentication Programmatic Initialization - Deep Research Document

## Objective
Find a way to programmatically initialize Firebase Authentication without requiring manual interaction with the Firebase Console. Currently, users must click "Get Started" in the Firebase Console to initialize Auth, which prevents full automation.

## Current Problem
When attempting to access Firebase Authentication configuration via API:
```
GET https://identitytoolkit.googleapis.com/v2/projects/{projectId}/config
```
Returns:
```json
{
  "error": {
    "code": 404,
    "message": "CONFIGURATION_NOT_FOUND",
    "status": "NOT_FOUND"
  }
}
```

## Project Setup Context
- **Project ID**: test0727-p2pc
- **Project Number**: 413554396880
- **APIs Enabled**:
  - `identitytoolkit.googleapis.com` ✅
  - `firebase.googleapis.com` ✅
  - `firebasestorage.googleapis.com` ✅
- **Location**: Set via App Engine creation (us-central)
- **Firebase**: Project is Firebase-enabled

## All Attempted Solutions with Code

### 1. Direct PATCH to Config (Multiple Variations)

**Attempt 1a: PATCH with updateMask**
```bash
curl -X PATCH \
  "https://identitytoolkit.googleapis.com/v2/projects/test0727-p2pc/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired,signIn.anonymous.enabled" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "x-goog-user-project: test0727-p2pc" \
  -d '{
    "signIn": {
      "email": {"enabled": true, "passwordRequired": true},
      "anonymous": {"enabled": true}
    }
  }'
```
**Result**: 404 CONFIGURATION_NOT_FOUND

**Attempt 1b: PATCH without updateMask**
```bash
curl -X PATCH \
  "https://identitytoolkit.googleapis.com/v2/projects/test0727-p2pc/config" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "x-goog-user-project: test0727-p2pc" \
  -d '{"signIn":{"email":{"enabled":true}}}'
```
**Result**: 404 CONFIGURATION_NOT_FOUND

### 2. PUT to Create Config

**Attempt 2a: PUT to v2 endpoint**
```bash
curl -X PUT \
  "https://identitytoolkit.googleapis.com/v2/projects/test0727-p2pc/config" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "x-goog-user-project: test0727-p2pc" \
  -d '{
    "signIn": {
      "email": {
        "enabled": true,
        "passwordRequired": true
      },
      "anonymous": {
        "enabled": true
      }
    }
  }'
```
**Result**: 404 endpoint not found (HTML error page)

**Attempt 2b: PUT to admin/v2 endpoint**
```bash
curl -X PUT \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/test0727-p2pc/config" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "x-goog-user-project: test0727-p2pc" \
  -d '{
    "signIn": {
      "email": {
        "enabled": true,
        "passwordRequired": true
      }
    }
  }'
```
**Result**: 404 endpoint not found (HTML error page)

### 3. POST to Create Config

```bash
curl -X POST \
  "https://identitytoolkit.googleapis.com/v2/projects/test0727-p2pc/config" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "x-goog-user-project: test0727-p2pc" \
  -d '{
    "signIn": {
      "email": {
        "enabled": false,
        "passwordRequired": false
      }
    }
  }'
```
**Result**: 404 endpoint not found (HTML error page)

### 4. Firebase Management API Approaches

**Attempt 4a: Finalize Default Location**
```bash
curl -X POST \
  "https://firebase.googleapis.com/v1beta1/projects/test0727-p2pc/defaultLocation:finalize" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "x-goog-user-project: test0727-p2pc" \
  -d '{}'
```
**Result**: 400 INVALID_ARGUMENT (location already set via App Engine)

**Attempt 4b: Finalize Project**
```bash
curl -X POST \
  "https://firebase.googleapis.com/v1beta1/projects/test0727-p2pc:finalize" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "x-goog-user-project: test0727-p2pc" \
  -d '{}'
```
**Result**: 404 endpoint not found

**Attempt 4c: Enable AUTH product**
```bash
curl -X POST \
  "https://firebase.googleapis.com/v1beta1/projects/test0727-p2pc/products/AUTH" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "x-goog-user-project: test0727-p2pc" \
  -d '{}'
```
**Result**: 404 endpoint not found

### 5. Identity Provider Configuration

**Attempt 5a: Create defaultSupportedIdpConfigs**
```bash
curl -X POST \
  "https://identitytoolkit.googleapis.com/v2/projects/test0727-p2pc/defaultSupportedIdpConfigs" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "x-goog-user-project: test0727-p2pc" \
  -d '{
    "enabled": true
  }'
```
**Result**: 400 MISSING_PROVIDER_ID

**Attempt 5b: With provider IDs**
```bash
# Tried with various provider IDs
for provider in "google.com" "github.com" "facebook.com" "email" "anonymous" "password"; do
  curl -X POST \
    "https://identitytoolkit.googleapis.com/v2/projects/test0727-p2pc/defaultSupportedIdpConfigs?idpId=$provider" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -H "x-goog-user-project: test0727-p2pc" \
    -d '{"enabled": true}'
done
```
**Results**:
- `google.com`, `github.com`, `facebook.com`: 400 INVALID_CONFIG (client_id cannot be empty)
- `email`, `anonymous`, `password`: 400 INVALID_PROVIDER_ID

**Attempt 5c: With client_id**
```bash
curl -X POST \
  "https://identitytoolkit.googleapis.com/v2/projects/test0727-p2pc/defaultSupportedIdpConfigs?idpId=google.com" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "x-goog-user-project: test0727-p2pc" \
  -d '{
    "enabled": true,
    "clientId": "dummy-client-id.apps.googleusercontent.com",
    "clientSecret": "dummy-secret"
  }'
```
**Result**: 404 CONFIGURATION_NOT_FOUND

### 6. Tenant Creation

**Attempt 6a: Create tenant**
```bash
curl -X POST \
  "https://identitytoolkit.googleapis.com/v2/projects/test0727-p2pc/tenants" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "x-goog-user-project: test0727-p2pc" \
  -d '{
    "displayName": "default",
    "allowPasswordSignup": true,
    "enableEmailLinkSignin": true
  }'
```
**Result**: 400 INVALID_PROJECT_ID

### 7. Custom/Undocumented Endpoints

**Attempt 7a: initializeAuth endpoint**
```bash
curl -X POST \
  "https://identitytoolkit.googleapis.com/v1/projects/test0727-p2pc:initializeAuth" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "x-goog-user-project: test0727-p2pc" \
  -d '{}'
```
**Result**: 404 endpoint not found

### 8. User Operations (to trigger initialization)

**Attempt 8a: Create user via signUp**
```bash
curl -X POST \
  "https://identitytoolkit.googleapis.com/v1/accounts:signUp" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "x-goog-user-project: test0727-p2pc" \
  -d '{
    "email": "test@example.com",
    "password": "testPassword123",
    "returnSecureToken": true
  }'
```
**Result**: 400 CONFIGURATION_NOT_FOUND

**Attempt 8b: Send OOB code**
```bash
curl -X POST \
  "https://identitytoolkit.googleapis.com/v1/projects/test0727-p2pc/accounts:sendOobCode" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "x-goog-user-project: test0727-p2pc" \
  -d '{
    "requestType": "VERIFY_EMAIL",
    "idToken": "dummy"
  }'
```
**Result**: 400 CONFIGURATION_NOT_FOUND

### 9. Admin SDK Config Check

```bash
curl -X GET \
  "https://firebase.googleapis.com/v1beta1/projects/test0727-p2pc/adminSdkConfig" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-goog-user-project: test0727-p2pc"
```
**Result**: Returns project info but doesn't initialize Auth

## Console Network Analysis Needed

When clicking "Get Started" in Firebase Console, the browser likely makes API calls that aren't publicly documented. Research areas:

1. **Internal APIs**: Google may use internal APIs (e.g., `firebase-pa.googleapis.com` or similar)
2. **Special Headers**: Console might send special headers or use different auth mechanisms
3. **Multi-step Process**: Initialization might involve multiple API calls in sequence
4. **RPC Endpoints**: Console might use gRPC-Web or JSON-RPC endpoints

## Research Questions for Gemini

1. **Are there any internal Google APIs or endpoints for Firebase Auth initialization that aren't publicly documented?**

2. **What exact API calls does the Firebase Console make when clicking "Get Started" on Authentication?**

3. **Is there a way to use the Firebase Admin SDK or Google Cloud SDK to trigger the same initialization?**

4. **Are there any Terraform providers or other IaC tools that have solved this problem?**

5. **Is there a different API version (v1, v1beta1, v2beta1, admin/v1, etc.) that exposes initialization?**

6. **Could Identity Platform APIs (`identityplatform.googleapis.com`) provide an alternative approach?**

7. **Is there a way to create the configuration through Cloud Resource Manager or other GCP APIs?**

8. **What is the actual backend process that creates the Auth configuration, and can it be triggered programmatically?**

## Success Criteria

A solution that allows us to programmatically:
1. Initialize Firebase Authentication configuration
2. Enable email/password authentication provider
3. Do this without any manual Firebase Console interaction
4. Have the configuration accessible via the standard Identity Toolkit API

## Additional Context

- This is for an automated infrastructure deployment tool
- We've successfully automated Firebase Storage initialization
- Auth is the last remaining manual step preventing full automation
- The tool uses OAuth2 authentication with appropriate scopes
- All necessary APIs are enabled and permissions granted

## Test Environment

If you need to test solutions:
- Project ID: test0727-p2pc
- Project Number: 413554396880
- Region: us-central
- All Firebase APIs enabled
- Firebase project is active and configured

The goal is to find ANY programmatic way to initialize Firebase Authentication without manual console interaction.