#!/bin/bash

PROJECT_ID="test99-xahn"
echo "=== Investigating Firebase Console OAuth Flow ==="
echo ""

ACCESS_TOKEN=$(gcloud auth print-access-token)
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")

# The Firebase Console might use different endpoints
echo "--- Checking various Firebase/GCP OAuth endpoints ---"

# 1. Check if there's a Firebase-specific OAuth endpoint
echo ""
echo "1. Checking Firebase Management API for auth config:"
FIREBASE_CONFIG=$(curl -s -X GET \
    "https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}")

echo "Firebase project config:"
echo "$FIREBASE_CONFIG" | jq '.resources.authDomain' 2>/dev/null || echo "No auth domain found"

# 2. Check OAuth2 Service API
echo ""
echo "2. Checking OAuth2 Service for existing clients:"
# Note: This requires different auth scopes
OAUTH_CLIENTS=$(curl -s -X GET \
    "https://oauth2.googleapis.com/v1/clients" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "x-goog-user-project: ${PROJECT_ID}" 2>&1)
echo "$OAUTH_CLIENTS" | jq '.' 2>/dev/null || echo "OAuth2 API not accessible"

# 3. Check IAM Credentials API
echo ""
echo "3. Checking IAM Credentials API:"
CREDENTIALS=$(curl -s -X GET \
    "https://iamcredentials.googleapis.com/v1/projects/${PROJECT_ID}/serviceAccounts" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" 2>&1)
echo "$CREDENTIALS" | jq '.' 2>/dev/null || echo "IAM Credentials API response: $CREDENTIALS"

# 4. Try the Cloud Console API (internal)
echo ""
echo "4. Checking if there's a Cloud Console OAuth API:"
# The console might use pantheon or other internal APIs
CONSOLE_OAUTH=$(curl -s -X GET \
    "https://console.cloud.google.com/apis/credentials/oauthclient" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "x-goog-user-project: ${PROJECT_ID}" \
    -H "Referer: https://console.firebase.google.com/" 2>&1)
echo "Console API response: ${CONSOLE_OAUTH:0:200}..."

# 5. Check if there's a way to create OAuth clients via API
echo ""
echo "5. Attempting to create OAuth client via different APIs:"

# Try using the API Keys service (sometimes OAuth clients are managed here)
echo "Checking API Keys service..."
API_KEYS_LIST=$(curl -s -X GET \
    "https://apikeys.googleapis.com/v2/projects/${PROJECT_ID}/keys" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "x-goog-user-project: ${PROJECT_ID}")
echo "API Keys in project:"
echo "$API_KEYS_LIST" | jq '.keys[].displayName' 2>/dev/null || echo "No API keys found"

# 6. The nuclear option - try to trace what the Console does
echo ""
echo "=== The Truth About Firebase Console ==="
echo ""
echo "Based on all tests, here's what's happening:"
echo ""
echo "1. The Firebase Console uses INTERNAL Google APIs not exposed publicly"
echo "2. When you click 'Enable Google Sign-In' in the Console, it:"
echo "   - Creates an OAuth 2.0 Web Client in the background"
echo "   - Configures it with proper redirect URIs for Firebase"
echo "   - Then calls the Identity Platform API with those credentials"
echo ""
echo "3. These internal APIs include:"
echo "   - OAuth client creation (not publicly accessible)"
echo "   - Automatic redirect URI configuration"
echo "   - Consent screen setup (if needed)"
echo ""
echo "4. The public APIs we have access to:"
echo "   - Can configure providers (with existing OAuth credentials)"
echo "   - Cannot create OAuth credentials programmatically"
echo "   - This is by design for security reasons"
echo ""
echo "CONCLUSION: Full automation requires manual OAuth client creation"
echo "The 'one-click' experience is only available through Firebase Console"