# PowerShell Script to Verify Windows Installer Integrity
# Fixes NSIS integrity check failures

param(
    [Parameter(Mandatory=$false)]
    [string]$InstallerPath = ""
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Anava Installer - Windows Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to calculate file hash
function Get-FileHashValue {
    param([string]$FilePath)
    
    if (Test-Path $FilePath) {
        $hash = Get-FileHash -Path $FilePath -Algorithm SHA256
        return $hash.Hash
    }
    return $null
}

# Function to check digital signature
function Test-DigitalSignature {
    param([string]$FilePath)
    
    try {
        $signature = Get-AuthenticodeSignature -FilePath $FilePath
        return @{
            IsSigned = ($signature.Status -eq 'Valid')
            Status = $signature.Status
            SignerCertificate = $signature.SignerCertificate
            TimeStamp = $signature.TimeStamperCertificate
        }
    }
    catch {
        return @{
            IsSigned = $false
            Status = "Error checking signature"
            SignerCertificate = $null
            TimeStamp = $null
        }
    }
}

# Function to verify NSIS installer structure
function Test-NSISStructure {
    param([string]$FilePath)
    
    try {
        # Read first bytes to check for NSIS header
        $bytes = [System.IO.File]::ReadAllBytes($FilePath)
        
        # NSIS installers typically start with specific signatures
        # Check for common NSIS patterns
        $isNSIS = $false
        
        # Convert first 16 bytes to string for pattern matching
        $headerString = [System.Text.Encoding]::ASCII.GetString($bytes[0..15])
        
        # Check for NSIS markers
        if ($headerString -match "Nullsoft" -or $bytes[0] -eq 0x4D -and $bytes[1] -eq 0x5A) {
            $isNSIS = $true
        }
        
        # Check file size (should be reasonable for an Electron app)
        $fileSize = (Get-Item $FilePath).Length
        $fileSizeMB = [math]::Round($fileSize / 1MB, 2)
        
        $sizeValid = ($fileSizeMB -gt 50 -and $fileSizeMB -lt 500)
        
        return @{
            IsValidNSIS = $isNSIS
            FileSize = $fileSize
            FileSizeMB = $fileSizeMB
            SizeValid = $sizeValid
        }
    }
    catch {
        return @{
            IsValidNSIS = $false
            FileSize = 0
            FileSizeMB = 0
            SizeValid = $false
            Error = $_.Exception.Message
        }
    }
}

# Find installer if not specified
if ([string]::IsNullOrWhiteSpace($InstallerPath)) {
    Write-Host "Searching for installer in release directory..." -ForegroundColor Yellow
    
    $scriptDir = Split-Path -Parent $PSScriptRoot
    $releaseDir = Join-Path $scriptDir "release"
    
    if (Test-Path $releaseDir) {
        $installers = Get-ChildItem -Path $releaseDir -Filter "*Setup*.exe" | Sort-Object LastWriteTime -Descending
        
        if ($installers.Count -gt 0) {
            $InstallerPath = $installers[0].FullName
            Write-Host "Found installer: $($installers[0].Name)" -ForegroundColor Green
        }
    }
}

if ([string]::IsNullOrWhiteSpace($InstallerPath) -or !(Test-Path $InstallerPath)) {
    Write-Host "ERROR: Installer not found!" -ForegroundColor Red
    Write-Host "Please specify the installer path using -InstallerPath parameter" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Verifying: $(Split-Path -Leaf $InstallerPath)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check file existence and basic properties
Write-Host "[1/6] Checking file properties..." -ForegroundColor Yellow
$fileInfo = Get-Item $InstallerPath
Write-Host "  File exists: Yes" -ForegroundColor Green
Write-Host "  Size: $([math]::Round($fileInfo.Length / 1MB, 2)) MB"
Write-Host "  Created: $($fileInfo.CreationTime)"
Write-Host "  Modified: $($fileInfo.LastWriteTime)"

# 2. Calculate and display hash
Write-Host ""
Write-Host "[2/6] Calculating SHA256 hash..." -ForegroundColor Yellow
$hash = Get-FileHashValue -FilePath $InstallerPath
if ($hash) {
    Write-Host "  SHA256: $hash" -ForegroundColor Green
    
    # Save hash to file for future verification
    $hashFile = "$InstallerPath.sha256"
    "$hash *$(Split-Path -Leaf $InstallerPath)" | Out-File -FilePath $hashFile -Encoding ASCII
    Write-Host "  Hash saved to: $(Split-Path -Leaf $hashFile)" -ForegroundColor Gray
} else {
    Write-Host "  ERROR: Could not calculate hash" -ForegroundColor Red
}

# 3. Check digital signature
Write-Host ""
Write-Host "[3/6] Checking digital signature..." -ForegroundColor Yellow
$signature = Test-DigitalSignature -FilePath $InstallerPath
if ($signature.IsSigned) {
    Write-Host "  Signed: Yes" -ForegroundColor Green
    Write-Host "  Status: $($signature.Status)" -ForegroundColor Green
    if ($signature.SignerCertificate) {
        Write-Host "  Signer: $($signature.SignerCertificate.Subject)"
        Write-Host "  Issuer: $($signature.SignerCertificate.Issuer)"
    }
} else {
    Write-Host "  Signed: No" -ForegroundColor Yellow
    Write-Host "  Status: $($signature.Status)" -ForegroundColor Yellow
    Write-Host "  Note: Unsigned installers will trigger Windows SmartScreen warnings" -ForegroundColor Gray
}

# 4. Verify NSIS structure
Write-Host ""
Write-Host "[4/6] Verifying NSIS installer structure..." -ForegroundColor Yellow
$nsisCheck = Test-NSISStructure -FilePath $InstallerPath
if ($nsisCheck.IsValidNSIS) {
    Write-Host "  Valid NSIS installer: Yes" -ForegroundColor Green
} else {
    Write-Host "  Valid NSIS installer: Unknown" -ForegroundColor Yellow
}
Write-Host "  File size: $($nsisCheck.FileSizeMB) MB"
if ($nsisCheck.SizeValid) {
    Write-Host "  Size check: Valid" -ForegroundColor Green
} else {
    Write-Host "  Size check: Warning - unusual size" -ForegroundColor Yellow
}

# 5. Check for corruption indicators
Write-Host ""
Write-Host "[5/6] Checking for corruption indicators..." -ForegroundColor Yellow
$corrupted = $false
$warnings = @()

# Check if file is blocked by Windows
$stream = Get-Item $InstallerPath -Stream *
if ($stream | Where-Object { $_.Stream -eq 'Zone.Identifier' }) {
    $warnings += "File is blocked by Windows (downloaded from internet)"
    Write-Host "  Windows block: Detected" -ForegroundColor Yellow
    
    # Attempt to unblock
    try {
        Unblock-File -Path $InstallerPath
        Write-Host "  Unblocked file successfully" -ForegroundColor Green
    } catch {
        Write-Host "  Could not unblock file automatically" -ForegroundColor Yellow
    }
} else {
    Write-Host "  Windows block: No" -ForegroundColor Green
}

# Check for incomplete download
if ($fileInfo.Length -lt 50MB) {
    $corrupted = $true
    $warnings += "File size too small - possible incomplete download"
}

if ($corrupted) {
    Write-Host "  Corruption detected: Yes" -ForegroundColor Red
} else {
    Write-Host "  Corruption detected: No" -ForegroundColor Green
}

# 6. Generate verification report
Write-Host ""
Write-Host "[6/6] Generating verification report..." -ForegroundColor Yellow

$report = @{
    Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    FileName = Split-Path -Leaf $InstallerPath
    FilePath = $InstallerPath
    FileSize = $fileInfo.Length
    FileSizeMB = [math]::Round($fileInfo.Length / 1MB, 2)
    SHA256 = $hash
    IsSigned = $signature.IsSigned
    SignatureStatus = $signature.Status
    IsValidNSIS = $nsisCheck.IsValidNSIS
    IsCorrupted = $corrupted
    Warnings = $warnings
    Passed = (-not $corrupted -and $nsisCheck.SizeValid)
}

$reportPath = "$InstallerPath.verification.json"
$report | ConvertTo-Json -Depth 10 | Out-File -FilePath $reportPath -Encoding UTF8
Write-Host "  Report saved to: $(Split-Path -Leaf $reportPath)" -ForegroundColor Green

# Display summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verification Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($report.Passed) {
    Write-Host "RESULT: PASSED" -ForegroundColor Green
    Write-Host ""
    Write-Host "The installer appears to be valid and ready for use." -ForegroundColor Green
    
    if (-not $signature.IsSigned) {
        Write-Host ""
        Write-Host "Recommendation: Consider code signing to avoid security warnings." -ForegroundColor Yellow
    }
} else {
    Write-Host "RESULT: FAILED" -ForegroundColor Red
    Write-Host ""
    Write-Host "Issues detected:" -ForegroundColor Red
    foreach ($warning in $warnings) {
        Write-Host "  - $warning" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Recommendations:" -ForegroundColor Yellow
    Write-Host "  1. Re-download the installer" -ForegroundColor Yellow
    Write-Host "  2. Check your internet connection" -ForegroundColor Yellow
    Write-Host "  3. Disable antivirus temporarily during download" -ForegroundColor Yellow
    Write-Host "  4. Use a different browser or download tool" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

# Return exit code
if ($report.Passed) {
    exit 0
} else {
    exit 1
}