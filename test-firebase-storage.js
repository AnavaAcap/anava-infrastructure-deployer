const projectId = 'agile-being-466720-s0';

// Test if we can finalize Firebase Storage
async function testFirebaseStorage() {
  try {
    // Get access token
    const { execSync } = require('child_process');
    const accessToken = execSync('gcloud auth print-access-token').toString().trim();
    
    console.log('Testing Firebase Storage initialization...');
    
    // Try to finalize the default bucket
    const finalizeUrl = `https://firebase.googleapis.com/v1beta1/projects/${projectId}/defaultBucket:finalize`;
    
    const response = await fetch(finalizeUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-goog-user-project': projectId
      },
      body: JSON.stringify({})
    });
    
    const responseText = await response.text();
    console.log(`Response status: ${response.status}`);
    console.log(`Response: ${responseText}`);
    
    if (response.ok) {
      console.log('✅ Firebase Storage initialized successfully\!');
    } else {
      console.log('❌ Failed to initialize Firebase Storage');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testFirebaseStorage();
