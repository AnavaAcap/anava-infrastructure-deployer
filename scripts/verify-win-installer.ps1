# Windows Installer Verification Tool
# Verifies installer integrity, shortcuts, and registry entries
# Compatible with Anava Installer v0.9.178

param(
    [Parameter(Mandatory=$false)]
    [string]$InstallerPath,
    
    [Parameter(Mandatory=$false)]
    [switch]$Detailed,
    
    [Parameter(Mandatory=$false)]
    [switch]$TestInstall,
    
    [Parameter(Mandatory=$false)]
    [string]$OutputReport
)

# Configuration
$AppName = "Anava Installer"
$AppId = "com.anava.installer"
$Publisher = "Anava AI Inc."
$Version = "0.9.178"
$UninstallKey = "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$AppName"

# Colors for output
function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor Cyan
}

function Write-Section {
    param([string]$Title)
    Write-Host "`n" -NoNewline
    Write-Host ("=" * 60) -ForegroundColor DarkGray
    Write-Host $Title -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor DarkGray
}

# Find installer if not specified
function Find-Installer {
    if ($InstallerPath -and (Test-Path $InstallerPath)) {
        return $InstallerPath
    }
    
    # Search in common locations
    $searchPaths = @(
        ".\dist\*.exe",
        ".\dist\*Setup*.exe",
        ".\*Setup*.exe",
        "..\dist\*.exe",
        "..\dist\*Setup*.exe"
    )
    
    foreach ($path in $searchPaths) {
        $files = Get-ChildItem -Path $path -ErrorAction SilentlyContinue | 
                 Where-Object { $_.Name -like "*Setup*" -and $_.Name -like "*.exe" } |
                 Sort-Object LastWriteTime -Descending
        
        if ($files) {
            return $files[0].FullName
        }
    }
    
    return $null
}

# Verify installer file integrity
function Test-InstallerIntegrity {
    param([string]$Path)
    
    Write-Section "Installer File Verification"
    
    if (-not (Test-Path $Path)) {
        Write-Error "Installer file not found: $Path"
        return $false
    }
    
    $file = Get-Item $Path
    Write-Info "Installer: $($file.Name)"
    Write-Info "Size: $([math]::Round($file.Length / 1MB, 2)) MB"
    Write-Info "Created: $($file.CreationTime)"
    Write-Info "Modified: $($file.LastWriteTime)"
    
    # Check file size
    if ($file.Length -lt 50MB) {
        Write-Warning "Installer size is unusually small (< 50 MB)"
    } elseif ($file.Length -gt 200MB) {
        Write-Warning "Installer size is unusually large (> 200 MB)"
    } else {
        Write-Success "File size is within expected range"
    }
    
    # Verify PE signature
    try {
        $bytes = [System.IO.File]::ReadAllBytes($Path)
        if ($bytes[0] -eq 0x4D -and $bytes[1] -eq 0x5A) {
            Write-Success "Valid PE executable signature (MZ)"
        } else {
            Write-Error "Invalid PE executable signature"
            return $false
        }
    } catch {
        Write-Error "Failed to read file signature: $_"
        return $false
    }
    
    # Check digital signature
    try {
        $signature = Get-AuthenticodeSignature -FilePath $Path
        if ($signature.Status -eq "Valid") {
            Write-Success "Digital signature is valid"
            Write-Info "Signer: $($signature.SignerCertificate.Subject)"
        } elseif ($signature.Status -eq "NotSigned") {
            Write-Warning "File is not digitally signed"
        } else {
            Write-Warning "Digital signature status: $($signature.Status)"
        }
    } catch {
        Write-Warning "Could not verify digital signature: $_"
    }
    
    # Calculate hash
    try {
        $hash = Get-FileHash -Path $Path -Algorithm SHA256
        Write-Info "SHA256: $($hash.Hash)"
        
        # Save hash for future verification
        $hashFile = "$Path.sha256"
        "$($hash.Hash)  $($file.Name)" | Out-File -FilePath $hashFile -Encoding ASCII
        Write-Success "Hash saved to $hashFile"
    } catch {
        Write-Warning "Could not calculate file hash: $_"
    }
    
    if ($Detailed) {
        # Extract and analyze NSIS header
        Write-Info "`nAnalyzing NSIS installer structure..."
        
        try {
            # Look for NSIS signature
            $nsisSignature = [System.Text.Encoding]::ASCII.GetBytes("NullsoftInst")
            $found = $false
            
            for ($i = 0; $i -lt [Math]::Min($bytes.Length, 10000); $i++) {
                $match = $true
                for ($j = 0; $j -lt $nsisSignature.Length; $j++) {
                    if ($bytes[$i + $j] -ne $nsisSignature[$j]) {
                        $match = $false
                        break
                    }
                }
                if ($match) {
                    $found = $true
                    Write-Success "Found NSIS installer signature at offset $i"
                    break
                }
            }
            
            if (-not $found) {
                Write-Warning "NSIS signature not found in expected location"
            }
        } catch {
            Write-Warning "Could not analyze NSIS structure: $_"
        }
    }
    
    return $true
}

