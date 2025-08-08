#!/bin/bash

# Anava Vision macOS Setup Script
# This script configures macOS to allow network access for Anava Vision

echo "========================================="
echo "Anava Vision - macOS Network Setup"
echo "========================================="
echo ""
echo "This script will configure your Mac to allow"
echo "Anava Vision to access cameras on your local network."
echo ""

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "Error: This script is only for macOS"
    exit 1
fi

# Get the app path
APP_PATH="/Applications/Anava Vision.app"

# Check if app is installed
if [ ! -d "$APP_PATH" ]; then
    echo "Error: Anava Vision not found at $APP_PATH"
    echo "Please install the app first."
    exit 1
fi

echo "Found Anava Vision at: $APP_PATH"
echo ""

# Function to add app to firewall
add_to_firewall() {
    echo "Adding Anava Vision to macOS firewall..."
    
    # This requires admin privileges
    sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add "$APP_PATH" 2>/dev/null
    sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp "$APP_PATH" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo "✓ Successfully added to firewall"
        return 0
    else
        echo "✗ Failed to add to firewall"
        return 1
    fi
}

# Function to check if app is in firewall
check_firewall() {
    /usr/libexec/ApplicationFirewall/socketfilterfw --listapps 2>/dev/null | grep -q "Anava Vision"
    return $?
}

# Check current status
echo "Checking current firewall status..."
if check_firewall; then
    echo "✓ Anava Vision is already configured in the firewall"
else
    echo "Anava Vision is not in the firewall"
    echo ""
    echo "Administrator privileges required to add app to firewall."
    echo "You may be prompted for your password."
    echo ""
    
    add_to_firewall
fi

echo ""
echo "========================================="
echo "Setup Complete!"
echo "========================================="
echo ""
echo "Anava Vision should now be able to access"
echo "cameras on your local network."
echo ""
echo "If you still have issues:"
echo "1. Try launching the app from Terminal:"
echo "   open -a 'Anava Vision'"
echo ""
echo "2. Or manually add to firewall:"
echo "   System Settings > Privacy & Security > Firewall"
echo ""