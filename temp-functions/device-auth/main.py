import functions_framework
import firebase_admin
from firebase_admin import auth

# Initialize Firebase Admin SDK
if not firebase_admin._apps:
    firebase_admin.initialize_app()

@functions_framework.http
def device_authenticator(request):
    if not firebase_admin._apps: 
        return ("Firebase SDK not init", 500)
    if request.method != 'POST': 
        return ('Method Not Allowed', 405)
    try:
        req_json = request.get_json(silent=True)
        if not req_json: 
            return ("Bad Request: No JSON", 400)
        device_id = req_json.get("device_id")
        if not device_id: 
            return ("Bad Request: 'device_id' missing", 400)
        print(f"DeviceAuthFn: Req for device_id: {device_id}")
        # The service account used by this function needs
        # "Service Account Token Creator" role on ITSELF
        custom_token = auth.create_custom_token(uid=str(device_id)).decode('utf-8')
        print(f"DeviceAuthFn: Firebase Custom Token created for {device_id}")
        return ({"firebase_custom_token": custom_token}, 200)
    except Exception as e: 
        print(f"DeviceAuthFn ERROR for {device_id if 'device_id' in locals() else 'unknown'}: {e}")
        return ("Token gen error", 500)