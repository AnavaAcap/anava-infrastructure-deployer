#!/bin/bash

PROJECT_ID="test99-xahn"
echo "=== Testing: Initialize Auth FIRST, then Enable Google ==="
echo "Project: ${PROJECT_ID}"
echo "Hypothesis: Enabling Google provider AFTER auth is initialized might auto-create OAuth"
echo ""

ACCESS_TOKEN=$(gcloud auth print-access-token)
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")

# Step 1: First, make sure Identity Platform is properly initialized
echo "--- Step 1: Initializing Identity Platform ---"

# Check current state
CONFIG_CHECK=$(curl -s -X GET \
    "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/config" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "x-goog-user-project: ${PROJECT_ID}")

if echo "$CONFIG_CHECK" | grep -q "CONFIGURATION_NOT_FOUND"; then
    echo "Creating Identity Platform configuration..."
    
    # Initialize with basic config
    INIT_CONFIG=$(cat <<EOF
{
  "autodeleteAnonymousUsers": true,
  "signIn": {
    "email": {
      "enabled": true,
      "passwordRequired": true
    }
  },
  "authorizedDomains": [
    "${PROJECT_ID}.firebaseapp.com",
    "localhost"
  ]
}
EOF
)
    
    INIT_RESPONSE=$(curl -s -X PATCH \
        "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/config?updateMask=signIn.email,autodeleteAnonymousUsers,authorizedDomains" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}" \
        -H "Content-Type: application/json" \
        -H "x-goog-user-project: ${PROJECT_ID}" \
        -d "${INIT_CONFIG}")
    
    echo "Init response:"
    echo "$INIT_RESPONSE" | jq '.'
    
    # Wait for it to propagate
    sleep 3
else
    echo "✅ Identity Platform already configured"
fi

# Step 2: NOW try to enable Google provider without providing OAuth credentials
echo ""
echo "--- Step 2: Enabling Google Provider (without OAuth credentials) ---"
echo "Testing if Firebase auto-creates OAuth when auth is already initialized..."

# Try with minimal payload
ENABLE_RESPONSE=$(curl -s -X POST \
    "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs?idpId=google.com" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -H "x-goog-user-project: ${PROJECT_ID}" \
    -d '{"enabled": true}')

echo "Response:"
echo "$ENABLE_RESPONSE" | jq '.'

# Step 3: If that didn't work, try different variations
if echo "$ENABLE_RESPONSE" | grep -q "client_id cannot be empty"; then
    echo ""
    echo "--- Step 3: Trying alternative approaches ---"
    
    # Try with empty strings (sometimes APIs auto-fill)
    echo "Attempt 1: Empty string client credentials..."
    ATTEMPT1=$(curl -s -X POST \
        "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs?idpId=google.com" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}" \
        -H "Content-Type: application/json" \
        -H "x-goog-user-project: ${PROJECT_ID}" \
        -d '{"enabled": true, "clientId": "", "clientSecret": ""}')
    echo "$ATTEMPT1" | jq '.'
    
    # Try with project-based placeholder
    echo ""
    echo "Attempt 2: Project-based placeholder..."
    ATTEMPT2=$(curl -s -X POST \
        "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs?idpId=google.com" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}" \
        -H "Content-Type: application/json" \
        -H "x-goog-user-project: ${PROJECT_ID}" \
        -d "{\"enabled\": true, \"clientId\": \"${PROJECT_NUMBER}-default.apps.googleusercontent.com\", \"clientSecret\": \"default\"}")
    echo "$ATTEMPT2" | jq '.'
fi

# Step 4: Check final state
echo ""
echo "--- Step 4: Checking Final State ---"
FINAL_PROVIDERS=$(curl -s -X GET \
    "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "x-goog-user-project: ${PROJECT_ID}")

echo "Final providers configuration:"
echo "$FINAL_PROVIDERS" | jq '.'

if echo "$FINAL_PROVIDERS" | grep -q "google.com"; then
    echo ""
    echo "✅ Google provider is configured!"
    CLIENT_ID=$(echo "$FINAL_PROVIDERS" | jq -r '.defaultSupportedIdpConfigs[] | select(.name | contains("google.com")) | .clientId')
    echo "Client ID: $CLIENT_ID"
    
    # Check if it's auto-generated
    if [[ "$CLIENT_ID" == "${PROJECT_NUMBER}"* ]]; then
        echo "🎉 This appears to be an auto-generated OAuth client!"
    fi
else
    echo ""
    echo "❌ Google provider was not enabled"
    echo ""
    echo "CONCLUSION: Firebase does NOT auto-create OAuth credentials"
    echo "The API strictly requires valid OAuth client ID and secret"
fi

# Step 5: One more check - see if Firebase Console API does something different
echo ""
echo "--- Step 5: Checking how Firebase Console might do it ---"
echo "Looking for any other APIs or hidden endpoints..."

# Check if there's a Firebase-specific endpoint
FIREBASE_AUTH_CONFIG=$(curl -s -X GET \
    "https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "x-goog-user-project: ${PROJECT_ID}" 2>/dev/null || echo "{}")

if echo "$FIREBASE_AUTH_CONFIG" | grep -q "projectId"; then
    echo "Firebase project config exists"
fi

echo ""
echo "=== Final Analysis ==="
echo "Based on all tests, it appears that:"
echo "1. The Identity Platform API requires valid OAuth credentials"
echo "2. Firebase does NOT auto-create these credentials"
echo "3. The OAuth client in test0727-p2pc was likely created:"
echo "   - Manually through GCP Console"
echo "   - By clicking 'Enable' in Firebase Console (which creates OAuth behind the scenes)"
echo "   - Through some other initialization process we haven't discovered yet"