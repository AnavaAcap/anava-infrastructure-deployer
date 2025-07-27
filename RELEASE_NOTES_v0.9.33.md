# Release Notes - v0.9.33

## 🎉 Major Achievement: Complete Firebase Automation!

This release represents a significant milestone - **Firebase Authentication is now fully automated** using Terraform, eliminating the need for manual "Get Started" clicks in the Firebase Console!

## 🚀 Key Features

### 1. **Terraform Integration for Firebase Auth** (v0.9.26)
- Integrated Terraform to programmatically initialize Firebase Authentication
- Automatic Terraform binary download during `npm install`
- No more manual Firebase Console steps required!
- Both Email/Password and Anonymous authentication enabled automatically

### 2. **Critical Bug Fixes**
- **v0.9.27**: Extended project creation retry from 10s to 3+ minutes
- **v0.9.30**: Fixed auth test GCP token verification for WIF tokens
- **v0.9.31**: Fixed TypeScript build errors
- **v0.9.32**: Fixed Firebase Storage service agent IAM timing issue
- **v0.9.33**: Fixed Firebase Storage bucket creation to use proper default bucket

### 3. **Improved Resilience**
- Better handling of GCP eventual consistency
- Smart retry logic with exponential backoff
- Parallel operation optimization
- Improved error messages and recovery suggestions

## 📋 Technical Details

### Firebase Automation
- Uses Terraform's `google_identity_platform_config` resource
- Programmatically equivalent to clicking "Get Started" in Firebase Console
- Automatically configures email/password and anonymous authentication
- Sets up authorized domains for OAuth redirects

### Firebase Storage Improvements
- Now uses `defaultBucket:add` API to create proper `{projectId}.appspot.com` bucket
- Falls back to custom bucket only if default creation fails
- Proper Firebase Storage service agent permission handling

### Other Improvements
- Fixed deployment order (IAM roles before Firestore setup)
- Fixed service account permission format handling
- Removed verbose Terraform logging
- Added Google authentication provider setup

## 🔧 Breaking Changes
None - all changes are backward compatible

## 📚 Documentation
All changes are documented in `CLAUDE.md` with detailed version history.

## 🙏 Acknowledgments
Special thanks to Gemini for the insights on using Terraform for Firebase initialization!

---

## Deployment is now smoother than ever! 🚀

No more manual Firebase initialization steps - everything is automated!