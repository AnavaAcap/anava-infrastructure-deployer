# Camera Detection and License Activation Troubleshooting Guide

## Version: v0.9.178+
## Last Updated: 2025-08-11

## Quick Diagnosis Checklist

### Camera Not Detected
- [ ] Check if device responds to HTTPS requests
- [ ] Verify POST request includes propertyList parameter
- [ ] Check if device requires authentication (401 response)
- [ ] Verify network connectivity to device IP

### License Activation Fails
- [ ] Verify MAC address is present in camera object
- [ ] Check MAC is passed to activateLicenseKey() call
- [ ] Confirm MAC format is uppercase without colons (e.g., B8A44F45D624)
- [ ] Check debug logs for MAC tracking

### Wrong Device Type
- [ ] Speaker showing as camera: Check audio endpoint detection
- [ ] Camera showing as unknown: Verify ProdType field parsing
- [ ] Non-Axis device detected: Check response format validation

## Detailed Troubleshooting

### 1. Network Scanner Issues

#### Problem: Scanner Can't Find Camera at Known IP
```bash
# Test direct connection
curl -k https://192.168.50.156/axis-cgi/basicdeviceinfo.cgi

# If "Only POST supported" error, test POST:
curl -k -X POST https://192.168.50.156/axis-cgi/basicdeviceinfo.cgi \
  -H "Content-Type: application/json" \
  -d '{"apiVersion":"1.0","method":"getProperties","params":{"propertyList":["SerialNumber","ProdType"]}}'
```

**Solution**: Update scanner to handle POST requirement:
- File: `src/main/services/camera/fastNetworkScanner.ts`
- Look for: `identifyCamera` function
- Ensure POST logic with propertyList is present

#### Problem: Device Incorrectly Identified as Speaker
**Symptoms**: 
- Camera at .156 not showing in list
- Speaker at .121 showing as camera

**Debug Steps**:
1. Check device response:
```bash
# For camera (should work with credentials)
curl -k -u anava:baton https://192.168.50.156/axis-cgi/basicdeviceinfo.cgi

# For speaker (should return 401)
curl -k https://192.168.50.121/axis-cgi/basicdeviceinfo.cgi
curl -k https://192.168.50.121/axis-cgi/audio/transmit.cgi
```

2. Verify detection logic in scanner:
- Speakers: Return 401 on basicdeviceinfo BUT have audio endpoint
- Cameras: Return data (with auth) or require POST method

### 2. MAC Address Issues

#### Problem: "Could not determine device ID" Error
**Debug Path**:
1. Scanner → Check MAC extraction:
```javascript
// In fastNetworkScanner.ts
console.log('Extracted MAC:', data.propertyList?.SerialNumber);
```

2. CameraSetupPage → Verify MAC in formatted cameras:
```javascript
// In CameraSetupPage.tsx
console.log('Formatted cameras:', formattedCameras.map(c => ({
  ip: c.ip,
  mac: c.mac,
  hasMAC: !!c.mac
})));
```

3. License Activation → Confirm MAC passed:
```javascript
// In CameraSetupPage.tsx line ~337
console.log('Activating with MAC:', selectedCamera.mac);
await window.electronAPI.activateLicenseKey(
  selectedCamera.ip,
  credentials.username,
  credentials.password,
  licenseKey,
  'BatonAnalytic',
  selectedCamera.mac  // CRITICAL: Must be present!
);
```

#### MAC Format Issues
- **Expected**: Uppercase, no separators (B8A44F45D624)
- **Common Issues**:
  - Lowercase: Convert with `.toUpperCase()`
  - With colons: Remove with `.replace(/:/g, '')`
  - Missing: Extract from SerialNumber field, not MAC field

### 3. UI Display Issues

#### Problem: Speakers Showing in "Found Cameras" List
**File**: `src/renderer/pages/CameraSetupPage.tsx`
**Fix**: Filter devices before display:
```javascript
const camerasOnly = scanResults.filter(device => 
  device.deviceType !== 'speaker'
);
```

#### Problem: Green Checkmark for Failed Auth
**Fix**: Check `accessible` and `authRequired` flags:
```javascript
icon = device.accessible && !device.authRequired 
  ? <CheckCircle color="success" />
  : <Warning color="warning" />;
```

#### Problem: Progress Shows 599/254
**Fix**: Calculate total correctly or use indeterminate:
```javascript
// Option 1: Calculate actual total
const totalIPs = networkRanges.length * 254;

// Option 2: Use indeterminate progress
<LinearProgress variant="indeterminate" />
```

## Testing and Validation

### Manual Testing Script
```bash
# 1. Test device detection
node -e "
const axios = require('axios');
const https = require('https');

async function testDevice(ip) {
  const agent = new https.Agent({ rejectUnauthorized: false });
  try {
    // Try GET first
    let response = await axios.get(
      \`https://\${ip}/axis-cgi/basicdeviceinfo.cgi\`,
      { httpsAgent: agent, timeout: 2000 }
    );
    console.log(\`\${ip}: GET worked\`, response.data);
  } catch (e) {
    if (e.response?.status === 401) {
      // Check if speaker
      try {
        await axios.get(
          \`https://\${ip}/axis-cgi/audio/transmit.cgi\`,
          { httpsAgent: agent, timeout: 2000 }
        );
        console.log(\`\${ip}: SPEAKER (has audio endpoint)\`);
      } catch {
        console.log(\`\${ip}: AUTH REQUIRED (not speaker)\`);
      }
    } else if (e.response?.data?.error?.message?.includes('POST')) {
      // Try POST
      try {
        const postResp = await axios.post(
          \`https://\${ip}/axis-cgi/basicdeviceinfo.cgi\`,
          {
            apiVersion: '1.0',
            method: 'getProperties',
            params: {
              propertyList: ['SerialNumber', 'ProdType']
            }
          },
          { httpsAgent: agent, auth: { username: 'anava', password: 'baton' } }
        );
        console.log(\`\${ip}: CAMERA (POST)\`, postResp.data.data.propertyList);
      } catch (e2) {
        console.log(\`\${ip}: POST FAILED\`, e2.message);
      }
    }
  }
}

testDevice('192.168.50.156');
testDevice('192.168.50.121');
"
```

### Automated Tests
```bash
# Run specific test suites
npm test -- regression-tests.spec.ts
npm test -- --testNamePattern="Device Detection"
npm test -- --testNamePattern="MAC Address Flow"
```

### Build Verification
```bash
# After making changes
npm run build:renderer  # CRITICAL after UI changes!
npm run build:main      # After scanner changes
npm run build           # Full rebuild

# Test production build
npx electron dist/main/index.js
```

## Common Mistakes to Avoid

1. **Forgetting to pass MAC**: Always check selectedCamera.mac is passed
2. **Not building renderer**: UI changes require `npm run build:renderer`
3. **Assuming GET works**: Newer devices require POST with propertyList
4. **Hardcoding values**: Never hardcode MAC addresses or IPs
5. **Missing auth handling**: Check for 401 responses appropriately
6. **Not filtering speakers**: Always filter by deviceType in UI

## Debug Logging

Add these debug statements when troubleshooting:

```javascript
// In fastNetworkScanner.ts
console.log(`[SCANNER] Device ${ip}:`, {
  method: isPostRequired ? 'POST' : 'GET',
  deviceType,
  mac: extractedMAC,
  accessible,
  authRequired
});

// In CameraSetupPage.tsx
console.log('[SETUP] Formatted cameras:', formattedCameras);
console.log('[SETUP] Selected camera:', selectedCamera);
console.log('[SETUP] Activating license with MAC:', selectedCamera.mac);

// In ACAPDeploymentPage.tsx
console.log('[DEPLOY] Camera for license:', {
  id: camera.id,
  mac: camera.mac,
  hasMAC: !!camera.mac
});
```

## Contact for Issues

If issues persist after following this guide:
1. Collect debug logs with above statements
2. Run regression tests and save output
3. Document specific IPs and device models
4. Note exact error messages and where they occur