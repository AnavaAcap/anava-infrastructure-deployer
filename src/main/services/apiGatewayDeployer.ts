import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import { ResilienceUtils } from './utils/resilienceUtils';

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
    corsOrigins: string[],
    progressCallback?: (subStep: string, progress: number, detail?: string) => void,
    logCallback?: (message: string) => void
  ): Promise<{ gatewayUrl: string; apiKey: string }> {
    const log = (message: string) => {
      console.log(message);
      logCallback?.(message);
    };
    
    log('=== Starting API Gateway deployment ===');
    log(`Project: ${projectId}, API ID: ${apiId}, Region: ${region}`);
    log(`Config path: ${configPath}`);
    log(`Device Auth URL: ${deviceAuthUrl}`);
    log(`TVM URL: ${tvmUrl}`);
    
    // Step 1: Create managed service
    log('\n--- Step 1: Creating managed service ---');
    progressCallback?.('managed-service', 0, 'Starting managed service creation...');
    const serviceName = await this.createManagedService(projectId, apiId, progressCallback, log);
    log(`Managed service name: ${serviceName}`);
    progressCallback?.('managed-service', 100, 'Managed service created');

    // Step 2: Process and upload API config
    log('\n--- Step 2: Creating API config ---');
    progressCallback?.('api-config', 0, 'Starting API configuration...');
    const configId = await this.createApiConfig(
      projectId,
      apiId,
      configPath,
      serviceName,
      deviceAuthUrl,
      tvmUrl,
      serviceAccount,
      progressCallback,
      log
    );
    log(`API config ID: ${configId}`);
    progressCallback?.('api-config', 100, 'API configuration created');

    // Step 3: Create API Gateway
    log('\n--- Step 3: Creating API Gateway ---');
    progressCallback?.('gateway', 0, 'Starting API Gateway creation...');
    const { gatewayUrl } = await this.createGateway(
      projectId,
      apiId,
      configId,
      serviceAccount,
      region,
      progressCallback,
      log
    );
    log(`Gateway URL: ${gatewayUrl}`);
    
    // Always check and enable the managed service if needed
    progressCallback?.('gateway', 85, 'Checking API Gateway managed service...');
    await this.enableApiGatewayManagedService(projectId, serviceName, log);
    
    progressCallback?.('gateway', 90, 'API Gateway ready, checking API key...');

    // Step 4: Create or retrieve API key
    log('\n--- Step 4: Creating API key ---');
    const apiKey = await this.createApiKey(
      projectId,
      apiId,
      serviceName,
      corsOrigins,
      log
    );
    log(`API key ready`);
    progressCallback?.('gateway', 100, 'API Gateway deployment complete');

    log('\n=== API Gateway deployment completed successfully ===');
    return { gatewayUrl, apiKey };
  }

  private async createManagedService(
    projectId: string, 
    apiId: string,
    progressCallback?: (subStep: string, progress: number, detail?: string) => void,
    log: (message: string) => void = console.log
  ): Promise<string> {
    const serviceName = `${apiId}.apigateway.${projectId}.cloud.goog`;

    try {
      // Check if service already exists
      await this.servicemanagement.services.get({
        serviceName: serviceName,
        auth: this.auth
      });
      
      log(`Managed service ${serviceName} already exists`);
      return serviceName;
    } catch (error: any) {
      // 404 means service doesn't exist, which is expected
      // 403 can also mean the service doesn't exist (permission denied on non-existent resource)
      if (error.code !== 404 && error.code !== 403) {
        throw error;
      }
      log(`Managed service ${serviceName} does not exist, creating it...`);
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
    await this.waitForServiceManagementOperation(operation.name, progressCallback, log);

    return serviceName;
  }

  private async createApiConfig(
    projectId: string,
    apiId: string,
    configPath: string,
    serviceName: string,
    deviceAuthUrl: string,
    tvmUrl: string,
    serviceAccount: string,
    progressCallback?: (subStep: string, progress: number, detail?: string) => void,
    log: (message: string) => void = console.log
  ): Promise<string> {
    // Read and process the API config template
    log(`Reading API config from ${configPath}...`);
    progressCallback?.('api-config', 10, 'Reading API configuration template...');
    
    let configContent = fs.readFileSync(configPath, 'utf8');
    
    // Log initial state
    log(`Config template has ${(configContent.match(/\${DEVICE_AUTH_URL}/g) || []).length} instances of \${DEVICE_AUTH_URL}`);
    log(`Config template has ${(configContent.match(/\${TVM_URL}/g) || []).length} instances of \${TVM_URL}`);
    
    // Verify the URLs we're replacing with are valid
    if (!deviceAuthUrl || !tvmUrl || deviceAuthUrl.includes('undefined') || tvmUrl.includes('undefined')) {
      log(`ERROR: Invalid URLs provided - deviceAuthUrl: ${deviceAuthUrl}, tvmUrl: ${tvmUrl}`);
      throw new Error('Invalid Cloud Run URLs provided for API Gateway configuration');
    }
    
    // Replace all occurrences of the placeholders with actual URLs
    // Use a more robust replacement to ensure all instances are replaced
    let replacementCount = 0;
    while (configContent.includes('${DEVICE_AUTH_URL}')) {
      configContent = configContent.replace('${DEVICE_AUTH_URL}', deviceAuthUrl);
      replacementCount++;
      if (replacementCount > 10) {
        log('ERROR: Too many replacement iterations for DEVICE_AUTH_URL - possible infinite loop');
        break;
      }
    }
    log(`Replaced ${replacementCount} instances of \${DEVICE_AUTH_URL}`);
    
    replacementCount = 0;
    while (configContent.includes('${TVM_URL}')) {
      configContent = configContent.replace('${TVM_URL}', tvmUrl);
      replacementCount++;
      if (replacementCount > 10) {
        log('ERROR: Too many replacement iterations for TVM_URL - possible infinite loop');
        break;
      }
    }
    log(`Replaced ${replacementCount} instances of \${TVM_URL}`);
    
    // Debug logging to verify replacements
    log(`Replaced DEVICE_AUTH_URL with: ${deviceAuthUrl}`);
    log(`Replaced TVM_URL with: ${tvmUrl}`);
    
    // Check if replacements actually happened
    if (configContent.includes('${DEVICE_AUTH_URL}') || configContent.includes('${TVM_URL}')) {
      log('WARNING: Placeholders still exist in config after replacement!');
      log('This will cause 401 errors when the API Gateway tries to call Cloud Functions');
      
      // Log first occurrence of remaining placeholders for debugging
      const lines = configContent.split('\n');
      lines.forEach((line, index) => {
        if (line.includes('${DEVICE_AUTH_URL}') || line.includes('${TVM_URL}')) {
          log(`Line ${index + 1} still has placeholder: ${line.trim()}`);
        }
      });
    } else {
      log('✓ All placeholders successfully replaced');
    }
    
    // Log a sample of the backend configuration for verification
    const backendSample = configContent.split('\n').filter(line => 
      line.includes('address:') || line.includes('jwt_audience:')
    ).slice(0, 4);
    log('Backend configuration sample:');
    backendSample.forEach(line => log(`  ${line.trim()}`));
    
    log(`Successfully read API config (${configContent.length} characters)`);
    progressCallback?.('api-config', 20, 'Processing API configuration...');
    
    // Check if API exists
    log(`Checking if API ${apiId} exists...`);
    let apiExists = false;
    try {
      await this.apigateway.projects.locations.apis.get({
        name: `projects/${projectId}/locations/global/apis/${apiId}`,
        auth: this.auth
      });
      apiExists = true;
      log(`API ${apiId} already exists`);
    } catch (error: any) {
      if (error.code === 404) {
        log(`API ${apiId} not found, creating it...`);
      } else {
        throw error;
      }
    }
    
    // Create API if it doesn't exist
    if (!apiExists) {
      progressCallback?.('api-config', 30, 'Creating API...');
      const createApiResponse = await this.apigateway.projects.locations.apis.create({
        parent: `projects/${projectId}/locations/global`,
        apiId: apiId,
        requestBody: {
          name: apiId,
          displayName: `Anava API - ${apiId}`,
          managedService: serviceName
        },
        auth: this.auth
      });
      
      if (createApiResponse.data.name) {
        log('Waiting for API creation to complete...');
        await this.waitForApiGatewayOperation(createApiResponse.data.name, progressCallback, 'api-config', 30, 50, log);
      }
      log('API created successfully');
    }
    
    progressCallback?.('api-config', 50, 'Checking for existing configurations...');
    
    // Check for existing configs
    log('Checking for existing API configs...');
    const { data: configs } = await this.apigateway.projects.locations.apis.configs.list({
      parent: `projects/${projectId}/locations/global/apis/${apiId}`,
      auth: this.auth
    });
    
    if (configs.apiConfigs && configs.apiConfigs.length > 0) {
      log(`Found ${configs.apiConfigs.length} existing API configs`);
      
      // Check if any of the existing configs are still being created
      const pendingConfigs = configs.apiConfigs.filter(c => c.state === 'CREATING');
      if (pendingConfigs.length > 0) {
        log(`Found ${pendingConfigs.length} configs still being created, will wait...`);
      }
      
      // Look for a successfully created config
      const activeConfigs = configs.apiConfigs.filter(c => c.state === 'ACTIVE');
      if (activeConfigs.length > 0) {
        const latestConfig = activeConfigs[activeConfigs.length - 1];
        const existingConfigId = latestConfig.name?.split('/').pop() || '';
        log(`Found existing active API config: ${existingConfigId}, will use it`);
        progressCallback?.('api-config', 100, 'Using existing API configuration');
        return existingConfigId;
      }
    }
    
    // Check for pending operations
    log('Checking for pending API config operations...');
    await this.checkAndWaitForPendingOperations(projectId, apiId, progressCallback, log);
    
    progressCallback?.('api-config', 70, 'Creating new API configuration...');
    
    // Create the API config with retry logic
    const configId = `config-${Date.now()}`;
    log(`Creating API config ${configId}...`);
    
    log(`Creating API config with service account: ${serviceAccount}`);
    
    const createConfigWithRetry = async () => {
      const { data: operation } = await this.apigateway.projects.locations.apis.configs.create({
        parent: `projects/${projectId}/locations/global/apis/${apiId}`,
        apiConfigId: configId,
        requestBody: {
          displayName: `Config for ${apiId}`,
          openapiDocuments: [{
            document: {
              path: 'openapi.yaml',
              contents: Buffer.from(configContent).toString('base64')
            }
          }],
          gatewayServiceAccount: serviceAccount
        },
        auth: this.auth
      });
      
      return operation;
    };
    
    const operation = await ResilienceUtils.withRetry(createConfigWithRetry, {
      maxAttempts: 3,
      initialDelayMs: 2000,
      maxDelayMs: 10000,
      onRetry: (attempt, error, delayMs) => {
        log(`API config creation failed (attempt ${attempt}), retrying in ${delayMs}ms...`);
        log(`Error: ${error.message}`);
        progressCallback?.('api-config', 70, `Retrying config creation (attempt ${attempt})...`);
      }
    });
    
    log('Waiting for API config creation to complete...');
    await this.waitForApiGatewayOperation(operation.name || '', progressCallback, 'api-config', 70, 100, log);
    
    log(`API config ${configId} created successfully`);
    return configId;
  }

  private async createGateway(
    projectId: string,
    apiId: string,
    configId: string,
    _serviceAccount: string,
    region: string,
    progressCallback?: (subStep: string, progress: number, detail?: string) => void,
    log: (message: string) => void = console.log
  ): Promise<{ gatewayUrl: string }> {
    const gatewayId = `${apiId}-gateway`;
    log(`Creating gateway ${gatewayId} in region ${region}...`);
    progressCallback?.('gateway', 10, 'Initializing gateway creation...');
    
    // Check if gateway already exists
    try {
      const { data: existingGateway } = await this.apigateway.projects.locations.gateways.get({
        name: `projects/${projectId}/locations/${region}/gateways/${gatewayId}`,
        auth: this.auth
      });
      
      if (existingGateway.defaultHostname) {
        log(`Gateway already exists at ${existingGateway.defaultHostname}`);
        progressCallback?.('gateway', 90, 'Using existing gateway');
        return { 
          gatewayUrl: `https://${existingGateway.defaultHostname}`
        };
      }
    } catch (error: any) {
      if (error.code !== 404) {
        throw error;
      }
    }
    
    progressCallback?.('gateway', 20, 'Creating API Gateway instance...');
    
    // Use retry logic for gateway creation
    const createGatewayWithRetry = async () => {
      const { data: operation } = await this.apigateway.projects.locations.gateways.create({
        parent: `projects/${projectId}/locations/${region}`,
        gatewayId: gatewayId,
        requestBody: {
          displayName: `Gateway for ${apiId}`,
          apiConfig: `projects/${projectId}/locations/global/apis/${apiId}/configs/${configId}`
        },
        auth: this.auth
      });
      
      return operation;
    };
    
    const operation = await ResilienceUtils.withRetry(createGatewayWithRetry, {
      maxAttempts: 3,
      initialDelayMs: 2000,
      maxDelayMs: 10000,
      onRetry: (attempt, error, delayMs) => {
        log(`Gateway creation failed (attempt ${attempt}), retrying in ${delayMs}ms...`);
        log(`Error: ${error.message}`);
        progressCallback?.('gateway', 20, `Retrying gateway creation (attempt ${attempt})...`);
      }
    });
    
    log('Waiting for gateway creation to complete...');
    progressCallback?.('gateway', 30, 'Gateway creation initiated, this typically takes 10-15 minutes...');
    
    await this.waitForApiGatewayOperation(operation.name || '', progressCallback, 'gateway', 30, 90, log);
    
    // Get the gateway details to retrieve the URL
    const { data: gateway } = await this.apigateway.projects.locations.gateways.get({
      name: `projects/${projectId}/locations/${region}/gateways/${gatewayId}`,
      auth: this.auth
    });
    
    if (!gateway.defaultHostname) {
      throw new Error('Gateway created but no hostname assigned');
    }
    
    log(`Gateway created successfully at ${gateway.defaultHostname}`);
    
    // Note: serviceName is already available from the parent scope in deployApiGateway
    
    return { 
      gatewayUrl: `https://${gateway.defaultHostname}`
    };
  }
  
  private async enableApiGatewayManagedService(
    projectId: string,
    serviceName: string,
    log: (message: string) => void = console.log
  ): Promise<void> {
    const serviceusage = google.serviceusage('v1');
    
    // First check if the service is already enabled
    try {
      const { data: service } = await serviceusage.services.get({
        name: `projects/${projectId}/services/${serviceName}`,
        auth: this.auth
      });
      
      if (service.state === 'ENABLED') {
        log(`Managed service ${serviceName} is already enabled`);
        return;
      }
      
      log(`Managed service ${serviceName} is in state ${service.state}, enabling...`);
    } catch (error: any) {
      if (error.code === 404) {
        log(`Managed service ${serviceName} not found, will create and enable`);
      } else {
        log(`Warning: Could not check service state: ${error.message}`);
      }
    }
    
    // Try to enable the service
    try {
      log(`Enabling managed service ${serviceName}...`);
      
      const { data: operation } = await serviceusage.services.enable({
        name: `projects/${projectId}/services/${serviceName}`,
        auth: this.auth
      });
      
      if (operation.name && operation.name !== 'DONE_OPERATION') {
        // Wait for the operation to complete
        log('Waiting for managed service to be enabled...');
        let done = false;
        let retries = 0;
        const maxRetries = 60; // 5 minutes
        
        while (!done && retries < maxRetries) {
          const { data: op } = await serviceusage.operations.get({
            name: operation.name,
            auth: this.auth
          });
          
          if (op.done) {
            done = true;
            if (op.error) {
              throw new Error(`Failed to enable managed service: ${JSON.stringify(op.error)}`);
            }
          } else {
            await new Promise(resolve => setTimeout(resolve, 5000));
            retries++;
          }
        }
        
        if (!done) {
          log('Warning: Managed service enablement operation timed out, but it may still complete');
        }
      } else if (operation.name === 'DONE_OPERATION') {
        log('Managed service enablement completed immediately');
      }
      
      log(`Managed service ${serviceName} enabled successfully`);
    } catch (error: any) {
      if (error.code === 409 || error.message?.includes('already enabled')) {
        log(`Managed service ${serviceName} is already enabled`);
      } else {
        throw error;
      }
    }
  }

  private async createApiKey(
    projectId: string,
    apiId: string,
    serviceName: string,
    _corsOrigins: string[],
    log: (message: string) => void = console.log
  ): Promise<string> {
    const parent = `projects/${projectId}/locations/global`;
    const existingKeysToDelete: string[] = [];
    
    // First, find and mark old API keys for deletion
    log(`Checking for existing API keys for service ${serviceName}...`);
    try {
      const { data: keysResponse } = await this.apikeys.projects.locations.keys.list({
        parent: parent,
        auth: this.auth,
        pageSize: 100
      });
      
      if (keysResponse.keys && keysResponse.keys.length > 0) {
        // Find keys that target our service
        for (const key of keysResponse.keys) {
          if (key.restrictions?.apiTargets?.some(target => target.service === serviceName)) {
            const keyName = key.name?.split('/').pop() || '';
            // Check if this is an Anava key by looking at display name or key pattern
            if (key.displayName?.includes('Anava') || keyName.includes(apiId)) {
              log(`Found old API key to clean up: ${keyName}`);
              existingKeysToDelete.push(key.name!);
            }
          }
        }
      }
    } catch (error: any) {
      log(`Warning: Could not check for existing keys: ${error.message}`);
    }
    
    // Create a new key
    const keyId = `${apiId}-key-${Date.now()}`;
    log(`Creating new API key ${keyId}...`);
    
    // Create restrictions for the API key
    // Only restrict to the API service, no browser/referrer restrictions since cameras make direct API calls
    const restrictions: any = {
      apiTargets: [{
        service: serviceName
      }]
    };
    
    // Note: We don't add browser restrictions because the Anava cameras make direct API calls,
    // not browser-based calls. Browser restrictions would cause 403 errors.

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
    log('Waiting for API key creation to complete...');
    await this.waitForApiKeysOperation(operation.name, log);
    log(`API key ${keyId} created successfully`);

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

    // Clean up old keys now that we have a new one
    if (existingKeysToDelete.length > 0) {
      log(`Cleaning up ${existingKeysToDelete.length} old API key(s)...`);
      for (const oldKeyName of existingKeysToDelete) {
        try {
          await this.apikeys.projects.locations.keys.delete({
            name: oldKeyName,
            auth: this.auth
          });
          log(`Deleted old API key: ${oldKeyName.split('/').pop()}`);
        } catch (error: any) {
          log(`Warning: Failed to delete old key ${oldKeyName}: ${error.message}`);
        }
      }
    }

    return keyString.keyString || '';
  }

  private async waitForServiceManagementOperation(operationName: string, progressCallback?: (subStep: string, progress: number, detail?: string) => void, log: (message: string) => void = console.log): Promise<void> {
    log(`Waiting for service management operation: ${operationName}`);
    let done = false;
    let retries = 0;
    const maxRetries = 360; // 30 minutes for service management operations

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
          const elapsed = retries * 5;
          log(`Still waiting for service management operation... (${elapsed}s elapsed)`);
          progressCallback?.('managed-service', Math.min(90, (elapsed / 300) * 90), `Waiting for operation... ${elapsed}s elapsed`);
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
        retries++;
      }
    }

    if (!done) {
      throw new Error(`Operation timed out after ${maxRetries * 5} seconds. The operation may still be running in Google Cloud.`);
    }
  }

  private async checkAndWaitForPendingOperations(
    projectId: string, 
    apiId: string,
    progressCallback?: (subStep: string, progress: number, detail?: string) => void,
    log: (message: string) => void = console.log
  ): Promise<void> {
    try {
      // List all operations for this API
      const operations = google.apigateway('v1');
      const { data } = await operations.projects.locations.operations.list({
        name: `projects/${projectId}/locations/global`,
        filter: `metadata.@type="type.googleapis.com/google.cloud.apigateway.v1.OperationMetadata" AND metadata.target="${projectId}/locations/global/apis/${apiId}/configs/*"`,
        auth: this.auth
      });
      
      if (data.operations && data.operations.length > 0) {
        // Find any in-progress operations
        const pendingOps = data.operations.filter(op => !op.done);
        
        if (pendingOps.length > 0) {
          log(`Found ${pendingOps.length} pending operations, waiting for them to complete...`);
          
          // Wait for all pending operations
          for (const op of pendingOps) {
            if (op.name) {
              log(`Waiting for operation ${op.name.split('/').pop()} to complete...`);
              try {
                await this.waitForApiGatewayOperation(op.name, progressCallback, 'api-config', 50, 70, log);
              } catch (error) {
                log(`Warning: Operation ${op.name} failed, but continuing...`);
              }
            }
          }
        }
      }
    } catch (error: any) {
      // If we can't list operations, just continue
      log(`Warning: Could not check for pending operations: ${error.message}`);
    }
  }
  
  private async waitForApiGatewayOperation(
    operationName: string,
    progressCallback?: (subStep: string, progress: number, detail?: string) => void,
    subStep: string = 'gateway',
    startProgress: number = 0,
    endProgress: number = 100,
    log: (message: string) => void = console.log
  ): Promise<void> {
    // Special case: DONE_OPERATION indicates the operation is already complete
    if (operationName === 'DONE_OPERATION') {
      log('Operation is already complete');
      progressCallback?.(subStep, endProgress, 'Operation complete');
      return;
    }
    
    let done = false;
    let retries = 0;
    const maxRetries = 360; // 30 minutes for service management operations
    const operationTimeout = 10 * 60 * 1000; // 10 minutes timeout
    const startTime = Date.now();

    while (!done && retries < maxRetries) {
      // Check if we've exceeded the operation timeout
      if (Date.now() - startTime > operationTimeout) {
        log(`Warning: Operation ${operationName} timed out after 10 minutes`);
        throw new Error(`Operation timed out after ${operationTimeout / 1000} seconds`);
      }
      
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
          const elapsed = retries * 5;
          const operationId = operationName.split('/').pop();
          log(`Still waiting for operation ${operationId}... (${elapsed}s elapsed)`);
          
          // Calculate progress based on elapsed time
          const expectedDuration = subStep === 'gateway' ? 900 : 300; // 15 min for gateway, 5 min for others
          const progressPercent = Math.min((elapsed / expectedDuration) * 100, 95);
          const currentProgress = startProgress + ((endProgress - startProgress) * progressPercent / 100);
          
          progressCallback?.(subStep, currentProgress, `Operation in progress... ${elapsed}s elapsed`);
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
        retries++;
      }
    }

    if (!done) {
      throw new Error(`Operation timed out after ${maxRetries * 5} seconds. The operation may still be running in Google Cloud.`);
    }
  }

  private async waitForApiKeysOperation(operationName: string, log: (message: string) => void = console.log): Promise<void> {
    log(`Waiting for API keys operation: ${operationName}`);
    let done = false;
    let retries = 0;
    const maxRetries = 360; // 30 minutes for service management operations

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
          log(`Still waiting for API keys operation... (${retries * 5}s elapsed)`);
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
        retries++;
      }
    }

    if (!done) {
      throw new Error(`Operation timed out after ${maxRetries * 5} seconds. The operation may still be running in Google Cloud.`);
    }
  }
}