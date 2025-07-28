#!/bin/bash

PROJECT_ID="test0727-p2pc"
PROJECT_NUMBER="413554396880"
ADMIN_EMAIL="rywager@gmail.com"

echo "=== Testing Direct Terraform OAuth Configuration ==="
echo "Project: $PROJECT_ID"
echo "Project Number: $PROJECT_NUMBER"
echo "Admin Email: $ADMIN_EMAIL"
echo ""

# Create a temporary directory
TEMP_DIR=$(mktemp -d)
echo "Working directory: $TEMP_DIR"
cd "$TEMP_DIR"

# Create service account key
echo "Creating service account key..."
SA_NAME="terraform-oauth-direct-test"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# Check if service account exists
if ! gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" &>/dev/null; then
    gcloud iam service-accounts create "$SA_NAME" \
        --display-name="Terraform OAuth Direct Test" \
        --project="$PROJECT_ID"
fi

# Grant permissions
for role in "roles/firebase.admin" "roles/identityplatform.admin" "roles/iap.admin" "roles/serviceusage.serviceUsageAdmin"; do
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

# Create the same Terraform config that TerraformService would create
cat > main.tf << EOF
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  credentials = file("${KEY_FILE}")
  project     = "${PROJECT_ID}"
}

provider "google-beta" {
  credentials = file("${KEY_FILE}")
  project     = "${PROJECT_ID}"
}

# Enable required APIs
resource "google_project_service" "firebase" {
  service = "firebase.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "identitytoolkit" {
  service = "identitytoolkit.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "iap" {
  service = "iap.googleapis.com"
  disable_on_destroy = false
}

# Initialize Firebase Auth configuration
resource "google_identity_platform_config" "default" {
  depends_on = [
    google_project_service.firebase,
    google_project_service.identitytoolkit
  ]
  
  project = "${PROJECT_ID}"
  
  autodelete_anonymous_users = true
  
  sign_in {
    email {
      enabled = true
      password_required = true
    }
    
    anonymous {
      enabled = true
    }
  }
  
  authorized_domains = ["${PROJECT_ID}.firebaseapp.com", "localhost"]
}

# Create OAuth consent screen (brand)
resource "google_iap_brand" "firebase_oauth_brand" {
  provider         = google-beta
  project          = "${PROJECT_NUMBER}"
  support_email    = "${ADMIN_EMAIL}"
  application_title = "Anava Infrastructure"
  
  depends_on = [google_project_service.iap]
}

# Create OAuth 2.0 client for Firebase Google Sign-In
resource "google_iap_client" "firebase_oauth_client" {
  provider     = google-beta
  display_name = "Firebase Google Sign-In Client"
  brand        = google_iap_brand.firebase_oauth_brand.name
}

# Configure Google Sign-In provider with the OAuth client
resource "google_identity_platform_default_supported_idp_config" "google_provider" {
  provider = google-beta
  project  = "${PROJECT_ID}"
  idp_id   = "google.com"
  enabled  = true
  
  client_id     = google_iap_client.firebase_oauth_client.client_id
  client_secret = google_iap_client.firebase_oauth_client.secret
  
  depends_on = [
    google_identity_platform_config.default,
    google_iap_client.firebase_oauth_client
  ]
}

# Outputs
output "oauth_client_id" {
  value = google_iap_client.firebase_oauth_client.client_id
  sensitive = true
}

output "google_signin_enabled" {
  value = google_identity_platform_default_supported_idp_config.google_provider.enabled
}
EOF

echo ""
echo "=== Running Terraform ==="

# Initialize
echo "1. Initializing Terraform..."
terraform init

# Import existing resources
echo ""
echo "2. Importing existing resources..."
terraform import google_identity_platform_config.default "projects/$PROJECT_ID" 2>/dev/null || true
terraform import google_iap_brand.firebase_oauth_brand "projects/$PROJECT_NUMBER/brands/$PROJECT_NUMBER" 2>/dev/null || true

# Plan
echo ""
echo "3. Planning changes..."
terraform plan

# Apply
echo ""
echo "4. Applying configuration..."
echo "Press ENTER to continue or Ctrl+C to cancel"
read

terraform apply -auto-approve

# Show outputs
echo ""
echo "=== Terraform Outputs ==="
terraform output

# Cleanup instructions
echo ""
echo "=== Cleanup ==="
echo "To destroy resources: cd $TEMP_DIR && terraform destroy"
echo "To clean up completely:"
echo "  rm -rf $TEMP_DIR"
echo "  gcloud iam service-accounts delete $SA_EMAIL --project=$PROJECT_ID"