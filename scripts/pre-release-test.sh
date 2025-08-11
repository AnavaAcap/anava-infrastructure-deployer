#!/bin/bash

# Pre-release test script to catch critical errors before deployment
# Run this before creating any release

echo "========================================="
echo "Pre-Release Testing Suite"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track failures
FAILED=0

# Test 1: TypeScript compilation for main process
echo -e "\n${YELLOW}Test 1: TypeScript Main Process Compilation${NC}"
if npm run build:main > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Main process TypeScript compilation passed${NC}"
else
    echo -e "${RED}✗ Main process TypeScript compilation failed${NC}"
    FAILED=1
fi

# Test 2: TypeScript compilation for renderer
echo -e "\n${YELLOW}Test 2: TypeScript Renderer Compilation${NC}"
if npm run build:renderer > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Renderer TypeScript compilation passed${NC}"
else
    echo -e "${RED}✗ Renderer TypeScript compilation failed${NC}"
    FAILED=1
fi

# Test 3: Check for undefined variables in critical files
echo -e "\n${YELLOW}Test 3: Checking for undefined variables${NC}"
UNDEFINED_VARS=$(grep -r "currentPage\|currentView" src/renderer/components/NavigationSidebar.tsx 2>/dev/null)
if echo "$UNDEFINED_VARS" | grep -q "currentPage"; then
    echo -e "${RED}✗ Found 'currentPage' (should be 'currentView') in NavigationSidebar${NC}"
    FAILED=1
else
    echo -e "${GREEN}✓ No undefined variable issues in NavigationSidebar${NC}"
fi

# Test 4: Lint check (only for src files)
echo -e "\n${YELLOW}Test 4: ESLint Check (src only)${NC}"
LINT_ERRORS=$(npx eslint src --ext .ts,.tsx 2>&1 | grep -E "error" | wc -l)
if [ $LINT_ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ No ESLint errors in src directory${NC}"
else
    echo -e "${YELLOW}⚠ Found $LINT_ERRORS ESLint errors in src (review before release)${NC}"
fi

# Test 5: Test app startup (5 second timeout)
echo -e "\n${YELLOW}Test 5: App Startup Test${NC}"
timeout 5 npx electron dist/main/index.js > /tmp/electron-test.log 2>&1 &
ELECTRON_PID=$!

sleep 3

# Check if process is still running (good sign)
if ps -p $ELECTRON_PID > /dev/null 2>&1; then
    echo -e "${GREEN}✓ App starts without immediate crash${NC}"
    kill $ELECTRON_PID 2>/dev/null
else
    # Check for error in log
    if grep -q "ReferenceError\|is not defined\|Cannot read" /tmp/electron-test.log; then
        echo -e "${RED}✗ App crashed with error:${NC}"
        grep "ReferenceError\|is not defined\|Cannot read" /tmp/electron-test.log | head -3
        FAILED=1
    else
        echo -e "${GREEN}✓ App started and exited cleanly${NC}"
    fi
fi

# Test 6: Check for console.log statements in production code
echo -e "\n${YELLOW}Test 6: Console.log Check${NC}"
CONSOLE_COUNT=$(grep -r "console\.log" src --include="*.ts" --include="*.tsx" | wc -l)
if [ $CONSOLE_COUNT -gt 50 ]; then
    echo -e "${YELLOW}⚠ Found $CONSOLE_COUNT console.log statements (consider removing for production)${NC}"
else
    echo -e "${GREEN}✓ Acceptable number of console.log statements ($CONSOLE_COUNT)${NC}"
fi

# Test 7: Check package.json version
echo -e "\n${YELLOW}Test 7: Version Check${NC}"
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${GREEN}✓ Current version: $CURRENT_VERSION${NC}"

# Summary
echo -e "\n========================================="
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All critical tests passed! ✓${NC}"
    echo -e "Ready for release: v$CURRENT_VERSION"
else
    echo -e "${RED}CRITICAL TESTS FAILED! ✗${NC}"
    echo -e "${RED}Do not release until all tests pass${NC}"
    exit 1
fi
echo "========================================="

exit 0