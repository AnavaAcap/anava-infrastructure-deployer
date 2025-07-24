# Vision Interface Documentation

## Overview

The Vision interface in the Anava Unified Installer provides a visual command interface for interacting with deployed cameras via the Anava MCP (Model Context Protocol) server. This allows users to:

- Connect to cameras directly from the installer
- Send commands and receive responses
- Capture images and analyze them with AI
- Use text-to-speech to make cameras speak
- Monitor camera events
- Execute Holy Grail development commands

## Getting Started

1. **Navigate to Vision**: Click on "Vision" in the sidebar navigation
2. **Camera Connections**: The interface will automatically detect:
   - Cameras configured during ACAP deployment
   - Pre-configured test camera (192.168.50.156)
   - Custom camera connections you add

## Features

### Connection Management

- **Add Connection**: Click the edit icon to add new camera connections
- **Edit Connection**: Modify existing camera credentials and settings
- **Select Active Connection**: Choose which camera to interact with from the dropdown

### Quick Commands

Use the quick command chips for common operations:
- **Capture Image**: Takes a snapshot from the camera
- **What do you see?**: Captures and analyzes the image with AI
- **Speak: Hello**: Makes the camera speak through its speaker
- **Get Events**: Retrieves recent camera events

### Command Interface

Type commands directly in the input field:

#### Basic Commands
- `capture` - Capture an image
- `analyze [prompt]` - Capture and analyze with optional custom prompt
- `ask [question]` - Same as analyze
- `speak [text]` - Text-to-speech through camera speaker
- `events` - Get recent events

#### Holy Grail Commands
- `holy_grail_cycle` - Run complete development cycle
- `holy_grail_deploy` - Deploy code to camera
- `holy_grail_test` - Run tests
- `holy_grail_monitor` - Monitor camera logs
- `holy_grail_trigger_analysis` - Trigger analysis
- `holy_grail_get_config` - Get configuration
- `holy_grail_set_config` - Set configuration

### Visual Feedback

- **Connection Status**: Shows whether MCP server is running
- **Command History**: See all commands and responses
- **Success/Error Indicators**: Visual feedback for each command
- **Real-time Updates**: Responses appear as they're received

## Configuration

### Camera Connection Settings
- **Host**: Camera IP address (e.g., 192.168.50.156)
- **Username**: Camera username (typically 'root')
- **Password**: Camera password
- **Port**: HTTPS port (default: 443)
- **Use HTTPS**: Enable secure connection

### API Keys (Optional)
The MCP server supports additional features with API keys:
- **ElevenLabs API Key**: For enhanced text-to-speech voices
- **Google/Gemini API Key**: For advanced AI analysis

## Architecture

```
Electron App (Renderer)
    ↓
Vision Page Component
    ↓
IPC Communication
    ↓
Vision Service (Main Process)
    ↓
MCP Server Process (Child)
    ↓
MCP Client (StdIO Transport)
    ↓
Camera API (HTTPS)
```

## Troubleshooting

### MCP Server Won't Start
1. Check that @anava/mcp-server is installed
2. Verify camera credentials are correct
3. Ensure camera is accessible on the network

### Commands Fail
1. Verify you're connected (green status indicator)
2. Check camera has required features (audio, ACAP installed)
3. Review error messages in command history

### Connection Issues
1. Test camera access: `ping [camera-ip]`
2. Verify HTTPS is enabled on camera
3. Check firewall settings

## Security Notes

- Camera credentials are stored locally in the app's user data directory
- Connections use HTTPS by default
- MCP server runs as a child process with limited permissions
- No cloud services required - all processing is local

## Future Enhancements

- WebRTC audio streaming support
- Multi-camera simultaneous control
- Custom command macros
- Export/import connection configurations
- Integration with Claude Desktop MCP

## Development

To modify the Vision interface:

1. Frontend: `src/renderer/pages/vision/VisionPage.tsx`
2. Backend: `src/main/services/visionService.ts`
3. MCP Server: `/Users/ryanwager/anava-mcp-server/`

The MCP server is bundled in `resources/mcp-server/` for distribution.