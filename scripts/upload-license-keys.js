#!/usr/bin/env node

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');

// Initialize Firebase Admin
const serviceAccount = require('../firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'anava-ai'
});

const db = admin.firestore();

async function uploadLicenseKeys(csvPath) {
  try {
    console.log('Reading CSV file...');
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Parse CSV
    const records = csv.parse(fileContent, {
      columns: true,
      skip_empty_lines: true
    });
    
    console.log(`Found ${records.length} license keys to upload`);
    
    // Process in batches of 500 (Firestore limit)
    const batchSize = 500;
    let successCount = 0;
    let skipCount = 0;
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = db.batch();
      const batchRecords = records.slice(i, Math.min(i + batchSize, records.length));
      
      for (const record of batchRecords) {
        const licenseKey = record['License Code']?.trim();
        const status = record['Status']?.trim();
        
        if (!licenseKey) {
          console.warn('Skipping empty license key');
          skipCount++;
          continue;
        }
        
        // Use the license key as the document ID for easy duplicate detection
        const keyRef = db.collection('axis_keys').doc(licenseKey);
        
        batch.set(keyRef, {
          key_string: licenseKey,
          status: status === 'Active' ? 'available' : 'inactive',
          original_status: status,
          application_name: record['Application Name']?.trim() || 'Anava.ai',
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          uploaded_at: new Date().toISOString()
        }, { merge: false }); // Don't overwrite existing keys
        
        successCount++;
      }
      
      console.log(`Committing batch ${Math.floor(i / batchSize) + 1}...`);
      await batch.commit();
    }
    
    // Update statistics
    console.log('Updating license statistics...');
    const statsRef = db.collection('admin_config').doc('license_stats');
    
    // Get current stats
    const statsDoc = await statsRef.get();
    const currentStats = statsDoc.exists ? statsDoc.data() : { total_keys: 0, available_keys: 0 };
    
    // Count available keys
    const availableCount = await db.collection('axis_keys')
      .where('status', '==', 'available')
      .count()
      .get();
    
    await statsRef.set({
      total_keys: availableCount.data().count,
      available_keys: availableCount.data().count,
      last_updated: admin.firestore.FieldValue.serverTimestamp(),
      last_upload: new Date().toISOString(),
      upload_count: successCount
    }, { merge: true });
    
    console.log('\n✅ Upload completed successfully!');
    console.log(`   - Keys processed: ${successCount}`);
    console.log(`   - Keys skipped: ${skipCount}`);
    console.log(`   - Total available keys in database: ${availableCount.data().count}`);
    
  } catch (error) {
    console.error('Error uploading license keys:', error);
    process.exit(1);
  }
}

// Main execution
const csvPath = process.argv[2];

if (!csvPath) {
  console.error('Usage: node upload-license-keys.js <path-to-csv>');
  console.error('Example: node upload-license-keys.js /Users/ryanwager/Downloads/LicenseCodes-Anava.ai_cloud.csv');
  process.exit(1);
}

if (!fs.existsSync(csvPath)) {
  console.error(`CSV file not found: ${csvPath}`);
  process.exit(1);
}

console.log('🔑 Anava License Key Uploader');
console.log('============================');
console.log(`Project: anava-ai`);
console.log(`CSV File: ${csvPath}`);
console.log('');

uploadLicenseKeys(csvPath).then(() => {
  console.log('\nDone! Exiting...');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});