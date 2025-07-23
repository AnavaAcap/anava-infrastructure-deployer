const projectId = 'agile-being-466720-s0';
const { execSync } = require('child_process');

async function testAuthEnable() {
  try {
    const accessToken = execSync('gcloud auth print-access-token').toString().trim();
    
    // Get current auth config
    const configUrl = `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`;
    
    console.log('Getting current auth config...');
    const getResponse = await fetch(configUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-goog-user-project': projectId
      }
    });
    
    if (\!getResponse.ok) {
      console.error('Failed to get config:', getResponse.status);
      console.error(await getResponse.text());
      return;
    }
    
    const currentConfig = await getResponse.json();
    console.log('Current auth config:', JSON.stringify(currentConfig, null, 2));
    
    // Check if email/password is enabled
    if (currentConfig.signIn?.email?.enabled) {
      console.log('\n✅ Email/Password authentication is already enabled\!');
    } else {
      console.log('\n❌ Email/Password authentication is NOT enabled');
      
      // Try to enable it
      console.log('\nEnabling email/password authentication...');
      const updateMask = 'signIn.email.enabled,signIn.email.passwordRequired';
      const patchUrl = configUrl + '?updateMask=' + encodeURIComponent(updateMask);
      
      const patchResponse = await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
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
      
      if (patchResponse.ok) {
        console.log('✅ Successfully enabled email/password authentication\!');
      } else {
        console.error('Failed to enable auth:', patchResponse.status);
        console.error(await patchResponse.text());
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testAuthEnable();
