#!/bin/bash

# Test Network Permission Flow for macOS 15 Sequoia
# This script tests the complete network permission handling

set -e

echo "🔧 Testing Network Permission Flow for Anava Vision"
echo "==================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check macOS version
OS_VERSION=$(sw_vers -productVersion)
MAJOR_VERSION=$(echo $OS_VERSION | cut -d. -f1)

echo "📱 macOS Version: $OS_VERSION"
if [ "$MAJOR_VERSION" -ge "15" ]; then
    echo -e "${GREEN}✓ Running on macOS 15+ (Sequoia or later)${NC}"
else
    echo -e "${YELLOW}⚠ Running on macOS $MAJOR_VERSION - network permission not required${NC}"
fi

echo ""
echo "🔍 Checking current firewall status..."
echo "--------------------------------------"

# Check if app is in firewall
if /usr/libexec/ApplicationFirewall/socketfilterfw --listapps 2>/dev/null | grep -q "Anava Vision"; then
    echo -e "${GREEN}✓ Anava Vision is in firewall exception list${NC}"
    FIREWALL_STATUS="allowed"
else
    echo -e "${RED}✗ Anava Vision is NOT in firewall exception list${NC}"
    FIREWALL_STATUS="blocked"
fi

echo ""
echo "🧪 Test 1: Direct TCP Connection Test"
echo "--------------------------------------"

# Test direct connection to common router IPs
TEST_IPS=("192.168.1.1" "192.168.0.1" "10.0.0.1")
CONNECTED=false

for IP in "${TEST_IPS[@]}"; do
    echo -n "Testing connection to $IP:80... "
    if nc -z -w 2 $IP 80 2>/dev/null; then
        echo -e "${GREEN}Connected${NC}"
        CONNECTED=true
        break
    else
        echo -e "${RED}Failed${NC}"
    fi
done

if [ "$CONNECTED" = true ]; then
    echo -e "${GREEN}✓ Direct network access is working${NC}"
else
    echo -e "${YELLOW}⚠ Could not connect to any test IPs (this might be normal)${NC}"
fi

echo ""
echo "🧪 Test 2: Launch App and Check Permission Dialog"
echo "-------------------------------------------------"

if [ "$1" = "launch" ]; then
    echo "Launching Anava Vision..."
    
    # Kill any existing instances
    pkill -f "Anava Vision" 2>/dev/null || true
    sleep 1
    
    # Launch the app
    if [ -d "/Applications/Anava Vision.app" ]; then
        open "/Applications/Anava Vision.app"
        echo -e "${GREEN}✓ App launched${NC}"
        echo ""
        echo "👀 Watch for:"
        echo "  1. Network permission dialog (if first launch)"
        echo "  2. Manual instructions dialog (if permission denied)"
        echo "  3. Camera discovery working after permission granted"
    else
        echo -e "${RED}✗ App not found in /Applications${NC}"
        echo "Run: npm run dist:mac && cp -R 'release/mac/Anava Vision.app' /Applications/"
    fi
else
    echo "Skip launch test (run with 'launch' argument to test)"
fi

echo ""
echo "🧪 Test 3: Helper Script Test"
echo "-----------------------------"

HELPER_PATH="src/main/helpers/network-connect-helper.js"
if [ -f "$HELPER_PATH" ]; then
    echo "Testing helper script connection..."
    
    # Test the helper
    TEST_RESULT=$(node "$HELPER_PATH" test-tcp 192.168.1.1 80 2>/dev/null || echo '{"status":"error"}')
    
    if echo "$TEST_RESULT" | grep -q '"status":"connected"'; then
        echo -e "${GREEN}✓ Helper script can connect${NC}"
    else
        echo -e "${YELLOW}⚠ Helper script connection failed (might be normal)${NC}"
    fi
else
    echo -e "${RED}✗ Helper script not found${NC}"
fi

echo ""
echo "📊 Summary"
echo "----------"
echo "macOS Version: $OS_VERSION"
echo "Firewall Status: $FIREWALL_STATUS"

if [ "$FIREWALL_STATUS" = "blocked" ]; then
    echo ""
    echo "🔧 To fix network access manually:"
    echo "  sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add '/Applications/Anava Vision.app'"
    echo "  sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp '/Applications/Anava Vision.app'"
fi

echo ""
echo "✅ Test complete!"
echo ""
echo "📝 Next Steps:"
echo "1. Build the app: npm run dist:mac"
echo "2. Install to Applications: cp -R 'release/mac/Anava Vision.app' /Applications/"
echo "3. Run this test with launch: $0 launch"
echo "4. Check camera discovery in the app"