#!/bin/bash

# Anava Installer v0.9.178 - Comprehensive Test & Release Script
# This script performs all necessary tests before shipping the release

set -e  # Exit on any error

echo "=========================================="
echo "Anava Installer v0.9.178 Test & Release"
echo "=========================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Track test results
TESTS_PASSED=0
TESTS_FAILED=0

# 1. Version Verification
echo "1. VERSION VERIFICATION"
echo "-----------------------"
VERSION=$(grep '"version"' package.json | head -1 | cut -d'"' -f4)
if [ "$VERSION" = "0.9.178" ]; then
    print_status "Version confirmed: $VERSION"
    ((TESTS_PASSED++))
else
    print_error "Version mismatch! Expected 0.9.178, found $VERSION"
    ((TESTS_FAILED++))
    exit 1
fi
echo ""

# 2. Security Audit
echo "2. SECURITY AUDIT"
echo "-----------------"
echo "Running npm audit..."
AUDIT_OUTPUT=$(npm audit 2>&1 || true)
if echo "$AUDIT_OUTPUT" | grep -q "found 0 vulnerabilities"; then
    print_status "No security vulnerabilities found"
    ((TESTS_PASSED++))
else
    print_error "Security vulnerabilities detected!"
    echo "$AUDIT_OUTPUT"
    ((TESTS_FAILED++))
fi
echo ""

# 3. Dependency Check
echo "3. DEPENDENCY VERIFICATION"
echo "--------------------------"
echo "Checking for removed vulnerable packages..."
if ! grep -q "node-ssdp" package.json; then
    print_status "node-ssdp successfully removed"
    ((TESTS_PASSED++))
else
    print_error "node-ssdp still present in dependencies!"
    ((TESTS_FAILED++))
fi

echo "Checking Electron version..."
ELECTRON_VERSION=$(grep '"electron":' package.json | cut -d'"' -f4)
if [[ "$ELECTRON_VERSION" == "^37"* ]]; then
    print_status "Electron v37 confirmed: $ELECTRON_VERSION"
    ((TESTS_PASSED++))
else
    print_error "Unexpected Electron version: $ELECTRON_VERSION"
    ((TESTS_FAILED++))
fi
echo ""

# 4. Build Test
echo "4. BUILD TEST"
echo "-------------"
echo "Running clean build..."
rm -rf dist/ release/ 2>/dev/null || true

if npm run build > /tmp/build.log 2>&1; then
    print_status "Build completed successfully"
    ((TESTS_PASSED++))
    
    # Verify build artifacts
    if [ -f "dist/main/index.js" ] && [ -f "dist/renderer/index.html" ]; then
        print_status "Build artifacts verified"
        ((TESTS_PASSED++))
    else
        print_error "Build artifacts missing!"
        ((TESTS_FAILED++))
    fi
else
    print_error "Build failed! Check /tmp/build.log"
    ((TESTS_FAILED++))
fi
echo ""

# 5. Critical File Checks
echo "5. CRITICAL FILE VERIFICATION"
echo "-----------------------------"

# Check white screen fix
echo "Checking white screen fix..."
if grep -q 'injectTo: "body"' vite.config.ts; then
    print_status "White screen fix confirmed in vite.config.ts"
    ((TESTS_PASSED++))
else
    print_error "White screen fix not found!"
    ((TESTS_FAILED++))
fi

# Check license activation fix
echo "Checking license activation fix..."
if grep -q 'camera.macAddress' src/renderer/pages/camera/ACAPDeploymentPage.tsx && \
   ! grep -q 'ACCC8EFA63CD' src/renderer/pages/camera/ACAPDeploymentPage.tsx; then
    print_status "License activation using dynamic MAC addresses"
    ((TESTS_PASSED++))
else
    print_error "License activation issue - may be using hardcoded MAC!"
    ((TESTS_FAILED++))
fi

# Check AI mode fix
echo "Checking AI mode deployment fix..."
if ! grep -q 'if.*!isAiStudioMode.*return' src/main/services/deploymentEngine.ts; then
    print_status "AI mode conditional skipping removed"
    ((TESTS_PASSED++))
else
    print_error "AI mode may still be skipping deployment steps!"
    ((TESTS_FAILED++))
fi
echo ""

# 6. Unit Tests
echo "6. UNIT TESTS"
echo "-------------"
if [ -d "test-suite" ]; then
    echo "Running test suite..."
    if npm test -- --selectProjects=regression,security 2>/tmp/test.log; then
        print_status "Unit tests passed"
        ((TESTS_PASSED++))
    else
        print_warning "Some unit tests failed - review /tmp/test.log"
        ((TESTS_FAILED++))
    fi
else
    print_warning "Test suite not found, skipping unit tests"
