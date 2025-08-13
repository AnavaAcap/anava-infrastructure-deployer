# PowerShell script to test Terraform binary on Windows
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Testing Terraform Binary on Windows" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath
$terraformBinDir = Join-Path $projectRoot "terraform-bin"

Write-Host "`nChecking terraform-bin directory..." -ForegroundColor Yellow
if (Test-Path $terraformBinDir) {
    Write-Host "✓ terraform-bin directory exists" -ForegroundColor Green
    
    # List contents
    Write-Host "`nDirectory contents:" -ForegroundColor Yellow
    Get-ChildItem $terraformBinDir | ForEach-Object {
        $size = [math]::Round($_.Length / 1MB, 2)
        Write-Host "  - $($_.Name) ($size MB)" -ForegroundColor Gray
    }
    
    # Check for terraform.exe
    $terraformExe = Join-Path $terraformBinDir "terraform.exe"
    if (Test-Path $terraformExe) {
        Write-Host "`n✓ terraform.exe found" -ForegroundColor Green
        
        # Check file size
        $fileInfo = Get-Item $terraformExe
        $sizeMB = [math]::Round($fileInfo.Length / 1MB, 2)
        
        if ($fileInfo.Length -lt 1000000) {
            Write-Host "✗ terraform.exe appears corrupted (only $sizeMB MB)" -ForegroundColor Red
        } else {
            Write-Host "✓ terraform.exe size looks good ($sizeMB MB)" -ForegroundColor Green
            
            # Try to run terraform version
            Write-Host "`nTesting terraform.exe execution..." -ForegroundColor Yellow
            try {
                $versionOutput = & $terraformExe version 2>&1
                Write-Host "✓ Terraform executes successfully!" -ForegroundColor Green
                Write-Host $versionOutput -ForegroundColor Gray
            } catch {
                Write-Host "✗ Failed to execute terraform.exe" -ForegroundColor Red
                Write-Host "Error: $_" -ForegroundColor Red
                
                # Check if it's blocked by Windows
                $zone = Get-Content "${terraformExe}:Zone.Identifier" -ErrorAction SilentlyContinue
                if ($zone) {
                    Write-Host "`nFile may be blocked by Windows security!" -ForegroundColor Yellow
                    Write-Host "Run: Unblock-File '$terraformExe'" -ForegroundColor Yellow
                }
            }
        }
    } else {
        Write-Host "✗ terraform.exe NOT found" -ForegroundColor Red
        Write-Host "Run: npm run download-terraform-all" -ForegroundColor Yellow
    }
} else {
    Write-Host "✗ terraform-bin directory does NOT exist" -ForegroundColor Red
    Write-Host "Run: npm run download-terraform-all" -ForegroundColor Yellow
}

# Test in packaged app location (if exists)
$appData = $env:APPDATA
$installedAppPath = Join-Path $appData "anava-vision"
$installedTerraformBin = Join-Path $installedAppPath "resources" "terraform-bin"

if (Test-Path $installedTerraformBin) {
    Write-Host "`n============================================" -ForegroundColor Cyan
    Write-Host "Checking installed app terraform binary..." -ForegroundColor Cyan
    Write-Host "Path: $installedTerraformBin" -ForegroundColor Gray
    
    Get-ChildItem $installedTerraformBin | ForEach-Object {
        $size = [math]::Round($_.Length / 1MB, 2)
        Write-Host "  - $($_.Name) ($size MB)" -ForegroundColor Gray
    }
}

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "Test Complete" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan