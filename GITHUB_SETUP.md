# GitHub Actions Setup for Vision Releases

This document explains how to set up the GitHub Actions workflow to automatically deploy releases to the `vision-releases` repository.

## Required GitHub Secrets

You need to set up the following secret in the **AnavaAcap/anava-infrastructure-deployer** repository:

### 1. VISION_RELEASES_TOKEN

This is a Personal Access Token (PAT) that allows the workflow to push to the `vision-releases` repository.

**Steps to create:**

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a descriptive name: `Anava Vision Releases Deployment`
4. Set expiration: `No expiration` (or 1 year max)
5. Select these scopes:
   - `repo` (Full control of private repositories)
   - `workflow` (Update GitHub Action workflows)
6. Click "Generate token"
7. Copy the token immediately (you won't see it again)

**Add to repository secrets:**

1. Go to `AnavaAcap/anava-infrastructure-deployer` → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `VISION_RELEASES_TOKEN`
4. Value: Paste the PAT you created above
5. Click "Add secret"

## Repository Setup

### 1. Create the vision-releases repository

If it doesn't exist already:

1. Go to the AnavaAcap organization
2. Create a new public repository named `vision-releases`
3. Initialize with a README (it will be overwritten by the workflow)

### 2. Enable GitHub Actions

Make sure GitHub Actions are enabled on both repositories:
- `AnavaAcap/anava-infrastructure-deployer` (main repo)
- `AnavaAcap/vision-releases` (target repo)

## How the Workflow Works

When you push a tag to the main repository (e.g., `v0.9.212`), the workflow will:

1. **Build the applications** on macOS and Windows
2. **Create a release** in the main repository with the built assets
3. **Copy assets to vision-releases** with static names:
   - `Anava.Vision.dmg` (always latest macOS version)
   - `Anava.Vision.Setup.exe` (always latest Windows version)
   - `Anava.Vision.v0.9.212.dmg` (versioned copy)
   - `Anava.Vision.Setup.v0.9.212.exe` (versioned copy)
4. **Generate a README** with download links and documentation
5. **Create a release** in the vision-releases repository
6. **Update the repository** with the new files

## Static Download URLs

After setup, your website can use these permanent URLs:

### Windows
```
https://github.com/AnavaAcap/vision-releases/releases/latest/download/Anava.Vision.Setup.exe
```

### macOS
```
https://github.com/AnavaAcap/vision-releases/releases/latest/download/Anava.Vision.dmg
```

These URLs will **always** point to the latest version, so your website download links never break.

## Testing the Setup

1. Make sure all secrets are configured
2. Create a test tag: `git tag v0.9.212-test && git push origin --tags`
3. Check GitHub Actions tab to see if the workflow runs successfully
4. Verify that the `vision-releases` repository gets updated with the new files
5. Test the download URLs to make sure they work

## Troubleshooting

### "Permission denied" errors
- Check that the `VISION_RELEASES_TOKEN` has the correct permissions
- Make sure the token hasn't expired
- Verify the token was created with `repo` scope

### "Repository not found" errors
- Ensure the `vision-releases` repository exists and is public
- Check that the PAT has access to the AnavaAcap organization

### Files not uploading
- Check the build artifacts are being created correctly
- Verify the file paths in the workflow match the actual build output
- Look at the GitHub Actions logs for specific error messages

## Maintenance

- **Token expiration**: If you set an expiration on the PAT, remember to renew it before it expires
- **Repository access**: If you change organization settings, make sure the PAT still has access
- **File names**: If you change the installer file naming convention, update the workflow accordingly

## Manual Override

If you need to manually update the vision-releases repository:

1. Download the assets from a release in the main repository
2. Clone the vision-releases repository
3. Copy the files with the correct names
4. Update the README with the new version info
5. Commit and push the changes
6. Create a new release with the assets

The workflow is designed to handle this automatically, but manual override is always possible.