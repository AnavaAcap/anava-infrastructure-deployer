#!/bin/bash

# --- Configuration ---
PROJECT_ID="test99-xahn" # Using the fresh test project
APP_NAME="Anava Internal Application"

echo "=== Testing IAP OAuth for Internal Application ==="
echo "Project: ${PROJECT_ID}"
echo "App Type: Internal (for organization use only)"
echo ""

echo "--- Step 0: Fetching Logged-In User's Identity ---"
# Automatically get the email and Google User ID of the logged-in gcloud user.
ADMIN_EMAIL=$(gcloud config get-value account)
ADMIN_GOOGLE_ID=$(gcloud auth print-identity-token --quiet 2>/dev/null | jq -r ".sub" 2>/dev/null || echo "")

if [ -z "${ADMIN_EMAIL}" ]; then
    echo "Error: Could not retrieve user email. Please run 'gcloud auth login' first."
    exit 1
fi

echo "Installer is running as: ${ADMIN_EMAIL}"
if [ -n "${ADMIN_GOOGLE_ID}" ]; then
    echo "Google User ID: ${ADMIN_GOOGLE_ID}"
else
    echo "Could not get Google User ID (will generate placeholder)"
    ADMIN_GOOGLE_ID=$(echo -n "${ADMIN_EMAIL}" | sha256sum | cut -c1-21)
fi

# Enable required APIs first
echo ""
echo "--- Enabling required APIs ---"
gcloud services enable iap.googleapis.com --project="${PROJECT_ID}"
gcloud services enable identitytoolkit.googleapis.com --project="${PROJECT_ID}"
echo "✅ APIs enabled"
sleep 3

echo ""
echo "--- Step 1: Creating IAP OAuth Consent Screen (Brand) ---"

# Check if brand already exists
EXISTING_BRANDS=$(gcloud alpha iap oauth-brands list --project="${PROJECT_ID}" --format=json 2>/dev/null || echo "[]")

if [ "$EXISTING_BRANDS" != "[]" ] && [ "$(echo "$EXISTING_BRANDS" | jq length)" -gt 0 ]; then
    echo "Found existing OAuth brand, deleting it first..."
    # Note: IAP brands can't actually be deleted via CLI, so we'll have to work with what exists
    BRAND_NAME=$(echo "$EXISTING_BRANDS" | jq -r '.[0].name')
    echo "Using existing brand: ${BRAND_NAME}"
    
    # Check if it's the right type
    APP_TYPE=$(echo "$EXISTING_BRANDS" | jq -r '.[0].applicationType // "unknown"')
    echo "Application type: ${APP_TYPE}"
else
    # Create new brand with correct parameters for internal use
    echo "Creating new IAP OAuth brand for internal application..."
    BRAND_NAME=$(gcloud alpha iap oauth-brands create \
      --project="${PROJECT_ID}" \
      --support_email="${ADMIN_EMAIL}" \
      --application_title="${APP_NAME}" \
      --format="value(name)" 2>&1)
    
    if [ $? -eq 0 ] && [ -n "$BRAND_NAME" ]; then
        echo "✅ Created Brand: ${BRAND_NAME}"
    else
        echo "❌ Error creating brand:"
        echo "$BRAND_NAME"
        
        # Check if it's already exists error
        if echo "$BRAND_NAME" | grep -q "already exists"; then
            echo "Brand already exists, fetching it..."
            EXISTING_BRANDS=$(gcloud alpha iap oauth-brands list --project="${PROJECT_ID}" --format=json)
            BRAND_NAME=$(echo "$EXISTING_BRANDS" | jq -r '.[0].name')
            echo "Using existing brand: ${BRAND_NAME}"
        else
            exit 1
        fi
    fi
fi

echo ""
echo "--- Step 2: Creating IAP OAuth Client ID and Secret ---"

# Check for existing clients first
EXISTING_CLIENTS=$(gcloud alpha iap oauth-clients list "${BRAND_NAME}" --project="${PROJECT_ID}" --format=json 2>/dev/null || echo "[]")

if [ "$EXISTING_CLIENTS" != "[]" ] && [ "$(echo "$EXISTING_CLIENTS" | jq length)" -gt 0 ]; then
    echo "Found existing OAuth clients:"
    CLIENT_ID=$(echo "$EXISTING_CLIENTS" | jq -r '.[0].clientId')
    echo "Using existing client: ${CLIENT_ID}"
    echo "Note: Cannot retrieve secret for existing client"
    CLIENT_SECRET=""
