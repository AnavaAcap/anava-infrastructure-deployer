# Build Configuration

## Production Build Commands

### macOS (Universal Binary)
```bash
APPLE_ID="ryan@anava.ai" \
APPLE_ID_PASSWORD="gbdi-fnth-pxfx-aofv" \
APPLE_APP_SPECIFIC_PASSWORD="gbdi-fnth-pxfx-aofv" \
APPLE_TEAM_ID="3JVZNWGRYT" \
CSC_NAME="Ryan Wager (3JVZNWGRYT)" \
npm run dist:mac
```

### Windows
```bash
npm run dist:win
```

## Key Files
- `vite.config.ts` - Has custom script placement plugin
- `src/main/index.ts` - DevTools auto-open in production
- `package.json` - Version 0.9.178

## Testing
```bash
npx electron dist/main/index.js
```

## Release Upload
Upload to: https://github.com/AnavaAcap/acap-releases/releases/tag/v3.8.1