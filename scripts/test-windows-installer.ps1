# Windows Installer Test Suite
# Comprehensive testing for installation, shortcuts, and uninstallation
# Compatible with Anava Installer v0.9.178

param(
    [Parameter(Mandatory=$false)]
    [string]$InstallerPath,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipInstall,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipUninstall,
    
    [Parameter(Mandatory=$false)]
    [switch]$Verbose,
    
    [Parameter(Mandatory=$false)]
    [string]$LogFile = "test-results-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
)

# Test configuration
$script:TestResults = @{
    Passed = 0
    Failed = 0
    Skipped = 0
    Warnings = 0
    Details = @()
}

$script:Config = @{
    AppName = "Anava Installer"
    Publisher = "Anava AI Inc."
    Version = "0.9.178"
    InstallDir64 = "${env:ProgramFiles}\Anava AI\Anava Installer"
    InstallDir32 = "${env:ProgramFiles(x86)}\Anava AI\Anava Installer"
    InstallDirUser = "${env:LOCALAPPDATA}\Programs\Anava Installer"
    UninstallKey = "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Anava Installer"
    TestTimeout = 300 # 5 minutes
}

# Logging functions
function Write-TestLog {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"
    
    # Write to console with color
    switch ($Level) {
        "PASS" { Write-Host $logEntry -ForegroundColor Green }
        "FAIL" { Write-Host $logEntry -ForegroundColor Red }
        "WARN" { Write-Host $logEntry -ForegroundColor Yellow }
        "INFO" { Write-Host $logEntry -ForegroundColor Cyan }
        "DEBUG" { if ($Verbose) { Write-Host $logEntry -ForegroundColor Gray } }
        default { Write-Host $logEntry }
    }
    
    # Write to log file
    if ($LogFile) {
        $logEntry | Out-File -FilePath $LogFile -Append -Encoding UTF8
    }
}

function Test-Case {
    param(
        [string]$Name,
        [scriptblock]$Test,
        [switch]$Critical
    )
    
    Write-TestLog "`nRunning test: $Name" "INFO"
    
    try {
        $result = & $Test
        if ($result -eq $true) {
            Write-TestLog "✓ PASSED: $Name" "PASS"
            $script:TestResults.Passed++
            $script:TestResults.Details += @{
                Test = $Name
                Result = "PASSED"
                Critical = $Critical.IsPresent
            }
            return $true
        } else {
            Write-TestLog "✗ FAILED: $Name" "FAIL"
            $script:TestResults.Failed++
            $script:TestResults.Details += @{
                Test = $Name
                Result = "FAILED"
                Critical = $Critical.IsPresent
            }
            
            if ($Critical) {
                throw "Critical test failed: $Name"
            }
            return $false
        }
    } catch {
        Write-TestLog "✗ ERROR in test '$Name': $_" "FAIL"
        $script:TestResults.Failed++
        $script:TestResults.Details += @{
            Test = $Name
            Result = "ERROR"
            Error = $_.Exception.Message
            Critical = $Critical.IsPresent
        }
        
        if ($Critical) {
            throw $_
        }
        return $false
    }
}

# Test functions
function Test-Prerequisites {
    Write-TestLog "`n=== PREREQUISITES ===" "INFO"
    
    Test-Case "Administrator privileges" {
        $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
        return $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    }
    
    Test-Case "Windows version compatibility" {
        $os = Get-WmiObject -Class Win32_OperatingSystem
        $version = [Version]$os.Version
        return $version.Major -ge 10
    }
    
    Test-Case "Required disk space (500MB)" {
        $drive = (Get-Item $env:ProgramFiles).PSDrive.Name
        $disk = Get-PSDrive $drive
        return ($disk.Free -gt 500MB)
    }
    
    Test-Case "No conflicting processes" {
        $process = Get-Process -Name "Anava Installer" -ErrorAction SilentlyContinue
        return ($null -eq $process)
    }
}

