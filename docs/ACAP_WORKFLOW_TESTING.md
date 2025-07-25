# ACAP Workflow Testing Guide

This document describes how to test the Axis Camera Application Platform (ACAP) authentication workflow that was deployed by the Anava Infrastructure Deployer.

## Overview

The ACAP workflow implements a three-step authentication process that allows Axis cameras to securely access Google Cloud Platform services:

1. **Device Authentication**: Camera obtains a Firebase custom token from the API Gateway
2. **Firebase Authentication**: Camera exchanges the custom token for a Firebase ID token
3. **Token Vending**: Camera exchanges the Firebase ID token for a GCP access token via Workload Identity Federation

## Prerequisites

Before testing, ensure you have:
- The deployment output JSON file with API Gateway URL and API keys
- `curl` and `jq` installed for testing
- A device ID (any unique identifier for testing)

## Step-by-Step Testing Process

### Step 1: Device Authentication

The camera first calls the device authentication endpoint to get a Firebase custom token:

```bash
curl -X POST "https://YOUR-GATEWAY-URL/device-auth/initiate" \
  -H "x-api-key: YOUR-API-KEY" \
  -H "Content-Type: application/json" \
  -d '{"device_id": "test-device-001"}' | jq .
```

Expected response:
```json
{
  "firebase_custom_token": "eyJhbGciOiAiUlMyNTYi..."
}
```

The custom token is a JWT signed by the `device-auth-sa` service account and contains:
- `uid`: The device ID
- `iss/sub`: The service account email
- `aud`: Firebase Identity Toolkit audience
- `exp`: Expiration time (1 hour)

### Step 2: Exchange Custom Token for Firebase ID Token

Next, exchange the custom token for a Firebase ID token using the Firebase Web API:

```bash
CUSTOM_TOKEN="<token-from-step-1>"
FIREBASE_API_KEY="<firebase-web-api-key-from-deployment>"

curl -X POST "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=$FIREBASE_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"token\": \"$CUSTOM_TOKEN\",
    \"returnSecureToken\": true
  }" | jq .
```

Expected response:
```json
{
  "kind": "identitytoolkit#VerifyCustomTokenResponse",
  "idToken": "eyJhbGciOiJSUzI1NiI...",
  "refreshToken": "AMf-vBz...",
  "expiresIn": "3600",
  "isNewUser": false
}
```

### Step 3: Exchange Firebase ID Token for GCP Access Token

Finally, call the token vending machine to get a GCP access token:

```bash
FIREBASE_ID_TOKEN="<id-token-from-step-2>"

curl -X POST "https://YOUR-GATEWAY-URL/gcp-token/vend" \
  -H "x-api-key: YOUR-API-KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"firebase_id_token\": \"$FIREBASE_ID_TOKEN\"
  }" | jq .
```

Expected response:
```json
{
  "gcp_access_token": "ya29.c.c0ASRK0Ga...",
  "expires_in": 3577
}
```

## Complete Test Script

Here's a complete script that tests the entire workflow:

