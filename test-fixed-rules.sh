#!/bin/bash

PROJECT_ID="testdada-n73m"
ACCESS_TOKEN=$(gcloud auth print-access-token)

echo "Testing fixed Firebase Rules API..."

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

# Step 2: Try to patch existing release (with fixed format)
echo -e "\nTrying to patch existing release..."
RELEASE_NAME="projects/$PROJECT_ID/releases/cloud.firestore"

PATCH_RESPONSE=$(curl -s -X PATCH \
  "https://firebaserules.googleapis.com/v1/$RELEASE_NAME?updateMask=rulesetName" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-goog-user-project: $PROJECT_ID" \
  -d "{
    \"release\": {
      \"rulesetName\": \"$RULESET_NAME\"
    }
  }")

echo "Patch response: $PATCH_RESPONSE"

# If patch fails with 404, try create
if [[ $PATCH_RESPONSE == *"NOT_FOUND"* ]] || [[ $PATCH_RESPONSE == *"404"* ]]; then
  echo -e "\nRelease doesn't exist, creating..."
  
  CREATE_RESPONSE=$(curl -s -X POST \
    "https://firebaserules.googleapis.com/v1/projects/$PROJECT_ID/releases" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -H "x-goog-user-project: $PROJECT_ID" \
    -d "{
      \"name\": \"$RELEASE_NAME\",
      \"rulesetName\": \"$RULESET_NAME\"
    }")
  
  echo "Create response: $CREATE_RESPONSE"
fi