#!/usr/bin/env python3
"""
Comprehensive Vertex Cloud Setup Validation Script
Tests all components of the csci-468209 deployment to verify proper configuration
"""
import json
import requests
import sys
import base64
import time
from datetime import datetime

# Configuration for csci-468209 deployment
CONFIG = {
    "API_GATEWAY_URL": "https://csci-gw-5ks9avkc.ue.gateway.dev",
    "API_GATEWAY_KEY": "AIzaSyACLADhnyEGu_wXBKnoIPnLYtFFp2Sq6_o",
    "FIREBASE_API_KEY": "AIzaSyD7e1z9dtohYdGhkO6io61i_wjtOqDyyV4",
    "PROJECT_ID": "csci-468209",
    "REGION": "asia-northeast1",
    "GCS_BUCKET": "csci-468209.firebasestorage.app",
    "DEVICE_ID": f"test-device-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
    "FIREBASE_CONFIG": {
        "apiKey": "AIzaSyD7e1z9dtohYdGhkO6io61i_wjtOqDyyV4",
        "authDomain": "csci-468209.firebaseapp.com",
        "projectId": "csci-468209",
        "storageBucket": "csci-468209.firebasestorage.app",
        "messagingSenderId": "437065144140",
        "appId": "1:437065144140:web:4db9c43cefe96f3770a1e9",
        "databaseId": "(default)"
    }
}

print("=" * 80)
print("🔍 VERTEX CLOUD SETUP VALIDATION SUITE")
print(f"📍 Project: {CONFIG['PROJECT_ID']}")
print(f"🌐 API Gateway: {CONFIG['API_GATEWAY_URL']}")
print(f"🔧 Device ID: {CONFIG['DEVICE_ID']}")
print(f"🌎 Region: {CONFIG['REGION']}")
print("=" * 80)

def test_step(step_name, func, critical=True):
    """Helper to run a test step and handle errors"""
    print(f"\n📝 {step_name}...")
    try:
        result = func()
        print(f"✅ {step_name} - SUCCESS")
        return result, True
    except Exception as e:
        error_msg = str(e)
        print(f"❌ {step_name} - FAILED")
        print(f"   Error: {error_msg}")
        if critical:
            print(f"   🚨 Critical component failed - stopping test suite")
            return None, False
        return None, False

# Store tokens and results for use across steps
test_results = {
    'tokens': {},
    'passed': 0,
    'failed': 0,
    'details': []
}

# STEP 1: Test API Gateway connectivity
def test_api_gateway_health():
    """Test basic API Gateway connectivity"""
    try:
        # Try a simple GET request to see if gateway responds
        response = requests.get(
            f"{CONFIG['API_GATEWAY_URL']}/health",
            headers={"x-api-key": CONFIG['API_GATEWAY_KEY']},
            timeout=10
        )
        # Even 404 is OK - it means gateway is responding
        if response.status_code in [200, 404]:
            print(f"   Gateway responding (status: {response.status_code})")
            return True
    except requests.exceptions.RequestException as e:
        print(f"   Gateway connection failed: {e}")
    
    # Try device-auth endpoint directly
    response = requests.post(
        f"{CONFIG['API_GATEWAY_URL']}/device-auth/initiate",
        headers={
            "x-api-key": CONFIG['API_GATEWAY_KEY'],
            "Content-Type": "application/json"
        },
        json={"device_id": "health-check"},
        timeout=15
    )
    print(f"   Device auth endpoint status: {response.status_code}")
    return response.status_code in [200, 400, 401]  # Any response means it's working

result, success = test_step("Step 1: API Gateway Health Check", test_api_gateway_health, critical=True)
test_results['passed' if success else 'failed'] += 1
test_results['details'].append({"step": "API Gateway Health", "status": "PASS" if success else "FAIL"})

if not success:
    print("\n🚨 Critical infrastructure component failed. Stopping validation.")
    sys.exit(1)

# STEP 2: Test Firebase Custom Token Generation
def get_firebase_custom_token():
    """Get Firebase custom token from device auth endpoint"""
    response = requests.post(
        f"{CONFIG['API_GATEWAY_URL']}/device-auth/initiate",
        headers={
            "x-api-key": CONFIG['API_GATEWAY_KEY'],
            "Content-Type": "application/json"
        },
        json={"device_id": CONFIG['DEVICE_ID']},
        timeout=30
    )
    response.raise_for_status()
    
    data = response.json()
    if "firebase_custom_token" not in data:
        raise Exception(f"No custom token in response: {data}")
    
    token = data["firebase_custom_token"]
    print(f"   Custom token length: {len(token)} chars")
    print(f"   Token preview: {token[:50]}...")
    return token

custom_token, success = test_step("Step 2: Firebase Custom Token Generation", get_firebase_custom_token, critical=True)
if success:
    test_results['tokens']['custom'] = custom_token
