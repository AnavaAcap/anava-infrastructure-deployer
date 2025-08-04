"""
AI Proxy Cloud Function for Anava Vision Magical Installer
Provides instant AI demo without authentication using shared API keys
"""

import functions_framework
import requests
import json
import time
import jwt
import os
import logging
from datetime import datetime, timedelta
from google.cloud import firestore, secretmanager
from google.cloud.exceptions import NotFound
import hashlib

# Initialize clients
db = firestore.Client()
secrets_client = secretmanager.SecretManagerServiceClient()

# Configuration
PROJECT_ID = os.environ.get('GCP_PROJECT')
RATE_LIMITS = {
    'requests_per_minute': 10,
    'requests_per_hour': 100,
    'requests_per_day': 500,
    'requests_per_device': 1000  # Total lifetime limit for demo
}

# Collections
SHARED_KEYS_COLLECTION = 'shared_ai_keys'
USAGE_TRACKING_COLLECTION = 'ai_usage_tracking'
DEVICE_TOKENS_COLLECTION = 'device_tokens'

# Gemini API configuration
GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_secret(secret_name: str) -> str:
    """Retrieve secret from Secret Manager"""
    try:
        name = f"projects/{PROJECT_ID}/secrets/{secret_name}/versions/latest"
        response = secrets_client.access_secret_version(request={"name": name})
        return response.payload.data.decode('UTF-8')
    except Exception as e:
        logger.error(f"Failed to get secret {secret_name}: {e}")
        raise


def generate_device_id(request) -> str:
    """Generate consistent device ID from request characteristics"""
    # Use combination of IP, user agent, and camera info to create device ID
    ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    user_agent = request.headers.get('User-Agent', '')
    camera_info = request.get_json().get('device_info', {})
    
    device_string = f"{ip}:{user_agent}:{json.dumps(camera_info, sort_keys=True)}"
    return hashlib.sha256(device_string.encode()).hexdigest()[:16]


def check_rate_limits(device_id: str) -> tuple[bool, str]:
    """Check if device has exceeded rate limits"""
    now = datetime.utcnow()
    usage_ref = db.collection(USAGE_TRACKING_COLLECTION).document(device_id)
    
    try:
        usage_doc = usage_ref.get()
        if not usage_doc.exists:
            # First time user
            usage_ref.set({
                'created_at': now,
                'total_requests': 0,
                'requests_this_minute': [],
                'requests_this_hour': [],
                'requests_this_day': []
            })
            return True, "First time user"
        
        usage_data = usage_doc.to_dict()
        
        # Check lifetime limit
        if usage_data.get('total_requests', 0) >= RATE_LIMITS['requests_per_device']:
            return False, "Demo limit reached. Please upgrade to continue."
        
        # Clean old timestamps
        minute_ago = now - timedelta(minutes=1)
        hour_ago = now - timedelta(hours=1)
        day_ago = now - timedelta(days=1)
        
        requests_this_minute = [ts for ts in usage_data.get('requests_this_minute', []) 
                                if ts > minute_ago]
        requests_this_hour = [ts for ts in usage_data.get('requests_this_hour', []) 
                              if ts > hour_ago]
        requests_this_day = [ts for ts in usage_data.get('requests_this_day', []) 
                             if ts > day_ago]
        
        # Check rate limits
        if len(requests_this_minute) >= RATE_LIMITS['requests_per_minute']:
            return False, "Rate limit exceeded. Please wait a minute."
        if len(requests_this_hour) >= RATE_LIMITS['requests_per_hour']:
            return False, "Hourly limit reached. Please wait."
        if len(requests_this_day) >= RATE_LIMITS['requests_per_day']:
            return False, "Daily limit reached. Try again tomorrow."
        
        return True, "Within limits"
        
    except Exception as e:
        logger.error(f"Rate limit check failed: {e}")
        return False, "Service error"


def get_next_available_key() -> str:
    """Get next available API key from pool"""
    keys_ref = db.collection(SHARED_KEYS_COLLECTION)
    
    # Get all active keys sorted by usage
    keys = keys_ref.where('active', '==', True).order_by('used_today').limit(1).get()
    
    if not keys:
        logger.error("No available API keys in pool")
        return None
    
    key_doc = keys[0]
    key_data = key_doc.to_dict()
    
    # Check if key has quota remaining
    if key_data.get('used_today', 0) >= key_data.get('daily_quota', 1000):
        logger.warning(f"Key {key_doc.id} has reached daily quota")
        # Try to find another key
        keys = keys_ref.where('active', '==', True).where('used_today', '<', 1000).limit(1).get()
        if not keys:
            return None
        key_doc = keys[0]
    
    # Decrypt the API key
    encrypted_key = key_data.get('api_key')
    try:
        # In production, use KMS for decryption
        api_key = get_secret(f"ai-key-{key_doc.id}")
        return api_key
    except Exception as e:
        logger.error(f"Failed to decrypt API key: {e}")
        return None


