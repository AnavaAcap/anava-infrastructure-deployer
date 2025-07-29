#!/bin/bash

PROJECT_ID="testdada-n73m"
ACCESS_TOKEN=$(gcloud auth print-access-token)

echo "Testing simplified Firebase Rules API..."

# Step 1: Create ruleset
echo "Creating ruleset..."
RULESET_RESPONSE=$(curl -s -X POST \
  "https://firebaserules.googleapis.com/v1/projects/$PROJECT_ID/rulesets" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-goog-user-project: $PROJECT_ID" \
  -d '{
    "source": {
      "files": [{
        "name": "firestore.rules",
        "content": "rules_version = '\''2'\'';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if request.auth != null;\n    }\n  }\n}"
      }]
    }
  }')

RULESET_NAME=$(echo $RULESET_RESPONSE | jq -r '.name')
echo "Created ruleset: $RULESET_NAME"

# Step 2: Try to patch existing release WITHOUT the release wrapper
echo -e "\nTrying to patch existing release (without wrapper)..."
RELEASE_NAME="projects/$PROJECT_ID/releases/cloud.firestore"

PATCH_RESPONSE=$(curl -s -X PATCH \
  "https://firebaserules.googleapis.com/v1/$RELEASE_NAME?updateMask=rulesetName" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-goog-user-project: $PROJECT_ID" \
  -d "{
    \"rulesetName\": \"$RULESET_NAME\"
  }")

echo "Patch response: $PATCH_RESPONSE"

# Also test with the wrapper to see the difference
echo -e "\nTrying to patch with release wrapper..."
PATCH_RESPONSE2=$(curl -s -X PATCH \
  "https://firebaserules.googleapis.com/v1/$RELEASE_NAME?updateMask=release.rulesetName" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-goog-user-project: $PROJECT_ID" \
  -d "{
    \"release\": {
      \"rulesetName\": \"$RULESET_NAME\"
    }
  }")

echo "Patch response 2: $PATCH_RESPONSE2"