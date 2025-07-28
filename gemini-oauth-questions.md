# OAuth Client Creation for Firebase - Technical Deep Dive

## The Challenge

We need to programmatically create OAuth 2.0 Web Application credentials (clientId and clientSecret) for Firebase Google Sign-In without manual intervention through the Google Cloud Console.

## What We've Discovered

### 1. The API Requirements
```bash
# This fails - requires clientId
curl -X POST "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs?idpId=google.com" \
  -d '{"enabled": true}'
# Error: "INVALID_CONFIG : client_id cannot be empty."
```

### 2. Firebase Console Magic
When you click "Enable" for Google Sign-In in Firebase Console, it:
- Creates an OAuth 2.0 Web Client automatically
- Configures redirect URIs
- Updates Identity Platform with the credentials
- All through internal/private APIs

### 3. Failed Approaches
- ❌ IAP OAuth brands (wrong type, requires "Internal")
- ❌ Empty/null credentials (API rejects)
- ❌ Identity Platform APIs (requires existing credentials)
- ❌ OAuth2 Service API (seems inaccessible)
- ❌ Placeholder credentials (config accepts but auth fails)

## Questions for Gemini

### 1. Direct OAuth2 API Access
Is there a way to access the OAuth2 API directly to create Web Application credentials? Not the IAP-specific endpoints, but the general OAuth2 client creation API that the Console uses?

### 2. Service Account Magic
Can we use any of these approaches:
- Service account impersonation to create OAuth clients?
- Domain-wide delegation for OAuth client creation?
- Application Default Credentials with special scopes?
- Acting as a service agent that has OAuth creation permissions?

### 3. Alternative Google APIs
Are there other APIs that can create OAuth clients:
- Google Workspace Admin SDK?
- Cloud Identity API?
- Developer Console API?
- Any internal/beta APIs we can request access to?

### 4. Consent Screen Automation
The consent screen seems to be the blocker. Can we:
- Create OAuth clients that don't require consent screens?
- Use a pre-approved consent screen?
- Create "Internal" OAuth clients programmatically (not IAP)?
- Use first-party OAuth flows that bypass consent?

### 5. Firebase-Specific Solutions
Given this is specifically for Firebase:
- Is there a Firebase Admin SDK method we're missing?
- Can Firebase project creation trigger OAuth client creation?
- Are there Firebase-specific OAuth client types?
- Is there a way to use Firebase's own OAuth infrastructure?

### 6. The Nuclear Option
If standard approaches don't work:
- Can we reverse-engineer what the Firebase Console does?
- Are there unpublished but stable APIs we can use?
- Is there a way to automate the Console UI programmatically?
- Can we request special API access for infrastructure tools?

## The Ideal Solution

We need a programmatic way to:
1. Create an OAuth 2.0 Web Application client
2. Get the clientId and clientSecret
3. Configure it for Firebase authentication
4. All without manual Console interaction

## Context: Why This Matters

We're building an infrastructure deployment tool that sets up complete Firebase projects. Manual OAuth setup breaks the "one-click deployment" experience. Even if it requires special permissions or beta API access, any programmatic solution would be valuable.

## Technical Details That Might Help

- Project creation is automated
- We have full project owner permissions
- Service accounts with admin roles are available
- We can enable any APIs needed
- We can use Terraform, gcloud CLI, or REST APIs
- The tool runs on behalf of organization admins

## The Core Question

**Is there ANY programmatic path to create the OAuth credentials that Firebase needs for Google Sign-In, without requiring someone to manually click through the Google Cloud Console?**

Even if it requires:
- Special API access
- Beta features
- Workspace organization setup
- Domain verification
- Or any other prerequisites

We're looking for any possible solution, no matter how complex, as long as it can be automated.