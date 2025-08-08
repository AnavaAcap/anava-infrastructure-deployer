#!/usr/bin/env python3
import json
import requests
import sys

# Configuration
API_GATEWAY_URL = "https://anava-api-anava-iot-gateway-58sszmdx.uc.gateway.dev"
TVM_URL = "https://token-vending-machine-gr66vddjea-uc.a.run.app"  # Direct Cloud Run URL
API_KEY = "AIzaSyBcDUatoSRlotJkk09lvlnhbzBuBHVxiOg"
FIREBASE_API_KEY = "AIzaSyA_EYLdYI0u6YKR5MjDGhFH2zdIb2iF0S0"
PROJECT_ID = "testdada-n73m"
DEVICE_ID = "B8A44F45D624"

print("=== Testing Direct Token Vending Machine ===\n")

# Step 1: Get Firebase custom token
print("Step 1: Getting Firebase custom token...")
response = requests.post(
    f"{API_GATEWAY_URL}/device-auth/initiate",
    headers={
        "x-api-key": API_KEY,
        "Content-Type": "application/json"
    },
    json={"device_id": DEVICE_ID}
)

if response.status_code != 200:
    print(f"❌ Failed to get custom token: {response.status_code}")
    sys.exit(1)

custom_token = response.json()["firebase_custom_token"]
print(f"✅ Got custom token")

# Step 2: Exchange for Firebase ID token
print("\nStep 2: Getting Firebase ID token...")
firebase_auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key={FIREBASE_API_KEY}"
response = requests.post(
    firebase_auth_url,
    json={"token": custom_token, "returnSecureToken": True}
)

if response.status_code != 200:
    print(f"❌ Failed to get ID token: {response.status_code}")
    sys.exit(1)

id_token = response.json()["idToken"]
print(f"✅ Got Firebase ID token")

# Step 3: Call TVM directly (bypassing API Gateway)
print("\nStep 3: Calling Token Vending Machine directly...")
response = requests.post(
    TVM_URL,
    headers={
        "Content-Type": "application/json"
    },
    json={"firebase_id_token": id_token}
)

print(f"TVM Response status: {response.status_code}")
if response.status_code != 200:
    print(f"❌ TVM failed: {response.text}")
    sys.exit(1)

gcp_token = response.json()["gcp_access_token"]
print(f"✅ Got GCP access token!")

# Step 4: Test Firestore write
print("\nStep 4: Testing Firestore write with GCP token...")
firestore_url = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/devices/{DEVICE_ID}"
headers = {
    "Authorization": f"Bearer {gcp_token}",
    "Content-Type": "application/json"
}

data = {
    "fields": {
        "deviceId": {"stringValue": DEVICE_ID},
        "updatedAt": {"timestampValue": "2025-08-08T19:45:00Z"},
        "status": {"stringValue": "active"},
        "testField": {"stringValue": "Direct TVM test - with proper permissions"}
    }
}

response = requests.patch(firestore_url, headers=headers, json=data)
print(f"Firestore response: {response.status_code}")
if response.status_code == 200:
    print("✅ SUCCESS! Firestore write worked with vertex-ai-sa permissions!")
    print("The permission fix worked!")
else:
    print(f"❌ Still failing: {response.status_code}")
    error = response.json() if response.text else {}
    print(json.dumps(error, indent=2))