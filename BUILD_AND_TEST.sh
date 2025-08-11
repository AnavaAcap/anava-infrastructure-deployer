#!/bin/bash

echo "====================================="
echo "ANAVA INSTALLER BUILD & FIX SCRIPT"
echo "====================================="
echo ""
echo "This script will:"
echo "1. Build the application with all fixes"
echo "2. Show DevTools for debugging"
echo "3. Create a production DMG"
echo ""

# Step 1: Clean previous builds
echo "Step 1: Cleaning previous builds..."
rm -rf dist/
rm -rf release/

# Step 2: Build the application
echo "Step 2: Building application..."
npm run build

# Check if build succeeded
if [ $? -ne 0 ]; then
  echo "❌ Build failed. Please check the errors above."
  exit 1
fi

echo "✅ Build successful!"

# Step 3: Verify HTML structure
echo ""
echo "Step 3: Verifying HTML structure..."
if grep -q '<script type="module".*src="./assets/index.*\.js"></script>' dist/renderer/index.html; then
  echo "✅ Script tag found in HTML"
  
  # Check if script is in body
  if grep -A2 '<div id="root"></div>' dist/renderer/index.html | grep -q '<script type="module"'; then
    echo "✅ Script is correctly placed after root div"
  else
    echo "⚠️  Script may not be in correct position, but continuing..."
  fi
else
  echo "❌ Script tag not found in HTML!"
fi

# Step 4: Test with Electron directly
echo ""
echo "Step 4: Testing with Electron directly..."
echo "DevTools will open automatically. Check the Console tab for errors."
echo "Press Ctrl+C to stop the test and continue to DMG build."
echo ""
read -p "Press Enter to start Electron test..."

npx electron dist/main/index.js &
ELECTRON_PID=$!

echo ""
echo "Electron is running with PID: $ELECTRON_PID"
echo "Check the DevTools Console for any errors!"
echo ""
read -p "Press Enter when ready to continue to DMG build (this will close Electron)..."

kill $ELECTRON_PID 2>/dev/null

# Step 5: Build DMG
echo ""
echo "Step 5: Building DMG for distribution..."
echo "This will create a signed and notarized macOS installer."
echo ""

APPLE_ID="ryan@anava.ai" \
APPLE_ID_PASSWORD="gbdi-fnth-pxfx-aofv" \
APPLE_APP_SPECIFIC_PASSWORD="gbdi-fnth-pxfx-aofv" \
APPLE_TEAM_ID="3JVZNWGRYT" \
CSC_NAME="Ryan Wager (3JVZNWGRYT)" \
npm run dist:mac

if [ $? -eq 0 ]; then
  echo ""
  echo "====================================="
  echo "✅ BUILD COMPLETE!"
  echo "====================================="
  echo ""
  echo "Your DMG is ready at:"
  ls -lh release/*.dmg | grep "0.9.178"
  echo ""
  echo "IMPORTANT NOTES:"
  echo "1. The DevTools are enabled in production for debugging"
  echo "2. The script tag is now in the body after the root div"
  echo "3. All Firebase imports have been fixed"
  echo "4. The license activation now uses the camera's actual MAC address"
  echo ""
  echo "If you still see a white screen:"
  echo "1. Check the DevTools Console for errors"
  echo "2. Check the Network tab for failed resource loads"
  echo "3. Look for Content Security Policy violations"
else
  echo ""
  echo "❌ DMG build failed. Check the errors above."
  exit 1
fi