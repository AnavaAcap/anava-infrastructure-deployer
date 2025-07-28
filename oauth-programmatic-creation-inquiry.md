# Programmatic OAuth Client Creation for Firebase Google Sign-In

## Context and Problem Statement

We're building an automated infrastructure deployment tool that sets up Firebase Authentication with Google Sign-In provider. We've successfully automated most of the process using the Identity Platform API, but we're blocked on one critical step: creating OAuth2 client credentials (clientId and clientSecret) programmatically.

### Current Situation

1. **Identity Platform API Requirements**:
   - The `idpConfigs` endpoint requires non-empty `clientId` and `clientSecret` fields
   - These correspond to OAuth 2.0 Web Application credentials in GCP

2. **What Firebase Console Does**:
   - When enabling Google Sign-In in Firebase Console, it automatically creates OAuth credentials
   - This happens behind the scenes using internal Google APIs
   - The consent screen is auto-configured as "Internal" type

3. **Our Attempts So Far**:
   - **OAuth2 API**: Returns 403 "Access Not Configured" even with all permissions
   - **IAP OAuth Brands**: Requires "Internal" type which needs Google Workspace domain
   - **Service Account Keys**: Not suitable - they don't provide OAuth clientId/clientSecret
   - **Direct API calls**: The OAuth2 management APIs seem completely inaccessible

4. **Technical Details**:
   ```typescript
   // This is what we need to configure programmatically:
   {
     "signInOptions": [{
       "provider": "google.com",
       "enabled": true,
       "clientId": "XXXXXXX.apps.googleusercontent.com",  // Need to create this
       "clientSecret": "GOCSPX-XXXXXXXXXX"                // And this
     }]
   }
   ```

## Specific Questions for Gemini

### 1. Direct OAuth Client Creation
**Is there any programmatic API (documented or undocumented) that allows creating OAuth2 Web Application credentials without requiring a pre-existing consent screen?**
- Are there internal Google APIs that Firebase Console uses that we could potentially access?
- Is there a way to use the OAuth2 v2 API directly that bypasses the "Access Not Configured" error?

### 2. Service Account Approaches
**Can service account impersonation or domain-wide delegation be used to create OAuth clients on behalf of a user?**
- Could a service account with domain-wide delegation create OAuth apps in a Google Workspace domain?
- Is there a way to use Application Default Credentials to create OAuth clients as if we were the project owner?

### 3. Alternative APIs
**Are there any alternative Google APIs that can create OAuth credentials?**
- Google Workspace Admin SDK?
- Cloud Identity API?
- Any beta or alpha APIs in development?
- Firebase Management API internal endpoints?

### 4. Consent Screen Automation
**If we must have a consent screen first, is there ANY way to create one programmatically?**
- For non-Google Workspace domains?
- Using service accounts or impersonation?
- Any workarounds for the "Internal" type requirement?

### 5. Firebase-Specific Solutions
**Are there Firebase-specific APIs or methods we're missing?**
- Does Firebase have any special endpoints for OAuth setup?
- Can we leverage Firebase's relationship with GCP to bypass normal OAuth restrictions?
- Are there any Firebase SDK methods that handle this behind the scenes?

### 6. Future Roadmap
**Are there any planned or beta features that would enable this?**
- Upcoming Identity Platform API enhancements?
- New Firebase automation features?
- Changes to OAuth2 API accessibility?

## Use Case Justification

We're building a legitimate infrastructure automation tool for deploying security camera analytics systems. The tool needs to:
- Create GCP projects and enable APIs
- Set up Firebase Authentication for device authentication
- Configure Google Sign-In for admin users
- Deploy Cloud Functions and API Gateway

Everything else is automated except this OAuth client creation step, which breaks our "zero manual steps" goal.

## Ideal Solution

The ideal solution would be an API call (or series of calls) that:
1. Creates OAuth2 Web Application credentials programmatically
2. Returns the clientId and clientSecret
3. Works with service account authentication
4. Doesn't require manual consent screen setup
5. Produces the same result as clicking "Enable" in Firebase Console

## What We've Tried (Detailed)

1. **OAuth2 v2 API**:
   ```bash
   POST https://oauth2.googleapis.com/v2/oauth2/auth/applications
   # Result: 403 Access Not Configured
   ```

2. **IAP OAuth Brand Creation**:
   ```typescript
   // Creates brand but requires "Internal" type for Firebase compatibility
   // "Internal" requires Google Workspace domain ownership
   ```

3. **Identity Platform Config Endpoint**:
   ```typescript
   // Requires existing clientId/clientSecret - can't create them
   ```

4. **Various Permission Combinations**:
   - Project Owner
   - Firebase Admin
   - Identity Platform Admin
   - OAuth2 Data Access
   - All combinations still result in 403 errors

## Question for Gemini

Given all this context, **is there ANY programmatic path to achieve what Firebase Console does automatically when enabling Google Sign-In?** We're open to any approach, including:
- Undocumented APIs
- Creative workarounds
- Beta features we can request access to
- Alternative authentication flows
- Any other outside-the-box solutions

The key requirement is that it must be fully automatable without manual Console interaction.