const projectId = 'agile-being-466720-s0';

async function checkFirebaseProject() {
  try {
    const { execSync } = require('child_process');
    const accessToken = execSync('gcloud auth print-access-token').toString().trim();
    
    // Get Firebase project details
    const projectUrl = `https://firebase.googleapis.com/v1beta1/projects/${projectId}`;
    
    const response = await fetch(projectUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-goog-user-project': projectId
      }
    });
    
    if (response.ok) {
      const project = await response.json();
      console.log('Firebase Project:', JSON.stringify(project, null, 2));
      
      // Check default bucket status
      if (project.resources?.storageBucket) {
        console.log(`\n✅ Default storage bucket: ${project.resources.storageBucket}`);
      } else {
        console.log('\n❌ No default storage bucket configured');
      }
    } else {
      console.log('Failed to get Firebase project:', response.status, await response.text());
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkFirebaseProject();
