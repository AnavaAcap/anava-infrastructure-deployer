# PowerShell script to fix Terraform binary issues on Windows
param(
    [switch]$Force = $false
)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Fixing Terraform Binary for Windows" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath
$terraformBinDir = Join-Path $projectRoot "terraform-bin"

# Create directory if it doesn't exist
if (!(Test-Path $terraformBinDir)) {
    Write-Host "Creating terraform-bin directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $terraformBinDir -Force | Out-Null
}

# Check for terraform.exe
$terraformExe = Join-Path $terraformBinDir "terraform.exe"

if ((Test-Path $terraformExe) -and !$Force) {
    $fileInfo = Get-Item $terraformExe
    $sizeMB = [math]::Round($fileInfo.Length / 1MB, 2)
    
    if ($fileInfo.Length -gt 1000000) {
        Write-Host "✓ terraform.exe already exists and appears valid ($sizeMB MB)" -ForegroundColor Green
        
        # Unblock file if needed
        try {
            Unblock-File -Path $terraformExe -ErrorAction SilentlyContinue
            Write-Host "✓ Ensured terraform.exe is unblocked" -ForegroundColor Green
        } catch {
            Write-Host "Note: Could not unblock file (may already be unblocked)" -ForegroundColor Gray
        }
        
        # Test execution
        try {
            $version = & $terraformExe version 2>&1 | Out-String
            Write-Host "✓ Terraform executes successfully" -ForegroundColor Green
            Write-Host $version -ForegroundColor Gray
            exit 0
        } catch {
            Write-Host "✗ Terraform exists but won't execute, re-downloading..." -ForegroundColor Yellow
        }
    } else {
        Write-Host "✗ terraform.exe appears corrupted, re-downloading..." -ForegroundColor Yellow
    }
}

# Download Terraform for Windows
Write-Host "`nDownloading Terraform 1.9.8 for Windows..." -ForegroundColor Yellow

$terraformVersion = "1.9.8"
$url = "https://releases.hashicorp.com/terraform/${terraformVersion}/terraform_${terraformVersion}_windows_amd64.zip"
$zipPath = Join-Path $terraformBinDir "terraform_windows.zip"

try {
    # Download the file
    Write-Host "Downloading from: $url" -ForegroundColor Gray
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing
    
    Write-Host "✓ Download complete" -ForegroundColor Green
    
    # Extract the zip
    Write-Host "Extracting terraform.exe..." -ForegroundColor Yellow
    
    # Remove old terraform.exe if exists
    if (Test-Path $terraformExe) {
        Remove-Item $terraformExe -Force
    }
    
    # Extract using .NET (more reliable than Expand-Archive for this case)
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
    
    foreach ($entry in $zip.Entries) {
        if ($entry.Name -eq "terraform.exe") {
            $destPath = Join-Path $terraformBinDir $entry.Name
            [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destPath, $true)
            Write-Host "✓ Extracted $($entry.Name)" -ForegroundColor Green
        }
    }
    $zip.Dispose()
    
    # Clean up zip file
    Remove-Item $zipPath -Force
    
    # Unblock the executable
    Unblock-File -Path $terraformExe
    Write-Host "✓ Unblocked terraform.exe" -ForegroundColor Green
    
    # Verify the binary
    $fileInfo = Get-Item $terraformExe
    $sizeMB = [math]::Round($fileInfo.Length / 1MB, 2)
    Write-Host "✓ Binary size: $sizeMB MB" -ForegroundColor Green
    
    # Test execution
    Write-Host "`nTesting terraform.exe..." -ForegroundColor Yellow
    try {
        $version = & $terraformExe version 2>&1 | Out-String
        Write-Host "✓ Terraform installed and working!" -ForegroundColor Green
        Write-Host $version -ForegroundColor Gray
    } catch {
        Write-Host "✗ Terraform installed but won't execute" -ForegroundColor Red
        Write-Host "Error: $_" -ForegroundColor Red
        
        # Try to fix with ICACLS
        Write-Host "`nAttempting to fix permissions..." -ForegroundColor Yellow
        & icacls $terraformExe /grant "${env:USERNAME}:(RX)" 2>&1 | Out-Null
        
        # Test again
        try {
            $version = & $terraformExe version 2>&1 | Out-String
            Write-Host "✓ Fixed! Terraform now works" -ForegroundColor Green
        } catch {
            Write-Host "✗ Still not working. Manual intervention may be required." -ForegroundColor Red
            Write-Host "Try running as Administrator or check antivirus settings." -ForegroundColor Yellow
        }
    }
    
} catch {
    Write-Host "✗ Failed to download or extract Terraform" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "Fix Complete" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan