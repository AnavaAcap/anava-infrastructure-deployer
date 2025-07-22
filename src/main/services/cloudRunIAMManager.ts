import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

/**
 * Manager for Cloud Run IAM permissions
 * Needed because Cloud Functions v2 are backed by Cloud Run services
 */
export class CloudRunIAMManager {
  private run = google.run('v2');
  
  constructor(private auth: OAuth2Client) {}

  /**
   * Grant invoker permission to a service account on a Cloud Run service
   * This is needed for API Gateway to invoke Cloud Functions v2
   */
  async grantInvokerPermission(
    projectId: string,
    region: string,
    serviceName: string,
    serviceAccountEmail: string
  ): Promise<void> {
    console.log(`Granting Cloud Run invoker permission to ${serviceAccountEmail} on ${serviceName}...`);
    
    try {
      const resource = `projects/${projectId}/locations/${region}/services/${serviceName}`;
      
      // Get current IAM policy
      const { data: currentPolicy } = await this.run.projects.locations.services.getIamPolicy({
        resource,
        auth: this.auth
      });
      
      const policy = currentPolicy || { bindings: [] };
      
      // Check if binding already exists
      const member = `serviceAccount:${serviceAccountEmail}`;
      const role = 'roles/run.invoker';
      
      let binding = policy.bindings?.find(b => b.role === role);
      
      if (!binding) {
        binding = {
          role,
          members: []
        };
        policy.bindings = policy.bindings || [];
        policy.bindings.push(binding);
      }
      
      if (!binding.members?.includes(member)) {
        binding.members = binding.members || [];
        binding.members.push(member);
        
        // Update IAM policy
        await this.run.projects.locations.services.setIamPolicy({
          resource,
          auth: this.auth,
          requestBody: {
            policy
          }
        });
        
        console.log(`Successfully granted run.invoker permission to ${serviceAccountEmail} on ${serviceName}`);
      } else {
        console.log(`${serviceAccountEmail} already has run.invoker permission on ${serviceName}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to grant Cloud Run invoker permission: ${error.message}`);
    }
  }
}