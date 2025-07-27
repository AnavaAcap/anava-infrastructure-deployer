#!/bin/bash

# Test script to verify Firebase Auth and Storage initialization fixes
# Using the test project from the logs: test0727-p2pc

PROJECT_ID="test0727-p2pc"
PROJECT_NUMBER="413554396880"

echo "🧪 Testing Firebase initialization fixes for project: $PROJECT_ID"
echo ""

# Get access token
ACCESS_TOKEN=$(gcloud auth application-default print-access-token 2>/dev/null)
if [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ Not authenticated. Run: gcloud auth application-default login"
    exit 1
fi

echo "✅ Got access token"
echo ""

# Test 1: Firebase Authentication with corrected payload
echo "1️⃣ Testing Firebase Authentication initialization with idpConfigs..."
AUTH_CONFIG_URL="https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/config"
# First check if the API is enabled
echo "   Checking if Identity Toolkit API is enabled..."
API_CHECK=$(gcloud services list --enabled --project=$PROJECT_ID 2>/dev/null | grep identitytoolkit || true)
if [ -z "$API_CHECK" ]; then
    echo "   ❌ Identity Toolkit API is NOT enabled!"
    echo "   To fix: gcloud services enable identitytoolkit.googleapis.com --project=$PROJECT_ID"
    echo ""
else
    echo "   ✅ Identity Toolkit API is enabled"
fi

# Let's try a simpler approach - just email/password first
UPDATE_MASK="signIn.email.enabled,signIn.email.passwordRequired,signIn.anonymous.enabled"

echo "   PATCH to: $AUTH_CONFIG_URL?updateMask=$UPDATE_MASK"
echo ""

echo "   Using PATCH method to update config (email/password only)..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH \
  "${AUTH_CONFIG_URL}?updateMask=${UPDATE_MASK}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "signIn": {
      "email": {
        "enabled": true,
        "passwordRequired": true
      },
      "anonymous": {
        "enabled": true
      }
    }
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ SUCCESS! Auth config updated (HTTP $HTTP_CODE)"
    echo "   Response: $(echo "$BODY" | jq -c . 2>/dev/null || echo "$BODY")"
else
    echo "   ❌ Failed (HTTP $HTTP_CODE)"
    echo "   Error: $(echo "$BODY" | jq -r '.error.message' 2>/dev/null || echo "$BODY")"
fi

echo ""

# Test 2: Check Firebase Storage service agent
echo "2️⃣ Checking Firebase Storage service agent permissions..."
STORAGE_SA="service-${PROJECT_NUMBER}@gcp-sa-firebasestorage.iam.gserviceaccount.com"
echo "   Service account: $STORAGE_SA"

# Get current IAM policy
echo "   Checking IAM policy..."
IAM_POLICY=$(gcloud projects get-iam-policy $PROJECT_ID --flatten="bindings[].members" --filter="bindings.members:serviceAccount:${STORAGE_SA}" --format="table(bindings.role)" 2>/dev/null)

if [[ "$IAM_POLICY" == *"storage.admin"* ]]; then
    echo "   ✅ Storage service agent has Storage Admin role"
else
    echo "   ❌ Storage service agent does NOT have Storage Admin role"
    echo "   To fix, run:"
    echo "   gcloud projects add-iam-policy-binding $PROJECT_ID \\"
    echo "     --member=\"serviceAccount:$STORAGE_SA\" \\"
    echo "     --role=\"roles/storage.admin\""
    
    echo ""
    echo "   Granting Storage Admin role now..."
    gcloud projects add-iam-policy-binding $PROJECT_ID \
      --member="serviceAccount:$STORAGE_SA" \
      --role="roles/storage.admin" 2>/dev/null && echo "   ✅ Role granted successfully!" || echo "   ❌ Failed to grant role"
fi

echo ""

# Test 3: Firebase Storage bucket linking
echo "3️⃣ Testing Firebase Storage bucket linking..."
BUCKET_NAME="${PROJECT_ID}-firebase-storage"

# Check if bucket exists
if gsutil ls -b gs://${BUCKET_NAME} 2>/dev/null; then
    echo "   ✅ Bucket exists: $BUCKET_NAME"
    
    # Try to link it to Firebase
    echo "   Attempting to link bucket to Firebase..."
    
    LINK_URL="https://firebasestorage.googleapis.com/v1beta/projects/${PROJECT_ID}/buckets/${BUCKET_NAME}:addFirebase"
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
      "$LINK_URL" \
      -H "Authorization: Bearer ${ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{}')
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "   ✅ SUCCESS! Bucket linked to Firebase"
    elif [ "$HTTP_CODE" = "409" ]; then
        echo "   ✅ Bucket already linked to Firebase"
    elif [ "$HTTP_CODE" = "403" ]; then
        echo "   ❌ Permission denied - Storage service agent needs permissions"
        echo "   $(echo "$BODY" | jq -r '.error.message' 2>/dev/null || echo "$BODY")"
    else
        echo "   ❌ Failed to link bucket (HTTP $HTTP_CODE)"
        echo "   $(echo "$BODY" | jq -r '.error.message' 2>/dev/null || echo "$BODY")"
    fi
else
    echo "   ⚠️  Bucket does not exist: $BUCKET_NAME"
fi

echo ""

# Test 4: Try creating default Storage bucket
echo "4️⃣ Testing default Firebase Storage bucket creation..."
DEFAULT_BUCKET_URL="https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}/defaultBucket:add"

echo "   POST to: $DEFAULT_BUCKET_URL"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "$DEFAULT_BUCKET_URL" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ SUCCESS! Default bucket created"
elif [ "$HTTP_CODE" = "409" ]; then
    echo "   ✅ Default bucket already exists"
else
    echo "   ❌ Failed (HTTP $HTTP_CODE)"
    echo "   $(echo "$BODY" | jq -r '.error.message' 2>/dev/null || echo "$BODY")"
fi

echo ""
echo "✅ Test complete!"