#!/bin/bash

PROJECT_ID="test99-xahn"
echo "=== Testing Google Sign-In without providing credentials ==="
echo "Hypothesis: Maybe Firebase auto-creates OAuth if we don't provide any"
echo ""

ACCESS_TOKEN=$(gcloud auth print-access-token)

# First, delete the existing fake config
echo "--- Step 1: Removing existing fake Google provider config ---"
DELETE_RESPONSE=$(curl -s -X DELETE \
    "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs/google.com" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "x-goog-user-project: ${PROJECT_ID}")

echo "Delete response: $DELETE_RESPONSE"
sleep 2

# Verify it's gone
echo ""
echo "Verifying deletion:"
curl -s -X GET \
    "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "x-goog-user-project: ${PROJECT_ID}" | jq '.'

# Now try different approaches
echo ""
echo "--- Step 2: Testing different ways to enable without credentials ---"

# Attempt 1: Just enabled=true, no clientId/clientSecret at all
echo ""
echo "Attempt 1: Only 'enabled: true'"
ATTEMPT1=$(curl -s -X POST \
    "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs?idpId=google.com" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -H "x-goog-user-project: ${PROJECT_ID}" \
    -d '{"enabled": true}')
echo "$ATTEMPT1" | jq '.'

# Attempt 2: With null values
echo ""
echo "Attempt 2: With null clientId and clientSecret"
ATTEMPT2=$(curl -s -X POST \
    "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs?idpId=google.com" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -H "x-goog-user-project: ${PROJECT_ID}" \
    -d '{"enabled": true, "clientId": null, "clientSecret": null}')
echo "$ATTEMPT2" | jq '.'

# Attempt 3: Try to trigger auto-creation by accessing a different endpoint
echo ""
echo "--- Step 3: Checking Firebase-specific endpoints ---"

# Maybe there's a Firebase-specific API that triggers OAuth creation
echo "Checking Firebase Auth providers endpoint..."
FIREBASE_PROVIDERS=$(curl -s -X GET \
    "https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}/androidApps" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "x-goog-user-project: ${PROJECT_ID}" 2>&1)

# Check if creating a Firebase app triggers OAuth
echo ""
echo "--- Step 4: Creating a Firebase Web App to see if it triggers OAuth ---"
WEB_APP_CREATE=$(curl -s -X POST \
    "https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}/webApps" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -H "x-goog-user-project: ${PROJECT_ID}" \
    -d '{"displayName": "Test Web App"}' 2>&1)

echo "Web app creation response:"
echo "$WEB_APP_CREATE" | jq '.' 2>/dev/null || echo "$WEB_APP_CREATE"

# Final check
echo ""
echo "--- Step 5: Final check of providers ---"
FINAL_CHECK=$(curl -s -X GET \
    "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "x-goog-user-project: ${PROJECT_ID}")

echo "Final providers state:"
echo "$FINAL_CHECK" | jq '.'

echo ""
echo "=== Analysis ==="
echo "Based on the tests above:"
echo "1. Does omitting credentials trigger auto-creation? Check results"
echo "2. Does Firebase have a different API that creates OAuth? Check results"
echo "3. The Firebase Console must be using a private/internal API we can't access"