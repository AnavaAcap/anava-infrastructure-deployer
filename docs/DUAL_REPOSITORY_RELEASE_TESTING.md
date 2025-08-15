# Dual Repository Release Testing Guide for Anava Vision

## Overview

This guide provides comprehensive testing procedures for the new dual repository release system introduced in Anava Vision v0.9.210+. The system maintains two separate repositories:

1. **ACAP Releases**: https://github.com/AnavaAcap/acap-releases/releases/tag/v3.8.2
   - Contains versioned installers with ACAP files
   - For technical tracking and version history
   
2. **Vision Releases**: https://github.com/AnavaAcap/vision-releases *(NEW)*
   - Contains static-named installers for website integration
   - Provides consistent download URLs

## CRITICAL: Static Download URLs for Website Integration

These URLs must **NEVER** break as they are integrated into the Anava website:

- **Windows**: `https://github.com/AnavaAcap/vision-releases/releases/latest/download/Anava.Vision.Setup.exe`
- **macOS**: `https://github.com/AnavaAcap/vision-releases/releases/latest/download/Anava.Vision.dmg`

## Pre-Release Testing Checklist

### 1. Branding Validation Tests

```bash
# Run branding consistency tests
npm run test:dual-repo

# Manual verification
grep -r "Anava Installer" src/ --exclude-dir=node_modules
grep -r "Configure Vision AI" src/ --exclude-dir=node_modules
```

**Expected Results:**
- ✅ No "Anava Installer" references in current code
- ✅ Sidebar shows "Vision Architect" not "Configure Vision AI"
- ✅ Package.json shows `"name": "anava-vision"`
- ✅ Product name is "Anava Vision" throughout

### 2. Port Support Regression Tests

```bash
# Run comprehensive port support tests
npm run test:port-support

# Specific regression scenarios
npm run test:regression
```

**Critical Test Scenarios:**
- ✅ Standard ports (80, 443) work without explicit specification
- ✅ Custom ports (8080, 8443, etc.) work correctly
- ✅ Vision Architect functions with custom ports
- ✅ Camera discovery handles port variations
- ✅ VAPIX API calls include port in URLs when needed

### 3. Security Validation

```bash
# Run security tests for dual repository system
npm run test:security

# Check for hardcoded credentials
grep -r "AIza" src/ --exclude-dir=node_modules
grep -r "sk-" src/ --exclude-dir=node_modules
```

**Security Requirements:**
- ✅ No hardcoded API keys or credentials
- ✅ GitHub Actions uses secrets properly
- ✅ Code signing certificates configured
- ✅ Static URLs use HTTPS and correct repository
- ✅ No vulnerable dependencies

### 4. Version Synchronization

```bash
# Validate version consistency
npm run test:release-validation
```

**Version Checks:**
- ✅ Package.json version matches current release
- ✅ CLAUDE.md mentions current version
- ✅ No version conflicts across files
- ✅ Git tag format follows `v{major}.{minor}.{patch}`

## Release Workflow Testing

### Phase 1: GitHub Actions Build Validation

1. **Trigger Release Build**
   ```bash
   # Update version and create tag
   npm version patch
   git commit -m "chore: bump version to v0.9.XXX" --no-verify
   git tag v0.9.XXX
   git push origin main --tags
   ```

2. **Monitor Build Progress**
   ```bash
   # Check workflow status
   gh run list --workflow=release.yml --limit=3
   
   # Follow build logs
   gh run view <run-id> --log
   ```

3. **Validate Build Outputs**
   - ✅ Windows build completes with code signing
   - ✅ macOS build completes with notarization
   - ✅ Both platforms generate expected artifacts
   - ✅ No build errors or warnings

### Phase 2: Dual Repository Upload Verification

1. **ACAP Releases Repository**
   - ✅ New release created with version tag
   - ✅ Versioned installers uploaded:
     - `Anava.Vision.Setup.{version}.exe`
     - `Anava.Vision-{version}.dmg`
   - ✅ ACAP files included in release
   - ✅ Release notes updated

2. **Vision Releases Repository**
   - ✅ Release marked as "latest"
   - ✅ Static-named installers uploaded:
     - `Anava.Vision.Setup.exe`
     - `Anava.Vision.dmg`
   - ✅ README.md reflects current version features
   - ✅ Static download URLs resolve correctly

### Phase 3: Download URL Testing

**Automated URL Validation:**
```bash
# Test static URLs (these must work for website)
curl -I "https://github.com/AnavaAcap/vision-releases/releases/latest/download/Anava.Vision.Setup.exe"
curl -I "https://github.com/AnavaAcap/vision-releases/releases/latest/download/Anava.Vision.dmg"

# Both should return HTTP 302 (redirect to actual download)
```

**Manual Testing:**
1. Open static URLs in browser
2. Verify downloads start immediately
3. Check downloaded file names are correct
4. Validate file sizes are reasonable (not 0 bytes)

### Phase 4: Installation Testing

**Windows Installation:**
1. Download from static URL
2. Verify code signing (no Windows Defender warnings)
3. Install application
4. Test core functionality:
   - Camera discovery
   - Vision Architect access
   - Custom port support
   - License activation

**macOS Installation:**
1. Download from static URL
2. Verify notarization (no Gatekeeper blocks)
3. Install application
4. Test same core functionality as Windows

