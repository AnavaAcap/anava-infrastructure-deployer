import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';

export class ApiGatewayDeployer {
  private apigateway = google.apigateway('v1');
  private servicemanagement = google.servicemanagement('v1');
  private apikeys = google.apikeys('v2');

  constructor(private auth: OAuth2Client) {}

  async deployApiGateway(
    projectId: string,
    apiId: string,
    configPath: string,
    serviceAccount: string,
    region: string,
    deviceAuthUrl: string,
    tvmUrl: string,
    corsOrigins: string[]
  ): Promise<{ gatewayUrl: string; apiKey: string }> {
    console.log('=== Starting API Gateway deployment ===');
    console.log(`Project: ${projectId}, API ID: ${apiId}, Region: ${region}`);
    console.log(`Config path: ${configPath}`);
    console.log(`Device Auth URL: ${deviceAuthUrl}`);
    console.log(`TVM URL: ${tvmUrl}`);
    
    // Step 1: Create managed service
    console.log('\n--- Step 1: Creating managed service ---');
    const serviceName = await this.createManagedService(projectId, apiId);
    console.log(`Managed service name: ${serviceName}`);

    // Step 2: Process and upload API config
    console.log('\n--- Step 2: Creating API config ---');
    const configId = await this.createApiConfig(
      projectId,
      apiId,
      configPath,
      serviceName,
      deviceAuthUrl,
      tvmUrl
    );
    console.log(`API config ID: ${configId}`);

    // Step 3: Create API Gateway
    console.log('\n--- Step 3: Creating API Gateway ---');
    const gatewayUrl = await this.createGateway(
      projectId,
      apiId,
      configId,
      serviceAccount,
      region
    );
    console.log(`Gateway URL: ${gatewayUrl}`);

    // Step 4: Create API key
    console.log('\n--- Step 4: Creating API key ---');
    const apiKey = await this.createApiKey(
      projectId,
      apiId,
      serviceName,
      corsOrigins
    );
    console.log(`API key created successfully`);

    console.log('\n=== API Gateway deployment completed successfully ===');
    return { gatewayUrl, apiKey };
  }

  private async createManagedService(projectId: string, apiId: string): Promise<string> {
    const serviceName = `${apiId}.apigateway.${projectId}.cloud.goog`;

    try {
      // Check if service already exists
      await this.servicemanagement.services.get({
        serviceName: serviceName,
        auth: this.auth
      });
      
      console.log(`Managed service ${serviceName} already exists`);
      return serviceName;
    } catch (error: any) {
      // 404 means service doesn't exist, which is expected
      // 403 can also mean the service doesn't exist (permission denied on non-existent resource)
      if (error.code !== 404 && error.code !== 403) {
        throw error;
      }
      console.log(`Managed service ${serviceName} does not exist, creating it...`);
    }

    // Create the managed service
    const response = await this.servicemanagement.services.create({
      auth: this.auth,
      requestBody: {
        serviceName: serviceName,
        producerProjectId: projectId
      }
    });

    const operation = response.data;
    if (!operation.name) {
      throw new Error('Failed to create managed service');
    }

    // Wait for operation to complete
    await this.waitForServiceManagementOperation(operation.name);

    return serviceName;
  }

