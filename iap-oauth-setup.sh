#!/bin/bash

# IAP OAuth Setup for Internal Firebase Applications
# This script automates Google Sign-In configuration for internal apps

set -e  # Exit on error

# --- Configuration ---
PROJECT_ID="${1:-test99-xahn}"
APP_NAME="${2:-Internal Application}"

echo "=== IAP OAuth Setup for Internal Application ==="
echo "Project: ${PROJECT_ID}"
echo "Application: ${APP_NAME}"
echo ""

# Get admin email
ADMIN_EMAIL=$(gcloud config get-value account)
if [ -z "${ADMIN_EMAIL}" ]; then
    echo "Error: Not logged in. Please run 'gcloud auth login' first."
    exit 1
fi
echo "Admin: ${ADMIN_EMAIL}"
echo ""

# Enable required APIs
echo "--- Enabling Required APIs ---"
gcloud services enable iap.googleapis.com identitytoolkit.googleapis.com firebase.googleapis.com \
    --project="${PROJECT_ID}" --quiet
echo "✅ APIs enabled"
sleep 3

# Step 1: Create or get IAP OAuth brand
echo ""
echo "--- Step 1: IAP OAuth Brand ---"
EXISTING_BRANDS=$(gcloud alpha iap oauth-brands list --project="${PROJECT_ID}" --format=json --quiet 2>/dev/null || echo "[]")

if [ "$EXISTING_BRANDS" != "[]" ] && [ "$(echo "$EXISTING_BRANDS" | jq length)" -gt 0 ]; then
    BRAND_NAME=$(echo "$EXISTING_BRANDS" | jq -r '.[0].name')
    echo "✅ Using existing brand: ${BRAND_NAME}"
else
    echo "Creating new IAP OAuth brand..."
    BRAND_NAME=$(gcloud alpha iap oauth-brands create \
        --project="${PROJECT_ID}" \
        --support_email="${ADMIN_EMAIL}" \
        --application_title="${APP_NAME}" \
        --format="value(name)" \
        --quiet)
    echo "✅ Created brand: ${BRAND_NAME}"
fi

# Step 2: Create IAP OAuth client
echo ""
echo "--- Step 2: Creating OAuth Client ---"
CLIENT_OUTPUT=$(gcloud alpha iap oauth-clients create "${BRAND_NAME}" \
    --display_name="${APP_NAME} OAuth Client" \
    --project="${PROJECT_ID}" \
    --format=json \
    --quiet)

CLIENT_ID=$(echo "${CLIENT_OUTPUT}" | jq -r '.name' | rev | cut -d'/' -f1 | rev)
CLIENT_SECRET=$(echo "${CLIENT_OUTPUT}" | jq -r '.secret')

echo "✅ Created OAuth client"
echo "   Client ID: ${CLIENT_ID}"

# Step 3: Configure Google Sign-In in Identity Platform
echo ""
echo "--- Step 3: Configuring Google Sign-In ---"
ACCESS_TOKEN=$(gcloud auth print-access-token --quiet)

# Ensure Identity Platform is initialized
curl -s -X PATCH \
    "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/config?updateMask=signIn.email" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -H "x-goog-user-project: ${PROJECT_ID}" \
    -d '{"signIn": {"email": {"enabled": true, "passwordRequired": true}}}' > /dev/null 2>&1

# Configure Google provider
RESPONSE=$(curl -s -X POST \
    "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs?idpId=google.com" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -H "x-goog-user-project: ${PROJECT_ID}" \
    -d "{
        \"enabled\": true,
        \"clientId\": \"${CLIENT_ID}\",
        \"clientSecret\": \"${CLIENT_SECRET}\"
    }")

if echo "$RESPONSE" | grep -q "error"; then
    # Try updating if exists
    curl -s -X PATCH \
        "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs/google.com?updateMask=enabled,clientId,clientSecret" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}" \
        -H "Content-Type: application/json" \
        -H "x-goog-user-project: ${PROJECT_ID}" \
        -d "{
            \"enabled\": true,
            \"clientId\": \"${CLIENT_ID}\",
            \"clientSecret\": \"${CLIENT_SECRET}\"
        }" > /dev/null 2>&1
fi

echo "✅ Google Sign-In configured"

# Step 4: Output configuration
echo ""
echo "=== Configuration Complete ==="
echo ""
echo "OAuth Configuration:"
echo "  Client ID: ${CLIENT_ID}"
echo "  Client Secret: ${CLIENT_SECRET}"
echo "  Brand: ${BRAND_NAME}"
echo ""
echo "Identity Platform:"
echo "  Google Sign-In: Enabled"
echo "  Access: Internal users only (${ADMIN_EMAIL#*@} domain)"
echo ""
echo "Next Steps:"
echo "1. Users from your organization can now sign in with Google"
echo "2. Configure IAP if you want to protect the app at the proxy level"
echo "3. Use Firebase SDK with these OAuth credentials in your app"
echo ""
echo "✅ Setup complete!"