## Post-Release Validation

### 1. Website Integration Check

Verify that the Anava website can successfully download installers using the static URLs:

```bash
# Test from external network (not GitHub network)
curl -L -o test-windows.exe "https://github.com/AnavaAcap/vision-releases/releases/latest/download/Anava.Vision.Setup.exe"
curl -L -o test-macos.dmg "https://github.com/AnavaAcap/vision-releases/releases/latest/download/Anava.Vision.dmg"

# Verify file integrity
file test-windows.exe  # Should show: MS Windows installer
file test-macos.dmg    # Should show: Apple disk image
```

### 2. Version Tracking Verification

Ensure both repositories are properly synchronized:

- ✅ ACAP releases shows new versioned files
- ✅ Vision releases shows updated static files  
- ✅ Both point to same installer versions
- ✅ Release timestamps are close (within minutes)

### 3. Legacy URL Compatibility

Verify that existing bookmarks and links still work:

- ✅ Previous ACAP release URLs remain accessible
- ✅ Versioned installer links work for historical tracking
- ✅ No broken links in documentation

## Troubleshooting Common Issues

### Build Failures

**Windows Build Issues:**
```bash
# Check for rollup module error
npm ci
npm install @rollup/rollup-win32-x64-msvc --no-save
npm run dist:win
```

**macOS Code Signing Issues:**
- Verify certificates in GitHub secrets
- Check entitlements.mac.plist exists
- Ensure notarization credentials are valid

### Upload Failures

**Missing Artifacts:**
- Check GitHub Actions permissions
- Verify release workflow has correct repository access
- Ensure both repositories exist and are accessible

**Static URL Resolution Issues:**
- Verify release is marked as "latest"
- Check file names match exactly
- Ensure upload completed successfully

### Port Support Regressions

**Camera Connection Issues:**
```bash
# Test standard ports
curl -k "https://192.168.1.100/axis-cgi/basicdeviceinfo.cgi"

# Test custom ports  
curl -k "https://192.168.1.100:8443/axis-cgi/basicdeviceinfo.cgi"
```

**Vision Architect Port Problems:**
- Check camera IP construction in code
- Verify port parameter passing
- Test with different camera configurations

## Emergency Rollback Procedures

If critical issues are discovered after release:

### 1. Immediate Response
```bash
# Mark release as pre-release to remove "latest" tag
gh release edit v0.9.XXX --prerelease

# Or delete problematic release entirely
gh release delete v0.9.XXX --yes
```

### 2. Restore Previous Version
```bash
# Promote previous release to latest
gh release edit v0.9.XXX-1 --latest
```

### 3. Hotfix Process
```bash
# Create hotfix branch
git checkout -b hotfix/v0.9.XXX-1
# Apply minimal fixes
# Create new patch release
npm version patch
git tag v0.9.XXX-1
git push origin hotfix/v0.9.XXX-1 --tags
```

## Test Automation Scripts

### Daily Static URL Health Check
```bash
#!/bin/bash
# Add to CI/CD for daily validation

echo "Testing static download URLs..."

# Windows URL
WIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://github.com/AnavaAcap/vision-releases/releases/latest/download/Anava.Vision.Setup.exe")
if [ "$WIN_STATUS" != "302" ]; then
  echo "❌ Windows static URL failed: $WIN_STATUS"
  exit 1
fi

# macOS URL  
MAC_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://github.com/AnavaAcap/vision-releases/releases/latest/download/Anava.Vision.dmg")
if [ "$MAC_STATUS" != "302" ]; then
  echo "❌ macOS static URL failed: $MAC_STATUS"
  exit 1
fi

echo "✅ All static URLs healthy"
```

### Repository Sync Verification
```bash
#!/bin/bash
# Verify both repositories have matching releases

ACAP_LATEST=$(gh release list -R AnavaAcap/acap-releases --limit 1 | awk '{print $1}')
VISION_LATEST=$(gh release list -R AnavaAcap/vision-releases --limit 1 | awk '{print $1}')

if [ "$ACAP_LATEST" != "$VISION_LATEST" ]; then
  echo "⚠️ Repository version mismatch: ACAP=$ACAP_LATEST, Vision=$VISION_LATEST"
  exit 1
fi

echo "✅ Repositories synchronized: $ACAP_LATEST"
```

## Success Criteria Summary

A release is considered successful when:

- ✅ All automated tests pass (dual-repo, security, regression)
- ✅ GitHub Actions build completes without errors
- ✅ Both repositories updated with correct files
- ✅ Static download URLs resolve correctly
- ✅ Manual installation tests pass on both platforms
- ✅ Core functionality works (camera discovery, Vision Architect, ports)
- ✅ No security vulnerabilities introduced
- ✅ Branding consistency maintained
- ✅ Website integration functional

## Contact and Escalation

For critical release issues:

1. **Immediate**: Disable problematic release using GitHub UI
2. **Communication**: Update team via established channels
3. **Investigation**: Use test scripts and logs to identify root cause
4. **Resolution**: Apply minimal fix and create hotfix release
5. **Post-mortem**: Document issue and improve testing procedures

---

**Last Updated**: August 15, 2025
**Version**: Anava Vision v0.9.210+
**Maintainer**: QA/DevOps Team