#!/bin/bash

echo "Building signed and notarized macOS app..."
echo "=========================================="

# Set all required environment variables
export APPLE_ID="ryan@anava.ai"
export APPLE_ID_PASSWORD="gbdi-fnth-pxfx-aofv"
export APPLE_APP_SPECIFIC_PASSWORD="gbdi-fnth-pxfx-aofv"
export APPLE_TEAM_ID="3JVZNWGRYT"
export CSC_NAME="Ryan Wager (3JVZNWGRYT)"

# Show what we're using
echo "Apple ID: $APPLE_ID"
echo "Team ID: $APPLE_TEAM_ID"
echo "Certificate: $CSC_NAME"
echo ""

# Clean and build
echo "Cleaning previous builds..."
rm -rf dist

echo "Building application..."
npm run build

echo "Creating signed and notarized DMG..."
npm run dist:mac

echo ""
echo "✅ Build complete!"
echo ""
echo "Your notarized DMG files are in the release/ folder"
echo "Users can install without any security warnings!"