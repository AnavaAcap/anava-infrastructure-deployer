# Building Windows Installer from macOS M3

## Option 1: GitHub Actions (Recommended)

The safest and easiest way is to use the GitHub Actions workflow that's already set up:

1. **Push a tag to trigger the build:**
   ```bash
   git tag v0.9.50
   git push origin v0.9.50
   ```

2. **Or manually trigger via GitHub UI:**
   - Go to Actions tab in your GitHub repo
   - Select "Build Windows App" workflow
   - Click "Run workflow"
   - Download the artifact when complete

The workflow handles:
- Correct Windows architecture
- Proper Terraform binary for Windows
- Native NSIS installer creation
- Artifacts uploaded for 30 days

## Option 2: Windows VM on Mac

Use Parallels Desktop or VMware Fusion:

1. Install Windows 11 ARM VM
2. Install Node.js 20+ in the VM
3. Clone your repo in the VM
4. Run:
   ```cmd
   npm install
   npm run dist:win
   ```

## Option 3: Cross-compilation (Less Reliable)

You can try cross-compiling from macOS, but this may have issues:

```bash
# Install Wine (for NSIS)
brew install --cask wine-stable

# Build for Windows
npm run dist:win
```

⚠️ **Known Issues with Cross-compilation:**
- NSIS installer may not work properly
- Code signing is problematic
- Binary compatibility issues
- Terraform binary architecture mismatch

## Option 4: Cloud Build Services

Use services like:
- **AppVeyor**: Free for open source
- **Azure Pipelines**: Free tier available
- **CircleCI**: Has Windows runners

## Recommended Approach

Use GitHub Actions (Option 1) because:
1. ✅ Native Windows environment
2. ✅ Correct architecture guaranteed
3. ✅ No local setup required
4. ✅ Reproducible builds
5. ✅ Already configured in `.github/workflows/build-windows.yml`

## Testing the Windows Build

After building:
1. Test on a real Windows machine
2. Verify Terraform binary works
3. Check all features function correctly
4. Test on both Windows 10 and 11 if possible