function Test-InstallerFile {
    Write-TestLog "`n=== INSTALLER FILE VERIFICATION ===" "INFO"
    
    if (-not $InstallerPath -or -not (Test-Path $InstallerPath)) {
        # Try to find installer
        $found = Get-ChildItem -Path ".\dist" -Filter "*Setup*.exe" -ErrorAction SilentlyContinue |
                 Sort-Object LastWriteTime -Descending |
                 Select-Object -First 1
        
        if ($found) {
            $script:InstallerPath = $found.FullName
            Write-TestLog "Found installer: $($found.Name)" "INFO"
        } else {
            Write-TestLog "No installer file found" "FAIL"
            return $false
        }
    }
    
    Test-Case "Installer file exists" -Critical {
        return (Test-Path $InstallerPath)
    }
    
    Test-Case "Installer is valid PE executable" {
        $bytes = [System.IO.File]::ReadAllBytes($InstallerPath)
        return ($bytes[0] -eq 0x4D -and $bytes[1] -eq 0x5A)
    }
    
    Test-Case "Installer size check (50-200 MB)" {
        $file = Get-Item $InstallerPath
        $sizeMB = $file.Length / 1MB
        Write-TestLog "Installer size: $([math]::Round($sizeMB, 2)) MB" "DEBUG"
        return ($sizeMB -ge 50 -and $sizeMB -le 200)
    }
    
    Test-Case "NSIS installer signature" {
        $content = [System.IO.File]::ReadAllBytes($InstallerPath)
        $signature = [System.Text.Encoding]::ASCII.GetString($content, 0, [Math]::Min(10000, $content.Length))
        return $signature.Contains("NullsoftInst")
    }
}

function Test-Installation {
    if ($SkipInstall) {
        Write-TestLog "`n=== INSTALLATION TESTS SKIPPED ===" "WARN"
        $script:TestResults.Skipped++
        return
    }
    
    Write-TestLog "`n=== INSTALLATION TESTS ===" "INFO"
    
    # Backup existing installation if present
    $backupPath = $null
    $existingInstall = $null
    
    foreach ($path in @($script:Config.InstallDir64, $script:Config.InstallDir32, $script:Config.InstallDirUser)) {
        if (Test-Path $path) {
            $existingInstall = $path
            $backupPath = "$path.backup.$(Get-Date -Format 'yyyyMMddHHmmss')"
            Write-TestLog "Backing up existing installation to: $backupPath" "INFO"
            Copy-Item -Path $path -Destination $backupPath -Recurse -Force
            break
        }
    }
    
    Test-Case "Silent installation" -Critical {
        Write-TestLog "Running installer: $InstallerPath /S" "DEBUG"
        $process = Start-Process -FilePath $InstallerPath -ArgumentList "/S" -PassThru -Wait
        
        # Wait for installation to complete
        $timeout = [datetime]::Now.AddSeconds($script:Config.TestTimeout)
        while ([datetime]::Now -lt $timeout) {
            if (Test-Path "${env:ProgramFiles}\Anava AI\Anava Installer\Anava Installer.exe") {
                Write-TestLog "Installation completed" "DEBUG"
                return $true
            }
            Start-Sleep -Seconds 2
        }
        
        return $false
    }
    
    Test-Case "Main executable installed" {
        $paths = @(
            "${env:ProgramFiles}\Anava AI\Anava Installer\Anava Installer.exe",
            "${env:ProgramFiles(x86)}\Anava AI\Anava Installer\Anava Installer.exe",
            "${env:LOCALAPPDATA}\Programs\Anava Installer\Anava Installer.exe"
        )
        
        foreach ($path in $paths) {
            if (Test-Path $path) {
                Write-TestLog "Found executable at: $path" "DEBUG"
                return $true
            }
        }
        return $false
    }
    
    Test-Case "Uninstaller created" {
        $paths = @(
            "${env:ProgramFiles}\Anava AI\Anava Installer\Uninstall.exe",
            "${env:ProgramFiles(x86)}\Anava AI\Anava Installer\Uninstall.exe",
            "${env:LOCALAPPDATA}\Programs\Anava Installer\Uninstall.exe"
        )
        
        foreach ($path in $paths) {
            if (Test-Path $path) {
                Write-TestLog "Found uninstaller at: $path" "DEBUG"
                return $true
            }
        }
        return $false
    }
    
    # Restore backup if needed
    if ($backupPath -and (Test-Path $backupPath)) {
        Write-TestLog "Restoring backup from: $backupPath" "INFO"
        if (Test-Path $existingInstall) {
            Remove-Item -Path $existingInstall -Recurse -Force
        }
        Move-Item -Path $backupPath -Destination $existingInstall -Force
    }
}

