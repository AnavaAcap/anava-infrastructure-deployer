#!/usr/bin/env node

/**
 * Test script to validate Axis device response pattern matching
 */

// Sample response from actual Axis camera
const axisResponse = `root.Brand.Brand=AXIS
root.Brand.ProdFullName=AXIS M3215-LVE Dome Camera
root.Brand.ProdNbr=M3215-LVE
root.Brand.ProdShortName=AXIS M3215-LVE
root.Brand.ProdType=Dome Camera
root.Brand.ProdVariant=
root.Brand.WebURL=http://www.axis.com`;

// Sample response from Axis speaker
const speakerResponse = `root.Brand.Brand=AXIS
root.Brand.ProdFullName=AXIS C1310-E Network Speaker
root.Brand.ProdNbr=C1310-E
root.Brand.ProdShortName=AXIS C1310-E
root.Brand.ProdType=Network Speaker
root.Brand.ProdVariant=
root.Brand.WebURL=http://www.axis.com`;

// Old format (legacy devices)
const oldFormatResponse = `Brand=AXIS
ProdFullName=AXIS P3367-VE Network Camera
ProdNbr=P3367-VE
ProdShortName=AXIS P3367-VE
ProdType=Network Camera
ProdVariant=
WebURL=http://www.axis.com`;

function testPatternMatching(response, description) {
  console.log(`\nTesting: ${description}`);
  console.log('=' .repeat(50));
  
  // Test if it's an Axis device
  const isAxis = response.includes('Brand=AXIS') || response.includes('root.Brand.Brand=AXIS');
  console.log(`Is Axis device: ${isAxis ? '✓' : '✗'}`);
  
  // Extract model number with new regex
  const modelMatch = response.match(/(?:root\.Brand\.)?ProdNbr=([^\r\n]+)/);
  const model = modelMatch ? modelMatch[1] : 'Unknown';
  console.log(`Model: ${model}`);
  
  // Extract product type with new regex
  const typeMatch = response.match(/(?:root\.Brand\.)?ProdType=([^\r\n]+)/);
  const productType = typeMatch ? typeMatch[1] : 'Unknown';
  console.log(`Product Type: ${productType}`);
  
  // Determine if it's a speaker
  const isSpeaker = productType.toLowerCase().includes('speaker') || 
                    productType.toLowerCase().includes('audio') ||
                    productType.toLowerCase().includes('sound');
  console.log(`Is Speaker: ${isSpeaker ? '✓' : '✗'}`);
  console.log(`Is Camera: ${!isSpeaker ? '✓' : '✗'}`);
  
  return {
    isAxis,
    model,
    productType,
    isSpeaker,
    isCamera: !isSpeaker
  };
}

// Run tests
console.log('=== Axis Pattern Matching Tests ===\n');

const cameraResult = testPatternMatching(axisResponse, 'Current Axis Camera Format');
const speakerResult = testPatternMatching(speakerResponse, 'Axis Speaker Format');
const oldResult = testPatternMatching(oldFormatResponse, 'Legacy Axis Format');

// Summary
console.log('\n\n=== SUMMARY ===');
console.log(`Camera detection working: ${cameraResult.isAxis && cameraResult.isCamera ? '✓' : '✗'}`);
console.log(`Speaker detection working: ${speakerResult.isAxis && speakerResult.isSpeaker ? '✓' : '✗'}`);
console.log(`Legacy format working: ${oldResult.isAxis && oldResult.isCamera ? '✓' : '✗'}`);

// Test edge cases
console.log('\n\n=== Edge Cases ===');

// Test with extra whitespace
const withWhitespace = `  root.Brand.Brand=AXIS  
  root.Brand.ProdNbr=TEST-123  
  root.Brand.ProdType=Dome Camera  `;
const wsResult = testPatternMatching(withWhitespace, 'Response with whitespace');

// Test mixed case
const mixedCase = `root.Brand.Brand=AXIS
root.Brand.ProdType=Network SPEAKER System`;
const mcResult = testPatternMatching(mixedCase, 'Mixed case speaker');

console.log('\n✓ All pattern matching tests complete!');