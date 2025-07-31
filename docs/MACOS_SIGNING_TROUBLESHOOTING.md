# macOS Code Signing & Notarization Troubleshooting Guide

## Overview

This guide helps troubleshoot the "damaged and can't be opened" error and other macOS signing issues for the Anava Vision Electron app.

## Quick Validation

Before building, always run:
```bash
./scripts/pre-build-check.sh
```

This will validate:
- Environment variables are set
- Certificate is in Keychain
- Build configuration is correct
- Required files exist

## Common Issues & Solutions

### 1. "is damaged and can't be opened"

**Cause**: Code signature is invalid or broken.

**Solutions**:
1. Run validation: `node scripts/validate-signing-config.js`
2. Check that `identity: null` is NOT in package.json
3. Ensure `hardenedRuntime: true` is set
4. Verify entitlements file exists at `assets/entitlements.mac.plist`

### 2. "identity explicitly is set to null"

**Cause**: package.json has `"identity": null` in mac configuration.

**Solution**: Remove the `identity` field entirely from package.json. Let electron-builder auto-discover.

### 3. Certificate Not Found

**Symptoms**: 
- "No identity found" during build
- "skipped macOS code signing"

**Solutions**:
1. Check certificate is in Keychain:
   ```bash
   security find-identity -v -p codesigning
   ```
2. Should show: `Developer ID Application: Your Name (TEAMID)`
3. If missing, import your .p12 certificate file

### 4. Notarization Fails

**Symptoms**:
- Build succeeds but notarization times out
- "The request timed out" error

**Solutions**:
1. Verify environment variables:
   ```bash
   echo $APPLE_ID
   echo $APPLE_TEAM_ID
   ```
2. Use app-specific password (not regular Apple ID password)
3. Check Apple Developer account is active
4. Ensure app ID matches: `com.anava.vision`

### 5. Post-Signing Modifications

**Symptoms**:
- App was signed correctly but still shows as damaged
- Works locally but not after download

**Causes**:
- Using standard `zip` command (breaks symlinks)
- Modifying files after signing
- Incorrect DMG creation

**Solution**: 
Use proper packaging commands:
```bash
# For ZIP files
ditto -c -k --sequesterRsrc --keepParent "Anava Vision.app" "Anava-Vision-mac.zip"

# Never use:
zip -r app.zip "Anava Vision.app"  # This breaks signatures!
```

## Build Configuration Checklist

### package.json Requirements

```json
{
  "build": {
    "appId": "com.anava.vision",
    "productName": "Anava Vision",
    "afterSign": "scripts/notarize.js",
    "mac": {
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "assets/entitlements.mac.plist",
      "entitlementsInherit": "assets/entitlements.mac.plist"
      // NO "identity" field
      // NO "notarize" object (just boolean in v26+)
    }
  }
}
```

### Required Files

1. **scripts/notarize.js** - Handles notarization
2. **assets/entitlements.mac.plist** - Required entitlements
3. **assets/icon.icns** - App icon

### Environment Variables

Required for building:
- `APPLE_ID` - Your Apple ID email
- `APPLE_ID_PASSWORD` - App-specific password (not regular password)
- `APPLE_TEAM_ID` - Your team ID (e.g., "3JVZNWGRYT")

Optional:
- `APPLE_APP_SPECIFIC_PASSWORD` - Same as APPLE_ID_PASSWORD
- `CSC_NAME` - Not used by electron-builder, don't set

## Debugging Commands

### Check Final Signature
```bash
# Verify signature integrity
codesign --verify --deep --strict --verbose=4 "release/mac/Anava Vision.app"

# Check Gatekeeper assessment
spctl -a -vvv -t execute "release/mac/Anava Vision.app"
```

### Expected Output
Good: `source=Notarized Developer ID`
Bad: `a sealed resource is missing or invalid`

### Find Specific Issues
```bash
# This will show exactly which file is causing problems
codesign --verify --deep --strict --verbose=4 "Anava Vision.app" 2>&1 | grep -E "failed|invalid|error"
```

## Prevention

### Pre-Commit Validation
The `.husky/pre-commit` hook automatically validates signing configuration when you change:
- package.json
- electron-builder.yml
- notarize.js
- entitlements files

### CI/CD Validation
GitHub Actions workflow validates:
- All secrets are configured
- Build configuration is valid
- Signing requirements are met

### Manual Validation
Always run before building:
```bash
./scripts/pre-build-check.sh
```

## Emergency Fixes

If users report the app as damaged:

1. **Immediate workaround** (for users):
   ```bash
   # Remove quarantine attribute
   xattr -cr "/Applications/Anava Vision.app"
   ```

2. **Proper fix** (for developers):
   - Run full validation suite
   - Rebuild with proper signing
   - Test download through Safari
   - Verify with `spctl` before release

## Additional Resources

- [Apple: Notarizing macOS Software](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Electron Builder: Code Signing](https://www.electron.build/code-signing)
- [Troubleshooting Gatekeeper](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution/resolving_common_notarization_issues)