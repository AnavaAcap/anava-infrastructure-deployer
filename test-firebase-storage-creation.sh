#!/bin/bash

# Test script to verify Firebase Storage bucket creation approach

echo "🧪 Testing Firebase Storage Bucket Creation"
echo "=========================================="

# Get user input
read -p "Enter project ID: " PROJECT_ID

# Get access token using user credentials
ACCESS_TOKEN=$(gcloud auth print-access-token)

echo ""
echo "1️⃣ Checking existing buckets..."
echo "--------------------------------"

# Check for existing Firebase buckets
for BUCKET in "${PROJECT_ID}.appspot.com" "${PROJECT_ID}.firebasestorage.app"; do
    echo -n "Checking $BUCKET: "
    if gsutil ls -b "gs://$BUCKET" &>/dev/null; then
        echo "✅ EXISTS"
    else
        echo "❌ NOT FOUND"
    fi
done

# Check for custom bucket
CUSTOM_BUCKET="${PROJECT_ID}-firebase-storage"
echo -n "Checking $CUSTOM_BUCKET: "
if gsutil ls -b "gs://$CUSTOM_BUCKET" &>/dev/null; then
    echo "✅ EXISTS"
else
    echo "❌ NOT FOUND"
fi

echo ""
echo "2️⃣ Testing defaultBucket:add API..."
echo "-----------------------------------"

# Try to create default bucket
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}/defaultBucket:add" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

echo "HTTP Response Code: $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Default bucket creation initiated successfully!"
    echo "Response: $BODY"
    
    # Wait and check
    echo ""
    echo "Waiting 10 seconds for bucket creation..."
    sleep 10
    
    echo ""
    echo "3️⃣ Verifying bucket creation..."
    echo "--------------------------------"
    
    DEFAULT_BUCKET="${PROJECT_ID}.appspot.com"
    if gsutil ls -b "gs://$DEFAULT_BUCKET" &>/dev/null; then
        echo "✅ Default bucket created successfully!"
        echo ""
        echo "4️⃣ Checking bucket details..."
        gsutil ls -L -b "gs://$DEFAULT_BUCKET" | grep -E "(Location|Storage class|Bucket Policy Only)"
    else
        echo "❌ Default bucket not found after creation"
    fi
elif [ "$HTTP_CODE" = "409" ]; then
    echo "⚠️  Conflict - bucket might already exist"
    echo "Response: $BODY"
elif [ "$HTTP_CODE" = "403" ]; then
    echo "❌ Permission denied"
    echo "Response: $BODY"
    echo ""
    echo "Make sure:"
    echo "1. Firebase is enabled for the project"
    echo "2. Service account has necessary permissions"
    echo "3. Firebase Storage APIs are enabled"
else
    echo "❌ Unexpected response"
    echo "Response: $BODY"
fi

echo ""
echo "5️⃣ Testing bucket linking (if bucket exists)..."
echo "-----------------------------------------------"

# If default bucket exists, test linking
DEFAULT_BUCKET="${PROJECT_ID}.appspot.com"
if gsutil ls -b "gs://$DEFAULT_BUCKET" &>/dev/null; then
    echo "Testing buckets:addFirebase API..."
    
    LINK_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
      "https://firebasestorage.googleapis.com/v1beta/projects/${PROJECT_ID}/buckets/${DEFAULT_BUCKET}:addFirebase" \
      -H "Authorization: Bearer ${ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{}')
    
    LINK_CODE=$(echo "$LINK_RESPONSE" | tail -n1)
    LINK_BODY=$(echo "$LINK_RESPONSE" | head -n-1)
    
    echo "HTTP Response Code: $LINK_CODE"
    
    if [ "$LINK_CODE" = "200" ]; then
        echo "✅ Bucket successfully linked to Firebase!"
    elif [ "$LINK_CODE" = "409" ]; then
        echo "✅ Bucket already linked to Firebase"
    else
        echo "⚠️  Could not link bucket: $LINK_BODY"
    fi
fi

echo ""
echo "✅ Test complete!"