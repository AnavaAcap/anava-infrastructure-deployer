#!/bin/bash

# Fix Network Access for macOS 15 Sequoia
# This script builds and tests the Electron app with network permission fixes

set -e

echo "🔧 Anava Vision Network Access Fix for macOS 15 Sequoia"
echo "======================================================="
echo ""

# Check if running build mode or fix mode
if [ "$1" = "build" ]; then
    echo "📦 Building Anava Vision with network permission fixes..."
    
    # Clean previous builds
    echo "Cleaning previous builds..."
    rm -rf dist/ 2>/dev/null || true
    
    # Build the app
    echo "Building TypeScript..."
    npm run build
    
    # Package for macOS
    echo "Packaging for macOS..."
    npm run dist:mac
    
    # Find the built app
    APP_PATH=""
    if [ -d "release/mac/Anava Vision.app" ]; then
        APP_PATH="release/mac/Anava Vision.app"
    elif [ -d "release/mac-arm64/Anava Vision.app" ]; then
        APP_PATH="release/mac-arm64/Anava Vision.app"
    elif [ -d "dist/mac/Anava Vision.app" ]; then
        APP_PATH="dist/mac/Anava Vision.app"
    fi
    
    if [ -z "$APP_PATH" ] || [ ! -d "$APP_PATH" ]; then
        echo "❌ Build failed - app not found"
        exit 1
    fi
    
    echo "✅ Build complete: $APP_PATH"
    
    # Check entitlements
    echo ""
    echo "📋 Checking entitlements..."
    codesign -d --entitlements - "$APP_PATH" 2>/dev/null | grep -E "network|multicast" || true
    
    echo ""
    echo "📱 To install: cp -R \"$APP_PATH\" /Applications/"
    echo ""
else
    echo "🔨 Applying network permission fixes..."
    echo ""
    
    # Check if app is installed
    if [ ! -d "/Applications/Anava Vision.app" ]; then
        echo "❌ Anava Vision not found in /Applications"
        echo "Please install the app first or run: $0 build"
        exit 1
    fi
    
    # Add to firewall exceptions
    echo "Adding to firewall exceptions..."
    sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add "/Applications/Anava Vision.app"
    sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp "/Applications/Anava Vision.app"
    
    # Clear quarantine attributes
    echo "Clearing quarantine attributes..."
    xattr -cr "/Applications/Anava Vision.app"
    
    # Reset TCC permissions for the app
    echo "Resetting privacy permissions..."
    tccutil reset All com.anava.vision 2>/dev/null || true
    
    echo ""
    echo "✅ Network fixes applied!"
fi

echo ""
echo "🎯 Key Changes in This Version:"
echo "- Added Bonjour trigger to request network permission"
echo "- Added multicast entitlement (pending Apple approval)"
echo "- Created helper script for subprocess network access"
echo "- Separated inherit entitlements for helper processes"
echo ""
echo "📱 Testing Instructions:"
echo "========================"
echo ""
echo "1. Launch the app (should trigger permission dialog):"
echo "   open /Applications/Anava\\ Vision.app"
echo ""
echo "2. If permission dialog doesn't appear, the firewall fix has been applied"
echo ""
echo "3. Test camera discovery in the app"
echo ""
echo "4. Check Console.app for any errors (filter by 'Anava Vision')"
echo ""
echo "🚨 Known Issue: macOS 15 may not show the permission dialog for Developer ID"
echo "   signed apps. The manual firewall add (already applied) is the workaround."