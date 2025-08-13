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
 * Get a real Axis license key from Firestore
 */
async function getAxisLicenseFromFirestore(userId, email) {
  try {
    // Start a transaction to ensure atomic assignment
    const result = await db.runTransaction(async (transaction) => {
      // Check if user already has a key assigned
      const userRef = db.collection('users').doc(userId);
      const userDoc = await transaction.get(userRef);
      
      if (userDoc.exists && userDoc.data().assigned_axis_key) {
        const existingKey = userDoc.data().assigned_axis_key;
        // Check if it's a real key (not ANAVA-prefixed)
        if (!existingKey.startsWith('ANAVA-')) {
          console.log(`Existing real Axis key found for user ${userId}: ${existingKey}`);
          return existingKey;
        } else {
          console.log(`Fake Axis key found ${existingKey}, will get a real one`);
        }
      }

      // Query for an available key
      const availableKeysQuery = db.collection('axis_keys')
        .where('status', '==', 'available')
        .limit(1);
      
      const availableKeys = await transaction.get(availableKeysQuery);
      
      if (availableKeys.empty) {
        console.warn('No Axis keys available in Firestore');
        return null;
      }

      // Get the first available key
      const keyDoc = availableKeys.docs[0];
      const keyData = keyDoc.data();

      // Update the key status
      transaction.update(keyDoc.ref, {
        status: 'assigned',
        assigned_to_email: email,
        assigned_to_uid: userId,
        assigned_at: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update user document
      transaction.set(userRef, {
        email: email,
        assigned_axis_key: keyData.key_string,
        key_assigned_at: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      console.log(`New Axis key ${keyData.key_string} assigned to user ${userId}`);
      return keyData.key_string;
    });
    
    return result;
  } catch (error) {
    console.error('Error getting Axis license from Firestore:', error);
    return null;
  }
}

/**
 * Check or assign license for user
 */
async function handleLicense(userId, email) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (userDoc.exists && userDoc.data().licenseKey) {
      const existingKey = userDoc.data().licenseKey;
      
      // Check if it's a fake ANAVA-prefixed key
      if (existingKey.startsWith('ANAVA-')) {
        console.log(`Fake license detected for user ${userId}: ${existingKey}, getting real one`);
        // Delete the fake license
        await db.collection('users').doc(userId).update({
          licenseKey: admin.firestore.FieldValue.delete(),
          assigned_axis_key: admin.firestore.FieldValue.delete()
        });
      } else {
        // Real license exists
        console.log(`Real license found for user ${userId}`);
        return {
          key: existingKey,
          isNew: false,
          email: email
        };
      }
    }
    
    // Get a real Axis license from Firestore
    const licenseKey = await getAxisLicenseFromFirestore(userId, email);
    
    if (!licenseKey) {
      console.error('Failed to get Axis license key');
      return {
        key: null,
        isNew: false,
        email: email,
        error: 'No licenses available'
      };
    }
    
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
    
    // Check if we have a stored API key in Firestore
    const apiKeysQuery = await db.collection('gemini_api_keys')
      .where('status', '==', 'available')
      .limit(1)
      .get();
    
    if (!apiKeysQuery.empty) {
      const apiKeyDoc = apiKeysQuery.docs[0];
      const apiKeyData = apiKeyDoc.data();
      
      // Mark as assigned
      await apiKeyDoc.ref.update({
        status: 'assigned',
        assigned_to: userId,
        assigned_at: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Store in user document
      await db.collection('users').doc(userId).update({
        geminiApiKey: apiKeyData.key,
        geminiApiKeyCreatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`API key assigned to user ${userId}`);
      return apiKeyData.key;
    }
    
    // Return null to trigger local generation
    console.log('No API keys available in Firestore, client will generate locally');
    return null;
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