import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

export class CloudFunctionsDeployerV1 {
  private cloudfunctions = google.cloudfunctions('v1');

  constructor(private auth: OAuth2Client) {}

  async checkV2FunctionExists(projectId: string, functionName: string, region: string): Promise<string | null> {
    try {
      const v2 = google.cloudfunctions('v2');
      const functionId = `projects/${projectId}/locations/${region}/functions/${functionName}`;
      
      const { data: v2Function } = await v2.projects.locations.functions.get({
        name: functionId,
        auth: this.auth
      });
      
      if (v2Function && v2Function.serviceConfig?.uri) {
        console.log(`Found existing v2 function ${functionName} at ${v2Function.serviceConfig.uri}`);
        return v2Function.serviceConfig.uri;
      } else if (v2Function) {
        // Function exists but might be in broken state
        console.log(`Found v2 function ${functionName} but it has no URI (state: ${v2Function.state})`);
        return null;
      }
    } catch (error: any) {
      // Function doesn't exist in v2, which is fine
      if (error.code !== 404) {
        console.log(`Error checking v2 function: ${error.message}`);
      }
    }
    return null;
  }

  async deployFunction(
    projectId: string,
    functionName: string,
    _sourceDir: string,
    entryPoint: string,
    runtime: string,
    serviceAccount: string,
    envVars: Record<string, string>,
    region: string
  ): Promise<string> {
    console.log(`Deploying function ${functionName}:`);
    console.log(`  Entry point: ${entryPoint}`);
    console.log(`  Runtime: ${runtime}`);
    
    // First check if a v2 function already exists
    const v2FunctionUrl = await this.checkV2FunctionExists(projectId, functionName, region);
    if (v2FunctionUrl) {
      console.log(`Using existing v2 function ${functionName}`);
      return v2FunctionUrl;
    }
    
    // Check if function exists in broken state and delete it
    const functionState = await this.checkFunctionState(projectId, functionName, region);
    if (functionState === 'BROKEN') {
      console.log(`Function ${functionName} is in broken state, deleting it...`);
      await this.deleteFunction(projectId, functionName, region);
      // Wait a bit for deletion to complete
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
    // Use gcloud CLI deployment with inline source generation like vertexSetup_gcp.sh
    const functionUrl = await this.deployWithGcloud(
      projectId,
      functionName,
      entryPoint,
      runtime,
      serviceAccount,
      envVars,
      region
    );

    return functionUrl;
  }
  
  private async checkFunctionState(projectId: string, functionName: string, region: string): Promise<string | null> {
    try {
      const v2 = google.cloudfunctions('v2');
      const functionId = `projects/${projectId}/locations/${region}/functions/${functionName}`;
      
      const { data: v2Function } = await v2.projects.locations.functions.get({
        name: functionId,
        auth: this.auth
      });
      
      // Function exists but has no URI - it's in a bad state
      if (v2Function && !v2Function.serviceConfig?.uri) {
        console.log(`Function ${functionName} state: ${v2Function.state}`);
        return 'BROKEN';
      }
      
      return v2Function?.state || null;
    } catch (error) {
      return null;
    }
  }
  
  private async deleteFunction(projectId: string, functionName: string, region: string): Promise<void> {
    try {
      console.log(`Deleting function ${functionName}...`);
      execSync(`gcloud functions delete ${functionName} --project=${projectId} --region=${region} --quiet`, {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      console.log(`Function ${functionName} deleted successfully`);
    } catch (error: any) {
      console.error(`Failed to delete function: ${error.message}`);
    }
  }

  private async deployWithGcloud(
    projectId: string,
    functionName: string,
    entryPoint: string,
    runtime: string,
    serviceAccount: string,
    envVars: Record<string, string>,
    region: string
  ): Promise<string> {
    const tempDir = await this.createInlineSourceCode(functionName, entryPoint, runtime, envVars);
    
    
    try {
      // Create environment variables file
      const envFile = path.join(tempDir, '.env.yaml');
      const envContent = Object.entries(envVars)
        .map(([key, value]) => `${key}: '${value}'`)
        .join('\n');
      fs.writeFileSync(envFile, envContent);
      
      // Deploy with retry logic for 409 conflicts (like vertexSetup_gcp.sh)
      const functionUrl = await this.deployWithRetry(
        projectId,
        functionName,
        tempDir,
        entryPoint,
        runtime,
        serviceAccount,
        envFile,
        region
      );
      
      return functionUrl;
    } finally {
      // Clean up temp directory
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  private async createInlineSourceCode(
    functionName: string,
    entryPoint: string,
    _runtime: string,
    _envVars: Record<string, string>
  ): Promise<string> {
    const tempDir = path.join(os.tmpdir(), `${functionName}-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Always use Python like vertexSetup_gcp.sh
    const pythonCode = this.generatePythonFunctionCode(functionName, entryPoint);
    fs.writeFileSync(path.join(tempDir, 'main.py'), pythonCode);
    
    // Create minimal requirements.txt
    const requirements = functionName === 'token-vending-machine' 
      ? 'functions-framework>=3.1.0\nrequests>=2.28.0'
      : 'functions-framework>=3.1.0';
    fs.writeFileSync(path.join(tempDir, 'requirements.txt'), requirements);
    
    return tempDir;
  }

  private generatePythonFunctionCode(functionName: string, entryPoint: string): string {
    if (functionName === 'device-auth') {
      return `import functions_framework
import json
from datetime import datetime

@functions_framework.http
def ${entryPoint}(request):
    """Device authentication endpoint."""
    return {
        'status': 'Device auth endpoint working',
        'timestamp': datetime.now().isoformat(),
        'function': '${functionName}'
    }`;
    } else if (functionName === 'token-vending-machine') {
      // Copy exact TVM implementation from vertexSetup_gcp.sh
      return `import functions_framework
import requests
import json
import os
from datetime import datetime

@functions_framework.http
def ${entryPoint}(request):
    """Token vending machine for Firebase to GCP authentication."""
    
    # Handle CORS preflight
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
        return ('', 204, headers)
    
    if request.method != 'POST':
        return ({'error': 'Method not allowed'}, 405)
    
    try:
        # Get Firebase ID token from request
        data = request.get_json()
        if not data or 'firebase_token' not in data:
            return ({'error': 'firebase_token required'}, 400)
        
        firebase_token = data['firebase_token']
        
        # Environment variables
        project_number = os.environ.get('WIF_PROJECT_NUMBER')
        pool_id = os.environ.get('WIF_POOL_ID')
        provider_id = os.environ.get('WIF_PROVIDER_ID')
        target_sa = os.environ.get('TARGET_SERVICE_ACCOUNT_EMAIL')
        
        if not all([project_number, pool_id, provider_id, target_sa]):
            return ({'error': 'Missing environment configuration'}, 500)
        
        # STS token exchange
        sts_url = 'https://sts.googleapis.com/v1/token'
        audience = f'//iam.googleapis.com/projects/{project_number}/locations/global/workloadIdentityPools/{pool_id}/providers/{provider_id}'
        
        sts_data = {
            'audience': audience,
            'grantType': 'urn:ietf:params:oauth:grant-type:token-exchange',
            'requestedTokenType': 'urn:ietf:params:oauth:token-type:access_token',
            'subjectToken': firebase_token,
            'subjectTokenType': 'urn:ietf:params:oauth:token-type:id_token',
            'scope': 'https://www.googleapis.com/auth/cloud-platform'
        }
        
        sts_response = requests.post(sts_url, data=sts_data)
        if sts_response.status_code != 200:
            return ({'error': f'STS exchange failed: {sts_response.text}'}, 400)
        
        federated_token = sts_response.json().get('access_token')
        
        # Impersonate target service account
        impersonate_url = f'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/{target_sa}:generateAccessToken'
        
        impersonate_data = {
            'scope': ['https://www.googleapis.com/auth/cloud-platform'],
            'lifetime': '3600s'
        }
        
        headers = {'Authorization': f'Bearer {federated_token}'}
        
        impersonate_response = requests.post(impersonate_url, json=impersonate_data, headers=headers)
        if impersonate_response.status_code != 200:
            return ({'error': f'Impersonation failed: {impersonate_response.text}'}, 400)
        
        result = impersonate_response.json()
        
        return ({
            'access_token': result.get('accessToken'),
            'expires_in': result.get('expireTime'),
            'timestamp': datetime.now().isoformat()
        }, 200)
        
    except Exception as e:
        print(f'TVM error: {str(e)}')
        return ({'error': f'Internal error: {str(e)}'}, 500)`;
    }
    
    return `import functions_framework

@functions_framework.http
def ${entryPoint}(request):
    return {'status': 'Function working', 'name': '${functionName}'}`;
  }
  
  private async deployWithRetry(
    projectId: string,
    functionName: string,
    sourceDir: string,
    entryPoint: string,
    runtime: string,
    serviceAccount: string,
    envFile: string,
    region: string
  ): Promise<string> {
    const maxRetries = 3;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Deployment attempt ${attempt}/${maxRetries} for ${functionName}`);
        
        // Use Gen2 like the working vertexSetup_gcp.sh
        const gcloudRuntime = runtime.startsWith('python') ? 'python311' : 'nodejs20';
        
        const command = [
          'gcloud', 'functions', 'deploy', functionName,
          `--project=${projectId}`,
          `--region=${region}`,
          '--gen2',
          `--runtime=${gcloudRuntime}`,
          `--source=${sourceDir}`,
          `--entry-point=${entryPoint}`,
          '--trigger-http',
          '--no-allow-unauthenticated',
          `--service-account=${serviceAccount}`,
          `--env-vars-file=${envFile}`,
          '--max-instances=5',
          '--quiet',
          '--format=json'
        ].join(' ');
        
        console.log(`Executing: ${command}`);
        
        const result = execSync(command, {
          encoding: 'utf-8',
          timeout: 600000, // 10 minutes
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        // Parse the result to get the function URL
        const functionData = JSON.parse(result);
        const functionUrl = functionData.serviceConfig?.uri || functionData.url;
        
        if (!functionUrl) {
          // Fallback: get function URL via API
          return await this.getFunctionUrl(projectId, functionName, region);
        }
        
        console.log(`Successfully deployed ${functionName} at ${functionUrl}`);
        return functionUrl;
        
      } catch (error: any) {
        lastError = error;
        const errorMsg = error.message || error.toString();
        
        // Log stderr output if available
        if (error.stderr) {
          console.error('Cloud Build stderr:', error.stderr);
        }
        
        // Check for 409 conflict (concurrent deployment)
        if (errorMsg.includes('409') || errorMsg.includes('conflict')) {
          if (attempt < maxRetries) {
            console.log(`Deployment conflict detected, retrying in 60 seconds... (attempt ${attempt}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 60000));
            continue;
          }
        }
        
        console.error(`Deployment attempt ${attempt} failed:`, errorMsg);
        
        if (attempt === maxRetries) {
          break;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }
    
    throw new Error(`Failed to deploy ${functionName} after ${maxRetries} attempts. Last error: ${lastError?.message}`);
  }
  
  private async getFunctionUrl(projectId: string, functionName: string, region: string): Promise<string> {
    try {
      // Try v2 first
      const v2 = google.cloudfunctions('v2');
      const functionId = `projects/${projectId}/locations/${region}/functions/${functionName}`;
      
      const { data: v2Function } = await v2.projects.locations.functions.get({
        name: functionId,
        auth: this.auth
      });
      
      if (v2Function?.serviceConfig?.uri) {
        return v2Function.serviceConfig.uri;
      }
    } catch (error) {
      // Try v1
      try {
        const functionId = `projects/${projectId}/locations/${region}/functions/${functionName}`;
        const { data: v1Function } = await this.cloudfunctions.projects.locations.functions.get({
          name: functionId,
          auth: this.auth
        });
        
        if (v1Function?.httpsTrigger?.url) {
          return v1Function.httpsTrigger.url;
        }
      } catch (v1Error) {
        console.error('Failed to get function URL from both v1 and v2 APIs');
      }
    }
    
    throw new Error(`Could not retrieve URL for function ${functionName}`);
  }
}