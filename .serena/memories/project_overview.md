# Anava Vision (formerly Anava Infrastructure Deployer)

## Purpose
Anava Vision is an Electron desktop application that automates the deployment of a complete camera authentication infrastructure to Google Cloud Platform (GCP). It provides a GUI-based tool for deploying API Gateway, Cloud Functions, Firebase integration, and other GCP services without requiring command-line expertise.

## Tech Stack
- **Frontend**: React 19 with TypeScript, Material-UI v7, Emotion for styling
- **Backend**: Electron 37 with TypeScript
- **Build Tools**: Vite, electron-vite, electron-builder
- **Cloud SDKs**: Google Cloud client libraries (@google-cloud/*), googleapis, google-auth-library
- **Testing**: Jest with ts-jest
- **Linting**: ESLint with TypeScript plugins

## Key Features
- OAuth-based Google Cloud authentication
- Automated deployment of GCP infrastructure
- Support for new or existing Firebase projects
- API Gateway configuration with CORS support
- Cloud Functions deployment for authentication
- Workload Identity Federation setup
- Progress tracking with pause/resume capability