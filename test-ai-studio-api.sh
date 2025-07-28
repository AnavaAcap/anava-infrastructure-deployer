#!/bin/bash

# Test script for AI Studio API key creation
# This validates the process for creating AI Studio API keys

PROJECT_ID="your-project-id"  # Will be replaced with actual project

echo "=== AI Studio API Key Creation Test ==="
echo "This script validates the AI Studio API key creation process"
echo

# Step 1: Check if the generativelanguage API is enabled
echo "Step 1: Checking if Generative Language API is enabled..."
gcloud services list --enabled --project=$PROJECT_ID | grep generativelanguage.googleapis.com
if [ $? -eq 0 ]; then
    echo "✅ Generative Language API is already enabled"
else
    echo "Enabling Generative Language API..."
    gcloud services enable generativelanguage.googleapis.com --project=$PROJECT_ID
    echo "✅ API enabled"
fi
echo

# Step 2: List existing API keys
echo "Step 2: Listing existing API keys..."
gcloud api-keys list --project=$PROJECT_ID --format="table(name,displayName,restrictions.apiTargets[].service)"
echo

# Step 3: Check for existing AI Studio key
echo "Step 3: Checking for existing AI Studio API key..."
EXISTING_KEY=$(gcloud api-keys list --project=$PROJECT_ID --format=json | jq -r '.[] | select(.displayName | contains("AI Studio")) | .name')

if [ -n "$EXISTING_KEY" ]; then
    echo "Found existing AI Studio key: $EXISTING_KEY"
    # Get the key string
    KEY_STRING=$(gcloud api-keys get-key-string $EXISTING_KEY --project=$PROJECT_ID --format=json | jq -r '.keyString')
    echo "✅ Existing API key retrieved"
else
    echo "No existing AI Studio key found"
    
    # Step 4: Create new API key
    echo "Step 4: Creating new AI Studio API key..."
    KEY_ID="ai-studio-key-$(date +%s)"
    
    gcloud api-keys create $KEY_ID \
        --display-name="AI Studio API Key (Anava Vision)" \
        --api-target=service=generativelanguage.googleapis.com \
        --project=$PROJECT_ID
    
    if [ $? -eq 0 ]; then
        echo "✅ API key created successfully"
        
        # Get the key string
        echo "Retrieving key string..."
        sleep 2  # Wait for key to be available
        KEY_STRING=$(gcloud api-keys get-key-string projects/$PROJECT_ID/locations/global/keys/$KEY_ID --format=json | jq -r '.keyString')
        echo "✅ API key retrieved"
    else
        echo "❌ Failed to create API key"
        exit 1
    fi
fi

echo
echo "=== Manual Verification Steps ==="
echo "1. Go to https://aistudio.google.com/app/apikey"
echo "2. Verify the API key appears in the list"
echo "3. Test the API key with a simple Gemini API call:"
echo
echo "curl -X POST \"https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=$KEY_STRING\" \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"contents\":[{\"parts\":[{\"text\":\"Hello, Gemini!\"}]}]}'"
echo
echo "=== Summary ==="
echo "Project: $PROJECT_ID"
echo "API Key ID: ${KEY_ID:-$EXISTING_KEY}"
echo "API Key (first 8 chars): ${KEY_STRING:0:8}..."
echo
echo "✅ AI Studio API key setup complete!"