```bash
#!/bin/bash

# Configuration from deployment output
API_GATEWAY_URL="https://YOUR-GATEWAY-URL"
API_KEY="YOUR-API-KEY"
FIREBASE_API_KEY="YOUR-FIREBASE-API-KEY"
DEVICE_ID="test-device-$(date +%s)"

echo "Testing ACAP Authentication Workflow"
echo "===================================="
echo "Device ID: $DEVICE_ID"

# Step 1: Get Firebase custom token
echo -e "\n1. Getting Firebase custom token..."
CUSTOM_TOKEN=$(curl -s -X POST "$API_GATEWAY_URL/device-auth/initiate" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"device_id\": \"$DEVICE_ID\"}" | jq -r '.firebase_custom_token')

if [ -z "$CUSTOM_TOKEN" ] || [ "$CUSTOM_TOKEN" = "null" ]; then
    echo "❌ Failed to get custom token"
    exit 1
fi
echo "✅ Got custom token (length: ${#CUSTOM_TOKEN})"

# Step 2: Exchange for Firebase ID token
echo -e "\n2. Exchanging custom token for Firebase ID token..."
ID_TOKEN_RESPONSE=$(curl -s -X POST \
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=$FIREBASE_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"token\": \"$CUSTOM_TOKEN\", \"returnSecureToken\": true}")

ID_TOKEN=$(echo "$ID_TOKEN_RESPONSE" | jq -r '.idToken')
if [ -z "$ID_TOKEN" ] || [ "$ID_TOKEN" = "null" ]; then
    echo "❌ Failed to get ID token"
    echo "$ID_TOKEN_RESPONSE" | jq .
    exit 1
fi
echo "✅ Got Firebase ID token (expires in: $(echo "$ID_TOKEN_RESPONSE" | jq -r '.expiresIn')s)"

# Step 3: Exchange for GCP access token
echo -e "\n3. Exchanging Firebase ID token for GCP access token..."
GCP_TOKEN_RESPONSE=$(curl -s -X POST "$API_GATEWAY_URL/gcp-token/vend" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"firebase_id_token\": \"$ID_TOKEN\"}")

GCP_TOKEN=$(echo "$GCP_TOKEN_RESPONSE" | jq -r '.gcp_access_token')
EXPIRES_IN=$(echo "$GCP_TOKEN_RESPONSE" | jq -r '.expires_in')

if [ -z "$GCP_TOKEN" ] || [ "$GCP_TOKEN" = "null" ]; then
    echo "❌ Failed to get GCP access token"
    echo "$GCP_TOKEN_RESPONSE" | jq .
    exit 1
fi
echo "✅ Got GCP access token (expires in: ${EXPIRES_IN}s)"

# Test the GCP token by calling a GCP API
echo -e "\n4. Testing GCP access token..."
PROJECT_ID=$(echo "$API_GATEWAY_URL" | grep -oP '(?<=-)[\w-]+(?=-\w+\.uc\.gateway\.dev)')
BUCKET_TEST=$(curl -s -H "Authorization: Bearer $GCP_TOKEN" \
  "https://storage.googleapis.com/storage/v1/b?project=$PROJECT_ID" \
  --write-out "\n%{http_code}" --output -)

HTTP_CODE=$(echo "$BUCKET_TEST" | tail -1)
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ GCP token is valid! Successfully listed storage buckets"
else
    echo "❌ GCP token test failed (HTTP $HTTP_CODE)"
fi

echo -e "\n✅ All authentication steps completed successfully!"
```

## How Cameras Use This Workflow

In the actual ACAP application (from batonDescribe repo), the `Gemini::getFreshGcpAccessToken()` method implements this workflow:

1. **Token Worker Thread**: Runs continuously, refreshing tokens before they expire
2. **Caching**: Tokens are cached and only refreshed when needed
3. **Error Handling**: Automatic retries with exponential backoff
4. **Thread Safety**: Mutex protection for concurrent access

The camera code flow:
```cpp
// Called by TokenWorker thread or on-demand
std::string Gemini::getFreshGcpAccessToken() {
    // Check cached token
    if (tokenStillValid) return m_gcpAccessToken;
    
    // Step 1: Get custom token
    std::string customToken = fetchFirebaseCustomToken();
    
    // Step 2: Exchange for ID token  
    FirebaseIdTokenInfo idToken = exchangeCustomTokenForIdToken(customToken);
    
    // Step 3: Exchange for GCP token
    GcpAccessTokenInfo gcpToken = exchangeFirebaseIdTokenForGcpToken(idToken.id_token);
    
    // Cache and return
    m_gcpAccessToken = gcpToken.access_token;
    return m_gcpAccessToken;
}
```

## Troubleshooting

### Common Issues

1. **401 Unauthorized from API Gateway**
   - Check API key is correct
   - Verify API Gateway is enabled
   - Check service account permissions

2. **"Service account does not exist" errors**
   - Wait a few minutes after deployment for IAM propagation
   - Verify service accounts were created successfully

3. **Token exchange fails**
   - Ensure Firebase Authentication is enabled
   - Check Workload Identity Federation configuration
   - Verify service account has correct roles

### Debug Commands

Check API Gateway logs:
```bash
gcloud logging read "resource.type=api_gateway" --limit=50 --format=json | jq .
```

Check Cloud Function logs:
```bash
# Device auth function
gcloud functions logs read device-auth --limit=50

# Token vending machine
gcloud functions logs read token-vending-machine --limit=50
```

Verify service account permissions:
```bash
PROJECT_ID="your-project-id"

# Check vertex-ai-sa permissions
gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:vertex-ai-sa@" \
  --format="table(bindings.role)"
```

## Security Considerations

1. **API Keys**: Should be kept secret and rotated regularly
2. **Device IDs**: Should be unique per camera
3. **Token Expiration**: Tokens expire in 1 hour, cameras must refresh
4. **Network Security**: All communication uses HTTPS
5. **Audit Logging**: All API calls are logged in Cloud Logging

## Next Steps

After verifying the authentication workflow:
1. Test uploading images to Cloud Storage using the GCP token
2. Test writing to Firestore
3. Test calling Vertex AI for image analysis
4. Monitor token refresh cycles in camera logs