fi
echo ""

# 7. Electron Launch Test
echo "7. ELECTRON LAUNCH TEST"
echo "-----------------------"
echo "Testing Electron app launch (5 second test)..."

# Start Electron in background
timeout 5 npx electron dist/main/index.js > /tmp/electron.log 2>&1 &
ELECTRON_PID=$!

sleep 3

# Check if process is still running
if ps -p $ELECTRON_PID > /dev/null 2>&1; then
    print_status "Electron launched successfully"
    ((TESTS_PASSED++))
    kill $ELECTRON_PID 2>/dev/null || true
else
    print_warning "Electron process exited early - check /tmp/electron.log"
    ((TESTS_FAILED++))
fi
echo ""

# 8. API Endpoints Check
echo "8. API ENDPOINT VERIFICATION"
echo "----------------------------"

# Check for required API endpoints in deployment engine
APIS=(
    "identitytoolkit.googleapis.com"
    "firestore.googleapis.com"
    "cloudfunctions.googleapis.com"
    "apigateway.googleapis.com"
    "generativelanguage.googleapis.com"
)

for api in "${APIS[@]}"; do
    if grep -q "$api" src/main/services/deploymentEngine.ts; then
        print_status "API enabled: $api"
        ((TESTS_PASSED++))
    else
        print_error "API missing: $api"
        ((TESTS_FAILED++))
    fi
done
echo ""

# 9. DMG Build Test (macOS only)
echo "9. DMG BUILD TEST"
echo "-----------------"
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Preparing for DMG build..."
    
    # Check for signing certificate
    if security find-identity -v -p codesigning | grep -q "3JVZNWGRYT"; then
        print_status "Code signing certificate found"
        ((TESTS_PASSED++))
        
        echo "Building DMG (this may take a few minutes)..."
        export APPLE_ID="ryan@anava.ai"
        export APPLE_ID_PASSWORD="gbdi-fnth-pxfx-aofv"
        export APPLE_APP_SPECIFIC_PASSWORD="gbdi-fnth-pxfx-aofv"
        export APPLE_TEAM_ID="3JVZNWGRYT"
        export CSC_NAME="Ryan Wager (3JVZNWGRYT)"
        
        if npm run dist:mac > /tmp/dmg-build.log 2>&1; then
            print_status "DMG build completed"
            ((TESTS_PASSED++))
            
            # Check for DMG file
            DMG_FILE=$(find release -name "*.dmg" 2>/dev/null | head -1)
            if [ -n "$DMG_FILE" ]; then
                print_status "DMG created: $DMG_FILE"
                ((TESTS_PASSED++))
                
                # Verify DMG size (should be > 100MB)
                DMG_SIZE=$(du -m "$DMG_FILE" | cut -f1)
                if [ "$DMG_SIZE" -gt 100 ]; then
                    print_status "DMG size verified: ${DMG_SIZE}MB"
                    ((TESTS_PASSED++))
                else
                    print_warning "DMG seems small: ${DMG_SIZE}MB"
                    ((TESTS_FAILED++))
                fi
            else
                print_error "DMG file not found!"
                ((TESTS_FAILED++))
            fi
        else
            print_error "DMG build failed! Check /tmp/dmg-build.log"
            ((TESTS_FAILED++))
        fi
    else
        print_warning "Code signing certificate not found - skipping DMG build"
    fi
else
    print_warning "Not on macOS - skipping DMG build test"
fi
echo ""

# 10. Test Summary
echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo -e "${GREEN}Tests Passed:${NC} $TESTS_PASSED"
echo -e "${RED}Tests Failed:${NC} $TESTS_FAILED"

if [ $TESTS_FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ ALL TESTS PASSED!${NC}"
    echo ""
    echo "Release v0.9.178 is ready for deployment!"
    echo ""
    echo "NEXT STEPS:"
    echo "1. Create GitHub release:"
    echo "   git tag v0.9.178"
    echo "   git push origin v0.9.178"
    echo ""
    echo "2. Upload DMG to GitHub release:"
    if [ -n "$DMG_FILE" ]; then
        echo "   File: $DMG_FILE"
    else
        echo "   Build DMG first with: npm run dist:mac"
    fi
    echo ""
    echo "3. Update public release repo:"
    echo "   https://github.com/AnavaAcap/acap-releases"
    echo ""
    echo "4. Write release notes including:"
    echo "   - White screen fix"
    echo "   - Security vulnerability patches"
    echo "   - License activation improvements"
    echo "   - Performance optimizations"
else
    echo ""
    echo -e "${RED}✗ TESTS FAILED!${NC}"
    echo ""
    echo "Please fix the issues above before releasing."
    echo "Review the log files in /tmp/ for details."
    exit 1
fi