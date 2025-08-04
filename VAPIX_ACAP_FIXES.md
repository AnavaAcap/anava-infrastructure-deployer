# VAPIX ACAP Deployment Fixes

## Summary of Changes

### 1. Enhanced Camera vs Speaker Detection

**Problem**: The installer was detecting Axis speakers (like at 192.168.50.121) as cameras.

**Solution**: 
- Added comprehensive device type detection in `isAxisCamera()` method
- Checks multiple VAPIX parameters: `Brand.ProdNbr`, `Brand.ProdType`, `Brand.ProdShortName`, `Brand.WebURL`
- Filters out devices with keywords: speaker, audio, sound, horn, intercom, siren, etc.
- Recognizes camera model patterns (M3065, P1435, Q6055) vs speaker patterns (C series)
- Added detailed logging to track device detection decisions

### 2. Fixed ACAP Deployment via VAPIX

**VAPIX API Details**:
- **Upload Endpoint**: `/axis-cgi/applications/upload.cgi`
- **Method**: POST with multipart/form-data
- **Authentication**: Digest authentication
- **File Field Name**: `packfil` (critical - must be exactly this name)
- **Content Type**: `application/octet-stream`
- **Auto-Installation**: ACAP is automatically installed after successful upload

**Key Changes**:
- Fixed method calls: `getReleases()` → `getAvailableReleases()`
- Fixed method calls: `downloadRelease()` → `downloadACAP()`
- Proper error handling for download results
- Added type conversion from `CameraInfo` to `Camera` for API compatibility

### 3. Enhanced Verbose Logging

Added detailed logging at every step:
- Device discovery: Model, Type, ShortName for each device found
- ACAP release detection: Name, URL, architecture, size
- Download progress: File path and success status
- Upload process: VAPIX endpoint, headers, response details
- Installation status: Lists all installed ACAPs with versions

### 4. Improved ACAP List Parsing

Enhanced `listInstalledACAPs()` to properly parse VAPIX response:
```
app1.Name="BatonAnalytic"
app1.NiceName="Baton Analytic"
app1.Vendor="Anava"
app1.Version="1.0.0"
app1.Status="Running"
```

## VAPIX ACAP Commands Reference

### List Installed ACAPs
```bash
curl -u root:pass --digest \
  "http://192.168.50.156/axis-cgi/applications/list.cgi"
```

### Upload ACAP
```bash
curl -u root:pass --digest \
  -F "packfil=@BatonAnalytic_1_0_0_armv7hf.eap;type=application/octet-stream" \
  "http://192.168.50.156/axis-cgi/applications/upload.cgi"
```

### Remove ACAP
```bash
curl -u root:pass --digest \
  -d "action=remove&package=batonanalytic" \
  "http://192.168.50.156/axis-cgi/applications/control.cgi"
```

### Start/Stop ACAP
```bash
# Start
curl -u root:pass --digest \
  -d "action=start&package=batonanalytic" \
  "http://192.168.50.156/axis-cgi/applications/control.cgi"

# Stop
curl -u root:pass --digest \
  -d "action=stop&package=batonanalytic" \
  "http://192.168.50.156/axis-cgi/applications/control.cgi"
```

## Testing

To test the fixes:
1. Run the installer - it should skip the speaker at 192.168.50.121
2. Check logs for "SKIPPING: Non-camera Axis device" messages
3. Verify ACAP deployment shows detailed progress logs
4. Confirm successful installation on actual cameras

## Common Issues

1. **"packfil" field name**: Must be exactly this - not "file", "package", or "packfile"
2. **Auto-installation**: After upload, ACAP installs automatically - wait 3 seconds
3. **Digest auth**: Requires proper realm, nonce, qop handling
4. **C-series devices**: Usually speakers/audio devices, not cameras