#!/bin/bash
# Setup script for Anava Magical Backend

PROJECT_ID="anava-magical-backend"
REGION="us-central1"

echo "🎨 Setting up Anava Magical Backend..."

# Check if project exists
if ! gcloud projects describe $PROJECT_ID >/dev/null 2>&1; then
    echo "❌ Project $PROJECT_ID does not exist."
    echo "Please create it first or update PROJECT_ID in this script."
    exit 1
fi

echo "✅ Using project: $PROJECT_ID"

# Set the project
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable \
    cloudfunctions.googleapis.com \
    firestore.googleapis.com \
    secretmanager.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    --project=$PROJECT_ID

# Create service account
echo "👤 Creating service account..."
gcloud iam service-accounts create ai-proxy-sa \
    --display-name="AI Proxy Service Account" \
    --project=$PROJECT_ID || echo "Service account already exists"

# Grant necessary roles
echo "🔐 Granting IAM roles..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:ai-proxy-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/datastore.user"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:ai-proxy-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

# Create Firestore database
echo "🗄️ Creating Firestore database..."
gcloud firestore databases create \
    --location=$REGION \
    --project=$PROJECT_ID || echo "Firestore database already exists"

# Create collections
echo "📚 Setting up Firestore collections..."
cat <<EOF > firestore-setup.js
const { Firestore } = require('@google-cloud/firestore');

const db = new Firestore({ projectId: '$PROJECT_ID' });

async function setup() {
  // Create initial shared key document
  await db.collection('shared_ai_keys').doc('key_001').set({
    api_key: 'ENCRYPTED_KEY_PLACEHOLDER',
    daily_quota: 1000,
    used_today: 0,
    active: true,
    last_reset: new Date().toISOString().split('T')[0]
  });

  console.log('✅ Firestore collections created');
}

setup().catch(console.error);
EOF

# Note: You'll need to run the JS file separately or convert to Python

echo ""
echo "⚠️  IMPORTANT: Manual steps required:"
echo ""
echo "1. Create AI Studio API keys:"
echo "   - Go to https://aistudio.google.com/app/apikey"
echo "   - Create 2-3 API keys for load balancing"
echo ""
echo "2. Store API keys in Secret Manager:"
echo "   gcloud secrets create ai-key-key_001 --data-file=- --project=$PROJECT_ID"
echo "   (Then paste the API key and press Ctrl+D)"
echo ""
echo "3. Update the proxy URLs in your .env file:"
echo "   AI_PROXY_URL=https://ai-proxy-${REGION}-${PROJECT_ID}.cloudfunctions.net/ai-proxy"
echo "   AI_PROXY_STATUS_URL=https://ai-proxy-status-${REGION}-${PROJECT_ID}.cloudfunctions.net/ai-proxy-status"
echo ""
echo "4. Deploy the functions:"
echo "   cd functions/ai-proxy"
echo "   ./deploy.sh $PROJECT_ID $REGION"
echo ""
echo "✨ Setup script complete!"