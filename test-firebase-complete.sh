#\!/bin/bash

PROJECT_ID="test0727-p2pc"
PROJECT_NUMBER="413554396880"

echo "=== Testing Complete Firebase Auth and Storage Initialization ==="
echo "Project: $PROJECT_ID"
echo "Project Number: $PROJECT_NUMBER"
echo ""

# Get access token
ACCESS_TOKEN=$(gcloud auth print-access-token)

echo "1. Checking if Identity Toolkit API is enabled..."
if gcloud services list --enabled --filter="name:identitytoolkit.googleapis.com" --project=$PROJECT_ID --format="value(name)"  < /dev/null |  grep -q identitytoolkit; then
    echo "✅ Identity Toolkit API is enabled"
else
    echo "❌ Identity Toolkit API is NOT enabled"
    echo "Enabling it now..."
    gcloud services enable identitytoolkit.googleapis.com --project=$PROJECT_ID
    sleep 15
fi

echo ""
echo "2. Testing Firebase Auth configuration..."
echo "Attempting to get Auth config..."
curl -X GET \
  "https://identitytoolkit.googleapis.com/v2/projects/$PROJECT_ID/config" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-goog-user-project: $PROJECT_ID" \
  -H "Content-Type: application/json" 2>/dev/null | jq '.'

echo ""
echo "3. Testing Identity Platform Admin API..."
# Try the admin endpoint
curl -X GET \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/$PROJECT_ID/config" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-goog-user-project: $PROJECT_ID" \
  -H "Content-Type: application/json" 2>/dev/null | jq '.'

echo ""
echo "4. Checking if Firebase Auth needs initialization through Firebase Admin SDK..."
# Try to get the project config through Firebase Admin SDK endpoint
curl -X GET \
  "https://firebase.googleapis.com/v1beta1/projects/$PROJECT_ID/adminSdkConfig" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-goog-user-project: $PROJECT_ID" 2>/dev/null | jq '.'

echo ""
echo "5. Checking Firebase Storage service agent..."
SERVICE_AGENT="service-$PROJECT_NUMBER@gcp-sa-firebasestorage.iam.gserviceaccount.com"
echo "Service agent: $SERVICE_AGENT"

# Check if service agent exists
if gcloud iam service-accounts describe "$SERVICE_AGENT" --project=$PROJECT_ID 2>/dev/null; then
    echo "✅ Firebase Storage service agent exists"
    
    # Check permissions
    echo "Checking permissions..."
    ROLES=$(gcloud projects get-iam-policy $PROJECT_ID --flatten="bindings[].members" --filter="bindings.members:$SERVICE_AGENT" --format="value(bindings.role)")
    if [ -z "$ROLES" ]; then
        echo "⚠️  Service agent has NO roles assigned"
        echo "Granting Storage Admin role..."
        gcloud projects add-iam-policy-binding $PROJECT_ID \
          --member="serviceAccount:$SERVICE_AGENT" \
          --role="roles/storage.admin"
    else
        echo "✅ Service agent has roles: $ROLES"
    fi
else
    echo "⚠️  Firebase Storage service agent does NOT exist yet"
    echo "This is created when Firebase Storage is first accessed"
fi

echo ""
echo "6. Testing Firebase Storage bucket operations..."
# List storage buckets
echo "Existing buckets:"
gsutil ls -p $PROJECT_ID

# Try to add Firebase to existing bucket
BUCKET_NAME="$PROJECT_ID-firebase-storage"
echo ""
echo "Attempting to add Firebase to bucket: $BUCKET_NAME"
curl -X POST \
  "https://firebasestorage.googleapis.com/v1beta/projects/$PROJECT_ID/buckets/$BUCKET_NAME:addFirebase" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-goog-user-project: $PROJECT_ID" \
  -H "Content-Type: application/json" \
  -d '{}' 2>/dev/null | jq '.'

echo ""
echo "7. Trying to create default Firebase Storage bucket..."
curl -X POST \
  "https://firebase.googleapis.com/v1beta1/projects/$PROJECT_ID/defaultBucket:add" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-goog-user-project: $PROJECT_ID" \
  -H "Content-Type: application/json" \
  -d '{}' 2>/dev/null | jq '.'

echo ""
echo "=== Summary ==="
echo "If Auth config returns 404, it means Firebase Auth hasn't been initialized."
echo "The initialization happens when you click 'Get Started' in Firebase Console."
echo "We need to find the API endpoint that initializes it programmatically."
