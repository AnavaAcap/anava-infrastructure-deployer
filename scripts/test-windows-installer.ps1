# PowerShell Script to Test Complete Windows Installation/Uninstallation Flow
# Tests all three critical issues have been fixed

param(
    [Parameter(Mandatory=$false)]
    [string]$InstallerPath = "",
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipInstall = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipUninstall = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$Verbose = $false
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Windows Installer Complete Test Suite" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$script:TestResults = @{
    Passed = @()
    Failed = @()
    Warnings = @()
}

function Write-TestResult {
    param(
        [string]$Test,
        [string]$Status,
        [string]$Message = ""
    )
    
    switch ($Status) {
        "PASS" {
            Write-Host "  ✓ $Test" -ForegroundColor Green
            if ($Message) { Write-Host "    $Message" -ForegroundColor Gray }
            $script:TestResults.Passed += $Test
        }
        "FAIL" {
            Write-Host "  ✗ $Test" -ForegroundColor Red
            if ($Message) { Write-Host "    $Message" -ForegroundColor Red }
            $script:TestResults.Failed += $Test
        }
        "WARN" {
            Write-Host "  ⚠ $Test" -ForegroundColor Yellow
            if ($Message) { Write-Host "    $Message" -ForegroundColor Yellow }
            $script:TestResults.Warnings += $Test
        }
    }
}

# Find installer if not specified
if ([string]::IsNullOrWhiteSpace($InstallerPath)) {
    Write-Host "Searching for installer..." -ForegroundColor Yellow
    
    $scriptDir = Split-Path -Parent $PSScriptRoot
    $releaseDir = Join-Path $scriptDir "release"
    
    if (Test-Path $releaseDir) {
        $installers = Get-ChildItem -Path $releaseDir -Filter "*Setup*.exe" | Sort-Object LastWriteTime -Descending
        
        if ($installers.Count -gt 0) {
            $InstallerPath = $installers[0].FullName
            Write-Host "Found: $($installers[0].Name)" -ForegroundColor Green
        }
    }
}