  private async createApiConfig(
    projectId: string,
    apiId: string,
    configPath: string,
    serviceName: string,
    deviceAuthUrl: string,
    tvmUrl: string
  ): Promise<string> {
    // Read and process the API config template
    console.log(`Reading API config from ${configPath}...`);
    let configContent: string;
    try {
      configContent = fs.readFileSync(configPath, 'utf8');
      console.log(`Successfully read API config (${configContent.length} characters)`);
    } catch (error: any) {
      console.error(`Failed to read API config file: ${error.message}`);
      throw new Error(`Cannot read API config file at ${configPath}: ${error.message}`);
    }
    
    // Replace placeholders
    configContent = configContent
      .replace(/\${DEVICE_AUTH_URL}/g, deviceAuthUrl)
      .replace(/\${TVM_URL}/g, tvmUrl)
      .replace(/\${SERVICE_NAME}/g, serviceName);

    // Generate a config ID
    const configId = `config-${Date.now()}`;
    const parent = `projects/${projectId}/locations/global/apis/${apiId}`;

    try {
      // Create or get the API
      console.log(`Checking if API ${apiId} exists...`);
      try {
        await this.apigateway.projects.locations.apis.get({
          name: parent,
          auth: this.auth
        });
        console.log(`API ${apiId} already exists`);
      } catch (error: any) {
        if (error.code === 404) {
          // Create the API
          console.log(`API ${apiId} not found, creating it...`);
          const createResponse = await this.apigateway.projects.locations.apis.create({
            parent: `projects/${projectId}/locations/global`,
            apiId: apiId,
            auth: this.auth,
            requestBody: {
              name: parent,
              displayName: `Anava API - ${apiId}`,
              managedService: serviceName
            }
          });
          
          // Wait for API creation to complete
          if (createResponse.data.name) {
            console.log('Waiting for API creation to complete...');
            await this.waitForApiGatewayOperation(createResponse.data.name);
            console.log('API created successfully');
          }
        } else {
          throw error;
        }
      }

      // Create the API config with retry logic for "parent not ready" errors
      console.log(`Creating API config ${configId}...`);
      let response;
      let retries = 0;
      const maxRetries = 10;
      const retryDelay = 10000; // 10 seconds
      
      while (retries < maxRetries) {
        try {
          response = await this.apigateway.projects.locations.apis.configs.create({
            parent: parent,
            apiConfigId: configId,
            auth: this.auth,
            requestBody: {
              name: `${parent}/configs/${configId}`,
              displayName: `Config ${configId}`,
              openapiDocuments: [{
                document: {
                  path: 'openapi.yaml',
                  contents: Buffer.from(configContent).toString('base64')
                }
              }]
            }
          });
          break; // Success, exit the retry loop
        } catch (error: any) {
          // Check if it's a "parent not ready" error
          const errorMessage = error.response?.data?.error?.message || error.message || '';
          if (error.code === 409 && errorMessage.includes('parent resource is not in ready state')) {
            retries++;
            if (retries < maxRetries) {
              console.log(`API not ready yet, waiting ${retryDelay/1000}s before retry ${retries}/${maxRetries}...`);
              await new Promise(resolve => setTimeout(resolve, retryDelay));
              continue;
            }
          }
          // For other errors or max retries exceeded, throw the error
          throw error;
        }
      }

      if (!response) {
        throw new Error('No response received from API config creation');
      }

      const operation = response.data;
      if (!operation.name) {
        throw new Error('Failed to create API config');
      }

      console.log('Waiting for API config creation to complete...');
      await this.waitForApiGatewayOperation(operation.name);
      console.log(`API config ${configId} created successfully`);

      return configId;
    } catch (error: any) {
      console.error('Failed to create API config:', error);
      throw error;
    }
  }

