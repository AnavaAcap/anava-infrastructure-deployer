# Anava ACAP Release v3.8.1

Download the appropriate file for your camera:
- **ARMv7hf OS 11**: For older Axis cameras
- **ARMv7hf OS 12**: For newer Axis cameras  
- **AArch64 OS 11**: For 64-bit cameras (older OS)
- **AArch64 OS 12**: For 64-bit cameras (newer OS)

## What's New
- Fixed immediate GCP token refresh on manual trigger
- Config changes now take effect immediately
- Removed unnecessary 60-second cooldown

## Installation
1. Download the appropriate .eap file
2. Upload to your camera via AXIS Camera Management
3. Configure in camera's web interface

## Anava Installer (Updated to v0.9.175)

The Anava Installer (v0.9.175) is now available for download:
- **Windows**: Anava.Installer.Setup.0.9.175.exe
- **macOS Intel**: Anava.Installer-0.9.175.dmg
- **macOS Apple Silicon**: Anava.Installer-0.9.175-arm64.dmg

### v0.9.175 Improvements
- **Fixed**: API key generation immediately on home screen after Google login
- **Fixed**: Camera context integration and dropdown functionality
- **Fixed**: Scene capture triggers immediately after ACAP deployment
- **Fixed**: React version conflict with testing library
- **Performance**: Optimized parallel processing for scene analysis

The installer provides a unified experience for:
- Camera discovery and ACAP deployment
- Private cloud infrastructure setup
- Detection testing and validation