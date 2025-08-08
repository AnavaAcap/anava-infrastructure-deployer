#!/bin/bash

# Script to publish Anava Vision installer assets to AnavaAcap/acap-releases
# This uploads the installer files to the latest release in the public repo

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================================"
echo "  Anava Installer Publisher"
echo "  Target: AnavaAcap/acap-releases (Latest)"
echo "================================================"

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI (gh) is not installed${NC}"
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${RED}❌ Not authenticated with GitHub CLI${NC}"
    echo "Run: gh auth login"
    exit 1
fi

# Get version from package.json
VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")
echo -e "\n📦 Installer Version: ${GREEN}v${VERSION}${NC}"

# Get the latest release from the private repo
echo -e "\n🔍 Finding installer release v${VERSION}..."
PRIVATE_RELEASE=$(gh api \
    -H "Accept: application/vnd.github+json" \
    /repos/rywager/anava-infrastructure-deployer/releases/tags/v${VERSION} \
    2>/dev/null || echo "{}")

if [ "$PRIVATE_RELEASE" = "{}" ]; then
    echo -e "${RED}❌ No release found for v${VERSION} in private repo${NC}"
    echo "Make sure the release has been created and assets uploaded"
    exit 1
fi

PRIVATE_RELEASE_ID=$(echo "$PRIVATE_RELEASE" | jq -r '.id')
echo -e "${GREEN}✅ Found private release ID: ${PRIVATE_RELEASE_ID}${NC}"

# Create temp directory for downloads
TEMP_DIR=$(mktemp -d)
echo -e "\n📥 Downloading installer assets..."

# Download installer assets
cd "$TEMP_DIR"

# Get list of assets
ASSETS=$(gh api \
    -H "Accept: application/vnd.github+json" \
    /repos/rywager/anava-infrastructure-deployer/releases/${PRIVATE_RELEASE_ID}/assets \
    --jq '.[] | select(.name | test("\\.(dmg|exe)$")) | {id: .id, name: .name}')

# Download each asset
while IFS= read -r asset; do
    if [ ! -z "$asset" ]; then
        ASSET_ID=$(echo "$asset" | jq -r '.id')
        ASSET_NAME=$(echo "$asset" | jq -r '.name')
        echo "  Downloading: $ASSET_NAME"
        
        gh api \
            -H "Accept: application/octet-stream" \
            /repos/rywager/anava-infrastructure-deployer/releases/assets/${ASSET_ID} \
            > "${ASSET_NAME}"
    fi
done <<< "$(echo "$ASSETS" | jq -c '.')"

echo -e "\n${GREEN}✅ Downloaded files:${NC}"
ls -lh *.dmg *.exe 2>/dev/null || echo "No installer files found"

# Get the latest release from ACAP releases
echo -e "\n🎯 Finding latest ACAP release..."
ACAP_RELEASE=$(gh api \
    -H "Accept: application/vnd.github+json" \
    /repos/AnavaAcap/acap-releases/releases/latest \
    2>/dev/null || echo "{}")

if [ "$ACAP_RELEASE" = "{}" ]; then
    echo -e "${RED}❌ No releases found in AnavaAcap/acap-releases${NC}"
    exit 1
fi

ACAP_RELEASE_ID=$(echo "$ACAP_RELEASE" | jq -r '.id')
ACAP_RELEASE_TAG=$(echo "$ACAP_RELEASE" | jq -r '.tag_name')
echo -e "${GREEN}✅ Found ACAP release: ${ACAP_RELEASE_TAG} (ID: ${ACAP_RELEASE_ID})${NC}"

# Upload assets to ACAP release
echo -e "\n📤 Uploading installer assets to ACAP release..."

for file in *.dmg *.exe; do
    if [ -f "$file" ]; then
        echo -e "\n  Uploading: ${YELLOW}$file${NC}"
        
        # Check if asset already exists
        EXISTING_ASSET=$(gh api \
            -H "Accept: application/vnd.github+json" \
            /repos/AnavaAcap/acap-releases/releases/${ACAP_RELEASE_ID}/assets \
            --jq ".[] | select(.name == \"$file\") | .id" \
            2>/dev/null || echo "")
        
        if [ ! -z "$EXISTING_ASSET" ]; then
            echo "    Removing existing asset..."
            gh api \
                -X DELETE \
                -H "Accept: application/vnd.github+json" \
                /repos/AnavaAcap/acap-releases/releases/assets/${EXISTING_ASSET} \
                2>/dev/null || true
        fi
        
        # Upload the new asset
        gh release upload ${ACAP_RELEASE_TAG} "$file" \
            --repo AnavaAcap/acap-releases \
            --clobber \
            2>/dev/null || {
                echo -e "    ${RED}Failed to upload with gh release, trying API method...${NC}"
                curl -X POST \
                    -H "Authorization: Bearer $(gh auth token)" \
                    -H "Accept: application/vnd.github.v3+json" \
                    -H "Content-Type: application/octet-stream" \
                    --data-binary "@$file" \
                    "https://uploads.github.com/repos/AnavaAcap/acap-releases/releases/${ACAP_RELEASE_ID}/assets?name=$file"
            }
        
        echo -e "    ${GREEN}✅ Uploaded successfully${NC}"
    fi
done

# Update release notes
echo -e "\n📝 Updating release notes..."
CURRENT_BODY=$(echo "$ACAP_RELEASE" | jq -r '.body')

# Check if installer section exists
if echo "$CURRENT_BODY" | grep -q "## Anava Vision Installer"; then
    echo -e "${YELLOW}Installer section already exists in release notes${NC}"
else
    # Append installer information
    UPDATED_BODY="${CURRENT_BODY}

## Anava Installer

The Anava Installer (v${VERSION}) is now available for download:
- **Windows**: Anava.Installer.Setup.${VERSION}.exe
- **macOS Intel**: Anava.Installer-${VERSION}.dmg
- **macOS Apple Silicon**: Anava.Installer-${VERSION}-arm64.dmg

The installer provides a unified experience for:
- Camera discovery and ACAP deployment
- Private cloud infrastructure setup
- Detection testing and validation
"
    
    # Update the release body
    gh api \
        --method PATCH \
        -H "Accept: application/vnd.github+json" \
        /repos/AnavaAcap/acap-releases/releases/${ACAP_RELEASE_ID} \
        -f body="$UPDATED_BODY" \
        2>/dev/null || echo -e "${YELLOW}Could not update release notes${NC}"
    
    echo -e "${GREEN}✅ Updated release notes${NC}"
fi

# Cleanup
cd - > /dev/null
rm -rf "$TEMP_DIR"

echo -e "\n================================================"
echo -e "${GREEN}✅ Successfully published installers to ACAP release ${ACAP_RELEASE_TAG}${NC}"
echo -e "View at: https://github.com/AnavaAcap/acap-releases/releases/tag/${ACAP_RELEASE_TAG}"
echo "================================================"