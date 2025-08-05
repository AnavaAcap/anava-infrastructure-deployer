# Manual License Key Upload Instructions

## Prerequisites
1. Firebase CLI authenticated: `firebase login --reauth`
2. Cloud Functions deployed to anava-ai project
3. License keys prepared in JSON format

## Steps to Upload License Keys

### 1. Deploy the Cloud Functions
```bash
cd /Users/ryanwager/anava-infrastructure-deployer
firebase deploy --only functions
```

### 2. Verify Functions are Deployed
```bash
gcloud functions list --project=anava-ai
```

You should see:
- assignAxisKey
- uploadLicenseKeys
- getLicenseStats

### 3. Upload License Keys via Firebase Console

Option A: Using Firebase Console
1. Go to https://console.firebase.google.com/project/anava-ai/firestore
2. Create collection `axis_keys`
3. For each license key, create a document with ID = license key
4. Document structure:
   ```json
   {
     "key_string": "LICENSE-KEY-HERE",
     "status": "available",
     "created_at": SERVER_TIMESTAMP
   }
   ```

Option B: Using Admin SDK Script
1. Get service account key from Firebase Console:
   - Go to Project Settings > Service Accounts
   - Generate new private key
   - Save as `firebase-admin-key.json`

2. Run the upload script:
   ```bash
   node scripts/upload-license-keys.js /Users/ryanwager/Downloads/LicenseCodes-Anava.ai_cloud.csv
   ```

### 4. Initialize Statistics Document
In Firestore, create:
- Collection: `admin_config`
- Document ID: `license_stats`
- Data:
  ```json
  {
    "total_keys": 50,
    "available_keys": 50,
    "last_updated": SERVER_TIMESTAMP
  }
  ```

### 5. Test the System
```bash
# Test with a trial user
curl -X POST https://us-central1-anava-ai.cloudfunctions.net/assignAxisKey \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{}'
```

## Prepared License Keys
The license keys have been extracted and saved to:
`/Users/ryanwager/Downloads/license-keys-for-upload.json`

Total keys: 50
First 5 keys:
- FJNZXYZUE7BEGZ2W32EJ
- 3ERMFVYB5ZUSFAXACRUC
- Z5E3EEXFVJMSKE5BBPZS
- GUQ2RKGBRYYNCCWWQH5H
- 6AQLZL6TFWMKWNUYVWPV

## Firebase Config Update
The Firebase configuration has been updated in:
`/src/renderer/pages/CameraSetupPage.tsx`

New config uses the correct API key for anava-ai project:
- API Key: AIzaSyCJbWAa-zQir1v8kmlye8Kv3kmhPb9r18s
- Project ID: anava-ai

## Next Steps
1. Authenticate with Firebase CLI
2. Deploy the Cloud Functions
3. Upload the license keys
4. Test the trial license flow in the app