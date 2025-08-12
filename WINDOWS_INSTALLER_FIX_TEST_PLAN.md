# Windows Installer Fix Test Plan - v0.9.184

## Summary of Fixes Applied

### 1. Configuration Consolidation ✅
- **Fixed**: Removed conflicting `electron-builder-win.yml`
- **Result**: Single configuration file with consistent `perMachine: true` setting

### 2. NSIS Script Enhancement ✅
- **Fixed**: Created new `installer-fixed.nsh` with:
  - Dynamic GUID generation per build
  - Comprehensive process cleanup using WMI and taskkill
  - Windows Defender exception handling
  - Mark of the Web (MOTW) removal
  - File system tunneling mitigation (5-second delays)
  - Visual C++ Redistributable checks

### 3. Main Process Cleanup ✅
- **Fixed**: Added comprehensive Windows cleanup in `src/main/index.ts`:
  - Track all spawned child processes
  - Kill orphaned Electron/Chrome processes on exit
  - Use WMI to find and kill child processes by ParentProcessId
  - Proper IPC cleanup
  - Handle uncaught exceptions with cleanup

### 4. Build Process Improvements ✅
- **Fixed**: Added GUID generation script that runs before each build
- **Fixed**: Created installer asset generation script for BMPs
- **Fixed**: Updated ASAR unpacking configuration

## Testing Instructions

### Pre-Test Setup
1. Ensure you have admin rights on Windows test machine
2. Clear any existing installations:
   ```powershell
   # Run as Administrator
   wmic product where "name like '%Anava%'" call uninstall /nointeractive
   ```
3. Clear registry remnants:
   ```powershell
   reg delete "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Anava Installer" /f
   reg delete "HKLM\SOFTWARE\Anava AI Inc." /f
   reg delete "HKCU\SOFTWARE\Anava AI Inc." /f
   ```
4. Clear prefetch:
   ```powershell
   del /F /Q "%WINDIR%\Prefetch\ANAVA*.pf"
   ```

### Build Process Test
1. Build the installer:
   ```bash
   npm run dist:win
   ```
2. Verify GUID generation:
   - Check console output for "Generated INSTALLER_GUID"
   - Verify `.installer-guid` file created
3. Verify installer created in `release/` folder

### Installation Tests

#### Test 1: Clean Installation
1. Run installer as Administrator
2. Verify:
   - ✅ No NSIS integrity check errors
   - ✅ Installation completes without errors
   - ✅ Desktop shortcut created
   - ✅ Start menu shortcut created
   - ✅ Registry entries created in HKLM

#### Test 2: Process Cleanup
1. Launch Anava Installer
2. Open Task Manager, note process IDs
3. Close application normally
4. Verify:
   - ✅ All Anava Installer processes terminated
   - ✅ No orphaned electron.exe processes
   - ✅ No orphaned chrome.exe processes

#### Test 3: Upgrade Over Existing
1. Install v0.9.183 (or earlier)
2. Without uninstalling, run v0.9.184 installer
3. Verify:
   - ✅ Old version processes killed automatically
   - ✅ Installation completes without "cannot be closed" error
   - ✅ Registry updated with new version

#### Test 4: Uninstallation
1. Go to Control Panel > Programs
2. Uninstall Anava Installer
3. Verify:
   - ✅ Uninstallation completes without errors
   - ✅ All files removed from Program Files
   - ✅ Shortcuts removed
   - ✅ Registry entries cleaned
   - ✅ Option to keep/remove app data works

#### Test 5: Windows Defender
1. Ensure Windows Defender is active
2. Download installer from web (to trigger MOTW)
3. Install the application
4. Verify:
   - ✅ No corruption warnings
   - ✅ Installer runs despite MOTW
   - ✅ Windows Defender exceptions added during install

#### Test 6: Force Quit Recovery
1. Install application
2. Launch it
3. Kill via Task Manager (End Task on process tree)
4. Try to reinstall/uninstall
5. Verify:
   - ✅ Can reinstall without errors
   - ✅ Can uninstall without errors

### Registry Verification Commands
```powershell
# Check installation registry
reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Anava Installer"

# Check for orphaned entries
reg query HKLM /f "Anava" /s
reg query HKCU /f "Anava" /s

# Check for multiple GUIDs (should only be one)
reg query HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall /s | findstr "Anava"
```

### Process Verification Commands
```powershell
# Check for running processes
tasklist | findstr /i "anava"
tasklist | findstr /i "electron"
tasklist | findstr /i "chrome"

# Check for file locks
handle.exe -a "Anava" -nobanner
```

## Expected Results

### ✅ All Tests Pass Criteria:
1. **No NSIS integrity errors** - Installer runs without corruption warnings
2. **Clean process termination** - No orphaned processes after exit
3. **Successful upgrades** - Can install over existing without manual intervention
4. **Complete uninstallation** - Removes all traces except optional app data
5. **Windows Defender compatible** - Works with real-time protection enabled
6. **Registry consistency** - Single set of registry entries, proper cleanup

### 🔧 If Issues Persist:
1. Check Event Viewer > Windows Logs > Application for errors
2. Run installer with logging: `installer.exe /LOG=install.log`
3. Check for antivirus interference
4. Verify .NET Framework and VC++ Redistributables installed
5. Test with Windows compatibility mode if needed

## Rollback Plan
If v0.9.184 has issues:
1. Use v0.9.183 installer
2. Manually clean registry using provided commands
3. Report specific error messages and logs

## Success Metrics
- **0 NSIS integrity check failures** across 10 test installations
- **100% process cleanup** verified via Task Manager
- **Successful upgrade path** from v0.9.178 through v0.9.184
- **Clean uninstall** leaves no registry artifacts
- **Windows Defender compatibility** with no manual exceptions needed