test_results['passed' if success else 'failed'] += 1
test_results['details'].append({"step": "Custom Token Generation", "status": "PASS" if success else "FAIL"})

if not success:
    print("\n🚨 Token generation failed. Cannot proceed with authentication tests.")
    sys.exit(1)

# STEP 3: Test Firebase ID Token Exchange
def exchange_for_firebase_id_token():
    """Exchange custom token for Firebase ID token"""
    response = requests.post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key={CONFIG['FIREBASE_API_KEY']}",
        json={
            "token": test_results['tokens']['custom'],
            "returnSecureToken": True
        },
        timeout=30
    )
    response.raise_for_status()
    
    data = response.json()
    if "idToken" not in data:
        raise Exception(f"No ID token in response: {data}")
    
    id_token = data["idToken"]
    expires_in = data.get("expiresIn", "3600")
    print(f"   ID token length: {len(id_token)} chars")
    print(f"   Token expires in: {expires_in} seconds")
    print(f"   Token preview: {id_token[:50]}...")
    return id_token

id_token, success = test_step("Step 3: Firebase ID Token Exchange", exchange_for_firebase_id_token, critical=True)
if success:
    test_results['tokens']['id'] = id_token
test_results['passed' if success else 'failed'] += 1
test_results['details'].append({"step": "ID Token Exchange", "status": "PASS" if success else "FAIL"})

if not success:
    print("\n🚨 ID token exchange failed. Cannot proceed with GCP tests.")
    sys.exit(1)

# STEP 4: Test GCP Access Token via Token Vendor Machine
def get_gcp_access_token():
    """Get GCP access token via token vending machine"""
    response = requests.post(
        f"{CONFIG['API_GATEWAY_URL']}/gcp-token/vend",
        headers={
            "x-api-key": CONFIG['API_GATEWAY_KEY'],
            "Content-Type": "application/json"
        },
        json={"firebase_id_token": test_results['tokens']['id']},
        timeout=30
    )
    response.raise_for_status()
    
    data = response.json()
    if "gcp_access_token" not in data:
        raise Exception(f"No GCP access token in response: {data}")
    
    gcp_token = data["gcp_access_token"]
    expires_in = data.get("expires_in", 3600)
    print(f"   GCP token length: {len(gcp_token)} chars")
    print(f"   Token expires in: {expires_in} seconds")
    print(f"   Token preview: {gcp_token[:50]}...")
    return gcp_token

gcp_token, success = test_step("Step 4: GCP Access Token via TVM", get_gcp_access_token, critical=True)
if success:
    test_results['tokens']['gcp'] = gcp_token
test_results['passed' if success else 'failed'] += 1
test_results['details'].append({"step": "GCP Token Vending", "status": "PASS" if success else "FAIL"})

if not success:
    print("\n🚨 GCP token vending failed. Cannot proceed with GCP service tests.")
    sys.exit(1)

# STEP 5: Test Firestore Database Access
def test_firestore_write_access():
    """Test writing to Firestore database"""
    device_doc_url = f"https://firestore.googleapis.com/v1/projects/{CONFIG['PROJECT_ID']}/databases/(default)/documents/devices/{CONFIG['DEVICE_ID']}"
    
    headers = {
        "Authorization": f"Bearer {test_results['tokens']['gcp']}",
        "Content-Type": "application/json"
    }
    
    test_data = {
        "fields": {
            "deviceId": {"stringValue": CONFIG['DEVICE_ID']},
            "testTimestamp": {"timestampValue": datetime.utcnow().isoformat() + "Z"},
            "status": {"stringValue": "validation_test"},
            "model": {"stringValue": "VALIDATION-DEVICE"},
            "project": {"stringValue": CONFIG['PROJECT_ID']},
            "testType": {"stringValue": "vertex_cloud_validation"}
        }
    }
    
    # Write document
    response = requests.patch(device_doc_url, headers=headers, json=test_data, timeout=30)
    response.raise_for_status()
    
    created_doc = response.json()
    doc_name = created_doc.get('name', 'unknown')
    print(f"   Created document: {doc_name}")
    
    # Verify we can read it back
    response = requests.get(device_doc_url, headers=headers, timeout=30)
    response.raise_for_status()
    
    read_doc = response.json()
    fields_count = len(read_doc.get('fields', {}))
    print(f"   Read back document with {fields_count} fields")
    
    return doc_name

firestore_result, success = test_step("Step 5: Firestore Database Access", test_firestore_write_access, critical=False)
test_results['passed' if success else 'failed'] += 1
test_results['details'].append({"step": "Firestore Access", "status": "PASS" if success else "FAIL"})

