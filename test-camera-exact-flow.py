#!/usr/bin/env python3
"""
Test exact camera flow with subcollections for montest2-rtvn
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
    "DEVICE_ID": f"camera-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
    "REGION": "us-central1"
}

print("=" * 70)
print("🎥 TESTING EXACT CAMERA FLOW FOR MONTEST2-RTVN")
print(f"📍 Project: {CONFIG['PROJECT_ID']}")
print(f"📷 Camera ID: {CONFIG['DEVICE_ID']}")
print("=" * 70)

tokens = {}

# STEP 1: Device Auth
print("\n1️⃣ DEVICE AUTHENTICATION")
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
    print(f"   ✅ Custom token received")
    
    # Exchange for ID token
    response = requests.post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key={CONFIG['FIREBASE_API_KEY']}",
        json={"token": tokens['custom'], "returnSecureToken": True},
        timeout=30
    )
    response.raise_for_status()
    tokens['id'] = response.json()["idToken"]
    print(f"   ✅ Firebase ID token obtained")
    
    # Get GCP token
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
    print(f"   ✅ GCP access token obtained")
    
except Exception as e:
    print(f"   ❌ Authentication failed: {e}")
    sys.exit(1)

# Common headers for Firestore
firestore_headers = {
    "Authorization": f"Bearer {tokens['gcp']}",
    "Content-Type": "application/json"
}

# STEP 2: Write device document
print("\n2️⃣ WRITE DEVICE DOCUMENT")
try:
    url = f"https://firestore.googleapis.com/v1/projects/{CONFIG['PROJECT_ID']}/databases/(default)/documents/devices/{CONFIG['DEVICE_ID']}"
    data = {
        "fields": {
            "deviceId": {"stringValue": CONFIG['DEVICE_ID']},
            "model": {"stringValue": "AXIS-P3265"},
            "firmwareVersion": {"stringValue": "11.11.76"},
            "status": {"stringValue": "online"},
            "lastSeen": {"timestampValue": datetime.utcnow().isoformat() + "Z"}
        }
    }
    response = requests.patch(url, headers=firestore_headers, json=data, timeout=30)
    if response.status_code == 200:
        print(f"   ✅ Device document written")
    elif response.status_code == 403:
        print(f"   ❌ 403 FORBIDDEN on device document")
        print(f"      Error: {response.json().get('error', {}).get('message', response.text)}")
    else:
        print(f"   ⚠️ Status {response.status_code}: {response.text[:200]}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# STEP 3: Create session
print("\n3️⃣ CREATE SESSION")
session_id = f"session-{datetime.now().strftime('%Y%m%d%H%M%S')}"
try:
    url = f"https://firestore.googleapis.com/v1/projects/{CONFIG['PROJECT_ID']}/databases/(default)/documents/devices/{CONFIG['DEVICE_ID']}/sessions/{session_id}"
    data = {
        "fields": {
            "sessionId": {"stringValue": session_id},
            "deviceId": {"stringValue": CONFIG['DEVICE_ID']},
            "startTime": {"timestampValue": datetime.utcnow().isoformat() + "Z"},
            "status": {"stringValue": "active"}
        }
    }
    response = requests.patch(url, headers=firestore_headers, json=data, timeout=30)
    if response.status_code == 200:
        print(f"   ✅ Session created: {session_id}")
    elif response.status_code == 403:
        print(f"   ❌ 403 FORBIDDEN on session creation")
        print(f"      Path: devices/{CONFIG['DEVICE_ID']}/sessions/{session_id}")
        print(f"      Error: {response.json().get('error', {}).get('message', response.text)}")
    else:
        print(f"   ⚠️ Status {response.status_code}: {response.text[:200]}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# STEP 4: Write event
print("\n4️⃣ WRITE DETECTION EVENT")
event_id = f"event-{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
try:
    url = f"https://firestore.googleapis.com/v1/projects/{CONFIG['PROJECT_ID']}/databases/(default)/documents/devices/{CONFIG['DEVICE_ID']}/sessions/{session_id}/events/{event_id}"
    data = {
        "fields": {
            "eventId": {"stringValue": event_id},
            "sessionId": {"stringValue": session_id},
            "deviceId": {"stringValue": CONFIG['DEVICE_ID']},
            "eventType": {"stringValue": "person_detected"},
            "timestamp": {"timestampValue": datetime.utcnow().isoformat() + "Z"},
            "confidence": {"doubleValue": 0.92},
            "description": {"stringValue": "Person detected in parking area"},
            "imageUrl": {"stringValue": f"gs://{CONFIG['PROJECT_ID']}-anava-analytics/captures/{event_id}.jpg"}
        }
    }
    response = requests.patch(url, headers=firestore_headers, json=data, timeout=30)
    if response.status_code == 200:
        print(f"   ✅ Event written: {event_id}")
    elif response.status_code == 403:
        print(f"   ❌ 403 FORBIDDEN on event write")
        print(f"      Path: devices/{CONFIG['DEVICE_ID']}/sessions/{session_id}/events/{event_id}")
        print(f"      Error: {response.json().get('error', {}).get('message', response.text)}")
    else:
        print(f"   ⚠️ Status {response.status_code}: {response.text[:200]}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# STEP 5: Read back to verify
print("\n5️⃣ READ BACK DATA")
try:
    # Read device
    url = f"https://firestore.googleapis.com/v1/projects/{CONFIG['PROJECT_ID']}/databases/(default)/documents/devices/{CONFIG['DEVICE_ID']}"
    response = requests.get(url, headers=firestore_headers, timeout=30)
    if response.status_code == 200:
        print(f"   ✅ Device document readable")
    elif response.status_code == 403:
        print(f"   ❌ 403 FORBIDDEN on device read")
    
    # Read session
    url = f"https://firestore.googleapis.com/v1/projects/{CONFIG['PROJECT_ID']}/databases/(default)/documents/devices/{CONFIG['DEVICE_ID']}/sessions/{session_id}"
    response = requests.get(url, headers=firestore_headers, timeout=30)
    if response.status_code == 200:
        print(f"   ✅ Session document readable")
    elif response.status_code == 403:
        print(f"   ❌ 403 FORBIDDEN on session read")
    
    # Read event
    url = f"https://firestore.googleapis.com/v1/projects/{CONFIG['PROJECT_ID']}/databases/(default)/documents/devices/{CONFIG['DEVICE_ID']}/sessions/{session_id}/events/{event_id}"
    response = requests.get(url, headers=firestore_headers, timeout=30)
    if response.status_code == 200:
        print(f"   ✅ Event document readable")
    elif response.status_code == 403:
        print(f"   ❌ 403 FORBIDDEN on event read")
        
except Exception as e:
    print(f"   ❌ Error reading: {e}")

# STEP 6: Test Gemini API call
print("\n6️⃣ TEST GEMINI API CALL")
try:
    test_image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
    
    url = f"https://{CONFIG['REGION']}-aiplatform.googleapis.com/v1/projects/{CONFIG['PROJECT_ID']}/locations/{CONFIG['REGION']}/publishers/google/models/gemini-1.5-flash:streamGenerateContent"
    
    data = {
        "contents": [{
            "role": "user",
            "parts": [
                {"text": "Describe this image briefly."},
                {"inline_data": {
                    "mime_type": "image/png",
                    "data": test_image_base64
                }}
            ]
        }],
        "generation_config": {
            "temperature": 0.1,
            "maxOutputTokens": 50
        }
    }
    
    response = requests.post(url, headers=firestore_headers, json=data, timeout=30)
    if response.status_code == 200:
        print(f"   ✅ Gemini API accessible")
    elif response.status_code == 403:
        print(f"   ❌ 403 FORBIDDEN on Gemini API")
        print(f"      Error: {response.json().get('error', {}).get('message', response.text[:200])}")
    elif response.status_code == 404:
        print(f"   ⚠️ Gemini API not enabled (404)")
    else:
        print(f"   ⚠️ Status {response.status_code}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# STEP 7: Clean up
print("\n7️⃣ CLEANUP")
try:
    # Delete in reverse order
    requests.delete(f"https://firestore.googleapis.com/v1/projects/{CONFIG['PROJECT_ID']}/databases/(default)/documents/devices/{CONFIG['DEVICE_ID']}/sessions/{session_id}/events/{event_id}", headers=firestore_headers, timeout=10)
    requests.delete(f"https://firestore.googleapis.com/v1/projects/{CONFIG['PROJECT_ID']}/databases/(default)/documents/devices/{CONFIG['DEVICE_ID']}/sessions/{session_id}", headers=firestore_headers, timeout=10)
    requests.delete(f"https://firestore.googleapis.com/v1/projects/{CONFIG['PROJECT_ID']}/databases/(default)/documents/devices/{CONFIG['DEVICE_ID']}", headers=firestore_headers, timeout=10)
    print(f"   ✅ Test data cleaned up")
except:
    print(f"   ⚠️ Cleanup may have partially failed")

print("\n" + "=" * 70)
print("📊 SUMMARY")
print("=" * 70)
print("If you see 403 errors above, check:")
print("1. Service account permissions: vertex-ai-sa needs roles/datastore.owner")
print("2. Firestore security rules (currently should be 'allow write: if true')")
print("3. Token is using correct service account")
print("=" * 70)