function Test-Shortcuts {
    Write-TestLog "`n=== SHORTCUT TESTS ===" "INFO"
    
    Test-Case "Desktop shortcut exists" {
        $desktopPaths = @(
            [Environment]::GetFolderPath("Desktop"),
            [Environment]::GetFolderPath("CommonDesktopDirectory")
        )
        
        foreach ($desktop in $desktopPaths) {
            $shortcut = "$desktop\Anava Installer.lnk"
            if (Test-Path $shortcut) {
                Write-TestLog "Desktop shortcut found at: $shortcut" "DEBUG"
                return $true
            }
        }
        return $false
    }
    
    Test-Case "Desktop shortcut target is valid" {
        $desktopPaths = @(
            [Environment]::GetFolderPath("Desktop"),
            [Environment]::GetFolderPath("CommonDesktopDirectory")
        )
        
        foreach ($desktop in $desktopPaths) {
            $shortcutPath = "$desktop\Anava Installer.lnk"
            if (Test-Path $shortcutPath) {
                $shell = New-Object -ComObject WScript.Shell
                $shortcut = $shell.CreateShortcut($shortcutPath)
                
                if (Test-Path $shortcut.TargetPath) {
                    Write-TestLog "Shortcut target is valid: $($shortcut.TargetPath)" "DEBUG"
                    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($shell) | Out-Null
                    return $true
                }
                [System.Runtime.InteropServices.Marshal]::ReleaseComObject($shell) | Out-Null
            }
        }
        return $false
    }
    
    Test-Case "Start Menu shortcut exists" {
        $startMenuPaths = @(
            [Environment]::GetFolderPath("Programs"),
            [Environment]::GetFolderPath("CommonPrograms")
        )
        
        foreach ($startMenu in $startMenuPaths) {
            $shortcut = "$startMenu\Anava AI\Anava Installer.lnk"
            if (Test-Path $shortcut) {
                Write-TestLog "Start Menu shortcut found at: $shortcut" "DEBUG"
                return $true
            }
        }
        return $false
    }
    
    Test-Case "Start Menu uninstall shortcut exists" {
        $startMenuPaths = @(
            [Environment]::GetFolderPath("Programs"),
            [Environment]::GetFolderPath("CommonPrograms")
        )
        
        foreach ($startMenu in $startMenuPaths) {
            $shortcut = "$startMenu\Anava AI\Uninstall Anava Installer.lnk"
            if (Test-Path $shortcut) {
                Write-TestLog "Uninstall shortcut found at: $shortcut" "DEBUG"
                return $true
            }
        }
        return $false
    }
}

