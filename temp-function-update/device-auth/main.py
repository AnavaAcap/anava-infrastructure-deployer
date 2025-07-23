import functions_framework
import firebase_admin
from firebase_admin import auth

# Initialize Firebase Admin SDK
if not firebase_admin._apps:
    firebase_admin.initialize_app()

@functions_framework.http
def device_authenticator(request):
    """Cloud Function to generate Firebase custom tokens for device authentication."""
    
    # CORS headers for browser-based requests (if needed)
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
        'Content-Type': 'application/json'
    }
    
    # Handle preflight requests
    if request.method == 'OPTIONS':
        return ('', 204, headers)
    
    if not firebase_admin._apps: 
        return ({"error": "Firebase SDK not initialized"}, 500, headers)
        
    if request.method != 'POST': 
        return ({"error": "Method not allowed"}, 405, headers)
        
    try:
        req_json = request.get_json(silent=True)
        if not req_json: 
            return ({"error": "Bad Request: No JSON body"}, 400, headers)
            
        device_id = req_json.get("device_id")
        if not device_id: 
            return ({"error": "Bad Request: 'device_id' missing"}, 400, headers)
            
        print(f"DeviceAuthFn: Request for device_id: {device_id}")
        
        # Create custom token for the device
        custom_token = auth.create_custom_token(uid=str(device_id))
        
        # Decode bytes to string if needed
        if isinstance(custom_token, bytes):
            custom_token = custom_token.decode('utf-8')
            
        print(f"DeviceAuthFn: Firebase Custom Token created for {device_id}")
        
        return ({"firebase_custom_token": custom_token}, 200, headers)
        
    except Exception as e: 
        print(f"DeviceAuthFn ERROR: {str(e)}")
        return ({"error": f"Token generation error: {str(e)}"}, 500, headers)