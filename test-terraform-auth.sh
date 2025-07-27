#!/bin/bash

PROJECT_ID="test0727-p2pc"
PROJECT_NUMBER="413554396880"

echo "=== Testing Terraform Firebase Auth Initialization ==="
echo "Project: $PROJECT_ID"
echo ""

# Check if terraform is installed
if ! command -v terraform &> /dev/null; then
    echo "❌ Terraform is not installed. Please install it first:"
    echo "   brew install terraform"
    exit 1
fi

echo "✅ Terraform version: $(terraform version -json | jq -r '.terraform_version')"

# Create a temporary directory for Terraform files
TEMP_DIR=$(mktemp -d)
echo "Working directory: $TEMP_DIR"
cd "$TEMP_DIR"

# Create service account key for Terraform
echo ""
echo "Creating service account for Terraform..."
SA_NAME="terraform-test-sa"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# Check if service account exists
if gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" &>/dev/null; then
    echo "Service account already exists"
else
    gcloud iam service-accounts create "$SA_NAME" \
        --display-name="Terraform Test Service Account" \
        --project="$PROJECT_ID"
fi

# Grant necessary permissions
echo "Granting permissions..."
for role in "roles/firebase.admin" "roles/identityplatform.admin" "roles/serviceusage.serviceUsageAdmin"; do
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:$SA_EMAIL" \
        --role="$role" \
        --condition=None &>/dev/null
done

# Create key
KEY_FILE="$TEMP_DIR/sa-key.json"
gcloud iam service-accounts keys create "$KEY_FILE" \
    --iam-account="$SA_EMAIL" \
    --project="$PROJECT_ID" &>/dev/null

echo "✅ Service account configured"

# Create Terraform configuration
cat > main.tf << 'EOF'
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  credentials = file("./sa-key.json")
  project     = var.project_id
}

variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

# Enable required APIs (should already be enabled)
resource "google_project_service" "firebase" {
  service = "firebase.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "identitytoolkit" {
  service = "identitytoolkit.googleapis.com"
  disable_on_destroy = false
}

# This is the magic resource that initializes Firebase Auth!
resource "google_identity_platform_config" "default" {
  depends_on = [
    google_project_service.firebase,
    google_project_service.identitytoolkit
  ]
  
  project = var.project_id
  
  # Auto-delete anonymous users after 30 days
  autodelete_anonymous_users = true
  
  # Configure sign-in providers
  sign_in {
    # Enable Email/Password authentication
    email {
      enabled = true
      password_required = true
    }
    
    # Also enable anonymous auth
    anonymous {
      enabled = true
    }
  }
  
  # Authorized domains for OAuth redirects
  authorized_domains = [
    "${var.project_id}.firebaseapp.com",
    "localhost"
  ]
}

output "auth_initialized" {
  value = "Firebase Authentication has been initialized!"
}

output "config_exists" {
  value = google_identity_platform_config.default.id != null
}
EOF

# Create terraform.tfvars
cat > terraform.tfvars << EOF
project_id = "$PROJECT_ID"
EOF

echo ""
echo "=== Running Terraform ==="

# Initialize Terraform
echo "1. Initializing Terraform..."
terraform init

# Check if config already exists and try to import
echo ""
echo "2. Checking if Identity Platform config already exists..."
if terraform import google_identity_platform_config.default "projects/$PROJECT_ID" 2>/dev/null; then
    echo "✅ Existing config imported successfully"
else
    echo "ℹ️  No existing config found (this is expected for first run)"
fi

# Plan the changes
echo ""
echo "3. Planning changes..."
terraform plan

# Apply the configuration
echo ""
echo "4. Applying configuration..."
echo "Press ENTER to continue or Ctrl+C to cancel"
read

terraform apply -auto-approve

# Verify with Identity Toolkit API
echo ""
echo "=== Verifying with Identity Toolkit API ==="
ACCESS_TOKEN=$(gcloud auth print-access-token)

echo "Checking if config now exists..."
RESPONSE=$(curl -s -X GET \
  "https://identitytoolkit.googleapis.com/v2/projects/$PROJECT_ID/config" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-goog-user-project: $PROJECT_ID")

if echo "$RESPONSE" | grep -q "CONFIGURATION_NOT_FOUND"; then
    echo "❌ Config still not found!"
    echo "$RESPONSE" | jq '.'
else
    echo "✅ Success! Firebase Auth config exists!"
    echo "$RESPONSE" | jq '.'
fi

# Cleanup
echo ""
echo "=== Cleanup ==="
echo "Terraform state saved in: $TEMP_DIR"
echo "To destroy resources: cd $TEMP_DIR && terraform destroy"
echo ""
echo "To clean up completely:"
echo "  rm -rf $TEMP_DIR"
echo "  gcloud iam service-accounts delete $SA_EMAIL --project=$PROJECT_ID"