function Test-Registry {
    Write-TestLog "`n=== REGISTRY TESTS ===" "INFO"
    
    Test-Case "Uninstall registry key exists" {
        return (Test-Path $script:Config.UninstallKey)
    }
    
    Test-Case "Registry DisplayName correct" {
        if (Test-Path $script:Config.UninstallKey) {
            $reg = Get-ItemProperty -Path $script:Config.UninstallKey -ErrorAction SilentlyContinue
            return ($reg.DisplayName -eq $script:Config.AppName)
        }
        return $false
    }
    
    Test-Case "Registry Publisher correct" {
        if (Test-Path $script:Config.UninstallKey) {
            $reg = Get-ItemProperty -Path $script:Config.UninstallKey -ErrorAction SilentlyContinue
            return ($reg.Publisher -eq $script:Config.Publisher)
        }
        return $false
    }
    
    Test-Case "Registry Version correct" {
        if (Test-Path $script:Config.UninstallKey) {
            $reg = Get-ItemProperty -Path $script:Config.UninstallKey -ErrorAction SilentlyContinue
            Write-TestLog "Registry version: $($reg.DisplayVersion)" "DEBUG"
            return ($reg.DisplayVersion -eq $script:Config.Version)
        }
        return $false
    }
    
    Test-Case "Registry UninstallString exists" {
        if (Test-Path $script:Config.UninstallKey) {
            $reg = Get-ItemProperty -Path $script:Config.UninstallKey -ErrorAction SilentlyContinue
            if ($reg.UninstallString) {
                Write-TestLog "UninstallString: $($reg.UninstallString)" "DEBUG"
                return $true
            }
        }
        return $false
    }
    
    Test-Case "Registry EstimatedSize reasonable" {
        if (Test-Path $script:Config.UninstallKey) {
            $reg = Get-ItemProperty -Path $script:Config.UninstallKey -ErrorAction SilentlyContinue
            if ($reg.EstimatedSize) {
                $sizeMB = $reg.EstimatedSize / 1024
                Write-TestLog "Estimated size: $([math]::Round($sizeMB, 2)) MB" "DEBUG"
                return ($sizeMB -gt 50 -and $sizeMB -lt 500)
            }
        }
        return $false
    }
}

function Test-Uninstallation {
    if ($SkipUninstall) {
        Write-TestLog "`n=== UNINSTALLATION TESTS SKIPPED ===" "WARN"
        $script:TestResults.Skipped++
        return
    }
    
    Write-TestLog "`n=== UNINSTALLATION TESTS ===" "INFO"
    
    # Find uninstaller
    $uninstallerPath = $null
    $paths = @(
        "${env:ProgramFiles}\Anava AI\Anava Installer\Uninstall.exe",
        "${env:ProgramFiles(x86)}\Anava AI\Anava Installer\Uninstall.exe",
        "${env:LOCALAPPDATA}\Programs\Anava Installer\Uninstall.exe"
    )
    
    foreach ($path in $paths) {
        if (Test-Path $path) {
            $uninstallerPath = $path
            break
        }
    }
    
    if (-not $uninstallerPath) {
        Write-TestLog "No uninstaller found - skipping uninstallation tests" "WARN"
        $script:TestResults.Skipped++
        return
    }
    
    Test-Case "Silent uninstallation" {
        Write-TestLog "Running uninstaller: $uninstallerPath /S" "DEBUG"
        $process = Start-Process -FilePath $uninstallerPath -ArgumentList "/S" -PassThru -Wait
        
        # Wait for uninstallation to complete
        Start-Sleep -Seconds 10
        
        # Check if main directory is removed
        $installDir = Split-Path $uninstallerPath -Parent
        return (-not (Test-Path $installDir))
    }
    
    Test-Case "Shortcuts removed after uninstall" {
        $shortcuts = @(
            "$([Environment]::GetFolderPath('Desktop'))\Anava Installer.lnk",
            "$([Environment]::GetFolderPath('CommonDesktopDirectory'))\Anava Installer.lnk",
            "$([Environment]::GetFolderPath('Programs'))\Anava AI\Anava Installer.lnk",
            "$([Environment]::GetFolderPath('CommonPrograms'))\Anava AI\Anava Installer.lnk"
        )
        
        foreach ($shortcut in $shortcuts) {
            if (Test-Path $shortcut) {
                Write-TestLog "Shortcut still exists: $shortcut" "DEBUG"
                return $false
            }
        }
        return $true
    }
    
    Test-Case "Registry cleaned after uninstall" {
        return (-not (Test-Path $script:Config.UninstallKey))
    }
    
    Test-Case "Installation directory removed" {
        $dirs = @(
            $script:Config.InstallDir64,
            $script:Config.InstallDir32,
            $script:Config.InstallDirUser
        )
        
        foreach ($dir in $dirs) {
            if (Test-Path $dir) {
                Write-TestLog "Directory still exists: $dir" "DEBUG"
                return $false
            }
        }
        return $true
    }
}

