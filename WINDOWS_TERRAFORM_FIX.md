# Windows Terraform Binary Issue - Fixed

## Problem Description
The Anava Infrastructure Deployer was failing on Windows during the "Initializing Terraform service..." step with errors indicating the Terraform binary was not found or not executable.

### Root Causes Identified

1. **Missing Windows Binary**: The `terraform-bin` directory only contained a macOS/Linux `terraform` binary, not `terraform.exe` for Windows
2. **Configuration Mismatch**: The `electron-builder.yml` was looking for binaries in `terraform` directory while `package.json` referenced `terraform-bin`
3. **Platform-Specific Binary Not Downloaded**: The postinstall script only downloaded the binary for the build platform, not all target platforms
4. **Windows Path/Permission Issues**: Windows requires special handling for executable paths and permissions

## Solution Implemented

### 1. Fixed electron-builder.yml Configuration
- Updated `extraResources` to use `terraform-bin` instead of `terraform`
- Updated `asarUnpack` to include `terraform-bin/**/*`

### 2. Created Universal Binary Download Script
- **File**: `scripts/download-all-terraform-binaries.js`
- Downloads Terraform binaries for ALL platforms (Windows, macOS Intel, macOS ARM, Linux)
- Properly names binaries: `terraform.exe` for Windows, platform-specific names for others
- Verifies binary integrity by checking file size

### 3. Updated TerraformService
- **File**: `src/main/services/terraformService.ts`
- Added platform detection to select correct binary
- Windows-specific: looks for `terraform.exe`
- macOS: uses `terraform-darwin-x64` or `terraform-darwin-arm64` based on architecture
- Linux: uses `terraform-linux`
- Added Windows-specific executable checks (skip X_OK check, rely on .exe extension)
- Improved error messages with platform-specific guidance

### 4. Windows-Specific Scripts
- **`scripts/test-terraform-windows.ps1`**: PowerShell script to test Terraform binary on Windows
- **`scripts/fix-terraform-windows.ps1`**: PowerShell script to fix/re-download Terraform on Windows
- **`scripts/pre-build-windows.js`**: Pre-build check to ensure terraform.exe exists before packaging

### 5. Updated Build Process
- Modified `package.json` scripts:
  - `postinstall`: Now runs `download-all-terraform-binaries.js`
  - `dist:win`: Includes pre-build check for Windows
  - Added `pre-build:win` script

## How It Works Now

### Development
1. `npm install` runs postinstall hook
2. `download-all-terraform-binaries.js` downloads binaries for ALL platforms
3. Binaries are stored in `terraform-bin/` with platform-specific names

### Production Build (Windows)
1. `npm run dist:win` triggers pre-build check
2. `pre-build-windows.js` verifies terraform.exe exists and is valid
3. If missing or corrupted, automatically downloads it
4. electron-builder packages the binary into `resources/terraform-bin/`

### Runtime (Windows)
1. TerraformService detects Windows platform
2. Looks for `terraform.exe` in the correct location
3. Uses Windows-specific spawn options (no shell, proper path handling)
4. Handles Windows path separators correctly

## Testing on Windows

### Manual Test
```powershell
# Test if Terraform binary is present and working
.\scripts\test-terraform-windows.ps1

# Fix/download if needed
.\scripts\fix-terraform-windows.ps1
```

### Build Test
```bash
# Clean build for Windows
npm run dist:win
```

### Runtime Test
After installation, the app will:
1. Check for terraform.exe in `resources/terraform-bin/`
2. Verify it's executable (by size and extension)
3. Log detailed debug info if there are issues

## Common Windows Issues and Solutions

| Issue | Solution |
|-------|----------|
| "terraform.exe not found" | Run `npm run download-terraform-all` |
| "Access denied" | Run PowerShell as Administrator or check antivirus |
| "File blocked by Windows" | Run `Unblock-File` command in PowerShell |
| Binary corrupted (< 1MB) | Delete and re-download with scripts |

## Binary Locations

### Development
- **All platforms**: `./terraform-bin/`
  - Windows: `terraform.exe`
  - macOS Intel: `terraform-darwin-x64`
  - macOS ARM: `terraform-darwin-arm64`
  - Linux: `terraform-linux`

### Production (Installed App)
- **Windows**: `%APPDATA%/anava-vision/resources/terraform-bin/terraform.exe`
- **macOS**: `/Applications/Anava Vision.app/Contents/Resources/terraform-bin/terraform-darwin-*`

## Verification Checklist

- [x] terraform.exe is downloaded during build
- [x] Binary is > 50MB (not corrupted)
- [x] Binary is included in Windows installer
- [x] TerraformService finds the binary at runtime
- [x] Binary executes without permission errors
- [x] Proper error messages guide users if issues occur

## Future Improvements

1. Consider bundling Terraform as a native Node module
2. Add automatic retry logic if binary download fails
3. Implement checksum verification for downloaded binaries
4. Add telemetry to track Terraform initialization failures