def track_usage(device_id: str, success: bool, tokens_used: int = 0):
    """Track API usage for analytics and rate limiting"""
    now = datetime.utcnow()
    usage_ref = db.collection(USAGE_TRACKING_COLLECTION).document(device_id)
    
    try:
        usage_ref.update({
            'total_requests': firestore.Increment(1),
            'successful_requests': firestore.Increment(1 if success else 0),
            'total_tokens': firestore.Increment(tokens_used),
            'last_request': now,
            'requests_this_minute': firestore.ArrayUnion([now]),
            'requests_this_hour': firestore.ArrayUnion([now]),
            'requests_this_day': firestore.ArrayUnion([now])
        })
    except Exception as e:
        logger.error(f"Failed to track usage: {e}")


def proxy_to_gemini(request_data: dict, api_key: str) -> dict:
    """Proxy request to Gemini API"""
    try:
        # Extract the model and request type
        model = request_data.get('model', 'gemini-1.5-flash')
        endpoint = request_data.get('endpoint', 'generateContent')
        
        # Build Gemini API URL
        url = f"{GEMINI_API_BASE}/models/{model}:{endpoint}?key={api_key}"
        
        # Prepare request payload
        gemini_payload = {
            'contents': request_data.get('contents', []),
            'generationConfig': request_data.get('generationConfig', {
                'temperature': 0.7,
                'topK': 1,
                'topP': 1,
                'maxOutputTokens': 2048,
            })
        }
        
        # Make request to Gemini
        response = requests.post(url, json=gemini_payload, timeout=30)
        response.raise_for_status()
        
        result = response.json()
        
        # Extract token usage for tracking
        usage_metadata = result.get('usageMetadata', {})
        tokens_used = usage_metadata.get('totalTokenCount', 0)
        
        return {
            'success': True,
            'response': result,
            'tokens_used': tokens_used
        }
        
    except requests.exceptions.Timeout:
        return {'success': False, 'error': 'Request timeout'}
    except requests.exceptions.RequestException as e:
        logger.error(f"Gemini API request failed: {e}")
        return {'success': False, 'error': 'API request failed'}
    except Exception as e:
        logger.error(f"Unexpected error in proxy: {e}")
        return {'success': False, 'error': 'Internal error'}


@functions_framework.http
def ai_proxy(request):
    """Main entry point for AI proxy function"""
    
    # Enable CORS
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        return ('', 204, headers)
    
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    }
    
    try:
        # Validate request
        if request.method != 'POST':
            return json.dumps({'error': 'Method not allowed'}), 405, headers
        
        request_data = request.get_json()
        if not request_data:
            return json.dumps({'error': 'Invalid request body'}), 400, headers
        
        # Generate device ID
        device_id = generate_device_id(request)
        logger.info(f"Processing request for device: {device_id}")
        
        # Check rate limits
        allowed, message = check_rate_limits(device_id)
        if not allowed:
            return json.dumps({
                'error': 'Rate limit exceeded',
                'message': message,
                'upgrade_url': 'https://anava.ai/upgrade'
            }), 429, headers
        
        # Get available API key
        api_key = get_next_available_key()
        if not api_key:
            return json.dumps({
                'error': 'Service temporarily unavailable',
                'message': 'No API keys available. Please try again later.'
            }), 503, headers
        
        # Proxy to Gemini
        result = proxy_to_gemini(request_data, api_key)
        
        # Track usage
        track_usage(device_id, result['success'], result.get('tokens_used', 0))
        
        if result['success']:
            return json.dumps(result['response']), 200, headers
        else:
            return json.dumps({
                'error': result['error'],
                'message': 'Failed to process AI request'
            }), 500, headers
            
    except Exception as e:
        logger.error(f"Unhandled error in ai_proxy: {e}")
        return json.dumps({
            'error': 'Internal server error',
            'message': 'An unexpected error occurred'
        }), 500, headers


@functions_framework.http
def get_device_status(request):
    """Check device demo status and remaining quota"""
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        return ('', 204, headers)
    
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    }
    
    try:
        device_id = request.args.get('device_id')
        if not device_id:
            # Generate from request
            device_id = generate_device_id(request)
        
        usage_ref = db.collection(USAGE_TRACKING_COLLECTION).document(device_id)
        usage_doc = usage_ref.get()
        
        if not usage_doc.exists:
            # New device
            return json.dumps({
                'device_id': device_id,
                'status': 'new',
                'requests_used': 0,
                'requests_remaining': RATE_LIMITS['requests_per_device'],
                'daily_limit': RATE_LIMITS['requests_per_day']
            }), 200, headers
        
        usage_data = usage_doc.to_dict()
        total_requests = usage_data.get('total_requests', 0)
        
        return json.dumps({
            'device_id': device_id,
            'status': 'active' if total_requests < RATE_LIMITS['requests_per_device'] else 'limit_reached',
            'requests_used': total_requests,
            'requests_remaining': max(0, RATE_LIMITS['requests_per_device'] - total_requests),
            'daily_limit': RATE_LIMITS['requests_per_day'],
            'created_at': usage_data.get('created_at', datetime.utcnow()).isoformat()
        }), 200, headers
        
    except Exception as e:
        logger.error(f"Error getting device status: {e}")
        return json.dumps({'error': 'Failed to get status'}), 500, headers