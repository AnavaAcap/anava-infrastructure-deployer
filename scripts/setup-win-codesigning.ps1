# PowerShell Script to Setup Windows Code Signing
# Prevents NSIS integrity errors and Windows SmartScreen warnings

param(
    [Parameter(Mandatory=$false)]
    [string]$CertificatePath = "",
    
    [Parameter(Mandatory=$false)]
    [string]$CertificatePassword = "",
    
    [Parameter(Mandatory=$false)]
    [switch]$SelfSigned = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$Help = $false
)

if ($Help) {
    Write-Host ""
    Write-Host "Anava Installer - Windows Code Signing Setup" -ForegroundColor Cyan
    Write-Host "=============================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  .\setup-win-codesigning.ps1 [-CertificatePath <path>] [-CertificatePassword <password>]"
    Write-Host "  .\setup-win-codesigning.ps1 -SelfSigned  # Create self-signed cert for testing"
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  -CertificatePath     Path to .pfx certificate file"
    Write-Host "  -CertificatePassword Password for the certificate"
    Write-Host "  -SelfSigned         Create a self-signed certificate for testing"
    Write-Host "  -Help               Show this help message"
    Write-Host ""
    Write-Host "Environment Variables Set:" -ForegroundColor Yellow
    Write-Host "  WIN_CSC_LINK         Path to certificate file"
    Write-Host "  WIN_CSC_KEY_PASSWORD Certificate password"
    Write-Host ""
    exit 0
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Windows Code Signing Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to create self-signed certificate
function New-SelfSignedCertificateForSigning {
    Write-Host "Creating self-signed certificate for testing..." -ForegroundColor Yellow
    Write-Host "Note: This certificate is for TESTING ONLY" -ForegroundColor Red
    Write-Host ""
    
    try {
        # Check if running as administrator
        $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
        
        if (-not $isAdmin) {
            Write-Host "ERROR: Administrator privileges required to create certificate" -ForegroundColor Red
            Write-Host "Please run this script as Administrator" -ForegroundColor Yellow
            exit 1
        }
        
        # Certificate parameters
        $certName = "Anava Inc. (Test Certificate)"
        $certPassword = "AnavaTest2025!"
        
        # Create certificate
        Write-Host "Creating certificate: $certName" -ForegroundColor Yellow
        
        $cert = New-SelfSignedCertificate `
            -Type CodeSigningCert `
            -Subject "CN=$certName, O=Anava Inc., C=US" `
            -KeySpec Signature `
            -KeyLength 2048 `
            -KeyAlgorithm RSA `
            -HashAlgorithm SHA256 `
            -Provider "Microsoft Enhanced RSA and AES Cryptographic Provider" `
            -KeyExportPolicy Exportable `
            -KeyUsage DigitalSignature `
            -NotAfter (Get-Date).AddYears(2) `
            -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3", "2.5.29.19={text}CA=false") `
            -CertStoreLocation Cert:\CurrentUser\My
        
        Write-Host "Certificate created successfully" -ForegroundColor Green
        Write-Host "  Thumbprint: $($cert.Thumbprint)"
        Write-Host "  Subject: $($cert.Subject)"
        Write-Host ""
        
        # Export certificate to PFX
        $pfxPath = Join-Path $PSScriptRoot "..\certs\test-codesigning.pfx"
        $certDir = Split-Path -Parent $pfxPath
        
        if (-not (Test-Path $certDir)) {
            New-Item -ItemType Directory -Path $certDir -Force | Out-Null
        }
        
        Write-Host "Exporting certificate to PFX..." -ForegroundColor Yellow
        $securePassword = ConvertTo-SecureString -String $certPassword -Force -AsPlainText
        Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $securePassword | Out-Null
        
        Write-Host "Certificate exported to: $pfxPath" -ForegroundColor Green
        Write-Host "Password: $certPassword" -ForegroundColor Yellow
        Write-Host ""
        
        # Add to Trusted Publishers (for testing)
        Write-Host "Adding certificate to Trusted Publishers..." -ForegroundColor Yellow
        $publisherStore = New-Object System.Security.Cryptography.X509Certificates.X509Store "TrustedPublisher", "CurrentUser"
        $publisherStore.Open("ReadWrite")
        $publisherStore.Add($cert)
        $publisherStore.Close()
        
        Write-Host "Certificate added to Trusted Publishers" -ForegroundColor Green
        Write-Host ""
        
        return @{
            Path = $pfxPath
            Password = $certPassword
            Thumbprint = $cert.Thumbprint
        }
    }
    catch {
        Write-Host "ERROR: Failed to create self-signed certificate" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        exit 1
    }
}

# Function to verify certificate
function Test-CodeSigningCertificate {
    param(
        [string]$Path,
        [string]$Password
    )
    
    try {
        Write-Host "Verifying certificate..." -ForegroundColor Yellow
        
        $securePassword = ConvertTo-SecureString -String $Password -Force -AsPlainText
        $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($Path, $securePassword)
        
        Write-Host "  Subject: $($cert.Subject)" -ForegroundColor Green
        Write-Host "  Issuer: $($cert.Issuer)" -ForegroundColor Green
        Write-Host "  Valid from: $($cert.NotBefore)" -ForegroundColor Green
        Write-Host "  Valid to: $($cert.NotAfter)" -ForegroundColor Green
        Write-Host "  Thumbprint: $($cert.Thumbprint)" -ForegroundColor Green
        
        # Check if certificate is valid for code signing
        $codeSigningOid = "1.3.6.1.5.5.7.3.3"
        $hasCodeSigning = $cert.Extensions | Where-Object {
            $_.Oid.Value -eq "2.5.29.37" -and $_.Format($false) -match $codeSigningOid
        }
        
        if ($hasCodeSigning) {
            Write-Host "  Code signing: Enabled" -ForegroundColor Green
        } else {
            Write-Host "  Code signing: Not enabled" -ForegroundColor Yellow
            Write-Host "  Warning: This certificate may not work for code signing" -ForegroundColor Yellow
        }
        
        # Check expiration
        if ($cert.NotAfter -lt (Get-Date)) {
            Write-Host "  Status: EXPIRED" -ForegroundColor Red
            return $false
        } elseif ($cert.NotAfter -lt (Get-Date).AddDays(30)) {
            Write-Host "  Status: Expiring soon" -ForegroundColor Yellow
        } else {
            Write-Host "  Status: Valid" -ForegroundColor Green
        }
        
        return $true
    }
    catch {
        Write-Host "ERROR: Failed to verify certificate" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        return $false
    }
}

# Main logic
$certInfo = $null

if ($SelfSigned) {
    # Create self-signed certificate
    $certInfo = New-SelfSignedCertificateForSigning
    $CertificatePath = $certInfo.Path
    $CertificatePassword = $certInfo.Password
}
elseif ($CertificatePath -and $CertificatePassword) {
    # Use provided certificate
    if (-not (Test-Path $CertificatePath)) {
        Write-Host "ERROR: Certificate file not found: $CertificatePath" -ForegroundColor Red
        exit 1
    }
    
    if (-not (Test-CodeSigningCertificate -Path $CertificatePath -Password $CertificatePassword)) {
        Write-Host "ERROR: Certificate validation failed" -ForegroundColor Red
        exit 1
    }
}
else {
    # Check for existing environment variables
    if ($env:WIN_CSC_LINK -and $env:WIN_CSC_KEY_PASSWORD) {
        Write-Host "Found existing code signing configuration:" -ForegroundColor Yellow
        Write-Host "  Certificate: $env:WIN_CSC_LINK"
        Write-Host "  Password: [HIDDEN]"
        Write-Host ""
        
        $response = Read-Host "Use existing configuration? (Y/N)"
        if ($response -eq 'Y' -or $response -eq 'y') {
            $CertificatePath = $env:WIN_CSC_LINK
            $CertificatePassword = $env:WIN_CSC_KEY_PASSWORD
        }
    }
    
    if (-not $CertificatePath) {
        Write-Host "No certificate specified. Options:" -ForegroundColor Yellow
        Write-Host "  1. Provide certificate with -CertificatePath and -CertificatePassword"
        Write-Host "  2. Create test certificate with -SelfSigned"
        Write-Host "  3. Set WIN_CSC_LINK and WIN_CSC_KEY_PASSWORD environment variables"
        Write-Host ""
        Write-Host "Run with -Help for more information" -ForegroundColor Yellow
        exit 1
    }
}

# Set environment variables
Write-Host ""
Write-Host "Setting environment variables..." -ForegroundColor Yellow

# Set for current session
$env:WIN_CSC_LINK = $CertificatePath
$env:WIN_CSC_KEY_PASSWORD = $CertificatePassword

# Set for current user (persistent)
[System.Environment]::SetEnvironmentVariable("WIN_CSC_LINK", $CertificatePath, "User")
[System.Environment]::SetEnvironmentVariable("WIN_CSC_KEY_PASSWORD", $CertificatePassword, "User")

Write-Host "Environment variables set successfully" -ForegroundColor Green
Write-Host ""

# Create batch file for easy environment setup
$batchPath = Join-Path $PSScriptRoot "set-codesigning-env.bat"
$batchContent = @"
@echo off
echo Setting Windows code signing environment variables...
set WIN_CSC_LINK=$CertificatePath
set WIN_CSC_KEY_PASSWORD=$CertificatePassword
echo Environment variables set for this session
echo.
echo You can now run: npm run dist:win
"@

$batchContent | Out-File -FilePath $batchPath -Encoding ASCII
Write-Host "Created batch file for environment setup: $(Split-Path -Leaf $batchPath)" -ForegroundColor Green

# Test signing with a dummy file
Write-Host ""
Write-Host "Testing code signing..." -ForegroundColor Yellow

$testFile = Join-Path $env:TEMP "test-signing.exe"
$testContent = [byte[]](0x4D, 0x5A) # MZ header
[System.IO.File]::WriteAllBytes($testFile, $testContent)

try {
    $signtoolPath = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe"
    
    if (-not (Test-Path $signtoolPath)) {
        # Try to find signtool
        $signtoolSearch = Get-ChildItem -Path "C:\Program Files (x86)\Windows Kits" -Recurse -Filter "signtool.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($signtoolSearch) {
            $signtoolPath = $signtoolSearch.FullName
        }
    }
    
    if (Test-Path $signtoolPath) {
        & $signtoolPath sign /f "$CertificatePath" /p "$CertificatePassword" /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 "$testFile" 2>&1 | Out-Null
        Write-Host "Test signing successful" -ForegroundColor Green
    } else {
        Write-Host "Signtool not found - install Windows SDK for signing" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "Could not test signing - Windows SDK may not be installed" -ForegroundColor Yellow
}
finally {
    if (Test-Path $testFile) {
        Remove-Item $testFile -Force
    }
}

# Display summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Code Signing Setup Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Certificate configured:" -ForegroundColor Green
Write-Host "  Path: $CertificatePath"
Write-Host "  Password: [STORED IN ENVIRONMENT]"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Run: npm run dist:win"
Write-Host "  2. The installer will be automatically signed"
Write-Host "  3. Verify signature with: .\verify-win-installer.ps1"
Write-Host ""

if ($certInfo -and $certInfo.Thumbprint) {
    Write-Host "Test certificate thumbprint: $($certInfo.Thumbprint)" -ForegroundColor Gray
    Write-Host "Note: This is a TEST certificate and will still trigger warnings" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "For production, obtain a certificate from a trusted CA like:" -ForegroundColor Cyan
Write-Host "  - DigiCert"
Write-Host "  - Sectigo (formerly Comodo)"
Write-Host "  - GlobalSign"
Write-Host ""