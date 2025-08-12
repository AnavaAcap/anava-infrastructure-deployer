#!/usr/bin/env node

/**
 * Generate a unique GUID for each build to prevent registry conflicts
 * This ensures each installation has a unique identifier in Windows registry
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generateGUID() {
  // Generate a UUID v4
  const bytes = crypto.randomBytes(16);
  
  // Set version (4) and variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  
  // Format as GUID string
  const hex = bytes.toString('hex');
  const guid = [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20, 32)
  ].join('-').toUpperCase();
  
  return `{${guid}}`;
}

// Generate new GUID
const newGuid = generateGUID();

// Set as environment variable for the build process
process.env.INSTALLER_GUID = newGuid;

// Also write to a temporary file for the build
const tempFile = path.join(__dirname, '..', '.installer-guid');
fs.writeFileSync(tempFile, newGuid);

console.log(`Generated INSTALLER_GUID: ${newGuid}`);

// Update the NSIS script if it exists
const nsisScriptPath = path.join(__dirname, '..', 'installer-scripts', 'installer-fixed.nsh');
if (fs.existsSync(nsisScriptPath)) {
  let content = fs.readFileSync(nsisScriptPath, 'utf8');
  
  // Replace the GUID placeholder
  content = content.replace(
    /!define PRODUCT_GUID "[^"]+"/,
    `!define PRODUCT_GUID "${newGuid}"`
  );
  
  fs.writeFileSync(nsisScriptPath, content);
  console.log('Updated NSIS script with new GUID');
}

// Export for use in electron-builder
module.exports = { guid: newGuid };