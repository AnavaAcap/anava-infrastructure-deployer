# Anava Vision - macOS Network Access Issue Handoff

## Current Problem
Electron app v0.9.165 cannot access local network (cameras) on macOS 15 Sequoia when launched from Finder. Gets EHOSTUNREACH errors trying to connect to local IPs.

## Root Cause
macOS 15 requires explicit user permission for local network access. The permission dialog NEVER appears for Developer ID signed apps without special provisioning.

## What Works
- App works when launched from Terminal: `open /Applications/Anava\ Vision.app`
- App works after adding to firewall: `sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add "/Applications/Anava Vision.app"`

## What Doesn't Work
- `com.apple.developer.networking.multicast` entitlement - requires Apple provisioning profile, app won't launch
- Sandbox enabled - Electron app crashes on launch
- All standard network entitlements - don't trigger permission dialog

## Files Involved
- `/src/main/services/camera/optimizedCameraDiscoveryService.ts` - Camera discovery code
- `/assets/entitlements.mac.plist` - macOS entitlements 
- `/package.json` - Build configuration with NSLocalNetworkUsageDescription

## Current State
- Version 0.9.165 
- Sandbox disabled
- Has NSLocalNetworkUsageDescription and NSBonjourServices in Info.plist
- Network entitlements present but not triggering dialog

## Possible Solutions
1. Distribute with instructions to run firewall command
2. Create privileged helper tool with SMJobBless
3. Switch to Mac App Store distribution
4. Use mDNS responder instead of direct TCP
5. Wait for Apple to fix this in macOS update

## Test Command
```bash
# After installing app, run:
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add "/Applications/Anava Vision.app"
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp "/Applications/Anava Vision.app"
# Then launch app normally
```

## Last Working Version
v0.9.163 - Works when launched from Terminal only
EOF < /dev/null
