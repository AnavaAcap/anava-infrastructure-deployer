def device_authenticator(request):
    return ('{"status": "Device auth endpoint working"}', 200, {'Content-Type': 'application/json'})