#!/usr/bin/env node

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithCredential, GoogleAuthProvider } = require('firebase/auth');

// Firebase config from your project
const firebaseConfig = {
  apiKey: "AIzaSyBg_wFMnpfne7MBI5bGF-3LxHjLMM0MqGU",
  authDomain: "anava-platform-3d78f.firebaseapp.com",
  projectId: "anava-platform-3d78f",
  storageBucket: "anava-platform-3d78f.appspot.com",
  messagingSenderId: "392865621461",
  appId: "1:392865621461:web:c8c7c3f96bc5e956c1f17f"
};

// Test ID token - you'll need to replace this with a real one
const TEST_ID_TOKEN = process.argv[2];
const TEST_ACCESS_TOKEN = process.argv[3];

if (!TEST_ID_TOKEN) {
  console.error('Usage: node test-firebase-auth.js <ID_TOKEN> [ACCESS_TOKEN]');
  console.error('Get the ID token from the console logs when you try to login');
  process.exit(1);
}

async function testFirebaseAuth() {
  try {
    console.log('Initializing Firebase...');
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);

    console.log('\n=== Testing different credential approaches ===\n');

    // Test 1: Just ID token
    console.log('Test 1: GoogleAuthProvider.credential(idToken)');
    try {
      const credential1 = GoogleAuthProvider.credential(TEST_ID_TOKEN);
      const result1 = await signInWithCredential(auth, credential1);
      console.log('✅ SUCCESS with just ID token!');
      console.log('User:', result1.user.email);
      await auth.signOut();
    } catch (error) {
      console.log('❌ FAILED:', error.code, error.message);
    }

    // Test 2: ID token and access token
    if (TEST_ACCESS_TOKEN) {
      console.log('\nTest 2: GoogleAuthProvider.credential(idToken, accessToken)');
      try {
        const credential2 = GoogleAuthProvider.credential(TEST_ID_TOKEN, TEST_ACCESS_TOKEN);
        const result2 = await signInWithCredential(auth, credential2);
        console.log('✅ SUCCESS with ID and access tokens!');
        console.log('User:', result2.user.email);
        await auth.signOut();
      } catch (error) {
        console.log('❌ FAILED:', error.code, error.message);
      }
    }

    // Test 3: Try with undefined access token
    console.log('\nTest 3: GoogleAuthProvider.credential(idToken, undefined)');
    try {
      const credential3 = GoogleAuthProvider.credential(TEST_ID_TOKEN, undefined);
      const result3 = await signInWithCredential(auth, credential3);
      console.log('✅ SUCCESS with ID token and undefined!');
      console.log('User:', result3.user.email);
      await auth.signOut();
    } catch (error) {
      console.log('❌ FAILED:', error.code, error.message);
    }

    // Decode and display the ID token payload
    console.log('\n=== ID Token Analysis ===\n');
    const parts = TEST_ID_TOKEN.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      console.log('Token payload:');
      console.log('- aud (audience):', payload.aud);
      console.log('- iss (issuer):', payload.iss);
      console.log('- email:', payload.email);
      console.log('- exp (expiration):', new Date(payload.exp * 1000).toISOString());
      console.log('- iat (issued at):', new Date(payload.iat * 1000).toISOString());
      
      // Check if token is expired
      if (payload.exp * 1000 < Date.now()) {
        console.log('⚠️  WARNING: Token is expired!');
      }
      
      // Check audience
      if (payload.aud !== '392865621461-3332mfpeb245vp56raok2mmp4aqssv15.apps.googleusercontent.com') {
        console.log('⚠️  WARNING: Token audience does not match expected OAuth client ID!');
        console.log('   Expected:', '392865621461-3332mfpeb245vp56raok2mmp4aqssv15.apps.googleusercontent.com');
        console.log('   Got:', payload.aud);
      }
    }

  } catch (error) {
    console.error('Fatal error:', error);
  }
  
  process.exit(0);
}

testFirebaseAuth();