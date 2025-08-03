#!/bin/bash
# Deploy AI Proxy Cloud Function

PROJECT_ID=${1:-"anava-magical-backend"}
REGION=${2:-"us-central1"}
SERVICE_ACCOUNT="ai-proxy-sa@${PROJECT_ID}.iam.gserviceaccount.com"

echo "Deploying AI Proxy to project: $PROJECT_ID"

# Deploy the function
gcloud functions deploy ai-proxy \
  --gen2 \
  --runtime=python311 \
  --region=$REGION \
  --source=. \
  --entry-point=ai_proxy \
  --trigger-http \
  --allow-unauthenticated \
  --service-account=$SERVICE_ACCOUNT \
  --set-env-vars="GCP_PROJECT=$PROJECT_ID" \
  --memory=512MB \
  --timeout=60s \
  --max-instances=100 \
  --project=$PROJECT_ID

# Deploy device status endpoint
gcloud functions deploy ai-proxy-status \
  --gen2 \
  --runtime=python311 \
  --region=$REGION \
  --source=. \
  --entry-point=get_device_status \
  --trigger-http \
  --allow-unauthenticated \
  --service-account=$SERVICE_ACCOUNT \
  --set-env-vars="GCP_PROJECT=$PROJECT_ID" \
  --memory=256MB \
  --timeout=30s \
  --max-instances=50 \
  --project=$PROJECT_ID

echo "AI Proxy deployment complete!"