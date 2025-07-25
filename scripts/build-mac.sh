#!/bin/bash

echo "Building Anava Vision for macOS..."

# Clean previous builds
rm -rf dist
rm -rf release

# Install dependencies
npm install

# Rebuild native modules for Electron
npm install -g electron-rebuild
electron-rebuild

# Build the app
npm run build

# Create unsigned build
npm run dist:mac

echo "Build complete!"
echo ""
echo "IMPORTANT: Since this build is unsigned, users will need to:"
echo "1. Right-click the app and select 'Open' on first launch"
echo "2. Or run: sudo xattr -r -d com.apple.quarantine /Applications/Anava\ Vision.app"
echo ""
echo "See MACOS_INSTALL_INSTRUCTIONS.md for detailed instructions."