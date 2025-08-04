# Anava Vision - Magical Installer Implementation

## Overview

The Magical Installer provides a "zero-to-wow in 30 seconds" experience for Anava Vision, allowing users to see AI analysis from their cameras without any authentication or complex setup.

## Architecture

### Components

1. **AI Proxy Cloud Function** (`functions/ai-proxy/`)
   - Provides secure backend proxy for AI requests
   - Implements device-based rate limiting
   - Manages shared AI Studio API keys
   - Tracks usage per device

2. **Fast Start Service** (`src/main/services/fastStartService.ts`)
   - Orchestrates the magical experience
   - Runs camera discovery, configuration, and AI analysis in parallel
   - Optimized for speed over completeness

3. **Magical UI Components**
   - `MagicalWelcomePage`: Entry point with particle effects
   - `MagicalDiscoveryPage`: Animated discovery and AI interaction

### Flow

1. User clicks "Try AI on My Network"
2. System performs in parallel:
   - Device status check with backend
   - Fast camera discovery (stops on first found)
   - Automatic configuration push
3. First AI analysis shown within 30 seconds
4. User can interact with AI using natural language

## Backend Setup

### Prerequisites

- Google Cloud Project for the backend
- gcloud CLI installed and authenticated
- AI Studio API keys

### Setup Steps

1. **Create Backend Project**
   ```bash
   # Create a new GCP project for the magical backend
   gcloud projects create anava-magical-backend --name="Anava Magical Backend"
   ```

2. **Run Setup Script**
   ```bash
   cd functions/ai-proxy
   ./setup-backend.sh
   ```

3. **Create AI Studio Keys**
   - Visit https://aistudio.google.com/app/apikey
   - Create 2-3 API keys for redundancy
   - Store them in Secret Manager:
   ```bash
   gcloud secrets create ai-key-key_001 --data-file=- --project=anava-magical-backend
   # Paste key and press Ctrl+D
   ```

4. **Deploy Cloud Functions**
   ```bash
   ./deploy.sh anava-magical-backend us-central1
   ```

5. **Configure Client**
   Create `.env` file in project root:
   ```
   AI_PROXY_URL=https://ai-proxy-us-central1-anava-magical-backend.cloudfunctions.net/ai-proxy
   AI_PROXY_STATUS_URL=https://ai-proxy-status-us-central1-anava-magical-backend.cloudfunctions.net/ai-proxy-status
   ```

## Testing

### Local Development

1. **Start the app**
   ```bash
   npm run dev
   ```

2. **Test without camera** (mock mode)
   - The app will simulate camera discovery
   - Shows placeholder for camera feed
   - AI analysis still works with static image

3. **Test with camera**
   - Ensure Axis camera on network
   - Set credentials to `anava`/`baton`
   - Camera should be discovered automatically

### Production Testing

1. **Build the app**
   ```bash
   npm run build
   npm run dist
   ```

2. **Install and run**
   - Install the generated installer
   - Launch Anava Vision
   - Should see magical welcome screen

## Rate Limits

- **Per minute**: 10 requests
- **Per hour**: 100 requests  
- **Per day**: 500 requests
- **Lifetime per device**: 1000 requests

These limits ensure the demo remains sustainable while giving users enough usage to be impressed.

## Security

1. **No API keys on client**
   - All keys stored in backend Secret Manager
   - Client only has device ID

2. **Device fingerprinting**
   - Based on MAC addresses + platform info
   - Consistent across app restarts
   - Anonymous (no PII collected)

3. **Rate limiting**
   - Enforced at backend
   - Per-device tracking
   - Graceful degradation

## Edge Cases Handled

1. **No cameras found**
   - Shows manual setup option
   - Offers traditional installer

2. **Rate limit exceeded**
   - Clear messaging
   - Upgrade path shown
   - Falls back to traditional setup

3. **Network issues**
   - Timeout handling
   - Retry logic
   - Offline detection

4. **Camera auth failure**
   - Tries common credentials
   - Shows credential prompt
   - Can skip to manual

## Future Enhancements

1. **Demo video fallback**
   - If no camera found, show demo video
   - Still interactive with AI

2. **Mobile companion**
   - QR code for mobile setup assist
   - Remote camera discovery

3. **Voice interaction**
   - "Hey Anava, watch for deliveries"
   - Natural language camera control

4. **Multi-camera demo**
   - Discover all cameras
   - Show grid view
   - Orchestrated AI analysis

## Troubleshooting

### "Failed to check device status"
- Ensure backend is deployed
- Check .env file has correct URLs
- Verify Cloud Functions are accessible

### "No cameras found"
- Check camera is on same network
- Verify credentials are anava/baton
- Try manual IP entry

### "Rate limit exceeded"
- Device has used demo quota
- Use traditional setup
- Or deploy your own backend

## Metrics

Track these KPIs:
- Time to first AI response (target: <30s)
- Demo completion rate (target: >90%)
- Conversion to full setup (target: >50%)
- Error rate (target: <5%)