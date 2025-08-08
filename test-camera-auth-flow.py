#!/usr/bin/env python3
import json
import requests
import sys

# Configuration from your deployment
API_GATEWAY_URL = "https://anava-api-anava-iot-gateway-58sszmdx.uc.gateway.dev"
API_KEY = "AIzaSyBcDUatoSRlotJkk09lvlnhbzBuBHVxiOg"
FIREBASE_API_KEY = "AIzaSyA_EYLdYI0u6YKR5MjDGhFH2zdIb2iF0S0"
PROJECT_ID = "testdada-n73m"
DEVICE_ID = "B8A44F45D624"

print("=== Testing Camera Authentication Flow ===\n")

# Step 1: Get Firebase custom token from device-auth
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
    print(response.text)
    sys.exit(1)

custom_token = response.json()["firebase_custom_token"]
print(f"✅ Got custom token: {custom_token[:50]}...")

# Step 2: Exchange custom token for Firebase ID token
print("\nStep 2: Exchanging for Firebase ID token...")
firebase_auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key={FIREBASE_API_KEY}"
response = requests.post(
    firebase_auth_url,
    json={"token": custom_token, "returnSecureToken": True}
)

if response.status_code != 200:
    print(f"❌ Failed to get ID token: {response.status_code}")
    print(response.text)
    sys.exit(1)

id_token = response.json()["idToken"]
print(f"✅ Got Firebase ID token: {id_token[:50]}...")

# Step 3: Exchange Firebase token for GCP access token via token vendor
print("\nStep 3: Getting GCP access token from token vendor...")
response = requests.post(
    f"{API_GATEWAY_URL}/token-vendor",
    headers={
        "x-api-key": API_KEY,
        "Content-Type": "application/json"
    },
    json={"firebase_id_token": id_token}
)

if response.status_code != 200:
    print(f"❌ Failed to get GCP token: {response.status_code}")
    print(response.text)
    sys.exit(1)

gcp_token = response.json()["gcp_access_token"]
print(f"✅ Got GCP access token: {gcp_token[:50]}...")

# Step 4: Test Firestore write with GCP token
print("\nStep 4: Testing Firestore write with GCP token...")
firestore_url = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/devices/{DEVICE_ID}"
headers = {
    "Authorization": f"Bearer {gcp_token}",
    "Content-Type": "application/json"
}

data = {
    "fields": {
        "deviceId": {"stringValue": DEVICE_ID},
        "updatedAt": {"timestampValue": "2025-08-08T19:30:00Z"},
        "status": {"stringValue": "active"},
        "testField": {"stringValue": "Camera auth flow test"}
    }
}

response = requests.patch(firestore_url, headers=headers, json=data)
print(f"Response status: {response.status_code}")
if response.status_code == 200:
    print("✅ SUCCESS! Firestore write worked!")
    doc = response.json()
    print(f"Document updated: {doc.get('name', 'unknown')}")
else:
    print(f"❌ Firestore write failed: {response.status_code}")
    print(response.text)

# Step 5: Test session write
print("\nStep 5: Testing session write...")
session_url = f"{firestore_url}/sessions/test_session_001"
session_data = {
    "fields": {
        "deviceId": {"stringValue": DEVICE_ID},
        "sessionId": {"stringValue": "test_session_001"},
        "updatedAt": {"timestampValue": "2025-08-08T19:30:00Z"},
        "status": {"stringValue": "active"}
    }
}

response = requests.patch(session_url, headers=headers, json=session_data)
print(f"Response status: {response.status_code}")
if response.status_code == 200:
    print("✅ SUCCESS! Session write worked!")
else:
    print(f"❌ Session write failed: {response.status_code}")
    print(response.text)

# Step 6: Test event write
print("\nStep 6: Testing event write...")
event_url = f"{session_url}/events/test_event_001"
event_data = {
    "fields": {
        "deviceId": {"stringValue": DEVICE_ID},
        "sessionId": {"stringValue": "test_session_001"},
        "eventId": {"stringValue": "test_event_001"},
        "updatedAt": {"timestampValue": "2025-08-08T19:30:00Z"},
        "type": {"stringValue": "test_event"}
    }
}

response = requests.patch(event_url, headers=headers, json=event_data)
print(f"Response status: {response.status_code}")
if response.status_code == 200:
    print("✅ SUCCESS! Event write worked!")
else:
    print(f"❌ Event write failed: {response.status_code}")
    print(response.text)

print("\n=== Test Complete ===")