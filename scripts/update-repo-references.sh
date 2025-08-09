#!/bin/bash

# Script to update repository references after transferring to organization
# Usage: ./scripts/update-repo-references.sh [NEW_ORG_NAME]

NEW_ORG="${1:-AnavaAcap}"
OLD_REPO="rywager/anava-infrastructure-deployer"
NEW_REPO="$NEW_ORG/anava-infrastructure-deployer"

echo "================================================"
echo "  Updating Repository References"
echo "  From: $OLD_REPO"
echo "  To:   $NEW_REPO"
echo "================================================"

# Update git remote
echo "Updating git remote..."
git remote set-url origin "https://github.com/$NEW_REPO.git"

# Update references in scripts
echo "Updating script references..."
sed -i.bak "s|$OLD_REPO|$NEW_REPO|g" scripts/publish-to-acap-releases.sh

# Update references in workflow files
echo "Updating workflow references..."
if [ -f ".github/workflows/publish-to-acap-releases.yml" ]; then
    sed -i.bak "s|$OLD_REPO|$NEW_REPO|g" .github/workflows/publish-to-acap-releases.yml
fi

# Clean up backup files
rm -f scripts/*.bak
rm -f .github/workflows/*.bak

echo "✅ Repository references updated!"
echo ""
echo "Don't forget to:"
echo "1. Push these changes: git add -A && git commit -m 'chore: update repo references after org transfer' && git push"
echo "2. Update any CI/CD secrets in the new organization repository settings"
echo "3. Update any webhook URLs if applicable"