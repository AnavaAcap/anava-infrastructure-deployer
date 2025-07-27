#!/bin/bash

# Quick test of specific Firebase APIs
# This tests individual API calls to see what works

echo "🧪 Quick Firebase API Test"
echo ""

# Get access token - try application default first, then user auth
ACCESS_TOKEN=$(gcloud auth application-default print-access-token 2>/dev/null)
if [ -z "$ACCESS_TOKEN" ]; then
    ACCESS_TOKEN=$(gcloud auth print-access-token 2>/dev/null)
    if [ -z "$ACCESS_TOKEN" ]; then
        echo "❌ Not logged in. Run: gcloud auth login"
        exit 1
    fi
fi

# Get current project
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    echo "❌ No project set. Run: gcloud config set project YOUR-PROJECT-ID"
    exit 1
fi

echo "Project: $PROJECT_ID"
echo ""

# Test 1: Check Firebase project status
echo "1️⃣ Checking Firebase project status..."
curl -s -X GET \
  "https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" | jq '.resources' 2>/dev/null || echo "Project not found or Firebase not enabled"

echo ""

# Test 2: Check if location is set
echo "2️⃣ Checking default location..."
curl -s -X GET \
  "https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" | jq '.resources.locationId' 2>/dev/null || echo "No location set"

echo ""

# Test 3: Check Auth config with different endpoints
echo "3️⃣ Testing Auth endpoints..."

# v2 config endpoint
echo "   Testing v2/config endpoint..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET \
  "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/config" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")
echo "   v2/config: HTTP $HTTP_CODE"

# Admin endpoint
echo "   Testing admin/v2 endpoint..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")
echo "   admin/v2/config: HTTP $HTTP_CODE"

echo ""

# Test 4: List Firebase web apps
echo "4️⃣ Listing Firebase web apps..."
curl -s -X GET \
  "https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}/webApps" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" | jq '.apps[]?.displayName' 2>/dev/null || echo "No web apps found"

echo ""

# Test 5: Check available storage buckets
echo "5️⃣ Checking storage buckets..."
gsutil ls -p $PROJECT_ID 2>/dev/null | grep -E "(appspot\.com|firebasestorage\.app|firebase-storage)" || echo "No Firebase storage buckets found"

echo ""
echo "✅ Quick test complete"