  private async createGateway(
    projectId: string,
    apiId: string,
    configId: string,
    _serviceAccount: string,
    region: string
  ): Promise<string> {
    const gatewayId = `${apiId}-gateway`;
    const parent = `projects/${projectId}/locations/${region}`;
    const gatewayName = `${parent}/gateways/${gatewayId}`;

    console.log(`Creating gateway ${gatewayId} in region ${region}...`);
    
    try {
      // Check if gateway exists
      const { data: existingGateway } = await this.apigateway.projects.locations.gateways.get({
        name: gatewayName,
        auth: this.auth
      });

      console.log(`Gateway ${gatewayId} already exists`);
      return existingGateway.defaultHostname || '';
    } catch (error: any) {
      if (error.code !== 404) throw error;
    }

    // Create the gateway with retry logic
    let response;
    let retries = 0;
    const maxRetries = 10;
    const retryDelay = 10000; // 10 seconds
    
    while (retries < maxRetries) {
      try {
        response = await this.apigateway.projects.locations.gateways.create({
          parent: parent,
          gatewayId: gatewayId,
          auth: this.auth,
          requestBody: {
            name: gatewayName,
            displayName: `Anava Gateway - ${apiId}`,
            apiConfig: `projects/${projectId}/locations/global/apis/${apiId}/configs/${configId}`
          }
        });
        break; // Success, exit the retry loop
      } catch (error: any) {
        // Check if it's a timing-related error
        const errorMessage = error.response?.data?.error?.message || error.message || '';
        if ((error.code === 409 || error.code === 400) && 
            (errorMessage.includes('not ready') || errorMessage.includes('does not exist'))) {
          retries++;
          if (retries < maxRetries) {
            console.log(`Resources not ready yet, waiting ${retryDelay/1000}s before retry ${retries}/${maxRetries}...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
        }
        // For other errors or max retries exceeded, throw the error
        throw error;
      }
    }

    if (!response) {
      throw new Error('No response received from gateway creation');
    }

    const operation = response.data;
    if (!operation.name) {
      throw new Error('Failed to create gateway');
    }

    console.log('Waiting for gateway creation to complete...');
    await this.waitForApiGatewayOperation(operation.name);
    console.log(`Gateway ${gatewayId} created successfully`);

    // Get the gateway to retrieve its URL
    const { data: gateway } = await this.apigateway.projects.locations.gateways.get({
      name: gatewayName,
      auth: this.auth
    });

    return `https://${gateway.defaultHostname}`;
  }

  private async createApiKey(
    projectId: string,
    apiId: string,
    serviceName: string,
    corsOrigins: string[]
  ): Promise<string> {
    const keyId = `${apiId}-key-${Date.now()}`;
    const parent = `projects/${projectId}/locations/global`;

    console.log(`Creating API key ${keyId}...`);
    
    // Create restrictions for the API key
    const restrictions: any = {
      apiTargets: [{
        service: serviceName
      }]
    };

    // Add browser restrictions if CORS origins are specified
    if (corsOrigins && corsOrigins.length > 0) {
      restrictions.browserKeyRestrictions = {
        allowedReferrers: corsOrigins.map(origin => `${origin}/*`)
      };
    }

    const response = await this.apikeys.projects.locations.keys.create({
      parent: parent,
      keyId: keyId,
      auth: this.auth,
      requestBody: {
        displayName: `Anava API Key - ${apiId}`,
        restrictions: restrictions
      }
    });

    const operation = response.data;
    if (!operation.name) {
      throw new Error('Failed to create API key');
    }

    // Wait for operation to complete
    console.log('Waiting for API key creation to complete...');
    await this.waitForApiKeysOperation(operation.name);
    console.log(`API key ${keyId} created successfully`);

    // Get the created key
    const keyName = `${parent}/keys/${keyId}`;
    await this.apikeys.projects.locations.keys.get({
      name: keyName,
      auth: this.auth
    });

    // Get the key string
    const { data: keyString } = await this.apikeys.projects.locations.keys.getKeyString({
      name: keyName,
      auth: this.auth
    });

    return keyString.keyString || '';
  }

  private async waitForServiceManagementOperation(operationName: string): Promise<void> {
    console.log(`Waiting for service management operation: ${operationName}`);
    let done = false;
    let retries = 0;
    const maxRetries = 60;

    while (!done && retries < maxRetries) {
      const { data: operation } = await this.servicemanagement.operations.get({
        name: operationName,
        auth: this.auth
      });

      if (operation.done) {
        done = true;
        if (operation.error) {
          throw new Error(`Operation failed: ${JSON.stringify(operation.error)}`);
        }
      } else {
        if (retries % 3 === 0) { // Log every 15 seconds
          console.log(`Still waiting for service management operation... (${retries * 5}s elapsed)`);
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
        retries++;
      }
    }

    if (!done) {
      throw new Error('Operation timed out');
    }
  }

  private async waitForApiGatewayOperation(operationName: string): Promise<void> {
    let done = false;
    let retries = 0;
    const maxRetries = 60;

    while (!done && retries < maxRetries) {
      const { data: operation } = await this.apigateway.projects.locations.operations.get({
        name: operationName,
        auth: this.auth
      });

      if (operation.done) {
        done = true;
        if (operation.error) {
          throw new Error(`Operation failed: ${JSON.stringify(operation.error)}`);
        }
      } else {
        if (retries % 3 === 0) { // Log every 15 seconds
          console.log(`Still waiting for operation ${operationName.split('/').pop()}... (${retries * 5}s elapsed)`);
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
        retries++;
      }
    }

    if (!done) {
      throw new Error('Operation timed out');
    }
  }

  private async waitForApiKeysOperation(operationName: string): Promise<void> {
    console.log(`Waiting for API keys operation: ${operationName}`);
    let done = false;
    let retries = 0;
    const maxRetries = 60;

    while (!done && retries < maxRetries) {
      const { data: operation } = await this.apikeys.operations.get({
        name: operationName,
        auth: this.auth
      });

      if (operation.done) {
        done = true;
        if (operation.error) {
          throw new Error(`Operation failed: ${JSON.stringify(operation.error)}`);
        }
      } else {
        if (retries % 3 === 0) { // Log every 15 seconds
          console.log(`Still waiting for API keys operation... (${retries * 5}s elapsed)`);
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
        retries++;
      }
    }

    if (!done) {
      throw new Error('Operation timed out');
    }
  }
}