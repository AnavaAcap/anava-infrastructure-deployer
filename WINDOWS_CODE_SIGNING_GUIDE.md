# Windows Code Signing Setup Guide for Anava Installer

## Overview
To prevent security warnings and NSIS integrity errors when users install your Electron application on Windows, you need a code signing certificate from a trusted Certificate Authority (CA). This guide walks through the complete process.

## Why Code Signing is Critical

Without code signing, users will encounter:
- **Windows SmartScreen warnings** ("Windows protected your PC")
- **Security warnings** during installation
- **Antivirus false positives**
- **NSIS integrity check failures**
- **Missing shortcut errors** (due to Windows security blocking)

## Types of Code Signing Certificates

### 1. Standard Code Signing Certificate ($200-400/year)
- **Pros**: More affordable, works for most scenarios
- **Cons**: Still triggers SmartScreen until reputation is built
- **Best for**: Small companies, initial releases

### 2. EV (Extended Validation) Code Signing Certificate ($400-900/year)
- **Pros**: Immediate SmartScreen reputation, highest trust level
- **Cons**: More expensive, requires hardware token or HSM
- **Best for**: Enterprise software, immediate trust needed
- **Required**: USB hardware token or cloud HSM

## Step-by-Step Setup Process

### Step 1: Choose a Certificate Authority (CA)

Recommended CAs (in order of preference):

1. **DigiCert** (Industry leader)
   - Website: https://www.digicert.com/signing/code-signing-certificates
   - Standard: ~$499/year
   - EV: ~$699/year
   - Support: Excellent

2. **Sectigo (formerly Comodo)**
   - Website: https://sectigo.com/ssl-certificates-tls/code-signing
   - Standard: ~$179/year
   - EV: ~$349/year
   - Support: Good

3. **GlobalSign**
   - Website: https://www.globalsign.com/en/code-signing-certificate
   - Standard: ~$379/year
   - EV: ~$599/year
   - Support: Good

4. **SSL.com**
   - Website: https://www.ssl.com/certificates/ev-code-signing/
   - Standard: ~$249/year
   - EV: ~$474/year
   - Support: Good

### Step 2: Prepare Required Documentation

For **Standard Certificate**, you'll need:
- Valid email address matching domain
- Phone number for verification
- Business registration documents (if applicable)

For **EV Certificate**, additional requirements:
- **Business Documentation**:
  - Articles of Incorporation
  - Business license
  - Bank letter or statement
