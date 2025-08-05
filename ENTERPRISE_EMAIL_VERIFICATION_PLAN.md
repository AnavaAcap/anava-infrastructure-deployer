# Enterprise Email Verification & Marketing Integration Plan

## Overview
Transform the trial license system from anonymous trials to a proper enterprise-grade lead capture and nurturing system.

## 1. Email Verification Flow

### Current Flow (Anonymous)
```
User → Click Trial → Auto-generate email → Get License → Deploy
```

### New Enterprise Flow
```
User → Enter Real Email → Create Account → Verify Email → Get License → Sync to HubSpot → Deploy
```

## 2. Technical Implementation

### A. User Registration Form
```typescript
interface TrialRegistration {
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  jobTitle?: string;
  phone?: string;
  country: string;
  gdprConsent: boolean;
  marketingConsent: boolean;
}
```

### B. Firebase Authentication Changes
```typescript
// 1. Create user with real email
const userCredential = await createUserWithEmailAndPassword(auth, email, password);

// 2. Send verification email
await sendEmailVerification(userCredential.user, {
  url: 'https://app.anava.ai/verify-success', // Redirect after verification
  handleCodeInApp: false
});

// 3. Check verification status before assigning license
if (!userCredential.user.emailVerified) {
  throw new Error('Please verify your email before claiming a trial license');
}
```

### C. Cloud Function Updates
```javascript
// assignAxisKey function modifications
exports.assignAxisKey = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated AND email verified
  if (!context.auth || !context.auth.token.email_verified) {
    throw new functions.https.HttpsError(
      'unauthenticated', 
      'Email verification required'
    );
  }
  
  // Capture additional profile data
  const profile = {
    email: context.auth.token.email,
    firstName: data.firstName,
    lastName: data.lastName,
    company: data.company,
    trialStartDate: admin.firestore.FieldValue.serverTimestamp()
  };
  
  // ... existing license assignment logic ...
  
  // Trigger HubSpot sync
  await syncToHubSpot(profile, assignedKey);
});
```

## 3. HubSpot Integration

### A. Lead Creation
```javascript
// New Cloud Function: syncToHubSpot
exports.syncToHubSpot = functions.firestore
  .document('users/{userId}')
  .onCreate(async (snap, context) => {
    const userData = snap.data();
    
    const hubspotData = {
      email: userData.email,
      firstname: userData.firstName,
      lastname: userData.lastName,
      company: userData.company,
      jobtitle: userData.jobTitle,
      phone: userData.phone,
      country: userData.country,
      hs_lead_status: 'NEW',
      lifecycle_stage: 'lead',
      anava_trial_start_date: userData.trialStartDate,
      anava_license_key: userData.assigned_axis_key,
      lead_source: 'Trial Sign-up - Infrastructure Deployer'
    };
    
    await createOrUpdateHubSpotContact(hubspotData);
});
```

### B. Activity Tracking
- Trial activation
- Camera deployments
- Feature usage
- Support interactions

## 4. UI/UX Updates

### A. Registration Form
```tsx
// Replace simple trial button with comprehensive form
<TrialRegistrationForm onSubmit={handleTrialRegistration}>
  <TextField label="Work Email" type="email" required />
  <TextField label="First Name" required />
  <TextField label="Last Name" required />
  <TextField label="Company" required />
  <Select label="Country" required>
    {/* Country list for compliance */}
  </Select>
  
  <FormControlLabel
    control={<Checkbox required />}
    label="I agree to the Terms of Service and Privacy Policy"
  />
  
  <FormControlLabel
    control={<Checkbox />}
    label="Send me product updates and marketing communications"
  />
  
  <Button type="submit">Start Free Trial</Button>
</TrialRegistrationForm>
```

### B. Email Verification Screen
```tsx
<VerificationPending email={userEmail}>
  <Typography variant="h5">
    Check your email to verify your account
  </Typography>
  <Typography>
    We sent a verification link to {userEmail}
  </Typography>
  <Button onClick={resendVerification}>
    Resend Verification Email
  </Button>
</VerificationPending>
```

