#!/bin/bash

PROJECT_ID="test99-xahn"
echo "=== Testing OAuth Setup on Fresh Project ==="
echo "Project: ${PROJECT_ID}"
echo ""

# Get access token
ACCESS_TOKEN=$(gcloud auth print-access-token)

# Step 1: Check current state - should be empty
echo "--- Step 1: Checking current Identity Platform providers ---"
PROVIDERS_BEFORE=$(curl -s -X GET \
    "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "x-goog-user-project: ${PROJECT_ID}")

echo "Current providers:"
echo "$PROVIDERS_BEFORE" | jq '.'

# Step 2: Check if Identity Platform is even configured
echo ""
echo "--- Step 2: Checking Identity Platform Configuration ---"
CONFIG_CHECK=$(curl -s -X GET \
    "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/config" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "x-goog-user-project: ${PROJECT_ID}")

if echo "$CONFIG_CHECK" | grep -q "CONFIGURATION_NOT_FOUND"; then
    echo "❌ Identity Platform not configured yet"
    echo "Need to enable Firebase/Identity Platform first"
    
    # Enable required APIs
    echo ""
    echo "--- Enabling required APIs ---"
    gcloud services enable firebase.googleapis.com --project="${PROJECT_ID}"
    gcloud services enable identitytoolkit.googleapis.com --project="${PROJECT_ID}"
    sleep 5
else
    echo "✅ Identity Platform is already configured"
fi

# Step 3: Try to enable Google provider WITHOUT providing OAuth credentials
echo ""
echo "--- Step 3: Attempting to enable Google provider without OAuth credentials ---"

# Try with minimal payload - just enable it
ENABLE_PAYLOAD='{"enabled": true}'

ENABLE_RESPONSE=$(curl -s -X POST \
    "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs?idpId=google.com" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -H "x-goog-user-project: ${PROJECT_ID}" \
    -d "${ENABLE_PAYLOAD}")

echo "Response:"
echo "$ENABLE_RESPONSE" | jq '.'

# Step 4: Check if OAuth credentials were auto-created
echo ""
echo "--- Step 4: Checking if OAuth credentials were automatically created ---"
PROVIDERS_AFTER=$(curl -s -X GET \
    "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "x-goog-user-project: ${PROJECT_ID}")

echo "Providers after enabling Google:"
echo "$PROVIDERS_AFTER" | jq '.'

# Check if client ID was auto-generated
if echo "$PROVIDERS_AFTER" | grep -q "clientId"; then
    CLIENT_ID=$(echo "$PROVIDERS_AFTER" | jq -r '.defaultSupportedIdpConfigs[] | select(.name | contains("google.com")) | .clientId')
    echo ""
    echo "✅ SUCCESS! OAuth client was automatically created!"
    echo "Client ID: ${CLIENT_ID}"
    
    # Check if this matches a pattern for auto-generated Firebase OAuth clients
    if echo "$CLIENT_ID" | grep -q "firebaseapp.com"; then
        echo "This appears to be a Firebase-generated OAuth client!"
    fi
fi

# Step 5: List all OAuth clients in the project to understand what was created
echo ""
echo "--- Step 5: Checking OAuth 2.0 credentials in the project ---"
echo "Checking if any OAuth clients exist in the project..."

# This would need to use the OAuth2 API to list clients
# For now, we'll check via Firebase config

echo ""
echo "=== Summary ==="
echo "Test complete. Check the results above to see if Firebase auto-creates OAuth credentials."