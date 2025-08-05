const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Cloud Function to assign an Axis license key to a user
 * Uses a transaction to ensure atomic assignment
 */
exports.assignAxisKey = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const uid = context.auth.uid;
  const email = context.auth.token.email;

  if (!email) {
    throw new functions.https.HttpsError('invalid-argument', 'User email not found');
  }

  try {
    // Start a transaction to ensure atomic assignment
    const result = await db.runTransaction(async (transaction) => {
      // Check if user already has a key assigned
      const userRef = db.collection('users').doc(uid);
      const userDoc = await transaction.get(userRef);
      
      if (userDoc.exists && userDoc.data().assigned_axis_key) {
        // User already has a key, return it
        return {
          key: userDoc.data().assigned_axis_key,
          email: email,
          alreadyAssigned: true
        };
      }

      // Query for an available key
      const availableKeysQuery = db.collection('axis_keys')
        .where('status', '==', 'available')
        .limit(1);
      
      const availableKeys = await transaction.get(availableKeysQuery);
      
      if (availableKeys.empty) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          'No trial licenses available. Please contact sales@anava.com'
        );
      }

      // Get the first available key
      const keyDoc = availableKeys.docs[0];
      const keyData = keyDoc.data();
      const keyId = keyDoc.id;

      // Update the key status
      transaction.update(keyDoc.ref, {
        status: 'assigned',
        assigned_to_email: email,
        assigned_to_uid: uid,
        assigned_at: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update or create user document
      transaction.set(userRef, {
        email: email,
        assigned_axis_key: keyData.key_string,
        key_assigned_at: admin.firestore.FieldValue.serverTimestamp(),
        deployment_count: 0
      }, { merge: true });

      // Update admin stats
      const statsRef = db.collection('admin_config').doc('license_stats');
      transaction.update(statsRef, {
        available_keys: admin.firestore.FieldValue.increment(-1),
        last_updated: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        key: keyData.key_string,
        email: email,
        alreadyAssigned: false
      };
    });

    // Log the assignment
    console.log(`License key assigned to ${email} (${uid})`);
    
    return result;

  } catch (error) {
    console.error('Error assigning license key:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      'Failed to assign license key',
      error.message
    );
  }
});

/**
 * Admin function to bulk upload license keys
 * Should be called via Firebase Admin SDK or console
 */
exports.uploadLicenseKeys = functions.https.onCall(async (data, context) => {
  // Check if user has admin claim
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }

  const { keys } = data;
  
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Keys array is required');
  }

  try {
    const batch = db.batch();
    let successCount = 0;

    for (const key of keys) {
      if (typeof key !== 'string' || !key.match(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)) {
        console.warn(`Invalid key format skipped: ${key}`);
        continue;
      }

      // Create document with key as ID for easy duplicate detection
      const keyRef = db.collection('axis_keys').doc(key);
      batch.set(keyRef, {
        key_string: key,
        status: 'available',
        created_at: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: false }); // Don't overwrite existing keys
      
      successCount++;
    }

    // Update stats
    const statsRef = db.collection('admin_config').doc('license_stats');
    batch.set(statsRef, {
      total_keys: admin.firestore.FieldValue.increment(successCount),
      available_keys: admin.firestore.FieldValue.increment(successCount),
      last_updated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await batch.commit();

    return {
      success: true,
      keysAdded: successCount,
      totalKeys: keys.length
    };

  } catch (error) {
    console.error('Error uploading license keys:', error);
    throw new functions.https.HttpsError('internal', 'Failed to upload keys', error.message);
  }
});

/**
 * Get license availability stats
 */
exports.getLicenseStats = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    const statsDoc = await db.collection('admin_config').doc('license_stats').get();
    
    if (!statsDoc.exists) {
      return {
        total: 0,
        available: 0
      };
    }

    const stats = statsDoc.data();
    return {
      total: stats.total_keys || 0,
      available: stats.available_keys || 0
    };

  } catch (error) {
    console.error('Error getting license stats:', error);
    throw new functions.https.HttpsError('internal', 'Failed to get stats');
  }
});