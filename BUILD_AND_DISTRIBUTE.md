# Building and Distributing Anava Vision

## The macOS Code Signing Problem

Your app shows as "damaged" on other Macs because:
1. Ad-hoc signing (`identity: null`) only works on the build machine
2. macOS Gatekeeper blocks unsigned apps from the internet
3. The quarantine attribute is added to downloaded files

## Solution 1: Build Unsigned App (Immediate Fix)

Run this command to build a completely unsigned app:
```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist:mac
```

Then tell users to:
1. Download the .dmg or .zip file
2. Right-click the app and select "Open" (bypasses Gatekeeper)
3. Or run: `sudo xattr -r -d com.apple.quarantine /Applications/Anava\ Vision.app`

## Solution 2: Developer ID Certificate (Best Long-term)

Once your Apple Developer account is approved:
1. Create a Developer ID Application certificate
2. Install it in Keychain
3. Update package.json:
```json
"mac": {
  "identity": "Developer ID Application: Your Name (TEAMID)",
  "hardenedRuntime": true,
  "gatekeeperAssess": true,
  "notarize": {
    "appBundleId": "com.anava.vision",
    "appSpecificPassword": "your-app-specific-password",
    "appleId": "your-apple-id@email.com",
    "appleIdPassword": "your-app-specific-password",
    "teamId": "YOURTEAMID"
  }
}
```

## Solution 3: TestFlight (For Testing)

Distribute through TestFlight for beta testing:
1. Build for Mac App Store
2. Upload to App Store Connect
3. Distribute via TestFlight
4. No Gatekeeper issues for testers

## Current Build Configuration

The app is configured to:
- Build universal binary (x64 + arm64)
- Include all necessary native modules
- Unpack ping module from asar (required for network scanning)
- Create both .dmg and .zip outputs

## Debugging "Damaged" App Issues

If users still see "damaged" after using xattr:
1. Check if the download was corrupted (re-download)
2. Verify they're using the right architecture
3. Try the .zip instead of .dmg
4. Check Console.app for specific errors
5. Ensure all native modules are included in build

## Building for Distribution

```bash
# Install dependencies and rebuild native modules
npm install
npx electron-rebuild

# Build unsigned version
CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist:mac

# Files will be in release/ directory:
# - Anava Vision-0.9.0-arm64.dmg (for Apple Silicon)
# - Anava Vision-0.9.0-x64.dmg (for Intel)
# - Corresponding .zip files
```

The unsigned build will work on any Mac, but users must bypass Gatekeeper manually.