# Trial License System - Ready for Testing!

## ✅ What's Been Set Up

### 1. Firebase Configuration Fixed
- Correct API key: `AIzaSyCJbWAa-zQir1v8kmlye8Kv3kmhPb9r18s`
- Correct app ID: `1:392865621461:web:15db206ae4e9c72f7dc95c`
- Project: `anava-ai`

### 2. Cloud Functions Deployed
- `assignAxisKey` - Assigns licenses to authenticated users
- `uploadLicenseKeys` - Admin function to bulk upload keys
- `getLicenseStats` - Check available license counts

### 3. License Keys Uploaded
- 50 license keys uploaded to Firestore
- Collection: `axis_keys`
- Status: All marked as "available"

### 4. Email Tracking
The system tracks:
- `assigned_to_email` - Email of user who claimed the key
- `assigned_to_uid` - Firebase Auth UID
- `assigned_at` - Timestamp of assignment

## 🧪 Testing the Trial License Flow

1. **Build and run the app**
   ```bash
   npm run electron:dev
   ```

2. **Test scenarios:**
   - Click "Get Trial License Automatically" 
   - Should create a trial user (email: `trial-{timestamp}@anava.ai`)
   - Should assign one of the 50 uploaded licenses
   - Should store the license for camera deployment

3. **Verify in Firebase Console:**
   - Check Firestore `axis_keys` collection
   - Assigned keys will have status "assigned" 
   - Will show email and timestamp

## 📊 Monitor License Usage

View assigned licenses:
```
https://console.firebase.google.com/project/anava-ai/firestore/data/~2Faxis_keys
```

Check stats:
```
https://console.firebase.google.com/project/anava-ai/firestore/data/~2Fadmin_config~2Flicense_stats
```

## 🔐 Manual License Entry
The manual license key option remains available as a fallback if users already have a license.

## ⚠️ Production Functions Status
All production functions have been restored and are running:
- ✅ elevenLabsProxy
- ✅ geminiProxy  
- ✅ mailchimpProxy
- ✅ stripeWebhook