- **Verification**:
  - D-U-N-S Number (get free at https://www.dnb.com/duns-number.html)
  - Legal entity verification
  - Physical address verification
  - Phone call verification with authorized representative

### Step 3: Microsoft-Specific Requirements

#### A. Create a Microsoft Partner Account (Required for Microsoft Store)

1. Go to https://partner.microsoft.com/
2. Click "Join now"
3. Choose "Company account"
4. Complete registration ($19 one-time fee)
5. Verify your identity and company

#### B. Windows Hardware Dev Center (For Driver Signing - Optional)

If you need kernel-level access or drivers:
1. Go to https://partner.microsoft.com/en-us/dashboard/hardware
2. Requires EV certificate
3. Complete additional verification

### Step 4: Purchase and Validate Certificate

#### For DigiCert (Recommended):

1. **Go to DigiCert website**
   ```
   https://www.digicert.com/signing/code-signing-certificates
   ```

2. **Choose certificate type**
   - Select "Code Signing Certificate" or "EV Code Signing"
   - Click "Buy Now"

3. **Complete order form**
   - Organization details
   - Technical contact
   - Choose validity period (1-3 years, longer = better value)

4. **Validation process** (2-7 business days)
   - Email validation
   - Phone verification
   - Document review (for EV)

5. **Receive certificate**
   - Standard: Download .pfx file
   - EV: Receive USB token via mail

### Step 5: Install Certificate

#### For Standard Certificate (.pfx file):

```powershell
# Import certificate to Windows Certificate Store
certutil -f -user -p "YOUR_PASSWORD" -importpfx "path\to\certificate.pfx"

# Verify installation
certutil -user -store My
```

#### For EV Certificate (USB Token):

1. Install token driver software (provided by CA)
2. Plug in USB token
3. Install SafeNet Authentication Client or similar
4. Certificate is automatically available when token is connected

### Step 6: Configure for Electron Builder

#### Set Environment Variables:

**For Standard Certificate:**
```powershell
# Set in PowerShell
$env:WIN_CSC_LINK = "C:\path\to\certificate.pfx"
$env:WIN_CSC_KEY_PASSWORD = "your-certificate-password"

# Or set permanently for user
[System.Environment]::SetEnvironmentVariable("WIN_CSC_LINK", "C:\path\to\certificate.pfx", "User")
[System.Environment]::SetEnvironmentVariable("WIN_CSC_KEY_PASSWORD", "your-password", "User")
```

**For EV Certificate (USB Token):**
```powershell
# Set certificate subject name or thumbprint
$env:WIN_CERTIFICATE_NAME = "Anava Inc."
# OR
$env:WIN_CERTIFICATE_SHA1 = "YOUR_CERT_THUMBPRINT"

# Token PIN (if required)
$env:WIN_CSC_KEY_PASSWORD = "token-pin"
```

#### Update electron-builder-win.yml:

```yaml
win:
  certificateSubjectName: "Anava Inc."  # For EV certificates
  # OR for file-based certificates:
  # certificateFile: "${env.WIN_CSC_LINK}"
  # certificatePassword: "${env.WIN_CSC_KEY_PASSWORD}"
  
  # Important: Use these timestamp servers
  rfc3161TimeStampServer: http://timestamp.digicert.com
  timeStampServer: http://timestamp.digicert.com
  
  # Sign DLLs as well
  signDlls: true
  
  # Additional files to sign
  additionalCertificateFile: "path/to/cross-certificate.crt"  # If required by CA
```

### Step 7: Test Signing

```powershell
# Test sign a file
signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /a "test.exe"

# Verify signature
signtool verify /pa /v "test.exe"
```

### Step 8: Build and Sign Your Application

```bash
# Build with signing
npm run dist:win

# The build process will automatically sign:
# - Main executable (Anava Installer.exe)
# - Installer (Anava-Installer-Setup-*.exe)
# - All DLLs (if signDlls: true)
```

## Cost Breakdown

### Initial Setup Costs:
- **Microsoft Partner Account**: $19 (one-time)
- **D-U-N-S Number**: Free (but can pay $229 for expedited)
- **Standard Certificate**: $179-499/year
- **EV Certificate**: $349-699/year
- **USB Token** (for EV): Included or ~$50

### Annual Costs:
- **Certificate Renewal**: Same as initial
- **Microsoft Partner**: Free after initial fee

### Total First Year:
- **Budget Option**: ~$200 (Standard cert from Sectigo)
- **Professional Option**: ~$520 (Standard cert from DigiCert)
- **Enterprise Option**: ~$720 (EV cert from DigiCert)

## Timeline

1. **D-U-N-S Number**: 30 days (free) or 5 days (expedited)
2. **Microsoft Partner**: 1-2 days
3. **Standard Certificate**: 1-3 business days
4. **EV Certificate**: 3-7 business days
5. **USB Token Shipping**: 2-5 business days

**Total Time**: 
- Standard: 3-5 business days
- EV: 7-14 business days (including shipping)

## Troubleshooting Common Issues

### Issue: "The specified timestamp server could not be reached"
**Solution**: Use alternative timestamp servers:
```yaml
# In electron-builder-win.yml, try these:
rfc3161TimeStampServer: http://timestamp.sectigo.com
# OR
rfc3161TimeStampServer: http://timestamp.globalsign.com/scripts/timstamp.dll
# OR
rfc3161TimeStampServer: http://sha256timestamp.ws.symantec.com/sha256/timestamp
```

### Issue: "SignTool Error: No certificates were found"
**Solution**: 
```powershell
# List all certificates
certutil -user -store My

# If using token, ensure it's connected and drivers installed
# Check token is recognized:
certutil -csp "eToken Base Cryptographic Provider" -key
```

### Issue: SmartScreen still shows warnings with standard certificate
**Solution**: Build reputation over time:
1. Sign consistently with same certificate
2. Distribute to many users
3. Avoid changing file names frequently
4. Consider upgrading to EV certificate

### Issue: "Invalid provider type specified"
**Solution**: For EV certificates with hardware tokens:
```powershell
# Use the correct CSP (Cryptographic Service Provider)
signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /n "Anava Inc." /csp "eToken Base Cryptographic Provider" /k "[{{TokenPassword}}]" "app.exe"
```

## Best Practices

1. **Always timestamp** your signatures (survives certificate expiration)
2. **Sign all executables and DLLs** in your package
3. **Keep certificate files secure** (use encrypted storage)
4. **Never commit certificates** to version control
5. **Use CI/CD secrets** for automated builds
6. **Test on clean Windows machines** after signing
7. **Monitor certificate expiration** (set reminders 60 days before)

## CI/CD Integration

### GitHub Actions:
```yaml
- name: Sign Windows Build
  env:
    WIN_CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
    WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
  run: npm run dist:win
```

### Azure DevOps:
```yaml
- task: DownloadSecureFile@1
  name: certificate
  inputs:
    secureFile: 'code-signing.pfx'

- script: |
    set WIN_CSC_LINK=$(certificate.secureFilePath)
    set WIN_CSC_KEY_PASSWORD=$(CERT_PASSWORD)
    npm run dist:win
```

## Verification Steps

After signing, verify your installer:

1. **Check signature**:
   ```powershell
   # Right-click installer → Properties → Digital Signatures tab
   # OR use PowerShell:
   Get-AuthenticodeSignature "Anava-Installer-Setup-*.exe"
   ```

2. **Test on clean machine**:
   - No SmartScreen warnings (EV) or minimal warnings (Standard)
   - Installer shows "Verified publisher: Anava Inc."

3. **Submit to Microsoft for analysis** (optional):
   - https://www.microsoft.com/en-us/wdsi/filesubmission
   - Helps build reputation faster

## Support Contacts

- **DigiCert Support**: support@digicert.com | 1-801-701-9600
- **Sectigo Support**: support@sectigo.com | 1-888-266-6361
- **Microsoft Partner Support**: https://partner.microsoft.com/support
- **Electron Builder Issues**: https://github.com/electron-userland/electron-builder/issues

## Next Steps

1. **Determine certificate type needed** (Standard vs EV)
2. **Get D-U-N-S number** if choosing EV
3. **Purchase certificate** from recommended CA
4. **Follow setup steps** in this guide
5. **Test thoroughly** before release
6. **Monitor and maintain** certificate validity

Remember: Code signing is an investment in your software's credibility and user trust. The cost is minimal compared to the improved user experience and reduced support burden.