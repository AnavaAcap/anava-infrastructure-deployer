#!/bin/bash

echo "🚀 Starting Anava Infrastructure Deployer..."

# Navigate to project directory
cd ~/anava-infrastructure-deployer

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build TypeScript files
echo "🔨 Building TypeScript files..."
npm run build:main

# Start Vite dev server in the background
echo "🌐 Starting Vite dev server..."
npm run dev:renderer > /dev/null 2>&1 &
VITE_PID=$!

# Wait for Vite to be ready
echo "⏳ Waiting for Vite to start..."
until curl -s http://localhost:5173 > /dev/null 2>&1; do
    sleep 1
done
echo "✅ Vite is ready!"

# Start Electron
echo "🖥️  Starting Electron app..."
NODE_ENV=development npm run dev

# Cleanup on exit
trap "kill $VITE_PID 2>/dev/null" EXIT