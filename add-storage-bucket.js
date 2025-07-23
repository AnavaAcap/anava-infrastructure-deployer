const projectId = 'agile-being-466720-s0';

async function addDefaultStorageBucket() {
  try {
    const { execSync } = require('child_process');
    const accessToken = execSync('gcloud auth print-access-token').toString().trim();
    
    // Try to add default storage bucket
    const addBucketUrl = `https://firebase.googleapis.com/v1beta1/projects/${projectId}/defaultLocation:finalize`;
    
    console.log('Trying to finalize default location...');
    
    const response = await fetch(addBucketUrl, {
      method: 'POST', 
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-goog-user-project': projectId
      },
      body: JSON.stringify({
        locationId: 'us-central1'
      })
    });
    
    const responseText = await response.text();
    console.log(`Response status: ${response.status}`);
    console.log(`Response: ${responseText}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

addDefaultStorageBucket();
