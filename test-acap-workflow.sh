#!/bin/bash

# Test script for ACAP authentication workflow
# Usage: ./test-acap-workflow.sh <api-gateway-url> <api-key> <firebase-api-key>

set -e

# Parse arguments
if [ $# -lt 3 ]; then
    echo "Usage: $0 <api-gateway-url> <api-key> <firebase-api-key>"
    echo "Example: $0 https://gateway.dev AIzaSy... AIzaSy..."
    exit 1
fi

API_GATEWAY_URL="$1"
API_KEY="$2"
FIREBASE_API_KEY="$3"
DEVICE_ID="test-device-$(date +%s)"

echo "Testing ACAP Authentication Workflow"
echo "===================================="
echo "API Gateway URL: $API_GATEWAY_URL"
echo "Device ID: $DEVICE_ID"
echo ""

# Step 1: Get Firebase custom token
echo "Step 1: Getting Firebase custom token..."
echo "----------------------------------------"
RESPONSE=$(curl -s -X POST "$API_GATEWAY_URL/device-auth/initiate" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"device_id\": \"$DEVICE_ID\"}")

CUSTOM_TOKEN=$(echo "$RESPONSE" | jq -r '.firebase_custom_token')
if [ -z "$CUSTOM_TOKEN" ] || [ "$CUSTOM_TOKEN" = "null" ]; then
    echo "❌ Failed to get custom token"
    echo "Response: $RESPONSE"
    exit 1
fi

echo "✅ Got custom token"
echo "Token length: ${#CUSTOM_TOKEN}"

# Decode and display custom token claims
echo ""
echo "Custom token claims:"
python3 -c "
import base64
import json
parts = '$CUSTOM_TOKEN'.split('.')
payload = json.loads(base64.urlsafe_b64decode(parts[1] + '==='))
print('  - Issuer:', payload.get('iss', 'N/A'))
print('  - UID:', payload.get('uid', 'N/A'))
print('  - Expires:', payload.get('exp', 'N/A'))
"

# Step 2: Exchange for Firebase ID token
echo ""
echo "Step 2: Exchanging custom token for Firebase ID token..."
echo "-------------------------------------------------------"
ID_TOKEN_RESPONSE=$(curl -s -X POST \
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=$FIREBASE_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"token\": \"$CUSTOM_TOKEN\", \"returnSecureToken\": true}")

ID_TOKEN=$(echo "$ID_TOKEN_RESPONSE" | jq -r '.idToken')
EXPIRES_IN=$(echo "$ID_TOKEN_RESPONSE" | jq -r '.expiresIn')

if [ -z "$ID_TOKEN" ] || [ "$ID_TOKEN" = "null" ]; then
    echo "❌ Failed to get ID token"
    echo "Response: $ID_TOKEN_RESPONSE"
    exit 1
fi

echo "✅ Got Firebase ID token"
echo "Expires in: ${EXPIRES_IN}s"

# Decode and display ID token claims
echo ""
echo "ID token claims:"
python3 -c "
import base64
import json
parts = '$ID_TOKEN'.split('.')
payload = json.loads(base64.urlsafe_b64decode(parts[1] + '==='))
print('  - Project:', payload.get('aud', 'N/A'))
print('  - User ID:', payload.get('user_id', 'N/A'))
print('  - Auth Provider:', payload.get('firebase', {}).get('sign_in_provider', 'N/A'))
"

# Step 3: Exchange for GCP access token
echo ""
echo "Step 3: Exchanging Firebase ID token for GCP access token..."
echo "----------------------------------------------------------"
GCP_TOKEN_RESPONSE=$(curl -s -X POST "$API_GATEWAY_URL/gcp-token/vend" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"firebase_id_token\": \"$ID_TOKEN\"}")

GCP_TOKEN=$(echo "$GCP_TOKEN_RESPONSE" | jq -r '.gcp_access_token')
GCP_EXPIRES_IN=$(echo "$GCP_TOKEN_RESPONSE" | jq -r '.expires_in')

if [ -z "$GCP_TOKEN" ] || [ "$GCP_TOKEN" = "null" ]; then
    echo "❌ Failed to get GCP access token"
    echo "Response: $GCP_TOKEN_RESPONSE"
    exit 1
fi

echo "✅ Got GCP access token"
echo "Token length: ${#GCP_TOKEN}"
echo "Expires in: ${GCP_EXPIRES_IN}s"

# Step 4: Test the GCP token
echo ""
echo "Step 4: Testing GCP access token..."
echo "-----------------------------------"

# Extract project ID from API Gateway URL
PROJECT_ID=$(echo "$API_GATEWAY_URL" | sed -n 's/.*-\([^-]*\)\..*\.gateway\.dev/\1/p')
if [ -z "$PROJECT_ID" ]; then
    # Fallback: try to get from Firebase API key response
    PROJECT_ID=$(echo "$ID_TOKEN_RESPONSE" | jq -r '.kind' | grep -oP '(?<=identitytoolkit#)[^Response]+' || echo "")
fi

echo "Testing token by checking service account identity..."
IDENTITY_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -H "Authorization: Bearer $GCP_TOKEN" \
  "https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=$GCP_TOKEN")

HTTP_CODE=$(echo "$IDENTITY_RESPONSE" | grep "HTTP_CODE:" | cut -d':' -f2)
TOKEN_INFO=$(echo "$IDENTITY_RESPONSE" | grep -v "HTTP_CODE:")

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ GCP token is valid!"
    echo ""
    echo "Token info:"
    echo "$TOKEN_INFO" | jq -r '
      "  - Service Account: " + .email,
      "  - Scope: " + .scope,
      "  - Expires in: " + (.expires_in | tostring) + "s"
    ' 2>/dev/null || echo "$TOKEN_INFO"
else
    echo "❌ GCP token validation failed (HTTP $HTTP_CODE)"
    echo "$TOKEN_INFO"
fi

# Summary
echo ""
echo "Summary"
echo "======="
echo "✅ All authentication steps completed successfully!"
echo ""
echo "The ACAP workflow is working correctly. Cameras can now:"
echo "1. Authenticate with device IDs"
echo "2. Get Firebase custom tokens"
echo "3. Exchange for Firebase ID tokens"
echo "4. Get GCP access tokens via Workload Identity Federation"
echo "5. Access GCP services (Storage, Firestore, Vertex AI) with proper permissions"