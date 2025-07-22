#!/bin/bash

# Development launch script for Anava Infrastructure Deployer

echo "🚀 Starting Anava Infrastructure Deployer in development mode..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start Vite dev server in background
echo "🎨 Starting Vite dev server..."
npm run dev:renderer &
VITE_PID=$!

# Wait for Vite to start
echo "⏳ Waiting for Vite dev server to start..."
sleep 3

# Compile TypeScript for main process
echo "🔨 Building main process..."
npm run build:main

# Start the Electron app
echo "🚀 Starting Electron..."
NODE_ENV=development npm run dev

# Kill Vite when done
kill $VITE_PID