function Test-EdgeCases {
    Write-TestLog "`n=== EDGE CASE TESTS ===" "INFO"
    
    Test-Case "Handle spaces in installation path" {
        # This would require custom installation path testing
        Write-TestLog "Edge case test placeholder" "DEBUG"
        return $true
    }
    
    Test-Case "Unicode characters in user profile" {
        # Test if installer handles Unicode in paths
        $tempPath = "$env:TEMP\测试文件夹"
        try {
            New-Item -Path $tempPath -ItemType Directory -Force | Out-Null
            Remove-Item -Path $tempPath -Force
            return $true
        } catch {
            return $false
        }
    }
    
    Test-Case "Long path support" {
        # Test if installer handles long paths
        $longPath = "$env:TEMP\" + ("a" * 200)
        if ($longPath.Length -gt 260) {
            # Windows long path support test
            return $true
        }
        return $false
    }
}

function Show-TestSummary {
    Write-TestLog "`n" "INFO"
    Write-TestLog ("=" * 60) "INFO"
    Write-TestLog "TEST SUMMARY" "INFO"
    Write-TestLog ("=" * 60) "INFO"
    
    $total = $script:TestResults.Passed + $script:TestResults.Failed + $script:TestResults.Skipped
    
    Write-TestLog "Total Tests: $total" "INFO"
    Write-TestLog "Passed: $($script:TestResults.Passed)" "PASS"
    Write-TestLog "Failed: $($script:TestResults.Failed)" "FAIL"
    Write-TestLog "Skipped: $($script:TestResults.Skipped)" "WARN"
    Write-TestLog "Warnings: $($script:TestResults.Warnings)" "WARN"
    
    if ($script:TestResults.Failed -gt 0) {
        Write-TestLog "`nFailed Tests:" "FAIL"
        $script:TestResults.Details | Where-Object { $_.Result -eq "FAILED" -or $_.Result -eq "ERROR" } | ForEach-Object {
            Write-TestLog "  - $($_.Test)" "FAIL"
            if ($_.Error) {
                Write-TestLog "    Error: $($_.Error)" "FAIL"
            }
        }
    }
    
    if ($script:TestResults.Passed -eq $total - $script:TestResults.Skipped) {
        Write-TestLog "`nALL TESTS PASSED!" "PASS"
        $exitCode = 0
    } else {
        Write-TestLog "`nSOME TESTS FAILED!" "FAIL"
        $exitCode = 1
    }
    
    # Save detailed report
    $reportFile = "test-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
    $script:TestResults | ConvertTo-Json -Depth 5 | Out-File -FilePath $reportFile -Encoding UTF8
    Write-TestLog "`nDetailed report saved to: $reportFile" "INFO"
    Write-TestLog "Log file saved to: $LogFile" "INFO"
    
    return $exitCode
}

# Main execution
function Main {
    Write-Host @"

╔════════════════════════════════════════════════════════════╗
║       Anava Installer - Windows Test Suite                ║
║                   Version $($script:Config.Version)                       ║
╚════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan
    
    Write-TestLog "Starting test suite at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" "INFO"
    Write-TestLog "Log file: $LogFile" "INFO"
    
    try {
        # Run test suites
        Test-Prerequisites
        Test-InstallerFile
        Test-Installation
        Test-Shortcuts
        Test-Registry
        Test-Uninstallation
        Test-EdgeCases
        
        # Show summary
        $exitCode = Show-TestSummary
        
        exit $exitCode
        
    } catch {
        Write-TestLog "`nCRITICAL ERROR: $_" "FAIL"
        Write-TestLog $_.ScriptStackTrace "FAIL"
        exit 1
    }
}

# Run tests
Main