#!/bin/bash

# Test script for admin user creation flow
# This simulates what deploymentEngine.ts does after Firebase is set up

PROJECT_ID="testmonday1-xrka"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="SecurePass123!"

echo "Testing admin user creation for project: $PROJECT_ID"
echo "================================================"

# Step 1: Get Firebase web app ID
echo "1. Getting Firebase web app ID..."
TOKEN=$(cat /tmp/token_clean.txt)
APP_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
  -H "x-goog-user-project: $PROJECT_ID" \
  "https://firebase.googleapis.com/v1beta1/projects/$PROJECT_ID/webApps")

APP_ID=$(echo "$APP_RESPONSE" | jq -r '.apps[0].appId')
if [ -z "$APP_ID" ] || [ "$APP_ID" == "null" ]; then
  echo "❌ No Firebase web app found"
  exit 1
fi
echo "✅ Found app ID: $APP_ID"

# Step 2: Get Firebase SDK config with API key
echo -e "\n2. Getting Firebase API key..."
CONFIG_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
  -H "x-goog-user-project: $PROJECT_ID" \
  "https://firebase.googleapis.com/v1beta1/projects/$PROJECT_ID/webApps/$APP_ID/config")

API_KEY=$(echo "$CONFIG_RESPONSE" | jq -r '.apiKey')
if [ -z "$API_KEY" ] || [ "$API_KEY" == "null" ]; then
  echo "❌ Failed to get Firebase API key"
  exit 1
fi
echo "✅ Got API key: ${API_KEY:0:10}..."

# Step 3: Create admin user
echo -e "\n3. Creating admin user..."
CREATE_RESPONSE=$(curl -s -X POST \
  "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=$API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\",
    \"returnSecureToken\": true
  }")

USER_ID=$(echo "$CREATE_RESPONSE" | jq -r '.localId')
ERROR=$(echo "$CREATE_RESPONSE" | jq -r '.error.message // empty')

if [ -n "$ERROR" ]; then
  if [[ "$ERROR" == *"EMAIL_EXISTS"* ]]; then
    echo "⚠️  Admin user already exists (this is OK)"
  else
    echo "❌ Failed to create admin user: $ERROR"
    exit 1
  fi
else
  echo "✅ Created admin user: $ADMIN_EMAIL (ID: $USER_ID)"
fi

# Step 4: Test sign in
echo -e "\n4. Testing sign in..."
SIGNIN_RESPONSE=$(curl -s -X POST \
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\",
    \"returnSecureToken\": true
  }")

ID_TOKEN=$(echo "$SIGNIN_RESPONSE" | jq -r '.idToken')
SIGNIN_ERROR=$(echo "$SIGNIN_RESPONSE" | jq -r '.error.message // empty')

if [ -n "$SIGNIN_ERROR" ]; then
  echo "❌ Failed to sign in: $SIGNIN_ERROR"
  exit 1
fi

if [ -n "$ID_TOKEN" ] && [ "$ID_TOKEN" != "null" ]; then
  echo "✅ Sign in successful! Got ID token"
else
  echo "❌ Sign in failed - no ID token received"
  exit 1
fi

echo -e "\n✅ All tests passed! Admin user creation flow is working correctly."
echo "The deployment code should work properly with version 0.9.41"