else
    CLIENT_JSON=$(gcloud alpha iap oauth-clients create "${BRAND_NAME}" \
      --display_name="Web Client for ${APP_NAME}" \
      --project="${PROJECT_ID}" \
      --format=json 2>&1)

    if [ $? -eq 0 ]; then
        CLIENT_ID=$(echo "${CLIENT_JSON}" | jq -r .clientId)
        CLIENT_SECRET=$(echo "${CLIENT_JSON}" | jq -r .secret)
        echo "✅ Created Client ID: ${CLIENT_ID}"
        echo "✅ Client Secret: [REDACTED]"
    else
        echo "❌ Error creating client:"
        echo "${CLIENT_JSON}"
        
        # If it's the "Internal" error, provide guidance
        if echo "${CLIENT_JSON}" | grep -q "Application type must be set to Internal"; then
            echo ""
            echo "⚠️  IMPORTANT: IAP OAuth requires 'Internal' application type"
            echo "This means the application is only for users within your Google Workspace organization"
            echo ""
            echo "To fix this:"
            echo "1. Your project must be associated with a Google Workspace organization"
            echo "2. The OAuth consent screen must be set to 'Internal' type"
            echo "3. Only users from your organization can authenticate"
            echo ""
            echo "If you need external users, you cannot use IAP OAuth approach"
        fi
        exit 1
    fi
fi

echo ""
echo "--- Step 3: Configuring Google Provider in Identity Platform ---"

# Get access token
ACCESS_TOKEN=$(gcloud auth print-access-token --quiet)

# First check if Identity Platform is configured
CONFIG_CHECK=$(curl -s -X GET \
    "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/config" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "x-goog-user-project: ${PROJECT_ID}")

if echo "$CONFIG_CHECK" | grep -q "CONFIGURATION_NOT_FOUND"; then
    echo "Identity Platform not configured. Initializing..."
    # Initialize it first
    INIT_RESPONSE=$(curl -s -X PATCH \
        "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/config?updateMask=signIn.email" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}" \
        -H "Content-Type: application/json" \
        -H "x-goog-user-project: ${PROJECT_ID}" \
        -d '{"signIn": {"email": {"enabled": true, "passwordRequired": true}}}')
    echo "Init response: $(echo $INIT_RESPONSE | jq -c '.')"
fi

# Now configure Google provider
if [ -n "${CLIENT_SECRET}" ]; then
    echo "Configuring Google Sign-In with IAP OAuth credentials..."
    PROVIDER_RESPONSE=$(curl -s -X POST \
        "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs?idpId=google.com" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}" \
        -H "Content-Type: application/json" \
        -H "x-goog-user-project: ${PROJECT_ID}" \
        -d "{
            \"enabled\": true,
            \"clientId\": \"${CLIENT_ID}\",
            \"clientSecret\": \"${CLIENT_SECRET}\"
        }")
    
    if echo "$PROVIDER_RESPONSE" | grep -q "error"; then
        echo "Error response:"
        echo "$PROVIDER_RESPONSE" | jq '.'
        
        # Try updating if it already exists
        echo "Trying to update existing configuration..."
        UPDATE_RESPONSE=$(curl -s -X PATCH \
            "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs/google.com?updateMask=enabled,clientId,clientSecret" \
            -H "Authorization: Bearer ${ACCESS_TOKEN}" \
            -H "Content-Type: application/json" \
            -H "x-goog-user-project: ${PROJECT_ID}" \
            -d "{
                \"enabled\": true,
                \"clientId\": \"${CLIENT_ID}\",
                \"clientSecret\": \"${CLIENT_SECRET}\"
            }")
        echo "Update response: $(echo $UPDATE_RESPONSE | jq -c '.')"
    else
        echo "✅ Successfully configured Google Sign-In provider"
    fi
else
    echo "⚠️  No client secret available, cannot configure provider"
fi

echo ""
echo "--- Step 4: Verifying Configuration ---"
FINAL_CHECK=$(curl -s -X GET \
    "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "x-goog-user-project: ${PROJECT_ID}")

echo "Current providers:"
echo "$FINAL_CHECK" | jq '.'

if echo "$FINAL_CHECK" | grep -q "google.com"; then
    echo ""
    echo "✅ Google Sign-In is configured!"
    echo ""
    echo "=== Next Steps for IAP Setup ==="
    echo "1. Configure IAP for your application:"
    echo "   gcloud iap web enable --resource-type=backend-services --project=${PROJECT_ID}"
    echo ""
    echo "2. Set up IAP access policies:"
    echo "   - Add authorized users/groups"
    echo "   - Configure access levels"
    echo ""
    echo "3. Your application will now:"
    echo "   - Require Google Sign-In for access"
    echo "   - Only allow users from your organization (Internal)"
    echo "   - Provide secure access to Firestore and Storage"
else
    echo "❌ Google Sign-In configuration failed"
fi

echo ""
echo "=== IAP vs Firebase Auth ==="
echo "IAP OAuth is designed for:"
echo "- Internal applications (organization users only)"
echo "- Protecting web applications behind a proxy"
echo "- Automatic authentication without SDK integration"
echo ""
echo "This is different from Firebase Auth which is for:"
echo "- Public-facing applications"
echo "- Mobile and web apps with SDK integration"
echo "- Multiple auth providers and custom flows"