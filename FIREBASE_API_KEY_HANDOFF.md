# Firebase API Key Issue - Handoff Document

## Current Status
The Firebase web app is being created successfully, but the API key is not being returned by the Firebase Management API's `projects.webApps.getConfig` endpoint.

## What We've Tried
1. **Initial Approach**: Added retry loops to wait for API key to appear in getConfig response
2. **Current Approach**: Implemented proper Long-Running Operation (LRO) pattern based on Gemini's recommendation
   - Wait for the web app creation operation to fully complete
   - The operation should ensure all resources (including API key) are provisioned
   - Then call getConfig to retrieve the configuration

## The Problem
Even after waiting for the LRO to complete, `projects.webApps.getConfig` is returning a response WITHOUT the `apiKey` field. According to the API documentation and schema, this field should be present.

## Key Code Locations
1. **Firebase App Deployer**: `/src/main/services/firebaseAppDeployer.ts`
   - `createWebApp()` method (lines 114-144) - waits for LRO to complete
   - `getWebAppConfig()` method (lines 146-201) - retrieves config but apiKey is missing
   - `waitForOperation()` method (lines 219-256) - monitors LRO status

2. **Deployment Engine**: `/src/main/services/deploymentEngine.ts`
   - Calls firebaseAppDeployer.createFirebaseWebApp()

3. **Completion Page**: `/src/renderer/pages/CompletionPage.tsx`
   - Shows warning when Firebase API key is missing (lines 183-200)

## What the User Said
- "when you make the web app that whole thing comes with it"
- "it's not a separate API key"
- The API key should come directly from the Firebase web app creation, not from creating a separate API key

## Debugging Information Needed
1. Check the actual response from `projects.webApps.getConfig` - we log it at line 164 of firebaseAppDeployer.ts
2. Check the LRO response - we log it at line 137 of firebaseAppDeployer.ts
3. Verify if the API key exists in Firebase Console for the created web app

## Possible Causes
1. **Timing Issue**: Even though LRO completes, there might be additional propagation delay
2. **Permission Issue**: The OAuth token might not have permission to see API keys
3. **API Behavior**: The API might not return the key on first creation (requires console visit?)
4. **Project State**: The Firebase project might need additional configuration

## Next Steps to Try
1. **Check Firebase Console**: After deployment, check if the API key is visible in Firebase Console
2. **Try Firebase Admin SDK**: Use Firebase Admin SDK instead of Management API
3. **Check IAM Permissions**: Ensure the OAuth token has `firebase.projects.get` and related permissions
4. **Investigate WebApp Resource**: The LRO response might contain the API key directly
5. **Try Different API Version**: The v1beta1 API might behave differently than v1

## Related Issues Fixed
- Memory format for Cloud Functions (256Mi → 256M)
- Region dropdown now shows all GCP regions
- Navigation dead ends fixed
- Post-deployment checklist added
- Dynamic version display implemented

## Critical User Requirement
**The user stated**: "i need that to work, because the goal of this is that it can securely push all the settings to the acap and not require the customer to go find and insecurely do anything"

This means the Firebase API key MUST be retrieved programmatically. Manual retrieval from Firebase Console is NOT acceptable as it:
1. Breaks the automated flow
2. Requires customers to manually copy sensitive keys
3. Introduces security risks
4. Defeats the purpose of the automated deployer

## Important Context
- This app no longer uses gcloud CLI - everything is API-based
- OAuth config is in oauth-config.json (gitignored)
- The app successfully deploys everything else (Cloud Functions, Firestore, etc.)
- Version 0.8.3 attempted to fix this with LRO pattern but it's still not working