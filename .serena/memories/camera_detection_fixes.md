# Camera Detection and License Activation Fixes

## Date: 2025-08-11
## Version: v0.9.178+

### Critical Issues Fixed

#### 1. Network Scanner Device Detection
**Problem**: Scanner incorrectly identified devices (.121 as camera, .156 not detected)
**Root Cause**: Incorrect API request format for newer Axis devices
**Solution**: 
- Fixed POST request format with propertyList parameter
- Added speaker detection via audio endpoint checking
- Proper handling of 401 authentication responses

**File**: `src/main/services/camera/fastNetworkScanner.ts`
```typescript
// Correct POST format for newer devices
const response = await axiosInstance.post(
  `https://${ip}/axis-cgi/basicdeviceinfo.cgi`,
  {
    "apiVersion": "1.0",
    "method": "getProperties",
    "params": { 
      "propertyList": [
        'Brand', 'BuildDate', 'HardwareID', 'ProdFullName',
        'ProdNbr', 'ProdShortName', 'ProdType', 'ProdVariant',
        'SerialNumber', 'Soc', 'SocSerialNumber', 'Version', 'WebURL'
      ]
    }
  }
);
```

#### 2. MAC Address Not Passed to License Activation
**Problem**: "Could not determine device ID" error during license activation
**Root Cause**: MAC address not flowing through component chain
**Solution**: Ensured MAC flows: scanner → formattedCameras → selectedCamera → license activation

**Files**:
- `src/renderer/pages/CameraSetupPage.tsx`: Pass MAC to license activation
- `src/renderer/pages/camera/ACAPDeploymentPage.tsx`: Accept and use MAC

**Critical Fix**:
```typescript
// CameraSetupPage.tsx - Line 337
await window.electronAPI.activateLicenseKey(
  selectedCamera.ip,
  credentials.username,
  credentials.password,
  licenseKey,
  'BatonAnalytic',
  selectedCamera.mac  // MUST PASS THE MAC ADDRESS!
);
```

#### 3. UI Issues
**Problems**:
- Speakers shown in "Found Cameras" list
- Green checkmark shown for failed authentication
- Progress showing wrong denominator (599/254)

**Solutions**:
- Filter speakers from camera list: `devices.filter(d => d.deviceType !== 'speaker')`
- Show warning icon for auth failures
- Remove denominator, show indeterminate progress

### Device Identification Logic

#### Camera Detection
1. Try GET to basicdeviceinfo.cgi
2. If error says "Only POST supported", use POST with propertyList
3. Extract MAC from SerialNumber field
4. Identify as camera if ProdType contains "Camera"

#### Speaker Detection
1. If basicdeviceinfo returns 401 (auth required)
2. Check audio endpoint: `/axis-cgi/audio/transmit.cgi`
3. If audio endpoint exists (401 response), it's a speaker
4. Mark as `deviceType: 'speaker'` with `authRequired: true`

### Testing Commands

```bash
# Test device detection
npm run test:scanner

# Validate MAC flow
npm run test:mac-flow

# Run regression tests
npm test -- regression-tests.spec.ts

# Build and test production
npm run build
npx electron dist/main/index.js
```

### Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| Device not detected | Check POST request format includes propertyList |
| MAC not available | Extract from SerialNumber field, not dedicated MAC field |
| Speaker in camera list | Filter by deviceType !== 'speaker' |
| License activation fails | Ensure MAC is passed through entire chain |
| 401 on basicdeviceinfo | Device requires auth, check if speaker via audio endpoint |

### Regression Test Coverage

File: `src/__tests__/regression-tests.spec.ts`
- Device detection (camera vs speaker)
- MAC address extraction and flow
- UI component filtering
- License activation with MAC
- Network scanning progress
- POST request format validation

### Important Notes

1. **ALWAYS** pass MAC address to license activation
2. **NEVER** use hardcoded MAC addresses
3. **TEST** changes with validation scripts before claiming fixes work
4. **BUILD** renderer after UI changes: `npm run build:renderer`
5. **LOG** MAC flow for debugging future issues