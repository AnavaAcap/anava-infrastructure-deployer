#!/bin/bash

echo "Building and running Anava Vision with GPU completely disabled..."

# First rebuild with all fixes
npm run build:main

# Set EVERY possible environment variable to disable GPU
export ELECTRON_DISABLE_GPU=1
export ELECTRON_DISABLE_HARDWARE_ACCELERATION=true
export ELECTRON_NO_SANDBOX=1
export DISPLAY=
export LIBGL_ALWAYS_SOFTWARE=1
export CHROMIUM_FLAGS="--disable-gpu --disable-gpu-compositing --disable-gpu-rasterization --disable-gpu-sandbox --no-sandbox"

# Run the app with all GPU features disabled
"release/mac-arm64/Anava Vision.app/Contents/MacOS/Anava Vision" \
  --disable-gpu \
  --disable-gpu-compositing \
  --disable-gpu-rasterization \
  --disable-gpu-sandbox \
  --disable-software-rasterizer \
  --disable-accelerated-2d-canvas \
  --disable-accelerated-video-decode \
  --no-sandbox \
  --single-process