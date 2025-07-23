const { google } = require('googleapis');

async function enableFirebaseAuth(projectId) {
  console.log(`=== Testing Firebase Auth enablement for project: ${projectId} ===`);
  
  try {
    // Get credentials
    const auth = new google.auth.GoogleAuth({
      scopes: [
        'https://www.googleapis.com/auth/cloud-platform',
        'https://www.googleapis.com/auth/firebase',
        'https://www.googleapis.com/auth/identitytoolkit'
      ]
    });
    
    const authClient = await auth.getClient();
    const accessToken = await authClient.getAccessToken();
    
    const configUrl = `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`;
    
    // Step 1: Get current config
    console.log('\nStep 1: Getting current auth config...');
    const getResponse = await fetch(configUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'x-goog-user-project': projectId
      }
    });
    
    if (!getResponse.ok) {
      const errorText = await getResponse.text();
      console.error(`Failed to get auth config: ${getResponse.status} ${errorText}`);
      return;
    }
    
    const currentConfig = await getResponse.json();
    console.log('Current config:', JSON.stringify(currentConfig, null, 2));
    
    // Check if already enabled
    if (currentConfig.signIn?.email?.enabled) {
      console.log('\n✅ Email/Password authentication is already enabled!');
      return true;
    }
    
    // Step 2: Enable email/password auth
    console.log('\nStep 2: Enabling email/password authentication...');
    const updateMask = 'signIn.email.enabled,signIn.email.passwordRequired';
    const patchUrl = `${configUrl}?updateMask=${encodeURIComponent(updateMask)}`;
    
    const patchResponse = await fetch(patchUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
        'x-goog-user-project': projectId
      },
      body: JSON.stringify({
        signIn: {
          email: {
            enabled: true,
            passwordRequired: true
          }
        }
      })
    });
    
    if (!patchResponse.ok) {
      const errorText = await patchResponse.text();
      console.error(`Failed to enable authentication: ${patchResponse.status} ${errorText}`);
      return false;
    }
    
    console.log('✅ PATCH request successful!');
    
    // Step 3: Poll for verification (as recommended by Gemini)
    console.log('\nStep 3: Polling for configuration propagation...');
    const maxRetries = 10;
    const retryDelayMs = 3000;
    
    for (let i = 0; i < maxRetries; i++) {
      console.log(`\nPoll attempt ${i + 1}/${maxRetries}...`);
      
      const verifyResponse = await fetch(configUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
          'x-goog-user-project': projectId
        }
      });
      
      if (verifyResponse.ok) {
        const verifyConfig = await verifyResponse.json();
        if (verifyConfig.signIn?.email?.enabled === true) {
          console.log('✅ Configuration verified! Email/Password auth is now enabled.');
          console.log('Final config:', JSON.stringify(verifyConfig.signIn?.email, null, 2));
          return true;
        }
        console.log('Config not yet propagated. Current state:', verifyConfig.signIn?.email);
      }
      
      if (i < maxRetries - 1) {
        console.log(`Waiting ${retryDelayMs / 1000} seconds before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }
    
    console.error('❌ Failed to verify configuration after maximum retries');
    return false;
    
  } catch (error) {
    console.error('Error:', error);
    return false;
  }
}

// Test with custom token creation
async function testCustomToken(projectId) {
  console.log('\n=== Testing custom token creation ===');
  
  // Test the API directly
  const testToken = await fetch('https://anava-api-anava-iot-gateway-4uly9sov.uc.gateway.dev/device-auth/initiate', {
    method: 'POST',
    headers: {
      'x-api-key': 'AIzaSyBvan5HTyFPxWKen9g60wdhZJU5VZ1lZ_k',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ device_id: 'test-after-enable' })
  });
  
  if (testToken.ok) {
    const tokenData = await testToken.json();
    console.log('✅ Got custom token!');
    
    // Now test exchanging it
    console.log('\nTesting token exchange with Firebase Auth...');
    const exchangeResponse = await fetch(
      'https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=AIzaSyA0UEfPx7g58BdBMxzxoqYKmGJRdJeAo6M',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tokenData.firebase_custom_token,
          returnSecureToken: true
        })
      }
    );
    
    if (exchangeResponse.ok) {
      const authData = await exchangeResponse.json();
      console.log('✅ Token exchange successful! Got ID token.');
      console.log('User ID:', authData.localId);
    } else {
      const error = await exchangeResponse.json();
      console.error('❌ Token exchange failed:', error);
    }
  }
}

// Run the test
const projectId = 'manifest-shade-466803-m1';

enableFirebaseAuth(projectId).then(async (success) => {
  if (success) {
    // Wait a bit more for complete propagation
    console.log('\nWaiting 10 seconds for complete propagation...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    await testCustomToken(projectId);
  }
});