# STEP 6: Test Cloud Storage Bucket Access
def test_cloud_storage_access():
    """Test Cloud Storage bucket access"""
    # Test bucket listing
    bucket_url = f"https://storage.googleapis.com/storage/v1/b/{CONFIG['GCS_BUCKET']}/o"
    
    headers = {
        "Authorization": f"Bearer {test_results['tokens']['gcp']}",
    }
    
    response = requests.get(bucket_url, headers=headers, timeout=30)
    response.raise_for_status()
    
    data = response.json()
    items = data.get('items', [])
    print(f"   Bucket accessible, contains {len(items)} objects")
    
    # Test upload capability with a small test file
    test_filename = f"validation-test-{datetime.now().strftime('%Y%m%d-%H%M%S')}.txt"
    test_content = f"Vertex Cloud Validation Test\nTimestamp: {datetime.utcnow().isoformat()}\nProject: {CONFIG['PROJECT_ID']}"
    
    upload_url = f"https://storage.googleapis.com/upload/storage/v1/b/{CONFIG['GCS_BUCKET']}/o?uploadType=media&name={test_filename}"
    
    response = requests.post(
        upload_url,
        headers={
            "Authorization": f"Bearer {test_results['tokens']['gcp']}",
            "Content-Type": "text/plain"
        },
        data=test_content,
        timeout=30
    )
    response.raise_for_status()
    
    print(f"   Successfully uploaded test file: {test_filename}")
    
    # Clean up test file
    delete_url = f"https://storage.googleapis.com/storage/v1/b/{CONFIG['GCS_BUCKET']}/o/{test_filename}"
    requests.delete(delete_url, headers=headers, timeout=10)
    print(f"   Cleaned up test file")
    
    return True

storage_result, success = test_step("Step 6: Cloud Storage Access", test_cloud_storage_access, critical=False)
test_results['passed' if success else 'failed'] += 1
test_results['details'].append({"step": "Cloud Storage", "status": "PASS" if success else "FAIL"})

# STEP 7: Test Vertex AI / Gemini API Access
def test_vertex_ai_gemini():
    """Test Vertex AI Gemini API access"""
    # Create a simple 1x1 white pixel PNG for testing
    test_image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
    
    gemini_url = f"https://{CONFIG['REGION']}-aiplatform.googleapis.com/v1/projects/{CONFIG['PROJECT_ID']}/locations/{CONFIG['REGION']}/publishers/google/models/gemini-1.5-flash:streamGenerateContent"
    
    headers = {
        "Authorization": f"Bearer {test_results['tokens']['gcp']}",
        "Content-Type": "application/json"
    }
    
    request_data = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": "This is a validation test for the Vertex Cloud setup. Please respond with exactly: 'Vertex AI validation successful for project " + CONFIG['PROJECT_ID'] + "'"
                    },
                    {
                        "inline_data": {
                            "mime_type": "image/png",
                            "data": test_image_base64
                        }
                    }
                ]
            }
        ],
        "generation_config": {
            "temperature": 0.1,
            "maxOutputTokens": 150
        }
    }
    
    response = requests.post(gemini_url, headers=headers, json=request_data, timeout=30)
    
    if response.status_code == 200:
        # Parse streaming response
        response_text = ""
        lines = response.text.strip().split('\n')
        for line in lines:
            if line.strip():
                try:
                    chunk = json.loads(line)
                    if 'candidates' in chunk and chunk['candidates']:
                        content = chunk['candidates'][0].get('content', {})
                        parts = content.get('parts', [])
                        for part in parts:
                            if 'text' in part:
                                response_text += part['text']
                except json.JSONDecodeError:
                    continue
        
        if response_text:
            print(f"   Gemini response: {response_text[:200]}...")
            return True
        else:
            print("   Gemini API responded but no text content found")
            return False
    elif response.status_code == 403:
        error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        print(f"   ⚠️  Permission denied - check Vertex AI API permissions")
        print(f"   Error: {error_data}")
        return False
    else:
        response.raise_for_status()

gemini_result, success = test_step("Step 7: Vertex AI Gemini API", test_vertex_ai_gemini, critical=False)
test_results['passed' if success else 'failed'] += 1
test_results['details'].append({"step": "Vertex AI/Gemini", "status": "PASS" if success else "FAIL"})

# STEP 8: Test Firebase Config Validation
def validate_firebase_config():
    """Validate Firebase configuration structure"""
    required_fields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId']
    config = CONFIG['FIREBASE_CONFIG']
    
    missing_fields = []
    for field in required_fields:
        if field not in config or not config[field]:
            missing_fields.append(field)
    
    if missing_fields:
        raise Exception(f"Missing required Firebase config fields: {missing_fields}")
    
    # Validate format
    if not config['projectId'] == CONFIG['PROJECT_ID']:
        raise Exception(f"Project ID mismatch: {config['projectId']} vs {CONFIG['PROJECT_ID']}")
    
    if not config['storageBucket'].endswith('.app') and not config['storageBucket'].endswith('.appspot.com'):
        raise Exception(f"Invalid storage bucket format: {config['storageBucket']}")
    
    print(f"   All required fields present")
    print(f"   Project ID matches: {config['projectId']}")
    print(f"   Storage bucket: {config['storageBucket']}")
    print(f"   Auth domain: {config['authDomain']}")
    
    return True

