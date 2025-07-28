#!/bin/bash

PROJECT_ID="test99-xahn"
echo "=== Testing if Firebase Auto-Creates OAuth Credentials ==="
echo "Project: ${PROJECT_ID}"
echo ""

ACCESS_TOKEN=$(gcloud auth print-access-token)

# First, let's initialize Firebase in the project
echo "--- Step 1: Adding Firebase to the project ---"
firebase projects:addfirebase "${PROJECT_ID}" 2>/dev/null || echo "Firebase may already be added"

# Wait a bit for propagation
sleep 5

# Initialize Identity Platform config using Terraform approach
echo ""
echo "--- Step 2: Initializing Identity Platform with Terraform ---"
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

# Create minimal Terraform config
cat > main.tf << EOF
provider "google" {
  project = "${PROJECT_ID}"
}

resource "google_identity_platform_config" "default" {
  project = "${PROJECT_ID}"
  
  sign_in {
    email {
      enabled = true
      password_required = true
    }
  }
  
  authorized_domains = [
    "${PROJECT_ID}.firebaseapp.com",
    "localhost"
  ]
}
EOF

terraform init > /dev/null 2>&1
terraform apply -auto-approve > /dev/null 2>&1 || echo "Identity Platform may already be configured"

cd - > /dev/null

echo "✅ Identity Platform initialized"

# Now try to enable Google provider without credentials
echo ""
echo "--- Step 3: Enabling Google provider WITHOUT OAuth credentials ---"

# Method 1: Try with just enabled=true
RESPONSE1=$(curl -s -X POST \
    "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs?idpId=google.com" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -H "x-goog-user-project: ${PROJECT_ID}" \
    -d '{"enabled": true}')

echo "Response to enabling without credentials:"
echo "$RESPONSE1" | jq '.'

# Check what happened
echo ""
echo "--- Step 4: Checking current Google provider configuration ---"
PROVIDERS=$(curl -s -X GET \
    "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "x-goog-user-project: ${PROJECT_ID}")

echo "Current providers:"
echo "$PROVIDERS" | jq '.'

# If Google provider exists, check if it has auto-generated credentials
if echo "$PROVIDERS" | grep -q "google.com"; then
    CLIENT_ID=$(echo "$PROVIDERS" | jq -r '.defaultSupportedIdpConfigs[] | select(.name | contains("google.com")) | .clientId // empty')
    
    if [ -n "$CLIENT_ID" ]; then
        echo ""
        echo "🎉 DISCOVERY: Firebase DID auto-create OAuth credentials!"
        echo "Client ID: ${CLIENT_ID}"
        
        # Analyze the client ID pattern
        PROJECT_NUMBER=$(echo "$CLIENT_ID" | cut -d'-' -f1)
        echo "Project Number: ${PROJECT_NUMBER}"
        
        # Check if this follows Firebase's auto-generated pattern
        if [[ "$CLIENT_ID" =~ ^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$ ]]; then
            echo "✅ This matches Firebase's auto-generated OAuth client pattern!"
        fi
    else
        echo "❌ No client ID found - OAuth credentials were NOT auto-created"
    fi
else
    echo "❌ Google provider was not enabled"
fi

# Let's also check what happens in Firebase Console
echo ""
echo "--- Step 5: Getting Firebase web app config ---"
# First create a web app if needed
firebase apps:create web "test-app" --project="${PROJECT_ID}" 2>/dev/null || true

# Get the Firebase config
echo "Firebase SDK config:"
firebase apps:sdkconfig web --project="${PROJECT_ID}" 2>/dev/null || echo "Could not get SDK config"

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
echo "=== Summary ==="
echo "Check the results above. Key question: Did Firebase create OAuth credentials automatically?"
echo ""
echo "To verify in Firebase Console:"
echo "https://console.firebase.google.com/project/${PROJECT_ID}/authentication/providers"