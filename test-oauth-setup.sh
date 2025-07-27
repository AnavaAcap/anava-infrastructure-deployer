#!/bin/bash

PROJECT_ID="test0727-p2pc"
PROJECT_NUMBER="413554396880"
ADMIN_EMAIL="rywager@gmail.com"  # Update this with the actual admin email

echo "=== Testing OAuth Brand and Client Creation ==="
echo "Project: $PROJECT_ID"
echo "Admin Email: $ADMIN_EMAIL"
echo ""

# Function to check if a command exists
check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo "❌ $1 is not installed"
        return 1
    fi
    return 0
}

# Check prerequisites
echo "Checking prerequisites..."
check_command gcloud || exit 1
check_command jq || exit 1

# Check if gcloud alpha component is installed
if ! gcloud components list --filter="id:alpha state.name:Installed" --format="value(id)" | grep -q alpha; then
    echo "Installing gcloud alpha component..."
    gcloud components install alpha --quiet
fi

echo "✅ All prerequisites met"
echo ""

# Enable IAP API if needed
echo "Enabling IAP API..."
gcloud services enable iap.googleapis.com --project="$PROJECT_ID"
echo "✅ IAP API enabled"
echo ""

# Step 1: Check if OAuth brand already exists
echo "Step 1: Checking for existing OAuth brand..."
EXISTING_BRANDS=$(gcloud alpha iap oauth-brands list --project="$PROJECT_ID" --format=json 2>/dev/null || echo "[]")

if [ "$EXISTING_BRANDS" != "[]" ] && [ "$(echo "$EXISTING_BRANDS" | jq length)" -gt 0 ]; then
    echo "✅ Found existing OAuth brand:"
    echo "$EXISTING_BRANDS" | jq -r '.[0] | "   Name: \(.name)\n   Support Email: \(.supportEmail)\n   Application Title: \(.applicationTitle)"'
    BRAND_NAME=$(echo "$EXISTING_BRANDS" | jq -r '.[0].name')
else
    echo "No existing OAuth brand found. Creating one..."
    
    # Create OAuth brand
    BRAND_OUTPUT=$(gcloud alpha iap oauth-brands create \
        --project="$PROJECT_ID" \
        --support_email="$ADMIN_EMAIL" \
        --application_title="Anava Infrastructure" \
        --format=json 2>&1)
    
    if [ $? -eq 0 ]; then
        BRAND_NAME=$(echo "$BRAND_OUTPUT" | jq -r '.name')
        echo "✅ Created OAuth brand: $BRAND_NAME"
    else
        echo "❌ Failed to create OAuth brand:"
        echo "$BRAND_OUTPUT"
        exit 1
    fi
fi

echo ""

# Step 2: Check for existing OAuth clients
echo "Step 2: Checking for existing OAuth clients..."
EXISTING_CLIENTS=$(gcloud alpha iap oauth-clients list "$BRAND_NAME" --project="$PROJECT_ID" --format=json 2>/dev/null || echo "[]")

if [ "$EXISTING_CLIENTS" != "[]" ] && [ "$(echo "$EXISTING_CLIENTS" | jq length)" -gt 0 ]; then
    echo "✅ Found existing OAuth clients:"
    for client in $(echo "$EXISTING_CLIENTS" | jq -r '.[] | @base64'); do
        _jq() {
            echo ${client} | base64 --decode | jq -r ${1}
        }
        echo "   Name: $(_jq '.name')"
        echo "   Display Name: $(_jq '.displayName')"
        echo "   Client ID: $(_jq '.clientId')"
        echo ""
    done
else
    echo "No existing OAuth clients found."
fi

# Step 3: Create a new OAuth client
echo ""
echo "Step 3: Creating new OAuth client for Firebase..."
CLIENT_OUTPUT=$(gcloud alpha iap oauth-clients create "$BRAND_NAME" \
    --display_name="Anava Firebase Web Client" \
    --project="$PROJECT_ID" \
    --format=json 2>&1)

if [ $? -eq 0 ]; then
    CLIENT_ID=$(echo "$CLIENT_OUTPUT" | jq -r '.clientId')
    CLIENT_SECRET=$(echo "$CLIENT_OUTPUT" | jq -r '.secret')
    
    echo "✅ Created OAuth client:"
    echo "   Client ID: $CLIENT_ID"
    echo "   Client Secret: $CLIENT_SECRET"
    echo ""
    
    # Save to a file for later use
    cat > oauth-client-config.json << EOF
{
  "client_id": "$CLIENT_ID",
  "client_secret": "$CLIENT_SECRET",
  "brand_name": "$BRAND_NAME",
  "project_id": "$PROJECT_ID"
}
EOF
    
    echo "✅ OAuth client configuration saved to: oauth-client-config.json"
else
    echo "❌ Failed to create OAuth client:"
    echo "$CLIENT_OUTPUT"
    
    # If it failed because a client already exists, try to list them
    if echo "$CLIENT_OUTPUT" | grep -q "already exists"; then
        echo ""
        echo "Attempting to retrieve existing client..."
        CLIENTS=$(gcloud alpha iap oauth-clients list "$BRAND_NAME" --project="$PROJECT_ID" --format=json)
        if [ "$(echo "$CLIENTS" | jq length)" -gt 0 ]; then
            # Get the first client
            CLIENT_ID=$(echo "$CLIENTS" | jq -r '.[0].clientId')
            echo "Found existing client ID: $CLIENT_ID"
            echo "Note: Client secret cannot be retrieved for existing clients"
        fi
    fi
fi

echo ""
echo "=== Testing Google Sign-In Configuration ==="

# Step 4: Configure Google Sign-In with the OAuth client
echo "Step 4: Configuring Google Sign-In provider in Identity Platform..."

# First, check if Identity Platform config exists
ACCESS_TOKEN=$(gcloud auth print-access-token)
CONFIG_URL="https://identitytoolkit.googleapis.com/v2/projects/$PROJECT_ID/config"

echo "Checking Identity Platform configuration..."
CONFIG_RESPONSE=$(curl -s -X GET \
    "$CONFIG_URL" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "x-goog-user-project: $PROJECT_ID")

if echo "$CONFIG_RESPONSE" | grep -q "CONFIGURATION_NOT_FOUND"; then
    echo "❌ Identity Platform not configured. Run test-terraform-auth.sh first!"
    exit 1
fi

echo "✅ Identity Platform is configured"

# Now configure Google provider using the REST API
# Note: The v2 API doesn't directly support configuring OAuth providers
# This is typically done through the Firebase Console or Terraform

echo ""
echo "=== Summary ==="
echo "✅ OAuth brand created/found: $BRAND_NAME"
if [ ! -z "$CLIENT_ID" ]; then
    echo "✅ OAuth client ID: $CLIENT_ID"
fi
echo ""
echo "To complete Google Sign-In setup:"
echo "1. Use these credentials in your Terraform configuration:"
echo "   - client_id = \"$CLIENT_ID\""
echo "   - client_secret = \"$CLIENT_SECRET\""
echo ""
echo "2. Or manually configure in Firebase Console:"
echo "   - Go to Authentication > Sign-in method"
echo "   - Enable Google provider"
echo "   - Add the client ID and secret"
echo ""
echo "3. Configure authorized redirect URIs in GCP Console:"
echo "   - Go to APIs & Services > Credentials"
echo "   - Edit the OAuth 2.0 Client ID"
echo "   - Add authorized redirect URIs for your application"