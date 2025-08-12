/**
 * Unified Authentication Cloud Function
 * 
 * This function acts as an authentication broker that:
 * 1. Exchanges GCP OAuth authorization code for tokens
 * 2. Verifies user identity
 * 3. Assigns/retrieves license from Firestore
 * 4. Generates/retrieves AI Studio API key
 * 5. Creates Firebase custom token for client auth
 * 
 * Returns all necessary credentials in a single response
 */

const functions = require('@google-cloud/functions-framework');
const admin = require('firebase-admin');
const { OAuth2Client } = require('google-auth-library');
const { ApiKeysClient } = require('@google-cloud/apikeys');
const axios = require('axios');

// Initialize Firebase Admin
admin.initializeApp({
  projectId: 'anava-ai'
});

const db = admin.firestore();

// OAuth Configuration
const OAUTH_CLIENT_ID = process.env.OAUTH_CLIENT_ID || '392865621461-3q8n4o7s2p8t2p4g9h7lf8ku66r9mrbg.apps.googleusercontent.com';
const OAUTH_CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET; // Must be set in environment
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/auth/callback';

// Initialize API Keys client
const apiKeysClient = new ApiKeysClient();

/**
 * Generate a unique license key for a user
 */
function generateLicenseKey(userId) {
  const prefix = 'ANAVA';
  const timestamp = Date.now().toString(36).toUpperCase();
  const userHash = userId.substring(0, 6).toUpperCase();
  return `${prefix}-${userHash}-${timestamp}`;
}

/**
 * Check or assign license for user
 */
async function handleLicense(userId, email) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (userDoc.exists && userDoc.data().licenseKey) {
      console.log(`Existing license found for user ${userId}`);
      return {
        key: userDoc.data().licenseKey,
        isNew: false,
        email: email
      };
    }
    
    // Generate new license
    const licenseKey = generateLicenseKey(userId);
    
    // Store in Firestore
    await db.collection('users').doc(userId).set({
      email: email,
      licenseKey: licenseKey,
      licenseType: 'trial',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    // Also store in licenses collection for tracking
    await db.collection('licenses').doc(licenseKey).set({
      userId: userId,
      email: email,
      type: 'trial',
      status: 'active',
      assignedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`New license ${licenseKey} assigned to user ${userId}`);
    return {
      key: licenseKey,
      isNew: true,
      email: email
    };
  } catch (error) {
    console.error('License handling error:', error);
    throw error;
  }
}

/**
 * Get or create AI Studio API key for user
 */
async function handleAIStudioKey(userId, accessToken) {
  try {
    // Check if user already has an API key
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (userDoc.exists && userDoc.data().geminiApiKey) {
      console.log(`Existing API key found for user ${userId}`);
      return userDoc.data().geminiApiKey;
    }
    
    // Try to create a new API key using the service
    try {
      const projectId = 'anava-ai';
      const keyName = `anava-user-${userId.substring(0, 8)}`;
      
      // Create API key using gcloud API
      const parent = `projects/${projectId}/locations/global`;
      const request = {
        parent: parent,
        key: {
          displayName: keyName,
          restrictions: {
            apiTargets: [
              { service: 'generativelanguage.googleapis.com' }
            ]
          }
        },
        keyId: `key-${userId.substring(0, 16)}`
      };
      
      const [operation] = await apiKeysClient.createKey(request);
      
      // Wait for operation to complete
      const [key] = await operation.promise();
      
      // Get the key string
      const keyString = key.keyString;
      
      // Store in user document
      await db.collection('users').doc(userId).update({
        geminiApiKey: keyString,
        geminiApiKeyCreatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`New API key created for user ${userId}`);
      return keyString;
      
    } catch (apiKeyError) {
      console.warn('Could not create API key automatically:', apiKeyError.message);
      
      // Return a placeholder - user will need to create manually
      return null;
    }
  } catch (error) {
    console.error('AI Studio key handling error:', error);
    return null;
  }
}

/**
 * Main handler for unified authentication
 */
functions.http('unifiedAuth', async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  try {
    const { code, test_mode } = req.body;
    
    if (!code && !test_mode) {
      return res.status(400).json({ 
        error: 'Authorization code is required' 
      });
    }
    
    // Test mode for development
    if (test_mode) {
      const testUserId = 'test_user_' + Date.now();
      const testEmail = 'test@example.com';
      
      return res.json({
        success: true,
        gcp_access_token: 'test_access_token',
        gcp_refresh_token: 'test_refresh_token',
        firebase_token: await admin.auth().createCustomToken(testUserId),
        gemini_api_key: 'test_api_key',
        license: {
          key: 'TEST-LICENSE-KEY',
          isNew: true,
          email: testEmail
        },
        user: {
          id: testUserId,
          email: testEmail,
          name: 'Test User'
        }
      });
    }
    
    // Production flow
    if (!OAUTH_CLIENT_SECRET) {
      console.error('OAuth client secret not configured');
      return res.status(500).json({ 
        error: 'Server configuration error' 
      });
    }
    
    // Initialize OAuth client
    const oauth2Client = new OAuth2Client(
      OAUTH_CLIENT_ID,
      OAUTH_CLIENT_SECRET,
      REDIRECT_URI
    );
    
    // Exchange authorization code for tokens
    console.log('Exchanging authorization code for tokens...');
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    // Verify and decode ID token
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: OAUTH_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    const userId = payload['sub']; // Google user ID
    const email = payload['email'];
    const name = payload['name'] || email.split('@')[0];
    
    console.log(`Authenticated user: ${email} (${userId})`);
    
    // Handle license assignment
    const license = await handleLicense(userId, email);
    
    // Handle AI Studio API key
    const geminiApiKey = await handleAIStudioKey(userId, tokens.access_token);
    
    // Create Firebase custom token
    const firebaseToken = await admin.auth().createCustomToken(userId, {
      email: email,
      licensed: true,
      licenseKey: license.key
    });
    
    // Update last login
    await db.collection('users').doc(userId).update({
      lastLogin: admin.firestore.FieldValue.serverTimestamp(),
      name: name
    });
    
    // Return all credentials
    const response = {
      success: true,
      gcp_access_token: tokens.access_token,
      gcp_refresh_token: tokens.refresh_token,
      firebase_token: firebaseToken,
      gemini_api_key: geminiApiKey,
      license: license,
      user: {
        id: userId,
        email: email,
        name: name
      }
    };
    
    console.log('Unified auth successful for:', email);
    res.json(response);
    
  } catch (error) {
    console.error('Unified auth error:', error);
    res.status(500).json({ 
      error: error.message || 'Authentication failed',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Token refresh endpoint
 */
functions.http('refreshToken', async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  try {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
      return res.status(400).json({ 
        error: 'Refresh token is required' 
      });
    }
    
    if (!OAUTH_CLIENT_SECRET) {
      return res.status(500).json({ 
        error: 'Server configuration error' 
      });
    }
    
    // Initialize OAuth client
    const oauth2Client = new OAuth2Client(
      OAUTH_CLIENT_ID,
      OAUTH_CLIENT_SECRET,
      REDIRECT_URI
    );
    
    oauth2Client.setCredentials({
      refresh_token: refresh_token
    });
    
    // Get new access token
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    res.json({
      success: true,
      access_token: credentials.access_token,
      expires_in: credentials.expiry_date ? 
        Math.floor((credentials.expiry_date - Date.now()) / 1000) : 3600
    });
    
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ 
      error: error.message || 'Token refresh failed' 
    });
  }
});