## 5. Security & Compliance

### A. GDPR Requirements
- Explicit consent checkboxes
- Data processing agreement
- Right to deletion
- Data portability

### B. Security Enhancements
- Rate limiting on registration
- Email domain validation (block disposable emails)
- IP-based fraud detection
- Trial abuse prevention

### C. Email Security
```javascript
// Validate email domain
const validateEmailDomain = async (email) => {
  const domain = email.split('@')[1];
  
  // Block disposable email domains
  if (DISPOSABLE_DOMAINS.includes(domain)) {
    throw new Error('Please use a business email address');
  }
  
  // Optional: Verify MX records
  const hasMX = await verifyMXRecord(domain);
  if (!hasMX) {
    throw new Error('Invalid email domain');
  }
};
```

## 6. Enterprise Features

### A. Single Sign-On (SSO)
- SAML 2.0 support
- OAuth with Google Workspace
- Azure AD integration

### B. Team Management
- Admin can invite team members
- Role-based access control
- Shared license management

### C. Audit Trail
- Track all license assignments
- Deployment history
- User activity logs

## 7. Implementation Priority

### Phase 1: Core Email Verification (Week 1-2)
1. Update registration form with required fields
2. Implement Firebase email verification
3. Update Cloud Functions to check verification
4. Create verification pending UI

### Phase 2: HubSpot Integration (Week 3)
1. Set up HubSpot API integration
2. Create custom properties in HubSpot
3. Implement contact sync
4. Set up automation workflows

### Phase 3: Compliance & Security (Week 4)
1. Add GDPR consent collection
2. Implement email domain validation
3. Add rate limiting
4. Create privacy policy updates

### Phase 4: Enterprise Features (Week 5-6)
1. SSO integration
2. Team management
3. Admin dashboard
4. Audit logging

## 8. Marketing Automation Opportunities

### A. Lead Scoring
- +10 points: Email verified
- +20 points: First camera deployed
- +30 points: Multiple cameras deployed
- +15 points: Used advanced features

### B. Nurture Campaigns
- Welcome series (5 emails)
- Feature education
- Best practices
- Case studies
- Upgrade prompts

### C. Behavioral Triggers
- Abandoned trial (no deployment in 3 days)
- High usage (deploy to 5+ cameras)
- Trial expiration warning
- Feature discovery prompts

## 9. Metrics to Track

### A. Conversion Funnel
- Registration started → completed
- Email sent → verified
- Trial activated → first deployment
- Trial → paid conversion

### B. User Engagement
- Time to first deployment
- Number of cameras deployed
- Features used
- Support tickets created

### C. Marketing Metrics
- Email open rates
- Click-through rates
- Lead score progression
- Sales qualified lead (SQL) rate

## 10. Technical Considerations

### A. Email Service
Options:
1. **SendGrid** - Great API, good deliverability
2. **AWS SES** - Cost-effective, integrates with AWS
3. **Postmark** - Excellent for transactional emails

### B. Database Schema Updates
```typescript
// Enhanced user profile
interface UserProfile {
  // Identity
  uid: string;
  email: string;
  emailVerified: boolean;
  
  // Profile
  firstName: string;
  lastName: string;
  company: string;
  jobTitle?: string;
  phone?: string;
  country: string;
  
  // Compliance
  gdprConsentDate: Timestamp;
  marketingConsent: boolean;
  termsAcceptedDate: Timestamp;
  
  // Trial Info
  trialStartDate: Timestamp;
  trialEndDate: Timestamp;
  assignedLicenseKey?: string;
  
  // Tracking
  hubspotContactId?: string;
  leadSource: string;
  utmParams?: UTMParams;
  
  // Activity
  lastLoginDate?: Timestamp;
  deploymentsCount: number;
  camerasDeployed: string[];
}
```

This approach transforms your trial system from a simple key distribution mechanism to a proper enterprise lead generation and nurturing engine that will integrate seamlessly with your marketing and sales processes.