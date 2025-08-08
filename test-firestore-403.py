#\!/usr/bin/env python3
import json
import requests
from google.auth import default
from google.auth.transport.requests import Request

# Get default credentials
credentials, project = default()

# Get access token
credentials.refresh(Request())
token = credentials.token

print(f"Using project: {project}")
print(f"Token preview: {token[:20]}...")

# Try to write to Firestore
firestore_url = f"https://firestore.googleapis.com/v1/projects/rock-verbena-466803-q4/databases/(default)/documents/devices/TEST_DEVICE"

headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

data = {
    "fields": {
        "deviceId": {"stringValue": "TEST_DEVICE"},
        "updatedAt": {"timestampValue": "2025-08-08T19:00:00Z"},
        "test": {"booleanValue": True}
    }
}

print(f"\nAttempting Firestore write to: {firestore_url}")
response = requests.patch(firestore_url, headers=headers, json=data)
print(f"Response status: {response.status_code}")
if response.status_code \!= 200:
    print(f"Response: {response.text}")
else:
    print("Success\!")
