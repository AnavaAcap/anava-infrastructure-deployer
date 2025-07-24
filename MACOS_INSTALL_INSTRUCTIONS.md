# macOS Installation Instructions

## Installing Anava Vision on macOS

Since this app is not yet signed with an Apple Developer certificate, macOS will show a security warning. Here's how to install it:

### Method 1: Right-click to Open (Recommended)
1. Download the .dmg file
2. Open the .dmg and drag Anava Vision to Applications
3. **Right-click** (or Control-click) on Anava Vision in Applications
4. Select "Open" from the context menu
5. Click "Open" in the security dialog

### Method 2: Security & Privacy Settings
1. Try to open the app normally (it will be blocked)
2. Go to System Settings > Privacy & Security
3. Look for "Anava Vision was blocked" message
4. Click "Open Anyway"

### Method 3: Terminal Command (Advanced)
If the above methods don't work:
```bash
# Remove quarantine attribute
sudo xattr -r -d com.apple.quarantine /Applications/Anava\ Vision.app

# If still showing as damaged, try:
sudo spctl --master-disable
# Open the app
# Then re-enable Gatekeeper:
sudo spctl --master-enable
```

### Why This Happens
macOS requires apps to be signed with a valid Apple Developer certificate. We're in the process of obtaining this certificate. Once signed, these steps won't be necessary.

### Troubleshooting
If you still see "app is damaged":
1. Re-download the installer (the download might have been corrupted)
2. Make sure you're downloading the correct version for your Mac:
   - Intel Macs: Use the x64 version
   - Apple Silicon (M1/M2/M3): Use the arm64 version
3. Try downloading the .zip version instead of .dmg

### For Developers
To build from source and avoid these issues:
```bash
git clone [repository]
cd anava-unified-installer
npm install
npm run dev
```