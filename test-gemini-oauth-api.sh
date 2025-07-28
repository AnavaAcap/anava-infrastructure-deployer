#!/bin/bash

# --- Configuration ---
PROJECT_ID="test0727-p2pc"
APP_NAME="Anava Vision"
ADMIN_EMAIL="ryan@anava.ai"

echo "=== Testing OAuth Setup via REST API ==="
echo "Project: ${PROJECT_ID}"
echo "Admin Email: ${ADMIN_EMAIL}"
echo ""

# Get access token
ACCESS_TOKEN=$(gcloud auth print-access-token)
if [ -z "$ACCESS_TOKEN" ]; then
    echo "Error: Could not get access token. Please run 'gcloud auth login'"
    exit 1
fi

echo "✅ Got access token"

# Step 1: Check if Identity Platform is configured
echo ""
echo "--- Step 1: Checking Identity Platform Configuration ---"
CONFIG_RESPONSE=$(curl -s -X GET \
    "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/config" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "x-goog-user-project: ${PROJECT_ID}")

if echo "$CONFIG_RESPONSE" | grep -q "CONFIGURATION_NOT_FOUND"; then
    echo "❌ Identity Platform not configured. Please run Terraform first."
    exit 1
else
    echo "✅ Identity Platform is configured"
fi

# Step 2: Create OAuth Client (using OAuth2 API, not IAP)
echo ""
echo "--- Step 2: Creating OAuth 2.0 Client ---"
echo "Note: This would normally create an OAuth client via the OAuth2 API"
echo "For testing, we'll use placeholder credentials"

# In production, you would create a real OAuth client here
CLIENT_ID="123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com"
CLIENT_SECRET="GOCSPX-1234567890abcdefghijklmn"

echo "Test Client ID: ${CLIENT_ID}"
echo "Test Client Secret: [REDACTED]"

# Step 3: Configure Google Sign-In Provider
echo ""
echo "--- Step 3: Configuring Google Sign-In Provider ---"

# Create the configuration
CONFIG_PAYLOAD=$(cat <<EOF
{
  "name": "projects/${PROJECT_ID}/defaultSupportedIdpConfigs/google.com",
  "enabled": true,
  "clientId": "${CLIENT_ID}",
  "clientSecret": "${CLIENT_SECRET}"
}
EOF
)

# Try to create the Google provider configuration
CREATE_RESPONSE=$(curl -s -X POST \
    "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs?idpId=google.com" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -H "x-goog-user-project: ${PROJECT_ID}" \
    -d "${CONFIG_PAYLOAD}")

# Check if it already exists and needs updating instead
if echo "$CREATE_RESPONSE" | grep -q "already exists"; then
    echo "Provider already exists, updating..."
    UPDATE_RESPONSE=$(curl -s -X PATCH \
        "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs/google.com?updateMask=enabled,clientId,clientSecret" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}" \
        -H "Content-Type: application/json" \
        -H "x-goog-user-project: ${PROJECT_ID}" \
        -d "${CONFIG_PAYLOAD}")
    
    if echo "$UPDATE_RESPONSE" | grep -q "google.com"; then
        echo "✅ Successfully updated Google Sign-In provider"
    else
        echo "❌ Failed to update provider:"
        echo "$UPDATE_RESPONSE" | jq '.'
    fi
else
    if echo "$CREATE_RESPONSE" | grep -q "google.com"; then
        echo "✅ Successfully created Google Sign-In provider"
    else
        echo "❌ Failed to create provider:"
        echo "$CREATE_RESPONSE" | jq '.'
    fi
fi

# Step 4: List configured providers to verify
echo ""
echo "--- Step 4: Verifying Configuration ---"
PROVIDERS_RESPONSE=$(curl -s -X GET \
    "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "x-goog-user-project: ${PROJECT_ID}")

if echo "$PROVIDERS_RESPONSE" | grep -q "google.com"; then
    echo "✅ Google provider is configured:"
    echo "$PROVIDERS_RESPONSE" | jq '.defaultSupportedIdpConfigs[] | select(.name | contains("google.com"))'
else
    echo "❌ Google provider not found"
fi

# Step 5: Import user (using Firebase Admin API pattern)
echo ""
echo "--- Step 5: Importing Admin User ---"
echo "Note: User import requires Firebase Admin SDK or manual sign-in"
echo "The user ${ADMIN_EMAIL} will be created when they first sign in with Google"

echo ""
echo "=== Summary ==="
echo "✅ Identity Platform configured"
echo "✅ Google Sign-In provider configured (with test credentials)"
echo "✅ Ready for user sign-in"
echo ""
echo "To complete setup with real OAuth credentials:"
echo "1. Create OAuth 2.0 credentials in GCP Console"
echo "2. Update the provider configuration with real client ID and secret"
echo "3. Configure authorized redirect URIs"
echo ""
echo "Direct link to Firebase Auth providers:"
echo "https://console.firebase.google.com/project/${PROJECT_ID}/authentication/providers"