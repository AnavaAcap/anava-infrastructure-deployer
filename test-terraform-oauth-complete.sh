#!/bin/bash

PROJECT_ID="test0727-p2pc"
PROJECT_NUMBER="413554396880"
ADMIN_EMAIL="rywager@gmail.com"

echo "=== Testing Complete Terraform OAuth Setup ==="
echo "Project: $PROJECT_ID"
echo "Project Number: $PROJECT_NUMBER"
echo "Admin Email: $ADMIN_EMAIL"
echo ""

# Check if terraform is installed
if ! command -v terraform &> /dev/null; then
    echo "❌ Terraform is not installed. Please install it first:"
    echo "   brew install terraform"
    exit 1
fi

echo "✅ Terraform version: $(terraform version -json | jq -r '.terraform_version')"

# Test using the actual TerraformService from our app
echo ""
echo "Testing TerraformService implementation..."

# Create a test TypeScript file
cat > test-terraform-service.ts << 'EOF'
import { TerraformService } from './src/main/services/terraformService';
import * as fs from 'fs/promises';
import * as path from 'path';

async function test() {
  const projectId = process.env.PROJECT_ID!;
  const projectNumber = process.env.PROJECT_NUMBER!;
  const adminEmail = process.env.ADMIN_EMAIL!;
  
  console.log('=== Testing TerraformService ===');
  console.log(`Project ID: ${projectId}`);
  console.log(`Project Number: ${projectNumber}`);
  console.log(`Admin Email: ${adminEmail}`);
  
  const terraformService = new TerraformService();
  
  try {
    // Initialize the service
    await terraformService.initialize();
    console.log('✅ TerraformService initialized');
    
    // Create a temporary credentials file
    const credsPath = path.join(process.cwd(), 'test-creds.json');
    const creds = {
      type: "service_account",
      // This would normally be a real service account key
      // For testing, we'll use gcloud default credentials
    };
    await fs.writeFile(credsPath, JSON.stringify(creds));
    
    // Run Terraform to set up Firebase Auth with OAuth
    await terraformService.initializeFirebaseAuth(
      projectId,
      credsPath,
      {
        enableAnonymous: true,
        authorizedDomains: [`${projectId}.firebaseapp.com`, 'localhost'],
        adminEmail: adminEmail,
        projectNumber: projectNumber
      }
    );
    
    console.log('✅ Firebase Auth initialized with Google Sign-In!');
    
    // Get the auth config
    const authConfig = await terraformService.getAuthConfig();
    console.log('Auth config:', JSON.stringify(authConfig, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    // Cleanup
    await terraformService.cleanup();
  }
}

test().catch(console.error);
EOF

# Run the test
echo ""
echo "Running TerraformService test..."
PROJECT_ID="$PROJECT_ID" PROJECT_NUMBER="$PROJECT_NUMBER" ADMIN_EMAIL="$ADMIN_EMAIL" \
  npx ts-node test-terraform-service.ts

# Verify the results with API calls
echo ""
echo "=== Verifying Results ==="
ACCESS_TOKEN=$(gcloud auth print-access-token)

# Check Identity Platform config
echo "1. Checking Identity Platform configuration..."
curl -s -X GET \
  "https://identitytoolkit.googleapis.com/v2/projects/$PROJECT_ID/config" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-goog-user-project: $PROJECT_ID" | jq '.signIn'

# Check for Google provider
echo ""
echo "2. Checking Google Sign-In provider..."
curl -s -X GET \
  "https://identitytoolkit.googleapis.com/v2/projects/$PROJECT_ID/defaultSupportedIdpConfigs" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-goog-user-project: $PROJECT_ID" | jq '.defaultSupportedIdpConfigs[] | select(.idpId == "google.com")'

# Check OAuth brands
echo ""
echo "3. Checking OAuth brands..."
gcloud alpha iap oauth-brands list --project="$PROJECT_ID" --format=json | jq '.'

# Check OAuth clients
echo ""
echo "4. Checking OAuth clients..."
BRAND_NAME=$(gcloud alpha iap oauth-brands list --project="$PROJECT_ID" --format=json | jq -r '.[0].name')
if [ ! -z "$BRAND_NAME" ]; then
  gcloud alpha iap oauth-clients list "$BRAND_NAME" --project="$PROJECT_ID" --format=json | jq '.'
fi

# Cleanup
rm -f test-terraform-service.ts test-creds.json

echo ""
echo "=== Test Complete ==="
echo "Check the Firebase Console to verify Google Sign-In is enabled:"
echo "https://console.firebase.google.com/project/$PROJECT_ID/authentication/providers"