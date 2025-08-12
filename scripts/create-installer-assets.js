#!/usr/bin/env node

/**
 * Create placeholder BMP files for Windows installer
 * These are required by NSIS installer but can be simple placeholders
 */

const fs = require('fs');
const path = require('path');

// Simple BMP header for a 1x1 pixel image
function createMinimalBMP(width = 1, height = 1, color = [255, 255, 255]) {
  const fileSize = 54 + (width * height * 3); // Header + pixel data
  const buffer = Buffer.alloc(fileSize);
  
  // BMP Header
  buffer.write('BM', 0); // Signature
  buffer.writeUInt32LE(fileSize, 2); // File size
  buffer.writeUInt32LE(0, 6); // Reserved
  buffer.writeUInt32LE(54, 10); // Offset to pixel data
  
  // DIB Header (BITMAPINFOHEADER)
  buffer.writeUInt32LE(40, 14); // Header size
  buffer.writeInt32LE(width, 18); // Width
  buffer.writeInt32LE(height, 22); // Height
  buffer.writeUInt16LE(1, 26); // Planes
  buffer.writeUInt16LE(24, 28); // Bits per pixel
  buffer.writeUInt32LE(0, 30); // Compression (none)
  buffer.writeUInt32LE(width * height * 3, 34); // Image size
  buffer.writeInt32LE(2835, 38); // X pixels per meter
  buffer.writeInt32LE(2835, 42); // Y pixels per meter
  buffer.writeUInt32LE(0, 46); // Colors used
  buffer.writeUInt32LE(0, 50); // Important colors
  
  // Pixel data (BGR format)
  for (let i = 0; i < width * height; i++) {
    buffer[54 + i * 3] = color[2]; // Blue
    buffer[54 + i * 3 + 1] = color[1]; // Green
    buffer[54 + i * 3 + 2] = color[0]; // Red
  }
  
  return buffer;
}

const assetsDir = path.join(__dirname, '..', 'assets');

// Create installer sidebar BMP (164x314 pixels, white background)
const sidebarPath = path.join(assetsDir, 'installerSidebar.bmp');
if (!fs.existsSync(sidebarPath) || fs.statSync(sidebarPath).size === 0) {
  const sidebarBmp = createMinimalBMP(164, 314, [250, 250, 250]);
  fs.writeFileSync(sidebarPath, sidebarBmp);
  console.log('Created installerSidebar.bmp');
}

// Create installer header BMP (150x57 pixels, white background)
const headerPath = path.join(assetsDir, 'installerHeader.bmp');
if (!fs.existsSync(headerPath)) {
  const headerBmp = createMinimalBMP(150, 57, [250, 250, 250]);
  fs.writeFileSync(headerPath, headerBmp);
  console.log('Created installerHeader.bmp');
}

console.log('Installer assets created successfully');