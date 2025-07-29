#!/bin/bash

# Test Firestore rules deployment manually

PROJECT_ID="testdada-n73m"  # Replace with your test project
ACCESS_TOKEN=$(gcloud auth print-access-token --project=$PROJECT_ID)

# Set the quota project
gcloud config set project $PROJECT_ID

echo "Testing Firestore rules deployment for project: $PROJECT_ID"

# Step 1: Create a test ruleset
echo "Creating ruleset..."
RULESET_RESPONSE=$(curl -X POST \
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

echo "Ruleset response: $RULESET_RESPONSE"
RULESET_NAME=$(echo $RULESET_RESPONSE | jq -r '.name')
echo "Created ruleset: $RULESET_NAME"

# Step 2: Try to patch existing release
echo -e "\nTrying to patch existing release..."
RELEASE_NAME="projects/$PROJECT_ID/databases/(default)/releases/cloud.firestore"

PATCH_RESPONSE=$(curl -X PATCH \
  "https://firebaserules.googleapis.com/v1/$RELEASE_NAME" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-goog-user-project: $PROJECT_ID" \
  -d "{
    \"name\": \"$RELEASE_NAME\",
    \"rulesetName\": \"$RULESET_NAME\"
  }" 2>&1)

echo "Patch response: $PATCH_RESPONSE"

# If patch fails with 404, try create
if [[ $PATCH_RESPONSE == *"404"* ]]; then
  echo -e "\nRelease doesn't exist, trying to create..."
  
  CREATE_RESPONSE=$(curl -X POST \
    "https://firebaserules.googleapis.com/v1/projects/$PROJECT_ID/releases" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -H "x-goog-user-project: $PROJECT_ID" \
    -d "{
      \"name\": \"$RELEASE_NAME\",
      \"rulesetName\": \"$RULESET_NAME\"
    }" 2>&1)
  
  echo "Create response: $CREATE_RESPONSE"
fi