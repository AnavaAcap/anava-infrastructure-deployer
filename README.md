# Anava Infrastructure Deployer

Deploy Anava's camera authentication infrastructure to your Google Cloud Platform project with a simple desktop application.

## Overview

The Anava Infrastructure Deployer is an Electron desktop application that automates the deployment of a complete camera authentication infrastructure to your GCP project. This includes:

- API Gateway for secure endpoints
- Cloud Functions for authentication
- Firebase integration for device tokens
- Workload Identity Federation for secure token exchange
- Firestore database for data persistence
- All necessary IAM configurations

## Prerequisites

- Google Cloud SDK (`gcloud`) installed and authenticated
- A GCP project with billing enabled
- Node.js 18+ and npm installed (for development)

## Installation

### For Users

Download the latest release for your platform:
- **macOS**: `Anava-Infrastructure-Deployer-*.dmg`
- **Windows**: `Anava-Infrastructure-Deployer-*.exe`
- **Linux**: `Anava-Infrastructure-Deployer-*.AppImage`

### For Developers

```bash
git clone https://github.com/rywager/anava-infrastructure-deployer.git
cd anava-infrastructure-deployer
npm install
npm run dev
```

## Usage

1. **Launch the application**
2. **Authenticate** with your Google Cloud account
3. **Select your GCP project**
4. **Configure deployment options**:
   - Resource name prefix
   - Deployment region
   - Firebase setup (new or existing)
   - CORS origins for API access
5. **Deploy** - The app will handle all infrastructure creation
6. **Get your credentials** - API Gateway URL and API key for camera configuration

## Architecture

The deployed infrastructure follows a 3-step authentication flow:

1. **Device Authentication**: Camera → API Gateway → Firebase custom token
2. **Firebase Exchange**: Custom token → Firebase ID token
3. **Token Vending**: Firebase ID token → GCP access token (via WIF)

## Development

### Project Structure

```
anava-infrastructure-deployer/
├── src/
│   ├── main/           # Electron main process
│   ├── renderer/       # React UI
│   └── types/          # TypeScript definitions
├── functions/          # Cloud Functions source
├── assets/            # Application assets
└── api-gateway-config.yaml
```

### Build Commands

```bash
npm run dev         # Development mode
npm run build       # Build for production
npm run dist        # Create distribution packages
npm run test        # Run tests
npm run lint        # Lint code
```

### Creating Releases

```bash
npm run dist:mac    # macOS release
npm run dist:win    # Windows release
npm run dist:linux  # Linux release
```

## Security

- All infrastructure is deployed to your own GCP project
- No data leaves your environment
- API keys are restricted to specified domains
- Service accounts follow principle of least privilege

## Support

For issues or questions:
- GitHub Issues: https://github.com/rywager/anava-infrastructure-deployer/issues
- Documentation: https://docs.anava.ai

## License

MIT License - See LICENSE file for details