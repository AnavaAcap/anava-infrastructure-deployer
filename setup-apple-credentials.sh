#!/bin/bash

echo "Setting up Apple credentials for code signing..."
echo "=============================================="

# Your app-specific password
APP_SPECIFIC_PASSWORD="gbdi-fnth-pxfx-aofv"

# Prompt for Apple ID
echo -n "Enter your Apple ID email: "
read APPLE_ID

# Create/update .env.local
cat > .env.local << EOF
# Apple Developer Credentials for Code Signing
# DO NOT COMMIT THIS FILE TO GIT!

# Your Apple ID email
APPLE_ID=$APPLE_ID

# App-specific password from appleid.apple.com
APPLE_ID_PASSWORD=$APP_SPECIFIC_PASSWORD

# Your Team ID (from certificate)
APPLE_TEAM_ID=3JVZNWGRYT

# Certificate name
CSC_NAME=Developer ID Application: Ryan Wager (3JVZNWGRYT)
EOF

echo ""
echo "✅ Credentials saved to .env.local"
echo ""
echo "Ready to build signed app! Run:"
echo "  ./build-signed-mac.sh"