# OAuth Automation Script - Issues and Feedback

## Executive Summary

The provided OAuth automation script has fundamental issues that prevent it from working for Firebase Authentication. The main problem is that it uses IAP (Identity-Aware Proxy) specific resources which are incompatible with Firebase's OAuth requirements.

## Detailed Issues Found

### 1. IAP OAuth Brands Cannot Be Used for Firebase

**What the script does:**
```bash
gcloud alpha iap oauth-brands create
```

**Why it doesn't work:**
- Creates an IAP-specific OAuth brand
- IAP brands are locked to specific application types
- Cannot create OAuth clients suitable for Firebase: `FAILED_PRECONDITION: Brand's Application type must be set to Internal`
- IAP OAuth resources are for Identity-Aware Proxy, not general OAuth use

### 2. Non-existent gcloud Commands

**Script attempts:**
```bash
gcloud identity platform oauth-providers update google.com
gcloud alpha identity platform users import
```

**Reality:**
- These commands don't exist in gcloud CLI
- Identity Platform is only accessible via REST API or Terraform
- No direct gcloud commands for Identity Platform provider configuration

### 3. OAuth Consent Screen Creation Limitations

**The fundamental blocker:**
- General-purpose OAuth consent screens cannot be created programmatically
- This is a Google security requirement - requires human consent
- Only IAP-specific brands can be automated, but they don't work for Firebase

### 4. Identity Token Issues

**Script uses:**
```bash
gcloud auth print-identity-token --quiet | jq -r ".sub"
```

**Problems:**
- Often fails or returns malformed JSON
- Not reliable for getting user's Google ID
- Not necessary for the actual configuration

## Working Solution Found

### What Actually Works:

1. **Use REST API directly:**
```bash
curl -X POST "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs?idpId=google.com" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -d '{"enabled": true, "clientId": "...", "clientSecret": "..."}'
```

2. **But still requires:**
- Manual creation of OAuth consent screen in GCP Console
- Manual creation of OAuth 2.0 Web Application credentials
- These credentials then used in the API call above

### Current Best Practice:

1. Automate what's possible (Firebase Auth initialization, email/password auth)
2. Provide clear instructions for the manual OAuth setup steps
3. Use deep links to guide users to the exact Console pages
4. Validate configuration after manual steps

## Key Questions for Clarification

1. **Is there any way to programmatically create non-IAP OAuth consent screens?**
   - The Console UI can do it - is there a hidden API?
   - Can this be done through Google Workspace APIs?

2. **What's Google's recommended approach for installer automation?**
   - Should we accept manual steps as a security requirement?
   - Are there alternative auth flows that can be fully automated?

3. **Are there upcoming API changes that would enable this?**
   - Is Google planning to expose OAuth consent screen creation APIs?
   - Will Firebase get its own OAuth management APIs?

## Conclusion

The script's approach using IAP resources is fundamentally incompatible with Firebase OAuth requirements. While we can automate the configuration of providers via REST API, the creation of OAuth credentials remains a manual step due to Google's security model. A truly "one-click" setup for Google Sign-In appears to be intentionally prevented by design.