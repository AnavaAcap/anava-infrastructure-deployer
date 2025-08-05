#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');

// This script prepares the license keys for upload via the Cloud Function

async function prepareLicenseKeys(csvPath) {
  try {
    console.log('Reading CSV file...');
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Parse CSV
    const records = csv.parse(fileContent, {
      columns: true,
      skip_empty_lines: true
    });
    
    console.log(`Found ${records.length} license keys`);
    
    // Extract just the license codes
    const licenseKeys = [];
    
    for (const record of records) {
      const licenseKey = record['License Code']?.trim();
      const status = record['Status']?.trim();
      
      if (licenseKey && status === 'Active') {
        licenseKeys.push(licenseKey);
      }
    }
    
    console.log(`\nExtracted ${licenseKeys.length} active license keys`);
    
    // Create output for the Cloud Function
    const output = {
      keys: licenseKeys,
      metadata: {
        source: 'LicenseCodes-Anava.ai_cloud.csv',
        count: licenseKeys.length,
        timestamp: new Date().toISOString()
      }
    };
    
    // Save to a JSON file
    const outputPath = path.join(path.dirname(csvPath), 'license-keys-for-upload.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    
    console.log(`\n✅ License keys prepared for upload!`);
    console.log(`   Output saved to: ${outputPath}`);
    console.log(`\nNext steps:`);
    console.log(`1. Deploy the Cloud Functions to anava-ai project`);
    console.log(`2. Use the uploadLicenseKeys function with the generated JSON`);
    console.log(`\nExample keys (first 5):`);
    licenseKeys.slice(0, 5).forEach(key => console.log(`   - ${key}`));
    
    return output;
    
  } catch (error) {
    console.error('Error preparing license keys:', error);
    process.exit(1);
  }
}

// Main execution
const csvPath = process.argv[2] || '/Users/ryanwager/Downloads/LicenseCodes-Anava.ai_cloud.csv';

if (!fs.existsSync(csvPath)) {
  console.error(`CSV file not found: ${csvPath}`);
  process.exit(1);
}

console.log('🔑 Anava License Key Preparation');
console.log('================================');
console.log(`CSV File: ${csvPath}`);
console.log('');

prepareLicenseKeys(csvPath).then(() => {
  console.log('\nDone!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});