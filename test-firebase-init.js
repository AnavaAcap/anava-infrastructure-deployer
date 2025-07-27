#!/usr/bin/env node

// Test script to verify Firebase initialization APIs
const axios = require('axios');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');

// Test configuration - CHANGE THESE
const TEST_PROJECT_ID = 'your-test-project-id';  // Replace with a test project
const OAUTH_CONFIG_PATH = './oauth-config.json';  // Path to your OAuth config

async function getAccessToken() {
  try {
    // Use Application Default Credentials
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    return tokenResponse.token;
  } catch (error) {
    console.error('Failed to get access token:', error.message);
    console.log('\nMake sure you have authenticated with:');
    console.log('gcloud auth application-default login');
    process.exit(1);
  }
}

async function testFirebaseInitialization(projectId) {
  console.log(`\n🧪 Testing Firebase initialization for project: ${projectId}\n`);
  
  const accessToken = await getAccessToken();
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  // Step 1: Add Firebase to project
  console.log('1️⃣ Adding Firebase to project...');
  try {
    await axios.post(
      `https://firebase.googleapis.com/v1beta1/projects/${projectId}:addFirebase`,
      {},
      { headers }
    );
    console.log('✅ Firebase added successfully');
  } catch (error) {
    if (error.response?.status === 409) {
      console.log('✅ Firebase already enabled');
    } else {
      console.error('❌ Failed to add Firebase:', error.response?.data || error.message);
      return;
    }
  }

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Step 2: Set default location
  console.log('\n2️⃣ Setting default location...');
  try {
    await axios.post(
      `https://firebase.googleapis.com/v1beta1/projects/${projectId}/defaultLocation:finalize`,
      { locationId: 'us-central' },
      { headers }
    );
    console.log('✅ Default location set to us-central');
  } catch (error) {
    if (error.response?.status === 409) {
      console.log('✅ Default location already set');
    } else {
      console.error('❌ Failed to set location:', error.response?.data || error.message);
    }
  }

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Step 3: Test Authentication initialization
  console.log('\n3️⃣ Testing Authentication initialization...');
  const authConfigUrl = `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/config`;
  
  // First check if config exists
  try {
    await axios.get(authConfigUrl, { headers });
    console.log('✅ Auth config already exists');
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('⚠️  Auth config does not exist - will try to create');
    }
  }

  // Try POST with updateMask (Gemini's recommendation)
  console.log('\n   Trying POST with updateMask...');
  try {
    const updateMask = 'signIn.email.enabled,signIn.email.passwordRequired,signIn.google.enabled,signIn.anonymous.enabled';
    await axios.post(
      `${authConfigUrl}?updateMask=${updateMask}`,
      {
        signIn: {
          email: { enabled: true, passwordRequired: true },
          google: { enabled: true },
          anonymous: { enabled: true }
        }
      },
      { headers }
    );
    console.log('✅ POST with updateMask succeeded! Auth should be initialized.');
  } catch (error) {
    console.error('❌ POST failed:', error.response?.data || error.message);
    
    // Try PATCH as fallback
    console.log('\n   Trying PATCH as fallback...');
    try {
      const updateMask = 'signIn.email.enabled,signIn.email.passwordRequired,signIn.google.enabled';
      await axios.patch(
        `${authConfigUrl}?updateMask=${updateMask}`,
        {
          signIn: {
            email: { enabled: true, passwordRequired: true },
            google: { enabled: true }
          }
        },
        { headers }
      );
      console.log('✅ PATCH succeeded!');
    } catch (patchError) {
      console.error('❌ PATCH also failed:', patchError.response?.data || patchError.message);
    }
  }

  // Step 4: Test Storage bucket creation and linking
  console.log('\n4️⃣ Testing Storage initialization...');
  
  // Create bucket using Cloud Storage API
  const bucketName = `${projectId}-test-firebase-storage`;
  console.log(`   Creating bucket: ${bucketName}`);
  
  const storage = google.storage('v1');
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });
  google.options({ auth });

  try {
    await storage.buckets.insert({
      project: projectId,
      requestBody: {
        name: bucketName,
        location: 'US',
        storageClass: 'STANDARD'
      }
    });
    console.log('✅ Bucket created');
  } catch (error) {
    if (error.code === 409) {
      console.log('✅ Bucket already exists');
    } else {
      console.error('❌ Failed to create bucket:', error.message);
    }
  }

  // Try the addFirebase endpoint (Gemini's suggestion)
  console.log('\n   Trying buckets.addFirebase API...');
  try {
    await axios.post(
      `https://firebasestorage.googleapis.com/v1beta/projects/${projectId}/buckets/${bucketName}:addFirebase`,
      {},
      { headers }
    );
    console.log('✅ buckets.addFirebase succeeded! Storage should be linked.');
  } catch (error) {
    console.error('❌ addFirebase failed:', error.response?.data || error.message);
    
    // Try defaultBucket:finalize as fallback
    console.log('\n   Trying defaultBucket:finalize as fallback...');
    try {
      await axios.post(
        `https://firebase.googleapis.com/v1beta1/projects/${projectId}/defaultBucket:finalize`,
        { bucket: `projects/${projectId}/buckets/${bucketName}` },
        { headers }
      );
      console.log('✅ defaultBucket:finalize succeeded!');
    } catch (finalizeError) {
      console.error('❌ finalize also failed:', finalizeError.response?.data || finalizeError.message);
    }
  }

  console.log('\n✨ Test complete! Check Firebase Console to see if Auth and Storage show as initialized.');
  console.log(`   https://console.firebase.google.com/project/${projectId}/authentication`);
  console.log(`   https://console.firebase.google.com/project/${projectId}/storage`);
}

// Parse command line args
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node test-firebase-init.js <project-id>');
  console.log('Example: node test-firebase-init.js my-test-project');
  process.exit(1);
}

// Run the test
testFirebaseInitialization(args[0]).catch(console.error);