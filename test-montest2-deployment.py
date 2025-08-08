#!/usr/bin/env python3
"""
Test the montest2-rtvn deployment for 403 errors
"""
import json
import requests
import sys
from datetime import datetime

# Configuration for montest2-rtvn deployment
CONFIG = {
    "API_GATEWAY_URL": "https://anava-api-anava-iot-gateway-6qm4nm1m.uc.gateway.dev",
    "API_KEY": "AIzaSyBaqeOb63evBHWx0HQgXfOp_Bxkk8ljQ_E",
    "FIREBASE_API_KEY": "AIzaSyDjj-7EiSxZv4DRkJciwbkt2k6652xkXbw",
    "PROJECT_ID": "montest2-rtvn",
    "DEVICE_ID": f"test-device-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
    "REGION": "us-central1"
}

print("=" * 70)
print("🚀 TESTING MONTEST2-RTVN DEPLOYMENT")
print(f"📍 Project: {CONFIG['PROJECT_ID']}")
print(f"🔧 Device ID: {CONFIG['DEVICE_ID']}")
print("=" * 70)

tokens = {}

# STEP 1: Get Firebase custom token
print("\n📝 Step 1: Getting Firebase Custom Token...")
try:
    response = requests.post(
        f"{CONFIG['API_GATEWAY_URL']}/device-auth/initiate",
        headers={
            "x-api-key": CONFIG['API_KEY'],
            "Content-Type": "application/json"
        },
        json={"device_id": CONFIG['DEVICE_ID']},
        timeout=30
    )
    response.raise_for_status()
    tokens['custom'] = response.json()["firebase_custom_token"]
    print(f"✅ Got custom token: {tokens['custom'][:50]}...")
except Exception as e:
    print(f"❌ Failed to get custom token: {e}")
    sys.exit(1)

# STEP 2: Exchange for Firebase ID token
print("\n📝 Step 2: Exchanging for Firebase ID Token...")
try:
    response = requests.post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key={CONFIG['FIREBASE_API_KEY']}",
        json={"token": tokens['custom'], "returnSecureToken": True},
        timeout=30
    )
    response.raise_for_status()
    tokens['id'] = response.json()["idToken"]
    print(f"✅ Got ID token: {tokens['id'][:50]}...")
except Exception as e:
    print(f"❌ Failed to get ID token: {e}")
    sys.exit(1)

# STEP 3: Get GCP access token
print("\n📝 Step 3: Getting GCP Access Token...")
try:
    response = requests.post(
        f"{CONFIG['API_GATEWAY_URL']}/gcp-token/vend",
        headers={
            "x-api-key": CONFIG['API_KEY'],
            "Content-Type": "application/json"
        },
        json={"firebase_id_token": tokens['id']},
        timeout=30
    )
    response.raise_for_status()
    tokens['gcp'] = response.json()["gcp_access_token"]
    expires_in = response.json().get("expires_in", 3600)
    print(f"✅ Got GCP token: {tokens['gcp'][:50]}...")
    print(f"   Token expires in: {expires_in} seconds")
except Exception as e:
    print(f"❌ Failed to get GCP token: {e}")
    sys.exit(1)

# STEP 4: Test Firestore write permissions
print("\n📝 Step 4: Testing Firestore Write Permissions...")
try:
    url = f"https://firestore.googleapis.com/v1/projects/{CONFIG['PROJECT_ID']}/databases/(default)/documents/devices/{CONFIG['DEVICE_ID']}"
    headers = {
        "Authorization": f"Bearer {tokens['gcp']}",
        "Content-Type": "application/json"
    }
    data = {
        "fields": {
            "deviceId": {"stringValue": CONFIG['DEVICE_ID']},
            "updatedAt": {"timestampValue": datetime.utcnow().isoformat() + "Z"},
            "status": {"stringValue": "active"},
            "testRun": {"booleanValue": True}
        }
    }
    response = requests.patch(url, headers=headers, json=data, timeout=30)
    
    if response.status_code == 403:
        print(f"❌ FIRESTORE WRITE FAILED WITH 403!")
        print(f"   Error: {response.text}")
        
        # Let's check what service account the token is for
        print("\n🔍 Checking token details...")
        token_info_response = requests.get(
            "https://www.googleapis.com/oauth2/v1/tokeninfo",
            params={"access_token": tokens['gcp']},
            timeout=10
        )
        if token_info_response.status_code == 200:
            token_info = token_info_response.json()
            print(f"   Token email: {token_info.get('email', 'N/A')}")
            print(f"   Token scope: {token_info.get('scope', 'N/A')}")
        
        # Check IAM permissions for the service account
        print("\n🔍 Checking IAM permissions...")
        print(f"   Run this command to check service account permissions:")
        print(f"   gcloud projects get-iam-policy {CONFIG['PROJECT_ID']} --flatten='bindings[].members' --filter='bindings.members:vertex-ai-sa'")
        
    elif response.status_code == 200:
        print(f"✅ Firestore write successful!")
        doc_name = response.json().get('name', 'unknown')
        print(f"   Created/Updated document: {doc_name}")
        
        # Clean up
        requests.delete(url, headers=headers, timeout=10)
    else:
        print(f"⚠️ Unexpected response: {response.status_code}")
        print(f"   Response: {response.text}")
        
except Exception as e:
    print(f"❌ Error testing Firestore: {e}")

print("\n" + "=" * 70)
print("📊 DEPLOYMENT STATUS SUMMARY")
print("=" * 70)