#!/bin/bash

PROJECT_ID="test0727-p2pc"
PROJECT_NUMBER="413554396880"
ADMIN_EMAIL="rywager@gmail.com"

echo "=== Testing Terraform OAuth Setup for Google Sign-In ==="
echo "Project: $PROJECT_ID"
echo "Admin Email: $ADMIN_EMAIL"
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
SA_NAME="terraform-oauth-test-sa"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# Check if service account exists
if gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" &>/dev/null; then
    echo "Service account already exists"
else
    gcloud iam service-accounts create "$SA_NAME" \
        --display-name="Terraform OAuth Test Service Account" \
        --project="$PROJECT_ID"
fi

# Grant necessary permissions
echo "Granting permissions..."
for role in "roles/firebase.admin" "roles/identityplatform.admin" "roles/serviceusage.serviceUsageAdmin" "roles/iap.admin"; do
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

# Create Terraform configuration with OAuth setup
cat > main.tf << 'EOF'
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
  credentials = file("./sa-key.json")
  project     = var.project_id
}

provider "google-beta" {
  credentials = file("./sa-key.json")
  project     = var.project_id
}

variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "project_number" {
  description = "The GCP project number"
  type        = string
}

variable "admin_email" {
  description = "Admin user email address"
  type        = string
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

# Initialize Firebase Auth
resource "google_identity_platform_config" "default" {
  depends_on = [
    google_project_service.firebase,
    google_project_service.identitytoolkit
  ]
  
  project = var.project_id
  
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
  
  authorized_domains = [
    "${var.project_id}.firebaseapp.com",
    "localhost"
  ]
}

# Create OAuth consent screen (brand)
resource "google_iap_brand" "project_brand" {
  provider         = google-beta
  project          = var.project_number  # Note: uses project number
  support_email    = var.admin_email
  application_title = "Anava Infrastructure"
  
  depends_on = [google_project_service.iap]
}

# Create OAuth 2.0 client
resource "google_iap_client" "project_client" {
  provider     = google-beta
  display_name = "Anava Firebase Web Client"
  brand        = google_iap_brand.project_brand.name
}

# Configure Google Sign-In with the OAuth client
resource "google_identity_platform_default_supported_idp_config" "google_provider" {
  provider = google-beta
  project  = var.project_id
  idp_id   = "google.com"
  enabled  = true
  
  client_id     = google_iap_client.project_client.client_id
  client_secret = google_iap_client.project_client.secret
  
  depends_on = [
    google_identity_platform_config.default,
    google_iap_client.project_client
  ]
}

# Outputs
output "auth_initialized" {
  value = "Firebase Authentication has been initialized with Google Sign-In!"
}

output "oauth_brand_name" {
  value = google_iap_brand.project_brand.name
}

output "oauth_client_id" {
  value = google_iap_client.project_client.client_id
  sensitive = true
}

output "oauth_client_secret" {
  value = google_iap_client.project_client.secret
  sensitive = true
}

output "google_signin_enabled" {
  value = google_identity_platform_default_supported_idp_config.google_provider.enabled
}
EOF

# Create terraform.tfvars
cat > terraform.tfvars << EOF
project_id     = "$PROJECT_ID"
project_number = "$PROJECT_NUMBER"
admin_email    = "$ADMIN_EMAIL"
EOF

echo ""
echo "=== Running Terraform ==="

# Initialize Terraform
echo "1. Initializing Terraform..."
terraform init

# Plan the changes
echo ""
echo "2. Planning changes..."
terraform plan

# Apply the configuration
echo ""
echo "3. Applying configuration..."
echo "Press ENTER to continue or Ctrl+C to cancel"
read

terraform apply -auto-approve

# Show outputs
echo ""
echo "=== Terraform Outputs ==="
terraform output

# Verify with APIs
echo ""
echo "=== Verifying Configuration ==="
ACCESS_TOKEN=$(gcloud auth print-access-token)

# Check Identity Platform config
echo "Checking Identity Platform configuration..."
CONFIG_RESPONSE=$(curl -s -X GET \
  "https://identitytoolkit.googleapis.com/v2/projects/$PROJECT_ID/config" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-goog-user-project: $PROJECT_ID")

if echo "$CONFIG_RESPONSE" | grep -q "signIn"; then
    echo "✅ Identity Platform is configured"
else
    echo "❌ Identity Platform configuration not found"
fi

# Check for Google provider
echo ""
echo "Checking Google Sign-In provider..."
PROVIDERS_RESPONSE=$(curl -s -X GET \
  "https://identitytoolkit.googleapis.com/v2/projects/$PROJECT_ID/defaultSupportedIdpConfigs" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-goog-user-project: $PROJECT_ID")

if echo "$PROVIDERS_RESPONSE" | grep -q "google.com"; then
    echo "✅ Google Sign-In provider is configured!"
    echo "$PROVIDERS_RESPONSE" | jq '.defaultSupportedIdpConfigs[] | select(.idpId == "google.com")'
else
    echo "❌ Google Sign-In provider not found"
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
echo ""
echo "To test Google Sign-In:"
echo "1. Go to Firebase Console > Authentication"
echo "2. You should see Google provider enabled"
echo "3. Click on it to see the OAuth client configuration"