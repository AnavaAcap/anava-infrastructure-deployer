#!/bin/bash

PROJECT_ID="test99-xahn"
echo "=== Testing Firebase Project Creation and Default OAuth ==="
echo "Project: ${PROJECT_ID}"
echo ""

ACCESS_TOKEN=$(gcloud auth print-access-token)

# Step 1: Add Firebase to the project using the Management API
echo "--- Step 1: Adding Firebase to project via API ---"
echo "This might trigger creation of default OAuth clients..."

# Get project number first
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
echo "Project Number: $PROJECT_NUMBER"

# Use Firebase Management API to add Firebase
FIREBASE_ADD_RESPONSE=$(curl -s -X POST \
    "https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}:addFirebase" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{}')

echo "Add Firebase response:"
echo "$FIREBASE_ADD_RESPONSE" | jq '.'

# Check if it's a long-running operation
if echo "$FIREBASE_ADD_RESPONSE" | grep -q '"name"'; then
    OPERATION_NAME=$(echo "$FIREBASE_ADD_RESPONSE" | jq -r '.name')
    echo "Waiting for operation: $OPERATION_NAME"
    
    # Poll the operation
    for i in {1..30}; do
        sleep 2
        OP_STATUS=$(curl -s -X GET \
            "https://firebase.googleapis.com/v1beta1/${OPERATION_NAME}" \
            -H "Authorization: Bearer ${ACCESS_TOKEN}")
        
        if echo "$OP_STATUS" | grep -q '"done": true'; then
            echo "✅ Firebase added successfully"
            break
        fi
        echo -n "."
    done
    echo ""
fi

# Step 2: Create a Firebase web app
echo ""
echo "--- Step 2: Creating Firebase Web App ---"
echo "This might trigger OAuth client creation..."

WEB_APP_RESPONSE=$(curl -s -X POST \
    "https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}/webApps" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
        "displayName": "Default Web App",
        "appId": "1:'${PROJECT_NUMBER}':web:auto"
    }')

echo "Create web app response:"
echo "$WEB_APP_RESPONSE" | jq '.'

# Wait if it's an operation
if echo "$WEB_APP_RESPONSE" | grep -q '"name"'; then
    OPERATION_NAME=$(echo "$WEB_APP_RESPONSE" | jq -r '.name')
    echo "Waiting for web app creation..."
    sleep 5
fi

# Step 3: Get the web app config (this might trigger OAuth creation)
echo ""
echo "--- Step 3: Getting Web App SDK Config ---"
# List web apps first
WEB_APPS=$(curl -s -X GET \
    "https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}/webApps" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}")

if echo "$WEB_APPS" | grep -q "apps"; then
    APP_ID=$(echo "$WEB_APPS" | jq -r '.apps[0].appId // empty')
    if [ -n "$APP_ID" ]; then
        echo "Found web app: $APP_ID"
        
        # Get SDK config
        SDK_CONFIG=$(curl -s -X GET \
            "https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}/webApps/${APP_ID}/config" \
            -H "Authorization: Bearer ${ACCESS_TOKEN}")
        
        echo "SDK Config:"
        echo "$SDK_CONFIG" | jq '.'
    fi
fi

# Step 4: Check if any OAuth clients were created
echo ""
echo "--- Step 4: Checking for OAuth clients ---"

# Check Identity Platform providers again
PROVIDERS=$(curl -s -X GET \
    "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "x-goog-user-project: ${PROJECT_ID}")

echo "Current providers:"
echo "$PROVIDERS" | jq '.'

# Step 5: Try a different approach - check if there's a default OAuth client via another API
echo ""
echo "--- Step 5: Checking OAuth 2.0 Credentials ---"

# This would require using the OAuth2 API
# Let's check if there are any breadcrumbs in the project

# Check API Keys (sometimes Firebase creates these)
API_KEYS=$(curl -s -X GET \
    "https://apikeys.googleapis.com/v2/projects/${PROJECT_ID}/keys" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "x-goog-user-project: ${PROJECT_ID}")

echo "API Keys in project:"
echo "$API_KEYS" | jq '.keys[] | {name: .name, displayName: .displayName}'

echo ""
echo "=== Analysis ==="
echo "Based on the test results:"
echo "1. Does adding Firebase create OAuth clients? Check above"
echo "2. Does creating a web app trigger OAuth creation? Check above"
echo "3. Are there any default OAuth clients? Check above"
echo ""
echo "The key question: How did test0727-p2pc get its OAuth client automatically?"