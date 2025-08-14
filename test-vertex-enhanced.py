#!/usr/bin/env python3
"""
Enhanced Vertex AI region testing for csci-468209
"""
import json
import requests
from datetime import datetime

# Get tokens from the main validation
CONFIG = {
    "API_GATEWAY_URL": "https://csci-gw-5ks9avkc.ue.gateway.dev",
    "API_GATEWAY_KEY": "AIzaSyACLADhnyEGu_wXBKnoIPnLYtFFp2Sq6_o",
    "FIREBASE_API_KEY": "AIzaSyD7e1z9dtohYdGhkO6io61i_wjtOqDyyV4",
    "PROJECT_ID": "csci-468209",
    "DEVICE_ID": f"test-device-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
}

def get_tokens():
    """Get fresh tokens for testing"""
    # Get custom token
    response = requests.post(
        f"{CONFIG['API_GATEWAY_URL']}/device-auth/initiate",
        headers={
            "x-api-key": CONFIG['API_GATEWAY_KEY'],
            "Content-Type": "application/json"
        },
        json={"device_id": CONFIG['DEVICE_ID']},
        timeout=30
    )
    custom_token = response.json()["firebase_custom_token"]
    
    # Exchange for ID token
    response = requests.post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key={CONFIG['FIREBASE_API_KEY']}",
        json={"token": custom_token, "returnSecureToken": True},
        timeout=30
    )
    id_token = response.json()["idToken"]
    
    # Get GCP token
    response = requests.post(
        f"{CONFIG['API_GATEWAY_URL']}/gcp-token/vend",
        headers={
            "x-api-key": CONFIG['API_GATEWAY_KEY'],
            "Content-Type": "application/json"
        },
        json={"firebase_id_token": id_token},
        timeout=30
    )
    gcp_token = response.json()["gcp_access_token"]
    
    return gcp_token

print("🧪 Enhanced Vertex AI Region Testing")
print("=" * 50)

gcp_token = get_tokens()
print(f"✅ Got fresh GCP token: {gcp_token[:50]}...")

# Test different regions
regions_to_test = [
    'us-east1',
    'us-central1', 
    'us-west1',
    'us-west4',
    'europe-west1',
    'asia-northeast1'
]

models_to_test = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-pro',
    'gemini-pro-vision'
]

print(f"\n🌍 Testing {len(regions_to_test)} regions with {len(models_to_test)} models...")

for region in regions_to_test:
    print(f"\n📍 Testing region: {region}")
    
    for model in models_to_test:
        url = f"https://{region}-aiplatform.googleapis.com/v1/projects/{CONFIG['PROJECT_ID']}/locations/{region}/publishers/google/models/{model}:streamGenerateContent"
        
        headers = {
            "Authorization": f"Bearer {gcp_token}",
            "Content-Type": "application/json"
        }
        
        data = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": "Say 'Hello from Vertex AI'"}]
                }
            ],
            "generation_config": {
                "temperature": 0.1,
                "maxOutputTokens": 50
            }
        }
        
        try:
            response = requests.post(url, headers=headers, json=data, timeout=15)
            
            if response.status_code == 200:
                print(f"   ✅ {model}: Working")
                # Try to extract response
                lines = response.text.strip().split('\n')
                for line in lines[:2]:  # Check first 2 lines
                    if line.strip():
                        try:
                            chunk = json.loads(line)
                            if 'candidates' in chunk:
                                print(f"      Response received")
                                break
                        except:
                            pass
            elif response.status_code == 404:
                print(f"   ❌ {model}: Not found")
            elif response.status_code == 403:
                print(f"   ❌ {model}: Permission denied")
            elif response.status_code == 400:
                error_info = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
                print(f"   ❌ {model}: Bad request - {error_info.get('error', {}).get('message', 'Unknown error')}")
            else:
                print(f"   ❌ {model}: HTTP {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ {model}: {str(e)[:50]}...")

print(f"\n🔍 Checking Vertex AI API status...")
try:
    # Check if Vertex AI API is enabled
    api_check_url = f"https://serviceusage.googleapis.com/v1/projects/{CONFIG['PROJECT_ID']}/services/aiplatform.googleapis.com"
    response = requests.get(api_check_url, headers={"Authorization": f"Bearer {gcp_token}"}, timeout=15)
    
    if response.status_code == 200:
        service_info = response.json()
        state = service_info.get('state', 'UNKNOWN')
        print(f"   Vertex AI API state: {state}")
    else:
        print(f"   Could not check API status: {response.status_code}")
        
except Exception as e:
    print(f"   Error checking API: {e}")

print(f"\n📋 Summary:")
print(f"   • Project: {CONFIG['PROJECT_ID']}")
print(f"   • Tested {len(regions_to_test)} regions")
print(f"   • Tested {len(models_to_test)} models per region")
print(f"   • If all failed, likely issues:")
print(f"     - Vertex AI API not enabled")
print(f"     - Service account lacks aiplatform.endpoints.predict permission")
print(f"     - Region restrictions on the project")
print("=" * 50)