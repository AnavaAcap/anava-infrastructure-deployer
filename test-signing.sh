#!/bin/bash

echo "Testing macOS code signing setup..."
echo "=================================="

# You'll need to fill these in:
export APPLE_ID="your-apple-id@example.com"
export APPLE_ID_PASSWORD="your-app-specific-password"
export APPLE_TEAM_ID="YOUR_TEAM_ID"

# Find your certificate
echo "Available signing certificates:"
security find-identity -v -p codesigning

echo ""
echo "Please update the environment variables in this script with:"
echo "1. APPLE_ID: Your Apple ID email"
echo "2. APPLE_ID_PASSWORD: The app-specific password you created"
echo "3. APPLE_TEAM_ID: Your 10-character team ID"
echo ""
echo "Then run: npm run dist:mac"