# Google Sign-In with HubSpot Integration Plan

## 1. Simplified Flow with Google Sign-In

### Current Flow
```
User → Generate trial email → Create account → Get license
```

### New Google SSO Flow
```
User → Sign in with Google → Auto-verify (Google emails are pre-verified) → Capture profile → Get License → Sync to HubSpot
```

## 2. Key Advantages of Google Sign-In

- **No email verification needed** - Google handles this
- **Rich profile data** - Name, email, profile picture automatically
- **Enterprise friendly** - Most businesses use Google Workspace
- **Higher quality leads** - Real business emails
- **Instant activation** - No verification delays

## 3. Implementation Plan

### A. Firebase Google Auth Setup
```typescript
// licenseKeyService.ts - Add Google sign-in method
import { 
  getAuth, 
  signInWithPopup,
  GoogleAuthProvider,
  User
} from 'firebase/auth';

async signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account', // Always show account picker
    hd: '*' // Accept any domain (remove for specific domain)
  });
  
  const result = await signInWithPopup(this.auth, provider);
  const user = result.user;
  
  // Extract profile info
  const profile = {
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    emailVerified: true // Always true for Google
  };
  
  return user;
}
```

### B. Updated UI Flow
```tsx
// CameraSetupPage.tsx - Replace trial button with Google sign-in
<Box sx={{ textAlign: 'center', p: 3 }}>
  <Typography variant="h6" gutterBottom>
    Get Your Trial License
  </Typography>
  
  <Button
    variant="contained"
    startIcon={<GoogleIcon />}
    size="large"
    onClick={handleGoogleSignIn}
    sx={{ 
      backgroundColor: '#4285f4',
      '&:hover': { backgroundColor: '#357ae8' }
    }}
  >
    Sign in with Google to Get Trial License
  </Button>
  
  <Typography variant="caption" sx={{ mt: 2, display: 'block' }}>
    We'll use your Google account to manage your trial license
  </Typography>
</Box>
```

### C. Backend Updates
```javascript
// Cloud Function - Enhanced with profile capture
exports.assignAxisKey = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }
  
  const { email, name, picture } = context.auth.token;
  
  // Parse Google name
  const nameParts = (name || '').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  
  // Extract company from email domain
  const emailDomain = email.split('@')[1];
  const company = emailDomain.replace(/\.(com|org|net|io|ai|co)$/i, '');
  
  // Create/update user profile
  const userProfile = {
    email,
    firstName,
    lastName,
    company: capitalize(company),
    photoURL: picture,
    signInProvider: 'google.com',
    trialStartDate: admin.firestore.FieldValue.serverTimestamp()
  };
  
  // ... assign license key ...
  
  // Queue for HubSpot sync
  await db.collection('hubspot_queue').add({
    type: 'trial_signup',
    userId: context.auth.uid,
    profile: userProfile,
    licenseKey: assignedKey,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return { key: assignedKey, email, alreadyAssigned };
});
```

## 4. HubSpot Integration

### A. What I Need from You

1. **HubSpot API Key** (or better, OAuth credentials)
   - Go to HubSpot → Settings → Integrations → API Key
   - Or create a Private App with specific scopes

2. **Required HubSpot Scopes**:
   - `crm.objects.contacts.read`
   - `crm.objects.contacts.write`
   - `crm.objects.companies.read`
   - `crm.objects.companies.write`
   - `timeline` (for activity tracking)

3. **Custom Properties to Create** (I can do this via API):
   - `anava_trial_start_date`
   - `anava_license_key`
   - `anava_cameras_deployed`
   - `anava_last_deployment_date`
   - `anava_product_interest` (Vision, Infrastructure, etc.)

### B. HubSpot Sync Function
```javascript
// New Cloud Function: hubspotSync
const HubSpotClient = require('@hubspot/api-client');

exports.hubspotSync = functions.firestore
  .document('hubspot_queue/{docId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const hubspot = new HubSpotClient({ apiKey: HUBSPOT_API_KEY });
    
    try {
      // 1. Create or update contact
      const contactData = {
        email: data.profile.email,
        firstname: data.profile.firstName,
        lastname: data.profile.lastName,
        company: data.profile.company,
        anava_trial_start_date: data.profile.trialStartDate,
        anava_license_key: data.licenseKey,
        lifecyclestage: 'lead',
        hs_lead_status: 'NEW',
        lead_source_detail_1: 'Infrastructure Deployer Trial'
      };
      
      const contact = await hubspot.crm.contacts.basicApi.create({
        properties: contactData
      });
      
      // 2. Create timeline event
      await createTimelineEvent(hubspot, contact.id, {
        eventTypeId: 'trial_started',
        email: data.profile.email,
        licenseKey: data.licenseKey
      });
      
      // 3. Create or associate company
      await createOrAssociateCompany(hubspot, contact.id, data.profile.company);
      
      // 4. Mark as processed
      await snap.ref.update({ 
        processed: true, 
        hubspotContactId: contact.id,
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
    } catch (error) {
      console.error('HubSpot sync failed:', error);
      await snap.ref.update({ 
        error: error.message,
        retryCount: admin.firestore.FieldValue.increment(1)
      });
    }
  });
```

### C. Activity Tracking
```javascript
// Track key events
exports.trackDeployment = functions.https.onCall(async (data, context) => {
  // When user deploys to a camera
  await db.collection('hubspot_queue').add({
    type: 'deployment',
    userId: context.auth.uid,
    eventData: {
      cameraIp: data.cameraIp,
      cameraModel: data.cameraModel,
      deploymentType: data.deploymentType
    }
  });
});
```

## 5. Quick Implementation Steps

### Phase 1: Google Sign-In (This Week)
1. Enable Google auth provider in Firebase Console
2. Update UI to use Google sign-in button
3. Modify license assignment to work with Google auth
4. Test the flow

### Phase 2: Basic HubSpot Sync (Next Week)
1. Add HubSpot API credentials to Cloud Functions config
2. Deploy hubspotSync function
3. Create custom properties in HubSpot
4. Test contact creation

### Phase 3: Enhanced Tracking (Week 3)
1. Add deployment tracking
2. Create HubSpot workflows
3. Set up lead scoring
4. Configure email automation

## 6. Environment Variables Needed

```bash
# Firebase Functions config
firebase functions:config:set hubspot.api_key="YOUR_HUBSPOT_API_KEY"
firebase functions:config:set hubspot.portal_id="YOUR_PORTAL_ID"

# Or better, use Secret Manager
firebase functions:secrets:set HUBSPOT_API_KEY
```

## 7. Benefits of This Approach

1. **Frictionless Trial** - One click with Google
2. **Quality Leads** - Real business emails
3. **Rich Data** - Name, company extracted automatically  
4. **Instant Activation** - No verification delays
5. **Enterprise Ready** - SSO is standard for B2B
6. **Marketing Automation** - Full HubSpot integration

This is much cleaner than username/password and gives you better data quality for your marketing funnel!