# Test installation in sandbox
function Test-Installation {
    param([string]$InstallerPath)
    
    Write-Section "Installation Test"
    
    if (-not (Get-Command "sandbox.exe" -ErrorAction SilentlyContinue)) {
        Write-Warning "Windows Sandbox not available. Skipping installation test."
        Write-Info "To enable: Enable-WindowsOptionalFeature -Online -FeatureName 'Containers-DisposableClientVM'"
        return
    }
    
    # Create sandbox configuration
    $sandboxConfig = @"
<Configuration>
    <MappedFolders>
        <MappedFolder>
            <HostFolder>$(Split-Path $InstallerPath -Parent)</HostFolder>
            <SandboxFolder>C:\Installer</SandboxFolder>
            <ReadOnly>true</ReadOnly>
        </MappedFolder>
    </MappedFolders>
    <LogonCommand>
        <Command>powershell.exe -ExecutionPolicy Bypass -File C:\Installer\test-install.ps1</Command>
    </LogonCommand>
    <MemoryInMB>4096</MemoryInMB>
</Configuration>
"@
    
    # Create test script
    $testScript = @"
# Test installation in sandbox
`$installer = 'C:\Installer\$(Split-Path $InstallerPath -Leaf)'
Write-Host 'Starting installation test...'

# Run installer silently
Start-Process -FilePath `$installer -ArgumentList '/S' -Wait

# Check if installed
if (Test-Path 'C:\Program Files\Anava AI\Anava Installer\Anava Installer.exe') {
    Write-Host 'Installation successful!' -ForegroundColor Green
    
    # Check shortcuts
    `$desktop = [Environment]::GetFolderPath('Desktop')
    if (Test-Path "`$desktop\Anava Installer.lnk") {
        Write-Host 'Desktop shortcut created' -ForegroundColor Green
    } else {
        Write-Host 'Desktop shortcut missing!' -ForegroundColor Red
    }
    
    # Check Start Menu
    `$startMenu = [Environment]::GetFolderPath('Programs')
    if (Test-Path "`$startMenu\Anava AI\Anava Installer.lnk") {
        Write-Host 'Start Menu shortcut created' -ForegroundColor Green
    } else {
        Write-Host 'Start Menu shortcut missing!' -ForegroundColor Red
    }
    
    # Test uninstallation
    Write-Host 'Testing uninstallation...'
    Start-Process -FilePath 'C:\Program Files\Anava AI\Anava Installer\Uninstall.exe' -ArgumentList '/S' -Wait
    
    if (-not (Test-Path 'C:\Program Files\Anava AI\Anava Installer')) {
        Write-Host 'Uninstallation successful!' -ForegroundColor Green
    } else {
        Write-Host 'Uninstallation failed - files remain!' -ForegroundColor Red
    }
} else {
    Write-Host 'Installation failed!' -ForegroundColor Red
}

