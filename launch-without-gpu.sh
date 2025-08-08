#!/bin/bash

# This script launches the app with GPU completely disabled
# For macOS 15 Sequoia compatibility

APP_PATH="release/mac-arm64/Anava Vision.app/Contents/MacOS/Anava Vision"

# Kill any existing instances
pkill -f "Anava Vision" 2>/dev/null

echo "Launching Anava Vision with GPU disabled for macOS 15 Sequoia..."
echo "This is a workaround for the GPU process crash issue."
echo ""

# Launch with all possible GPU-disabling flags
"$APP_PATH" \
  --disable-gpu \
  --disable-gpu-compositing \
  --disable-gpu-rasterization \
  --disable-gpu-sandbox \
  --disable-accelerated-2d-canvas \
  --disable-accelerated-video-decode \
  --use-gl=swiftshader \
  --force-cpu-draw