firebase_config_result, success = test_step("Step 8: Firebase Config Validation", validate_firebase_config, critical=False)
test_results['passed' if success else 'failed'] += 1
test_results['details'].append({"step": "Firebase Config", "status": "PASS" if success else "FAIL"})

# STEP 9: Clean up test data
def cleanup_test_data():
    """Clean up any test data created during validation"""
    try:
        # Delete test device document from Firestore
        device_doc_url = f"https://firestore.googleapis.com/v1/projects/{CONFIG['PROJECT_ID']}/databases/(default)/documents/devices/{CONFIG['DEVICE_ID']}"
        headers = {"Authorization": f"Bearer {test_results['tokens']['gcp']}"}
        
        response = requests.delete(device_doc_url, headers=headers, timeout=10)
        if response.status_code in [200, 404]:
            print("   Cleaned up test device document")
        
        return True
    except Exception as e:
        print(f"   Warning: Cleanup failed: {e}")
        return True  # Don't fail the test for cleanup issues

cleanup_result, success = test_step("Step 9: Cleanup Test Data", cleanup_test_data, critical=False)

# GENERATE COMPREHENSIVE REPORT
print("\n" + "=" * 80)
print("📊 VERTEX CLOUD VALIDATION REPORT")
print("=" * 80)

total_tests = test_results['passed'] + test_results['failed']
success_rate = (test_results['passed'] / total_tests * 100) if total_tests > 0 else 0

print(f"\n📈 OVERALL RESULTS")
print(f"   Tests Passed: {test_results['passed']}/{total_tests}")
print(f"   Success Rate: {success_rate:.1f}%")
print(f"   Project: {CONFIG['PROJECT_ID']}")
print(f"   Region: {CONFIG['REGION']}")

print(f"\n📋 DETAILED RESULTS")
for detail in test_results['details']:
    status_emoji = "✅" if detail['status'] == 'PASS' else "❌"
    print(f"   {status_emoji} {detail['step']}: {detail['status']}")

print(f"\n🔧 CONFIGURATION SUMMARY")
print(f"   API Gateway: {CONFIG['API_GATEWAY_URL']}")
print(f"   Firebase API Key: {CONFIG['FIREBASE_API_KEY'][:20]}...")
print(f"   Storage Bucket: {CONFIG['GCS_BUCKET']}")
print(f"   Auth Domain: {CONFIG['FIREBASE_CONFIG']['authDomain']}")

print(f"\n🚀 DEPLOYMENT STATUS")
if success_rate >= 80:
    print("   ✅ READY FOR PRODUCTION")
    print("   Your Vertex Cloud setup is properly configured and ready for cameras!")
elif success_rate >= 60:
    print("   ⚠️  MOSTLY WORKING")
    print("   Core components working but some issues detected. Review failed tests.")
else:
    print("   ❌ NEEDS ATTENTION")
    print("   Multiple critical components failed. Check configuration and permissions.")

print("\n🔍 NEXT STEPS")
if test_results['failed'] > 0:
    print("   • Review failed test details above")
    print("   • Check GCP IAM permissions and service account configuration")
    print("   • Verify API Gateway deployment and routing")
    print("   • Ensure all required APIs are enabled in the project")
else:
    print("   • Your setup is ready for camera deployment!")
    print("   • Use these configuration values in your camera installer")
    print("   • Test with actual camera devices when ready")

print("\n" + "=" * 80)

# Generate JSON report for programmatic use
report_data = {
    "timestamp": datetime.utcnow().isoformat() + "Z",
    "project_id": CONFIG['PROJECT_ID'],
    "success_rate": success_rate,
    "tests_passed": test_results['passed'],
    "tests_failed": test_results['failed'],
    "total_tests": total_tests,
    "details": test_results['details'],
    "configuration": {
        "api_gateway_url": CONFIG['API_GATEWAY_URL'],
        "firebase_config": CONFIG['FIREBASE_CONFIG'],
        "region": CONFIG['REGION'],
        "storage_bucket": CONFIG['GCS_BUCKET']
    }
}

report_filename = f"vertex-cloud-validation-{CONFIG['PROJECT_ID']}-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
with open(report_filename, 'w') as f:
    json.dump(report_data, f, indent=2)

print(f"💾 Detailed report saved to: {report_filename}")
print("=" * 80)

# Exit with appropriate code
sys.exit(0 if test_results['failed'] == 0 else 1)