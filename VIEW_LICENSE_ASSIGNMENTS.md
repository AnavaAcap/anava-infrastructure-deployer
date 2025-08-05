# How to View License Key Assignments

## Firebase Console - Firestore

1. **Go to Firestore**: https://console.firebase.google.com/project/anava-ai/firestore/data

2. **View assigned keys**:
   - Navigate to: `axis_keys` collection
   - Look for keys with `status: "assigned"`
   - Each assigned key shows:
     - `assigned_to_email`: The trial email that claimed it
     - `assigned_at`: Timestamp of assignment
     - `key_string`: The actual license key

3. **View user assignments**:
   - Navigate to: `users` collection
   - Each document ID is a Firebase Auth UID
   - Shows:
     - `email`: User's email (e.g., trial-1754408609385@anava.ai)
     - `assigned_axis_key`: The key they received
     - `key_assigned_at`: When it was assigned

## Example Query

To find which key was assigned to a specific email:
1. In Firestore, go to `axis_keys` collection
2. Click "Filter" 
3. Add filter: `assigned_to_email` == `trial-1754408609385@anava.ai`

## To see the actual key in logs

The Cloud Function intentionally doesn't log the full key for security. 
You can see `keyLength: 20` but not the actual key value.