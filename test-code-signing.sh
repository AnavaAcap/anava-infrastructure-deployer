#!/bin/bash

echo "Testing code signing (without notarization)..."
echo "============================================="

# Load credentials
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
fi

# Show what we're using
echo "Team ID: $APPLE_TEAM_ID"
echo "Certificate: $CSC_NAME"
echo ""

# First, let's just test code signing without notarization
echo "Building without notarization (faster test)..."
CSC_NAME="Developer ID Application: Ryan Wager (3JVZNWGRYT)" \
CSC_IDENTITY_AUTO_DISCOVERY=false \
npm run dist:mac

echo ""
echo "Build complete! Check release/ folder for the .dmg file"
echo ""
echo "To verify signing, run:"
echo "  codesign -dv --verbose=4 release/*.dmg"