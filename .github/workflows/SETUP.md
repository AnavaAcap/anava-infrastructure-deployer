# Setting Up Cross-Repository Releases

This guide explains how to set up automated releases that build in your private repository but publish to a public repository.

## Prerequisites

1. Create a public repository for releases (e.g., `anava-vision-releases`)
2. Create a Personal Access Token (PAT) with appropriate permissions

## Step 1: Create the Public Releases Repository

1. Go to https://github.com/new
2. Create a new public repository named `anava-vision-releases` (or your preferred name)
3. Initialize it with a README explaining it's for releases only

## Step 2: Create a Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Direct link: https://github.com/settings/tokens/new

2. Create a new token with these permissions:
   - `repo` (Full control of private repositories) - needed to create releases
   - `workflow` (Update GitHub Action workflows) - if you want to trigger workflows

3. Name it something like `ANAVA_RELEASES_PAT`

4. Copy the token immediately (you won't see it again!)

## Step 3: Add the PAT to Your Private Repository

1. Go to your private repository settings
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `RELEASES_PAT`
5. Value: Paste your Personal Access Token
6. Click "Add secret"

## Step 4: Update the Workflow

The workflow in `.github/workflows/release.yml` has been updated to:
- Build in the private repository
- Create releases in the public repository
- Use your PAT for authentication

Make sure to update the repository name in the workflow if you used a different name than `anava-vision-releases`.

## Step 5: Test the Setup

1. Push a new tag to trigger a release:
   ```bash
   git tag -a v0.8.33 -m "Test cross-repo release"
   git push origin v0.8.33
   ```

2. Monitor the Actions tab in your private repo
3. Check the public repo for the new release

## Troubleshooting

- **Authentication errors**: Make sure your PAT has the correct permissions
- **Repository not found**: Check the repository name in the workflow matches exactly
- **No releases created**: Ensure the PAT secret name matches (`RELEASES_PAT`)

## Security Notes

- The PAT only needs access to the public releases repository
- Never commit the PAT directly to your code
- Rotate the PAT periodically for security
- The source code remains completely private