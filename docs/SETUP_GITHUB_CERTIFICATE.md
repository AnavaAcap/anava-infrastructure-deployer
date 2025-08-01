# Setting Up Code Signing Certificate for GitHub Actions

## Export Your Certificate

1. Open Keychain Access on your Mac
2. Find your "Developer ID Application: Ryan Wager (3JVZNWGRYT)" certificate
3. Right-click and select "Export Items..."
4. Save as a .p12 file (e.g., `certificate.p12`)
5. Set a strong password when prompted

## Convert to Base64

Run this command to convert your certificate to base64:

```bash
base64 -i certificate.p12 -o certificate_base64.txt
```

## Add to GitHub Secrets

1. Go to your repository settings on GitHub
2. Navigate to Secrets and variables > Actions
3. Add these secrets:

- `CSC_LINK`: Paste the entire contents of `certificate_base64.txt`
- `CSC_KEY_PASSWORD`: The password you set when exporting the .p12 file

## Important Security Notes

- Delete the .p12 and base64 files from your computer after adding to GitHub
- Never commit these files to your repository
- The certificate will expire - update it before expiration

## Test the Setup

After adding the secrets, the GitHub Actions workflow will automatically:
1. Decode the base64 certificate
2. Import it into the runner's keychain
3. Use it for signing during the build process