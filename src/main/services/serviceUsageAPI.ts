import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export class ServiceUsageAPI {
  private serviceusage = google.serviceusage('v1');

  constructor(private auth: OAuth2Client) {}

  async enableApi(projectId: string, apiName: string): Promise<void> {
    console.log(`Enabling API ${apiName} for project ${projectId}...`);

    try {
      // Check if API is already enabled
      const parent = `projects/${projectId}`;
      const { data } = await this.serviceusage.services.list({
        parent,
        filter: `state:ENABLED`,
        auth: this.auth
      });

      const serviceName = apiName.endsWith('.googleapis.com') 
        ? apiName 
        : `${apiName}.googleapis.com`;

      const enabledService = data.services?.find(
        service => service.name === `${parent}/services/${serviceName}`
      );

      if (enabledService) {
        console.log(`API ${apiName} is already enabled`);
        return;
      }

      // Enable the API
      const operation = await this.serviceusage.services.enable({
        name: `${parent}/services/${serviceName}`,
        auth: this.auth
      });

      if (operation.data.name) {
        console.log(`Waiting for ${apiName} to be enabled...`);
        await this.waitForOperation(operation.data.name);
      }

      console.log(`API ${apiName} enabled successfully`);
    } catch (error: any) {
      console.error(`Failed to enable API ${apiName}:`, error);
      throw new Error(`Failed to enable API ${apiName}: ${error.message}`);
    }
  }

  async listEnabledServices(projectId: string): Promise<string[]> {
    try {
      const { data } = await this.serviceusage.services.list({
        parent: `projects/${projectId}`,
        filter: 'state:ENABLED',
        pageSize: 200,
        auth: this.auth
      });

      return (data.services || []).map(service => {
        const parts = service.name?.split('/') || [];
        return parts[parts.length - 1];
      });
    } catch (error: any) {
      console.error('Failed to list enabled services:', error);
      return [];
    }
  }

  private async waitForOperation(operationName: string): Promise<void> {
    let done = false;
    let retries = 0;
    const maxRetries = 60; // 5 minutes

    while (!done && retries < maxRetries) {
      const { data: operation } = await this.serviceusage.operations.get({
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