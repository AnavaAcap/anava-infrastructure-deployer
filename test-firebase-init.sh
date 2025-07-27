#!/bin/bash

# Test Firebase initialization APIs using curl
# Usage: ./test-firebase-init.sh <project-id>

PROJECT_ID=$1

if [ -z "$PROJECT_ID" ]; then
    echo "Usage: ./test-firebase-init.sh <project-id>"
    echo "Example: ./test-firebase-init.sh my-test-project"
    exit 1
fi

echo "🧪 Testing Firebase initialization for project: $PROJECT_ID"
echo ""

# Get access token
echo "Getting access token..."
ACCESS_TOKEN=$(gcloud auth print-access-token)

if [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ Failed to get access token. Make sure you're logged in with: gcloud auth login"
    exit 1
fi

echo "✅ Got access token"
echo ""

# Step 1: Add Firebase to project
echo "1️⃣ Adding Firebase to project..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}:addFirebase" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Firebase added successfully"
elif [ "$HTTP_CODE" = "409" ]; then
    echo "✅ Firebase already enabled"
else
    echo "❌ Failed to add Firebase (HTTP $HTTP_CODE)"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
fi

sleep 3

# Step 2: Set default location
echo ""
echo "2️⃣ Setting default location..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}/defaultLocation:finalize" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"locationId": "us-central"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Default location set to us-central"
elif [ "$HTTP_CODE" = "409" ]; then
    echo "✅ Default location already set"
else
    echo "❌ Failed to set location (HTTP $HTTP_CODE)"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
fi

sleep 3

# Step 3: Test Authentication initialization
echo ""
echo "3️⃣ Testing Authentication initialization..."

# Check if config exists
echo "   Checking if auth config exists..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET \
  "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/config" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Auth config already exists"
elif [ "$HTTP_CODE" = "404" ]; then
    echo "   ⚠️  Auth config does not exist"
fi

# Try POST with updateMask
echo ""
echo "   Trying POST with updateMask..."
UPDATE_MASK="signIn.email.enabled,signIn.email.passwordRequired,signIn.google.enabled,signIn.anonymous.enabled"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/config?updateMask=${UPDATE_MASK}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "signIn": {
      "email": {"enabled": true, "passwordRequired": true},
      "google": {"enabled": true},
      "anonymous": {"enabled": true}
    }
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ POST with updateMask succeeded! Auth initialized."
else
    echo "   ❌ POST failed (HTTP $HTTP_CODE)"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
    
    # Try PATCH as fallback
    echo ""
    echo "   Trying PATCH as fallback..."
    RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH \
      "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/config?updateMask=${UPDATE_MASK}" \
      -H "Authorization: Bearer ${ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{
        "signIn": {
          "email": {"enabled": true, "passwordRequired": true},
          "google": {"enabled": true}
        }
      }')
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    if [ "$HTTP_CODE" = "200" ]; then
        echo "   ✅ PATCH succeeded!"
    else
        echo "   ❌ PATCH also failed (HTTP $HTTP_CODE)"
    fi
fi

# Step 4: Test Storage
echo ""
echo "4️⃣ Testing Storage initialization..."
BUCKET_NAME="${PROJECT_ID}-test-firebase-storage"

# Check if standard bucket exists first
echo "   Checking for standard Firebase buckets..."
for BUCKET in "${PROJECT_ID}.appspot.com" "${PROJECT_ID}.firebasestorage.app"; do
    RESPONSE=$(gsutil ls -b gs://${BUCKET} 2>&1)
    if [ $? -eq 0 ]; then
        echo "   ✅ Found existing bucket: $BUCKET"
        BUCKET_NAME=$BUCKET
        break
    fi
done

# Try addFirebase API
echo ""
echo "   Trying buckets:addFirebase API..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "https://firebasestorage.googleapis.com/v1beta/projects/${PROJECT_ID}/buckets/${BUCKET_NAME}:addFirebase" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ buckets:addFirebase succeeded!"
else
    echo "   ❌ addFirebase failed (HTTP $HTTP_CODE)"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
fi

echo ""
echo "✨ Test complete! Check Firebase Console:"
echo "   Auth: https://console.firebase.google.com/project/${PROJECT_ID}/authentication"
echo "   Storage: https://console.firebase.google.com/project/${PROJECT_ID}/storage"