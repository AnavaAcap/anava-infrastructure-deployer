#!/bin/bash

echo "Checking notarization status..."
echo "=============================="

# Check if electron-builder is still running
if pgrep -f electron-builder > /dev/null; then
    echo "✅ Build is still in progress..."
    echo "   Notarization can take 5-15 minutes"
else
    echo "Build process completed."
fi

echo ""
echo "Current release directory:"
ls -la release/ 2>/dev/null || echo "No release directory"

echo ""
echo "DMG files:"
ls -la release/*.dmg 2>/dev/null || echo "No DMG files yet"

echo ""
echo "To check notarization history:"
echo "  xcrun notarytool history --apple-id ryan@anava.ai --team-id 3JVZNWGRYT"