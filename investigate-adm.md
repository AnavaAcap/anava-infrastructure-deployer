# Axis Device Manager Investigation

## Key Findings

1. **Axis Device Manager (ADM)** is a free Windows/Mac application that can manage Axis devices including license activation
2. **ADM can activate licenses** - this proves there IS a way to do it programmatically
3. **The camera responds with 400 Bad Request** to `/axis-cgi/applications/license.cgi?action=convert` - this suggests the endpoint exists but we're not calling it correctly

## Possible Approaches ADM Uses:

### 1. **Certificate-Based Authentication**
- ADM might install a client certificate that's trusted by Axis servers
- This would allow it to authenticate to the license conversion API
- The certificate could be embedded in the ADM installer

### 2. **Device-Specific Authentication**
- The camera might be able to authenticate itself to Axis servers
- ADM could be triggering the camera to make the API call itself
- This would explain why the endpoint exists on the camera

### 3. **Bundled API Credentials**
- ADM might include API credentials in its binary
- These would be obfuscated/encrypted but could be extracted

### 4. **OAuth/Token Flow**
- ADM might use an OAuth flow where users log in with their Axis account
- The token from this login could then be used for API calls

## Next Steps:

1. **Install ADM and capture its network traffic** when activating a license
2. **Reverse engineer the ADM binary** to find API endpoints and credentials
3. **Check if ADM creates any certificates** in the Windows/Mac certificate store
4. **Monitor the camera's outbound traffic** when ADM activates a license

## The 400 Bad Request is Key!

The fact that `/axis-cgi/applications/license.cgi?action=convert` returns 400 (not 404) means:
- The endpoint EXISTS
- We're just not calling it with the right parameters
- It might need POST data instead of GET parameters
- It might need specific headers or authentication

## Test Ideas:

1. Try POST to the endpoint with the license key in the body
2. Try different parameter names (licenseCode, key, license, etc.)
3. Check if it needs a specific Content-Type header
4. See if it requires the device's serial number as authentication