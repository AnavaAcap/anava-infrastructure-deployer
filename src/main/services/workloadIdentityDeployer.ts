import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export class WorkloadIdentityDeployer {
  private iam = google.iam('v1');

  constructor(private auth: OAuth2Client) {}

  async configureWorkloadIdentity(
    projectId: string,
    projectNumber: string,
    poolId: string,
    providerId: string,
    firebaseProjectId: string,
    serviceAccountEmail: string
  ): Promise<{ poolName: string; providerName: string }> {
    // Step 1: Create Workload Identity Pool
    const poolName = await this.createWorkloadIdentityPool(projectNumber, poolId);

    // Step 2: Create Workload Identity Provider
    const providerName = await this.createWorkloadIdentityProvider(
      projectNumber,
      poolId,
      providerId,
      firebaseProjectId
    );

    // Step 3: Grant service account impersonation
    await this.grantServiceAccountImpersonation(
      projectId,
      serviceAccountEmail,
      projectNumber,
      poolId
    );

    return { poolName, providerName };
  }

  private async createWorkloadIdentityPool(
    projectNumber: string,
    poolId: string
  ): Promise<string> {
    const parent = `projects/${projectNumber}/locations/global`;
    const poolName = `${parent}/workloadIdentityPools/${poolId}`;

    try {
      // Check if pool exists
      await this.iam.projects.locations.workloadIdentityPools.get({
        name: poolName,
        auth: this.auth
      });

      console.log(`Workload Identity Pool ${poolId} already exists`);
      return poolName;
    } catch (error: any) {
      if (error.code !== 404) throw error;
    }

    // Create the pool
    const { data: operation } = await this.iam.projects.locations.workloadIdentityPools.create({
      parent: parent,
      workloadIdentityPoolId: poolId,
      auth: this.auth,
      requestBody: {
        displayName: 'Anava Firebase Pool',
        description: 'Pool for Firebase authentication to GCP resources',
        disabled: false
      }
    });

    await this.waitForOperation(operation.name!);
    console.log(`Created Workload Identity Pool: ${poolId}`);

    return poolName;
  }

  private async createWorkloadIdentityProvider(
    projectNumber: string,
    poolId: string,
    providerId: string,
    firebaseProjectId: string
  ): Promise<string> {
    const parent = `projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}`;
    const providerName = `${parent}/providers/${providerId}`;

    try {
      // Check if provider exists
      await this.iam.projects.locations.workloadIdentityPools.providers.get({
        name: providerName,
        auth: this.auth
      });

      console.log(`Workload Identity Provider ${providerId} already exists`);
      return providerName;
    } catch (error: any) {
      if (error.code !== 404) throw error;
    }

    // Create the provider
    const { data: operation } = await this.iam.projects.locations.workloadIdentityPools.providers.create({
      parent: parent,
      workloadIdentityPoolProviderId: providerId,
      auth: this.auth,
      requestBody: {
        displayName: 'Firebase Auth Provider',
        description: 'Provider for Firebase authentication',
        disabled: false,
        oidc: {
          issuerUri: `https://securetoken.google.com/${firebaseProjectId}`,
          allowedAudiences: [firebaseProjectId]
        },
        attributeMapping: {
          'google.subject': 'assertion.sub',
          'attribute.firebase_user_id': 'assertion.sub',
          'attribute.firebase_project': 'assertion.aud'
        },
        attributeCondition: `assertion.aud == "${firebaseProjectId}"`
      }
    });

    await this.waitForOperation(operation.name!);
    console.log(`Created Workload Identity Provider: ${providerId}`);

    return providerName;
  }

  private async grantServiceAccountImpersonation(
    projectId: string,
    serviceAccountEmail: string,
    projectNumber: string,
    poolId: string
  ): Promise<void> {
    // Get current IAM policy for the service account
    const resource = `projects/${projectId}/serviceAccounts/${serviceAccountEmail}`;
    
    const { data: policy } = await this.iam.projects.serviceAccounts.getIamPolicy({
      resource: resource,
      auth: this.auth
    });

    // Add the workload identity pool as a member with workloadIdentityUser role
    const member = `principalSet://iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/*`;
    const role = 'roles/iam.workloadIdentityUser';

    // Check if binding already exists
    let binding = policy.bindings?.find(b => b.role === role);
    if (binding) {
      if (!binding.members?.includes(member)) {
        binding.members = binding.members || [];
        binding.members.push(member);
      } else {
        console.log('Workload Identity binding already exists');
        return;
      }
    } else {
      policy.bindings = policy.bindings || [];
      policy.bindings.push({
        role: role,
        members: [member]
      });
    }

    // Update IAM policy
    await this.iam.projects.serviceAccounts.setIamPolicy({
      resource: resource,
      auth: this.auth,
      requestBody: {
        policy: policy
      }
    });

    console.log(`Granted ${role} to workload identity pool on ${serviceAccountEmail}`);
  }

  private async waitForOperation(operationName: string): Promise<void> {
    let done = false;
    let retries = 0;
    const maxRetries = 60;

    while (!done && retries < maxRetries) {
      const { data: operation } = await this.iam.projects.locations.workloadIdentityPools.operations.get({
        name: operationName,
        auth: this.auth
      });

      if (operation.done) {
        done = true;
        if (operation.error) {
          throw new Error(`Operation failed: ${JSON.stringify(operation.error)}`);
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 5000));
        retries++;
      }
    }

    if (!done) {
      throw new Error('Operation timed out');
    }
  }
}