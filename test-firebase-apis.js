const projectId = 'agile-being-466720-s0';
const { execSync } = require('child_process');

async function testAPI(name, method, url, body = null) {
  try {
    const accessToken = execSync('gcloud auth print-access-token').toString().trim();
    
    console.log(`\n=== Testing ${name} ===`);
    console.log(`${method} ${url}`);
    
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-goog-user-project': projectId
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    const responseText = await response.text();
    
    console.log(`Status: ${response.status}`);
    if (responseText) {
      try {
        const json = JSON.parse(responseText);
        console.log('Response:', JSON.stringify(json, null, 2));
      } catch {
        console.log('Response:', responseText);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function runTests() {
  // Test various Firebase Storage-related endpoints
  await testAPI(
    'Get Firebase project',
    'GET',
    `https://firebase.googleapis.com/v1beta1/projects/${projectId}`
  );
  
  await testAPI(
    'Get project resources',
    'GET', 
    `https://firebase.googleapis.com/v1beta1/projects/${projectId}/resources`
  );
  
  await testAPI(
    'List available locations',
    'GET',
    `https://firebase.googleapis.com/v1beta1/projects/${projectId}/availableLocations`
  );
  
  // Try to update project with storage bucket
  await testAPI(
    'Update project resources',
    'PATCH',
    `https://firebase.googleapis.com/v1beta1/projects/${projectId}?updateMask=resources.storageBucket`,
    {
      resources: {
        storageBucket: `${projectId}.appspot.com`
      }
    }
  );
}

runTests();
