#!/usr/bin/env node

// Test script to verify ACAP selection logic
const path = require('path');
const os = require('os');

// Simulate available ACAP files
const availableAcaps = [
  {
    filename: 'signed_Anava_-_Analyze_3_7_65_aarch64_os11.eap',
    name: 'Anava Analyze 3.7.65 (aarch64/OS11)',
    architecture: 'aarch64',
    isDownloaded: true
  },
  {
    filename: 'signed_Anava_-_Analyze_3_7_65_aarch64_os12.eap',
    name: 'Anava Analyze 3.7.65 (aarch64/OS12)',
    architecture: 'aarch64',
    isDownloaded: true
  },
  {
    filename: 'signed_Anava_-_Analyze_3_7_65_armv7hf_os11.eap',
    name: 'Anava Analyze 3.7.65 (armv7hf/OS11)',
    architecture: 'armv7hf',
    isDownloaded: true
  },
  {
    filename: 'signed_Anava_-_Analyze_3_7_65_armv7hf_os12.eap',
    name: 'Anava Analyze 3.7.65 (armv7hf/OS12)',
    architecture: 'armv7hf',
    isDownloaded: false // Not downloaded
  }
];

// Test scenarios
const testScenarios = [
  {
    name: 'Camera with OS12 and aarch64 (Current camera)',
    firmwareVersion: '12.5.68',
    osVersion: 'OS12',
    architecture: 'aarch64',
    expectedFile: 'signed_Anava_-_Analyze_3_7_65_aarch64_os12.eap'
  },
  {
    name: 'Camera with OS11 and aarch64',
    firmwareVersion: '10.12.186',
    osVersion: 'OS11',
    architecture: 'aarch64',
    expectedFile: 'signed_Anava_-_Analyze_3_7_65_aarch64_os11.eap'
  },
  {
    name: 'Camera with OS12 and armv7hf (not downloaded)',
    firmwareVersion: '11.5.50',
    osVersion: 'OS12',
    architecture: 'armv7hf',
    expectedFile: null // Should fail as file not downloaded
  },
  {
    name: 'Camera with OS11 and armv7hf',
    firmwareVersion: '10.9.120',
    osVersion: 'OS11',
    architecture: 'armv7hf',
    expectedFile: 'signed_Anava_-_Analyze_3_7_65_armv7hf_os11.eap'
  }
];

function selectACAPForCamera(firmwareInfo, availableAcaps) {
  console.log(`\nSelecting ACAP for: ${firmwareInfo.osVersion}, ${firmwareInfo.architecture}`);
  
  const osVersionLower = firmwareInfo.osVersion.toLowerCase();
  const matchingAcap = availableAcaps.find(acap => {
    const filename = acap.filename.toLowerCase();
    
    // Check if filename contains the OS version
    const hasCorrectOS = filename.includes(osVersionLower);
    
    // Check if filename contains the architecture
    const hasCorrectArch = !firmwareInfo.architecture || 
                          filename.includes(firmwareInfo.architecture) ||
                          (firmwareInfo.architecture === 'aarch64' && filename.includes('aarch64'));
    
    console.log(`  Checking ${acap.filename}:`);
    console.log(`    OS match: ${hasCorrectOS} (looking for ${osVersionLower})`);
    console.log(`    Arch match: ${hasCorrectArch} (looking for ${firmwareInfo.architecture})`);
    console.log(`    Downloaded: ${acap.isDownloaded}`);
    
    return hasCorrectOS && hasCorrectArch && acap.isDownloaded;
  });
  
  if (matchingAcap) {
    console.log(`  ✓ Selected: ${matchingAcap.filename}`);
    return matchingAcap.filename;
  } else {
    console.log(`  ✗ No suitable ACAP found`);
    return null;
  }
}

function parseFirmwareVersion(version) {
  const parts = version.split('.');
  const majorVersion = parseInt(parts[0], 10);
  return majorVersion >= 11 ? 'OS12' : 'OS11';
}

console.log('=== ACAP Selection Logic Test ===\n');
console.log('Available ACAPs:');
availableAcaps.forEach(acap => {
  console.log(`  - ${acap.filename} (Downloaded: ${acap.isDownloaded})`);
});

console.log('\n=== Running Test Scenarios ===');

let passed = 0;
let failed = 0;

testScenarios.forEach((scenario, index) => {
  console.log(`\nTest ${index + 1}: ${scenario.name}`);
  console.log(`  Firmware: ${scenario.firmwareVersion}`);
  console.log(`  Expected OS: ${scenario.osVersion}`);
  console.log(`  Architecture: ${scenario.architecture}`);
  console.log(`  Expected ACAP: ${scenario.expectedFile || 'None (should fail)'}`);
  
  // Test OS version detection
  const detectedOS = parseFirmwareVersion(scenario.firmwareVersion);
  if (detectedOS !== scenario.osVersion) {
    console.log(`  ✗ OS detection failed: detected ${detectedOS}, expected ${scenario.osVersion}`);
    failed++;
    return;
  }
  console.log(`  ✓ OS detection correct: ${detectedOS}`);
  
  // Test ACAP selection
  const selectedFile = selectACAPForCamera(scenario, availableAcaps);
  
  if (selectedFile === scenario.expectedFile) {
    console.log(`  ✓ ACAP selection correct${selectedFile ? `: ${selectedFile}` : ' (no file as expected)'}`);
    passed++;
  } else {
    console.log(`  ✗ ACAP selection failed:`);
    console.log(`    Expected: ${scenario.expectedFile}`);
    console.log(`    Got: ${selectedFile}`);
    failed++;
  }
});

console.log('\n=== Test Results ===');
console.log(`Passed: ${passed}/${testScenarios.length}`);
console.log(`Failed: ${failed}/${testScenarios.length}`);

if (failed === 0) {
  console.log('\n✓ All tests passed!');
} else {
  console.log('\n✗ Some tests failed!');
  process.exit(1);
}