Read-Host 'Press Enter to exit'
"@
    
    $configFile = "$env:TEMP\sandbox-config.wsb"
    $scriptFile = "$(Split-Path $InstallerPath -Parent)\test-install.ps1"
    
    try {
        $sandboxConfig | Out-File -FilePath $configFile -Encoding UTF8
        $testScript | Out-File -FilePath $scriptFile -Encoding UTF8
        
        Write-Info "Launching Windows Sandbox for installation test..."
        Start-Process "sandbox.exe" -ArgumentList $configFile -Wait
        
        Remove-Item $configFile -Force -ErrorAction SilentlyContinue
        Remove-Item $scriptFile -Force -ErrorAction SilentlyContinue
        
        Write-Success "Sandbox test completed"
    } catch {
        Write-Error "Sandbox test failed: $_"
    }
}

# Check installed application
function Test-InstalledApplication {
    Write-Section "Installed Application Verification"
    
    $installPaths = @(
        "${env:ProgramFiles}\Anava AI\Anava Installer",
        "${env:ProgramFiles(x86)}\Anava AI\Anava Installer",
        "${env:LOCALAPPDATA}\Programs\Anava Installer"
    )
    
    $installed = $false
    $installPath = $null
    
    foreach ($path in $installPaths) {
        if (Test-Path "$path\Anava Installer.exe") {
            $installed = $true
            $installPath = $path
            break
        }
    }
    
    if (-not $installed) {
        Write-Warning "Application not installed"
        return $false
    }
    
    Write-Success "Application found at: $installPath"
    
    # Check main executable
    $exePath = "$installPath\Anava Installer.exe"
    if (Test-Path $exePath) {
        $exe = Get-Item $exePath
        Write-Success "Main executable exists"
        Write-Info "Version: $($exe.VersionInfo.FileVersion)"
        Write-Info "Product: $($exe.VersionInfo.ProductName)"
        Write-Info "Company: $($exe.VersionInfo.CompanyName)"
    } else {
        Write-Error "Main executable not found"
    }
    
    # Check uninstaller
    if (Test-Path "$installPath\Uninstall.exe") {
        Write-Success "Uninstaller exists"
    } else {
        Write-Error "Uninstaller not found"
    }
    
    # Check shortcuts
    Write-Info "`nVerifying shortcuts..."
    
    # Desktop shortcut
    $desktopPaths = @(
        [Environment]::GetFolderPath("Desktop"),
        [Environment]::GetFolderPath("CommonDesktopDirectory")
    )
    
    $desktopShortcutFound = $false
    foreach ($desktop in $desktopPaths) {
        if (Test-Path "$desktop\Anava Installer.lnk") {
            Write-Success "Desktop shortcut found at: $desktop"
            $desktopShortcutFound = $true
            
            # Verify shortcut target
            $shell = New-Object -ComObject WScript.Shell
            $shortcut = $shell.CreateShortcut("$desktop\Anava Installer.lnk")
            if ($shortcut.TargetPath -eq $exePath) {
                Write-Success "Desktop shortcut target is correct"
            } else {
                Write-Warning "Desktop shortcut target mismatch: $($shortcut.TargetPath)"
            }
            break
        }
    }
    
    if (-not $desktopShortcutFound) {
        Write-Error "Desktop shortcut not found"
    }
    
    # Start Menu shortcut
    $startMenuPaths = @(
        [Environment]::GetFolderPath("Programs"),
        [Environment]::GetFolderPath("CommonPrograms")
    )
    
    $startMenuShortcutFound = $false
    foreach ($startMenu in $startMenuPaths) {
        if (Test-Path "$startMenu\Anava AI\Anava Installer.lnk") {
            Write-Success "Start Menu shortcut found at: $startMenu\Anava AI"
            $startMenuShortcutFound = $true
            
            # Verify shortcut target
            $shell = New-Object -ComObject WScript.Shell
            $shortcut = $shell.CreateShortcut("$startMenu\Anava AI\Anava Installer.lnk")
            if ($shortcut.TargetPath -eq $exePath) {
                Write-Success "Start Menu shortcut target is correct"
            } else {
                Write-Warning "Start Menu shortcut target mismatch: $($shortcut.TargetPath)"
            }
            break
        }
    }
    
    if (-not $startMenuShortcutFound) {
        Write-Error "Start Menu shortcut not found"
    }
    
    # Check registry entries
    Write-Info "`nVerifying registry entries..."
    
    if (Test-Path $UninstallKey) {
        Write-Success "Uninstall registry key exists"
        
        $regEntry = Get-ItemProperty -Path $UninstallKey -ErrorAction SilentlyContinue
        
        if ($regEntry.DisplayName -eq $AppName) {
            Write-Success "Display name is correct"
        } else {
            Write-Warning "Display name mismatch: $($regEntry.DisplayName)"
        }
        
        if ($regEntry.Publisher -eq $Publisher) {
            Write-Success "Publisher is correct"
        } else {
            Write-Warning "Publisher mismatch: $($regEntry.Publisher)"
        }
        
        if ($regEntry.DisplayVersion -eq $Version) {
            Write-Success "Version is correct"
        } else {
            Write-Warning "Version mismatch: $($regEntry.DisplayVersion)"
        }
        
        if ($regEntry.UninstallString) {
            Write-Success "Uninstall string is set: $($regEntry.UninstallString)"
        } else {
            Write-Error "Uninstall string is missing"
        }
        
        if ($regEntry.EstimatedSize) {
            $sizeMB = [math]::Round($regEntry.EstimatedSize / 1024, 2)
            Write-Info "Estimated size: $sizeMB MB"
        }
    } else {
        Write-Error "Uninstall registry key not found"
    }
    
    return $installed
}

