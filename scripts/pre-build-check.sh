#!/bin/bash

# Pre-build validation script for macOS signing
# This script checks all requirements before attempting to build

set -e

echo "🔍 Running pre-build validation checks..."
echo "========================================"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

# Function to check environment variable
check_env() {
    local var_name=$1
    local var_value=${!var_name}
    
    if [ -z "$var_value" ]; then
        echo -e "${RED}✗ Missing environment variable: $var_name${NC}"
        ERRORS=$((ERRORS + 1))
        return 1
    else
        # Mask sensitive values in output
        if [[ "$var_name" == *"PASSWORD"* ]] || [[ "$var_name" == *"KEY"* ]]; then
            echo -e "${GREEN}✓ $var_name is set (hidden)${NC}"
        else
            echo -e "${GREEN}✓ $var_name = $var_value${NC}"
        fi
        return 0
    fi
}

# Check required environment variables
echo -e "\n1. Checking environment variables..."
check_env "APPLE_ID"
check_env "APPLE_ID_PASSWORD"
check_env "APPLE_TEAM_ID"

# Optional but recommended
if [ -z "$APPLE_APP_SPECIFIC_PASSWORD" ]; then
    echo -e "${YELLOW}⚠ APPLE_APP_SPECIFIC_PASSWORD not set (using APPLE_ID_PASSWORD)${NC}"
fi

# Check for certificate in keychain
echo -e "\n2. Checking for Developer ID certificate..."
if command -v security >/dev/null 2>&1; then
    CERT_COUNT=$(security find-identity -v -p codesigning | grep "Developer ID Application" | wc -l | tr -d ' ')
    if [ "$CERT_COUNT" -eq "0" ]; then
        echo -e "${RED}✗ No Developer ID Application certificate found in Keychain${NC}"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✓ Found $CERT_COUNT Developer ID certificate(s)${NC}"
        # Show certificate details
        security find-identity -v -p codesigning | grep "Developer ID Application" | while read -r line; do
            echo "  $line"
        done
    fi
else
    echo -e "${YELLOW}⚠ Cannot check certificates (not on macOS)${NC}"
fi

# Run Node.js validation script
echo -e "\n3. Checking build configuration..."
if node scripts/validate-signing-config.js; then
    echo -e "${GREEN}✓ Build configuration valid${NC}"
else
    echo -e "${RED}✗ Build configuration has errors${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check for required files
echo -e "\n4. Checking required files..."
REQUIRED_FILES=(
    "scripts/notarize.js"
    "assets/entitlements.mac.plist"
    "assets/icon.icns"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓ Found: $file${NC}"
    else
        echo -e "${RED}✗ Missing: $file${NC}"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check npm packages
echo -e "\n5. Checking npm dependencies..."
if [ -d "node_modules/@electron/notarize" ]; then
    echo -e "${GREEN}✓ @electron/notarize installed${NC}"
else
    echo -e "${YELLOW}⚠ @electron/notarize not found, running npm install...${NC}"
    npm install
fi

# Summary
echo -e "\n========================================"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All pre-build checks passed!${NC}"
    echo -e "\nYou can now run: npm run dist:mac"
    exit 0
else
    echo -e "${RED}❌ Found $ERRORS error(s) that must be fixed before building${NC}"
    echo -e "\nPlease fix the issues above and run this script again."
    exit 1
fi