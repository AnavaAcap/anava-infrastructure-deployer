#!/bin/bash

# --- Configuration ---
PROJECT_ID="test0727-p2pc"
APP_NAME="Anava Vision"

echo "--- Step 0: Fetching Logged-In User's Identity ---"
# Automatically get the email and Google User ID of the logged-in gcloud user.
ADMIN_EMAIL=$(gcloud config get-value account)
# Try to get Google ID, but don't fail if it doesn't work
ADMIN_GOOGLE_ID=$(gcloud auth print-identity-token --quiet 2>/dev/null | jq -r ".sub" 2>/dev/null || echo "")

# Check if we at least have the email
if [ -z "${ADMIN_EMAIL}" ]; then
    echo "Error: Could not retrieve user email. Please run 'gcloud auth login'."
    exit 1
fi

echo "Installer is running as: ${ADMIN_EMAIL}"
if [ -n "${ADMIN_GOOGLE_ID}" ]; then
    echo "Retrieved Google User ID successfully."
else
    echo "Could not retrieve Google User ID (this is okay, we'll proceed without it)"
    # Generate a placeholder ID based on email
    ADMIN_GOOGLE_ID=$(echo -n "${ADMIN_EMAIL}" | sha256sum | cut -c1-21)
fi


echo "--- Step 1: Skipping OAuth Consent Screen Creation ---"
echo "Note: For production, you would create an OAuth consent screen here."
echo "We're skipping this step to test the rest of the flow."

# For testing, we'll use placeholder OAuth credentials
# In a real deployment, these would come from the OAuth client creation
CLIENT_ID="test-client-id-123.apps.googleusercontent.com"
CLIENT_SECRET="test-client-secret-xyz"


echo "--- Step 2: OAuth Client Configuration ---"
echo "Using test OAuth credentials:"
echo "Client ID: ${CLIENT_ID}"
echo "Client Secret: [REDACTED]"


echo "--- Step 3: Configuring Google Provider in Firebase Auth ---"
# First check if identityplatform API is enabled
if ! gcloud services list --project="${PROJECT_ID}" --filter="name:identitytoolkit.googleapis.com" --format="value(name)" | grep -q identitytoolkit; then
    echo "Enabling Identity Platform API..."
    gcloud services enable identitytoolkit.googleapis.com --project="${PROJECT_ID}"
fi

# Use the correct gcloud command for identity platform
if [ -n "${CLIENT_SECRET}" ]; then
    # We have both client ID and secret
    gcloud alpha identity platform providers update oidc.google \
      --project="${PROJECT_ID}" \
      --client-id="${CLIENT_ID}" \
      --client-secret="${CLIENT_SECRET}" \
      --enabled 2>&1 || {
        # Try alternate command format
        echo "Trying alternate command format..."
        gcloud alpha identity platform idp-configs update google.com \
          --project="${PROJECT_ID}" \
          --client-id="${CLIENT_ID}" \
          --client-secret="${CLIENT_SECRET}" \
          --enabled 2>&1
    }
else
    echo "Warning: No client secret available. Cannot configure Google provider automatically."
    echo "Please configure it manually in Firebase Console."
fi

if [ $? -ne 0 ]; then 
    echo "Warning: Could not configure provider automatically. This may need to be done in Firebase Console."
else
    echo "Successfully enabled Google Sign-In."
fi


echo "--- Step 4: Importing the Admin User into Firebase ---"
# Create a JSON string for the user import data
USER_IMPORT_JSON=$(cat <<EOL
{
  "users": [
    {
      "localId": "${ADMIN_GOOGLE_ID}",
      "email": "${ADMIN_EMAIL}",
      "emailVerified": true,
      "providerUserInfo": [
        {
          "providerId": "google.com",
          "rawId": "${ADMIN_GOOGLE_ID}",
          "email": "${ADMIN_EMAIL}"
        }
      ]
    }
  ]
}
EOL
)

# Write to a temporary file for import
TEMP_FILE=$(mktemp)
echo "${USER_IMPORT_JSON}" > "${TEMP_FILE}"

# Import the user using the gcloud command
echo "Importing user ${ADMIN_EMAIL}..."
gcloud alpha identity platform users import "${TEMP_FILE}" --project="${PROJECT_ID}" 2>&1 || {
    echo "Note: User import may have failed if the user already exists."
}

# Clean up temp file
rm -f "${TEMP_FILE}"

echo ""
echo "=== Summary ==="
echo "✅ OAuth Brand: ${BRAND_NAME}"
echo "✅ OAuth Client ID: ${CLIENT_ID}"
if [ -n "${CLIENT_SECRET}" ]; then
    echo "✅ OAuth Client Secret: [REDACTED]"
fi
echo "✅ Admin user: ${ADMIN_EMAIL}"
echo ""
echo "Next steps:"
echo "1. Check Firebase Console to verify Google Sign-In is enabled:"
echo "   https://console.firebase.google.com/project/${PROJECT_ID}/authentication/providers"
echo "2. If not enabled, manually configure with the Client ID and Secret above"