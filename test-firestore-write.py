#!/usr/bin/env python3
import json
import requests

# Test writing to Firestore without authentication (simulating camera behavior)
firestore_url = "https://firestore.googleapis.com/v1/projects/testdada-n73m/databases/(default)/documents/devices/B8A44F45D624"

# No auth header - simulating camera trying to write without proper auth
headers = {
    "Content-Type": "application/json"
}

data = {
    "fields": {
        "deviceId": {"stringValue": "B8A44F45D624"},
        "updatedAt": {"timestampValue": "2025-08-08T19:00:00Z"},
        "status": {"stringValue": "active"}
    }
}

print(f"Testing Firestore write WITHOUT authentication...")
print(f"URL: {firestore_url}")
response = requests.patch(firestore_url, headers=headers, json=data)
print(f"Response status: {response.status_code}")
if response.status_code != 200:
    error_data = response.json() if response.text else {}
    print(f"Error: {json.dumps(error_data, indent=2)}")
else:
    print("Success! (This means rules are too permissive)")

# Now test subcollection write
session_url = f"{firestore_url}/sessions/1754680169398010005"
session_data = {
    "fields": {
        "deviceId": {"stringValue": "B8A44F45D624"},
        "sessionId": {"stringValue": "1754680169398010005"},
        "updatedAt": {"timestampValue": "2025-08-08T19:00:00Z"},
        "status": {"stringValue": "active"}
    }
}

print(f"\nTesting session write WITHOUT authentication...")
print(f"URL: {session_url}")
response = requests.patch(session_url, headers=headers, json=session_data)
print(f"Response status: {response.status_code}")
if response.status_code != 200:
    error_data = response.json() if response.text else {}
    print(f"Error: {json.dumps(error_data, indent=2)}")
else:
    print("Success! (This means rules are too permissive)")

# Test event write
event_url = f"{session_url}/events/1754680168736831004"
event_data = {
    "fields": {
        "deviceId": {"stringValue": "B8A44F45D624"},
        "sessionId": {"stringValue": "1754680169398010005"},
        "eventId": {"stringValue": "1754680168736831004"},
        "updatedAt": {"timestampValue": "2025-08-08T19:00:00Z"},
        "type": {"stringValue": "detection"}
    }
}

print(f"\nTesting event write WITHOUT authentication...")
print(f"URL: {event_url}")
response = requests.patch(event_url, headers=headers, json=event_data)
print(f"Response status: {response.status_code}")
if response.status_code != 200:
    error_data = response.json() if response.text else {}
    print(f"Error: {json.dumps(error_data, indent=2)}")
else:
    print("Success! (This means rules are too permissive)")