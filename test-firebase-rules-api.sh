#!/bin/bash

PROJECT_ID="testdada-n73m"
ACCESS_TOKEN=$(gcloud auth print-access-token)

echo "Testing Firebase Rules via Firebase Management API..."

# First, let's check the correct parent format
echo -e "\n1. Checking parent resource format:"
PARENT="projects/$PROJECT_ID"
echo "Parent: $PARENT"

# Create ruleset with Firebase API
echo -e "\n2. Creating ruleset..."
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

echo "Ruleset response: $RULESET_RESPONSE"
RULESET_NAME=$(echo $RULESET_RESPONSE | jq -r '.name')
echo "Created ruleset: $RULESET_NAME"

# Try different approaches for creating/updating the release
echo -e "\n3. Trying to update release..."

# Approach 1: Update method with updateMask
echo -e "\n3a. Using updateRelease method:"
UPDATE_RESPONSE=$(curl -s -X PATCH \
  "https://firebaserules.googleapis.com/v1/projects/$PROJECT_ID/releases/cloud.firestore?updateMask=rulesetName" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-goog-user-project: $PROJECT_ID" \
  -d "{
    \"rulesetName\": \"$RULESET_NAME\"
  }")
echo "Update response: $UPDATE_RESPONSE"

# If that fails, try the create endpoint with different body
if [[ $UPDATE_RESPONSE == *"error"* ]]; then
  echo -e "\n3b. Trying create with parent in URL:"
  CREATE_RESPONSE=$(curl -s -X POST \
    "https://firebaserules.googleapis.com/v1/projects/$PROJECT_ID/releases" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -H "x-goog-user-project: $PROJECT_ID" \
    -d "{
      \"rulesetName\": \"$RULESET_NAME\"
    }")
  echo "Create response: $CREATE_RESPONSE"
fi