# Generate verification report
function New-VerificationReport {
    param(
        [string]$InstallerPath,
        [bool]$IntegrityResult,
        [bool]$InstallationResult,
        [string]$OutputPath
    )
    
    $report = @{
        Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        InstallerFile = if ($InstallerPath) { Split-Path $InstallerPath -Leaf } else { "Not found" }
        IntegrityCheck = if ($IntegrityResult) { "PASSED" } else { "FAILED" }
        InstallationCheck = if ($InstallationResult) { "PASSED" } else { "NOT TESTED" }
        System = @{
            OSVersion = [System.Environment]::OSVersion.VersionString
            Architecture = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
            PowerShellVersion = $PSVersionTable.PSVersion.ToString()
            Username = [Environment]::UserName
            MachineName = [Environment]::MachineName
        }
    }
    
    if ($OutputPath) {
        $report | ConvertTo-Json -Depth 5 | Out-File -FilePath $OutputPath -Encoding UTF8
        Write-Success "Report saved to: $OutputPath"
    }
    
    return $report
}

# Main execution
function Main {
    Write-Host @"

╔════════════════════════════════════════════════════════════╗
║        Anava Installer - Windows Verification Tool        ║
║                      Version $Version                      ║
╚════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan
    
    # Find installer
    $installer = Find-Installer
    if (-not $installer) {
        Write-Error "No installer file found. Please specify with -InstallerPath parameter."
        exit 1
    }
    
    Write-Info "Using installer: $installer"
    
    # Run verifications
    $integrityOk = Test-InstallerIntegrity -Path $installer
    
    if (-not $integrityOk) {
        Write-Error "`nInstaller integrity check failed!"
        exit 1
    }
    
    # Check if application is installed
    $isInstalled = Test-InstalledApplication
    
    # Run installation test if requested
    if ($TestInstall -and -not $isInstalled) {
        Test-Installation -InstallerPath $installer
    } elseif ($TestInstall -and $isInstalled) {
        Write-Warning "Application is already installed. Skipping installation test."
    }
    
    # Generate report
    if ($OutputReport) {
        $report = New-VerificationReport -InstallerPath $installer `
                                        -IntegrityResult $integrityOk `
                                        -InstallationResult $isInstalled `
                                        -OutputPath $OutputReport
    }
    
    # Summary
    Write-Section "Verification Summary"
    
    if ($integrityOk) {
        Write-Success "Installer integrity verification: PASSED"
    } else {
        Write-Error "Installer integrity verification: FAILED"
    }
    
    if ($isInstalled) {
        Write-Success "Installation verification: Application is installed"
    } else {
        Write-Info "Installation verification: Application not installed"
    }
    
    Write-Host "`nVerification complete.`n" -ForegroundColor Green
}

# Run main function
Main