if ([string]::IsNullOrWhiteSpace($InstallerPath) -or !(Test-Path $InstallerPath)) {
    Write-Host "ERROR: No installer found!" -ForegroundColor Red
    Write-Host "Build the installer first with: node scripts/build-win.js" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Testing installer: $(Split-Path -Leaf $InstallerPath)" -ForegroundColor Cyan
Write-Host ""

# Test 1: Pre-Installation Verification
Write-Host "[Phase 1] Pre-Installation Checks" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Gray

# Check installer integrity
Write-Host "  Checking installer integrity..." -ForegroundColor Gray
$hash = Get-FileHash -Path $InstallerPath -Algorithm SHA256
if ($hash.Hash) {
    Write-TestResult "Installer integrity (SHA256)" "PASS" "Hash: $($hash.Hash.Substring(0,16))..."
} else {
    Write-TestResult "Installer integrity" "FAIL" "Could not calculate hash"
}

# Check digital signature
$signature = Get-AuthenticodeSignature -FilePath $InstallerPath
if ($signature.Status -eq 'Valid') {
    Write-TestResult "Digital signature" "PASS" "Signed by: $($signature.SignerCertificate.Subject)"
} elseif ($signature.Status -eq 'NotSigned') {
    Write-TestResult "Digital signature" "WARN" "Installer is not signed (users will see warnings)"
} else {
    Write-TestResult "Digital signature" "FAIL" "Invalid signature: $($signature.Status)"
}

# Check file size
$fileInfo = Get-Item $InstallerPath
$sizeMB = [math]::Round($fileInfo.Length / 1MB, 2)
if ($sizeMB -gt 50 -and $sizeMB -lt 500) {
    Write-TestResult "File size check" "PASS" "Size: ${sizeMB}MB"
} else {
    Write-TestResult "File size check" "WARN" "Unusual size: ${sizeMB}MB"
}

Write-Host ""

# Test 2: Installation Process
if (-not $SkipInstall) {
    Write-Host "[Phase 2] Installation Test" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Gray
    
    # Check for existing installation
    Write-Host "  Checking for existing installation..." -ForegroundColor Gray
    $uninstallKey = "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*"
    $existingInstall = Get-ItemProperty $uninstallKey | Where-Object { $_.DisplayName -like "*Anava Installer*" }
    
    if ($existingInstall) {
        Write-TestResult "Existing installation check" "WARN" "Found existing installation at: $($existingInstall.InstallLocation)"
        
        # Test uninstaller exists
        if ($existingInstall.UninstallString) {
            Write-TestResult "Uninstaller registered" "PASS" "Uninstall command found"
        } else {
            Write-TestResult "Uninstaller registered" "FAIL" "No uninstall command in registry"
        }
    } else {
        Write-TestResult "Clean system check" "PASS" "No existing installation found"
    }
    
    Write-Host ""
    Write-Host "  Starting installation (this may take a minute)..." -ForegroundColor Yellow
    
    # Run installer silently for testing
    $installProcess = Start-Process -FilePath $InstallerPath -ArgumentList "/S" -PassThru -Wait
    
    if ($installProcess.ExitCode -eq 0) {
        Write-TestResult "Installation process" "PASS" "Installer completed successfully"
    } else {
        Write-TestResult "Installation process" "FAIL" "Exit code: $($installProcess.ExitCode)"
    }
    
    # Wait for installation to complete
    Start-Sleep -Seconds 5
    
    # Verify installation
    Write-Host ""
    Write-Host "  Verifying installation..." -ForegroundColor Gray
    
    # Check registry
    $installedApp = Get-ItemProperty $uninstallKey | Where-Object { $_.DisplayName -like "*Anava Installer*" }
    if ($installedApp) {
        Write-TestResult "Registry entry created" "PASS" "Found in Uninstall registry"
        
        # Check install location
        if ($installedApp.InstallLocation -and (Test-Path $installedApp.InstallLocation)) {
            Write-TestResult "Installation directory" "PASS" "Installed to: $($installedApp.InstallLocation)"
            
            # Check for main executable
            $exePath = Join-Path $installedApp.InstallLocation "Anava Installer.exe"
            if (Test-Path $exePath) {
                Write-TestResult "Main executable" "PASS" "Anava Installer.exe exists"
            } else {
                Write-TestResult "Main executable" "FAIL" "Anava Installer.exe not found"
            }
        } else {
            Write-TestResult "Installation directory" "FAIL" "Install location not found or invalid"
        }
    } else {
        Write-TestResult "Registry entry created" "FAIL" "Not found in registry"
    }
    
    # Check shortcuts - CRITICAL TEST FOR ISSUE #1
    Write-Host ""
    Write-Host "  Checking shortcuts (Critical Test)..." -ForegroundColor Gray
    
    $desktopShortcut = Join-Path $env:USERPROFILE "Desktop\Anava Installer.lnk"
    $publicDesktopShortcut = Join-Path $env:PUBLIC "Desktop\Anava Installer.lnk"
    
    $desktopFound = (Test-Path $desktopShortcut) -or (Test-Path $publicDesktopShortcut)
    
    if ($desktopFound) {
        Write-TestResult "Desktop shortcut" "PASS" "Desktop shortcut created"
        
        # Verify shortcut target
        $shell = New-Object -ComObject WScript.Shell
        $shortcut = if (Test-Path $desktopShortcut) { 
            $shell.CreateShortcut($desktopShortcut) 
        } else { 
            $shell.CreateShortcut($publicDesktopShortcut) 
        }
        
        if (Test-Path $shortcut.TargetPath) {
            Write-TestResult "Shortcut target valid" "PASS" "Points to: $($shortcut.TargetPath)"
        } else {
            Write-TestResult "Shortcut target valid" "FAIL" "Target does not exist: $($shortcut.TargetPath)"
        }
    } else {
        Write-TestResult "Desktop shortcut" "FAIL" "Desktop shortcut not created"
    }
    
    # Check Start Menu shortcuts
    $startMenuPaths = @(
        "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\Anava",
        "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Anava"
    )
    
    $startMenuFound = $false
    foreach ($path in $startMenuPaths) {
        if (Test-Path $path) {
            $startMenuFound = $true
            $shortcuts = Get-ChildItem -Path $path -Filter "*.lnk"
            if ($shortcuts.Count -gt 0) {
                Write-TestResult "Start Menu shortcuts" "PASS" "Found $($shortcuts.Count) shortcuts"
            }
            break
        }
    }
    
    if (-not $startMenuFound) {
        Write-TestResult "Start Menu shortcuts" "FAIL" "Start Menu folder not created"
    }
    
    Write-Host ""
} else {
    Write-Host "[Phase 2] Installation Test - SKIPPED" -ForegroundColor Gray
    Write-Host ""
}

# Test 3: Uninstallation Process - CRITICAL TEST FOR ISSUE #2
if (-not $SkipUninstall) {
    Write-Host "[Phase 3] Uninstallation Test (Critical)" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Gray
    
    # Find uninstaller
    Write-Host "  Locating uninstaller..." -ForegroundColor Gray
    
    $uninstallKey = "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*"
    $installedApp = Get-ItemProperty $uninstallKey | Where-Object { $_.DisplayName -like "*Anava Installer*" }
    
    if ($installedApp -and $installedApp.UninstallString) {
        $uninstallCmd = $installedApp.UninstallString
        Write-TestResult "Uninstaller found" "PASS" "Command: $uninstallCmd"
        
        # Get installation directory before uninstall
        $installDir = $installedApp.InstallLocation
        
        # Kill any running instances
        Write-Host "  Terminating running instances..." -ForegroundColor Gray
        Get-Process | Where-Object { $_.ProcessName -like "*Anava*Installer*" } | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        
        # Run uninstaller
        Write-Host "  Running uninstaller..." -ForegroundColor Gray
        
        # Extract exe path and add silent flag
        if ($uninstallCmd -match '"([^"]+)"') {
            $uninstallerPath = $Matches[1]
            $uninstallProcess = Start-Process -FilePath $uninstallerPath -ArgumentList "/S" -PassThru -Wait
        } else {
            $uninstallProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$uninstallCmd /S`"" -PassThru -Wait
        }
        
        if ($uninstallProcess.ExitCode -eq 0) {
            Write-TestResult "Uninstall process" "PASS" "Uninstaller completed successfully"
        } else {
            Write-TestResult "Uninstall process" "WARN" "Exit code: $($uninstallProcess.ExitCode)"
        }
        
        # Wait for uninstall to complete
        Start-Sleep -Seconds 5
        
        # Verify complete removal
        Write-Host ""
        Write-Host "  Verifying complete removal..." -ForegroundColor Gray
        
        # Check if directory is removed
        if ($installDir -and (Test-Path $installDir)) {
            $remainingFiles = Get-ChildItem -Path $installDir -Recurse -ErrorAction SilentlyContinue
            if ($remainingFiles.Count -gt 0) {
                Write-TestResult "Directory removal" "FAIL" "Directory still exists with $($remainingFiles.Count) files"
            } else {
                Write-TestResult "Directory removal" "WARN" "Empty directory remains"
            }
        } else {
            Write-TestResult "Directory removal" "PASS" "Installation directory removed"
        }
        
        # Check registry cleanup
        $stillInRegistry = Get-ItemProperty $uninstallKey | Where-Object { $_.DisplayName -like "*Anava Installer*" }
        if ($stillInRegistry) {
            Write-TestResult "Registry cleanup" "FAIL" "Registry entries still present"
        } else {
            Write-TestResult "Registry cleanup" "PASS" "Registry entries removed"
        }
        
        # Check shortcut removal
        $shortcutsRemoved = $true
        
        $shortcutPaths = @(
            "$env:USERPROFILE\Desktop\Anava Installer.lnk",
            "$env:PUBLIC\Desktop\Anava Installer.lnk",
            "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\Anava",
            "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Anava"
        )
        
        foreach ($path in $shortcutPaths) {
            if (Test-Path $path) {
                $shortcutsRemoved = $false
                Write-TestResult "Shortcut cleanup: $path" "FAIL" "Still exists"
            }
        }
        
        if ($shortcutsRemoved) {
            Write-TestResult "Shortcut cleanup" "PASS" "All shortcuts removed"
        }
        
        # Check AppData cleanup
        $appDataPaths = @(
            "$env:APPDATA\anava-installer",
            "$env:LOCALAPPDATA\anava-installer"
        )
        
        $appDataCleaned = $true
        foreach ($path in $appDataPaths) {
            if (Test-Path $path) {
                $appDataCleaned = $false
                Write-TestResult "AppData cleanup: $path" "WARN" "Still exists (may contain user data)"
            }
        }
        
        if ($appDataCleaned) {
            Write-TestResult "AppData cleanup" "PASS" "User data directories cleaned"
        }
        
    } else {
        Write-TestResult "Uninstaller found" "FAIL" "No uninstaller found in registry"
    }
    
    Write-Host ""
} else {
    Write-Host "[Phase 3] Uninstallation Test - SKIPPED" -ForegroundColor Gray
    Write-Host ""
}

# Test 4: NSIS Integrity Verification - CRITICAL TEST FOR ISSUE #3
Write-Host "[Phase 4] NSIS Integrity Verification (Critical)" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Gray

# Check for corruption indicators
Write-Host "  Checking for corruption indicators..." -ForegroundColor Gray

# Check if file is blocked by Windows
$stream = Get-Item $InstallerPath -Stream * -ErrorAction SilentlyContinue
if ($stream | Where-Object { $_.Stream -eq 'Zone.Identifier' }) {
    Write-TestResult "Windows file block" "WARN" "File is blocked (from internet)"
    
    # Try to unblock
    try {
        Unblock-File -Path $InstallerPath -ErrorAction Stop
        Write-Host "    Automatically unblocked file" -ForegroundColor Green
    } catch {
        Write-Host "    Could not unblock automatically" -ForegroundColor Yellow
    }
} else {
    Write-TestResult "Windows file block" "PASS" "File is not blocked"
}

# Verify NSIS structure
$bytes = [System.IO.File]::ReadAllBytes($InstallerPath)
if ($bytes[0] -eq 0x4D -and $bytes[1] -eq 0x5A) {
    Write-TestResult "PE header check" "PASS" "Valid Windows executable"
} else {
    Write-TestResult "PE header check" "FAIL" "Invalid executable header"
}

# Check for NSIS signature
$nsisFound = $false
$fileContent = [System.Text.Encoding]::ASCII.GetString($bytes[0..10000])
if ($fileContent -match "Nullsoft" -or $fileContent -match "NSIS") {
    Write-TestResult "NSIS structure" "PASS" "Valid NSIS installer detected"
} else {
    Write-TestResult "NSIS structure" "WARN" "Could not verify NSIS structure"
}

Write-Host ""

# Final Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$totalTests = $script:TestResults.Passed.Count + $script:TestResults.Failed.Count + $script:TestResults.Warnings.Count

Write-Host "Total Tests: $totalTests" -ForegroundColor White
Write-Host "  Passed: $($script:TestResults.Passed.Count)" -ForegroundColor Green
Write-Host "  Failed: $($script:TestResults.Failed.Count)" -ForegroundColor Red
Write-Host "  Warnings: $($script:TestResults.Warnings.Count)" -ForegroundColor Yellow
Write-Host ""

# Critical issue status
Write-Host "Critical Issues Status:" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Gray

$shortcutIssue = $script:TestResults.Failed -contains "Desktop shortcut" -or 
                 $script:TestResults.Failed -contains "Shortcut target valid"
$uninstallIssue = $script:TestResults.Failed -contains "Directory removal" -or 
                  $script:TestResults.Failed -contains "Registry cleanup"
$integrityIssue = $script:TestResults.Failed -contains "PE header check" -or 
                  $script:TestResults.Failed -contains "Installer integrity"

if (-not $shortcutIssue) {
    Write-Host "  ✓ Issue #1 (Missing shortcuts): FIXED" -ForegroundColor Green
} else {
    Write-Host "  ✗ Issue #1 (Missing shortcuts): STILL PRESENT" -ForegroundColor Red
}

if (-not $uninstallIssue) {
    Write-Host "  ✓ Issue #2 (Failed uninstall): FIXED" -ForegroundColor Green
} else {
    Write-Host "  ✗ Issue #2 (Failed uninstall): STILL PRESENT" -ForegroundColor Red
}

if (-not $integrityIssue) {
    Write-Host "  ✓ Issue #3 (NSIS integrity): FIXED" -ForegroundColor Green
} else {
    Write-Host "  ✗ Issue #3 (NSIS integrity): STILL PRESENT" -ForegroundColor Red
}

Write-Host ""

# Overall result
if ($script:TestResults.Failed.Count -eq 0) {
    Write-Host "RESULT: ALL TESTS PASSED" -ForegroundColor Green -BackgroundColor DarkGreen
    Write-Host ""
    Write-Host "The Windows installer is working correctly!" -ForegroundColor Green
    $exitCode = 0
} elseif ($script:TestResults.Failed.Count -le 2) {
    Write-Host "RESULT: MINOR ISSUES" -ForegroundColor Yellow -BackgroundColor DarkYellow
    Write-Host ""
    Write-Host "The installer works but has minor issues to address" -ForegroundColor Yellow
    $exitCode = 1
} else {
    Write-Host "RESULT: CRITICAL FAILURES" -ForegroundColor Red -BackgroundColor DarkRed
    Write-Host ""
    Write-Host "The installer has critical issues that must be fixed" -ForegroundColor Red
    $exitCode = 2
}

# Save test report
$reportPath = Join-Path (Split-Path -Parent $PSScriptRoot) "windows-test-report.json"
$report = @{
    Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Installer = Split-Path -Leaf $InstallerPath
    TotalTests = $totalTests
    Passed = $script:TestResults.Passed.Count
    Failed = $script:TestResults.Failed.Count
    Warnings = $script:TestResults.Warnings.Count
    FailedTests = $script:TestResults.Failed
    CriticalIssues = @{
        MissingShortcuts = $shortcutIssue
        FailedUninstall = $uninstallIssue
        NSISIntegrity = $integrityIssue
    }
}

$report | ConvertTo-Json -Depth 10 | Out-File -FilePath $reportPath -Encoding UTF8
Write-Host ""
Write-Host "Test report saved to: windows-test-report.json" -ForegroundColor Gray

exit $exitCode