#!/bin/bash

echo "Building signed macOS app..."

# Load environment variables if .env.local exists
if [ -f .env.local ]; then
    while IFS='=' read -r key value
    do
        # Skip comments and empty lines
        if [[ ! "$key" =~ ^# ]] && [[ -n "$key" ]]; then
            # Remove any surrounding quotes from value
            value="${value%\"}"
            value="${value#\"}"
            export "$key=$value"
        fi
    done < .env.local
fi

# Set Team ID (we know this from your certificate)
export APPLE_TEAM_ID="3JVZNWGRYT"

# Check if environment variables are set
if [ -z "$APPLE_ID" ] || [ -z "$APPLE_ID_PASSWORD" ]; then
    echo "Error: Required environment variables not set!"
    echo "Please update .env.local with:"
    echo "  APPLE_ID='your-apple-id@example.com'"
    echo "  APPLE_ID_PASSWORD='app-specific-password'"
    exit 1
fi

# Also set the electron-builder expected variable
export APPLE_APP_SPECIFIC_PASSWORD="$APPLE_ID_PASSWORD"

# Clean and build
rm -rf dist
npm run build

# Build and sign
npm run dist:mac

echo "Build complete! Check the release folder for your signed .dmg file."