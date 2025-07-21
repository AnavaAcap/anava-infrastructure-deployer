# Quick Start Guide

## Prerequisites

1. **Install Google Cloud SDK**
   ```bash
   # macOS
   brew install google-cloud-sdk
   
   # Or download from: https://cloud.google.com/sdk/docs/install
   ```

2. **Authenticate with Google Cloud**
   ```bash
   gcloud auth login
   gcloud auth application-default login
   ```

3. **Ensure you have a GCP project with billing enabled**
   ```bash
   gcloud projects list
   ```

## Running the Development Version

1. **Clone and install dependencies**
   ```bash
   cd ~/anava-infrastructure-deployer
   npm install
   ```

2. **Build the TypeScript files**
   ```bash
   npm run build:main
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

   This will:
   - Compile the main process TypeScript files
   - Start the Electron app
   - The React dev server will start automatically

## Testing the Application

1. **Welcome Screen**
   - Click "New Deployment" to start fresh
   - Or "Check Existing" if you have a previous deployment

2. **Authentication**
   - The app will check your gcloud authentication
   - Select your GCP project from the dropdown

3. **Configuration**
   - Resource Prefix: Keep default "anava-iot" or customize
   - Region: Select your preferred region
   - Firebase: Choose "Create new" for now
   - CORS Origins: Add your domains (one per line)

4. **Deployment**
   - Watch the progress as each step executes
   - You can pause/resume the deployment
   - View logs for detailed information

5. **Completion**
   - Copy the API Gateway URL and API Key
   - Use these in your camera configuration

## Building for Distribution

```bash
# Build for your current platform
npm run dist

# Build for specific platforms
npm run dist:mac
npm run dist:win
npm run dist:linux
```

## Troubleshooting

1. **"gcloud not found" error**
   - Ensure Google Cloud SDK is in your PATH
   - Restart your terminal after installation

2. **Authentication errors**
   - Run `gcloud auth application-default login`
   - Check that you're using the correct Google account

3. **Build errors**
   - Clear node_modules: `rm -rf node_modules && npm install`
   - Check Node.js version: `node --version` (should be 18+)

4. **Electron not starting**
   - Check for port conflicts (React dev server uses 5173)
   - Look for errors in the terminal output

## Development Tips

- **Hot Reload**: The React UI supports hot reload in dev mode
- **DevTools**: Press Cmd+Option+I (Mac) or Ctrl+Shift+I (Windows/Linux) to open Chrome DevTools
- **Logs**: Check the terminal for main process logs
- **State File**: Check `~/Library/Application Support/anava-infrastructure-deployer/.anava-deployer/state.json` (macOS)

## Key Differences from terraform-installer

1. **No Terraform Required**: This version uses direct API calls
2. **Faster Setup**: No need to download Terraform binaries
3. **Better Progress Tracking**: More granular status updates
4. **Resumable Deployments**: Can pause and resume anytime
5. **Cleaner Architecture**: Modular service-based design