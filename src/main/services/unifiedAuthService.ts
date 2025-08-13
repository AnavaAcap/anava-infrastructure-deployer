import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';

let cachedOAuthClient: OAuth2Client | null = null;
let cachedConfig: any = null;

/**
 * Gets the unified OAuth client using tokens from config.json
 * This is THE SINGLE SOURCE OF TRUTH for Google API authentication
 */
export async function getUnifiedOAuthClient(): Promise<OAuth2Client | null> {
  try {
    const userDataPath = app.getPath('userData');
    const configPath = path.join(userDataPath, 'config.json');
    
    // Read config file
    const data = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(data);
    
    // Check if we have tokens
    if (!config.gcpAccessToken || !config.gcpRefreshToken) {
      console.log('[UnifiedAuth] No tokens found in config');
      return null;
    }
    
    // Check if tokens changed
    if (cachedOAuthClient && cachedConfig && 
        cachedConfig.gcpAccessToken === config.gcpAccessToken &&
        cachedConfig.gcpRefreshToken === config.gcpRefreshToken) {
      return cachedOAuthClient;
    }
    
    // Get OAuth config for client ID/secret
    const oauthConfigPath = app.isPackaged
      ? path.join(process.resourcesPath, 'oauth-config.json')
      : path.join(__dirname, '..', '..', 'oauth-config.json');
      
    const oauthData = await fs.readFile(oauthConfigPath, 'utf8');
    const oauthConfig = JSON.parse(oauthData);
    
    // Create OAuth client
    const oauth2Client = new google.auth.OAuth2(
      oauthConfig.installed.client_id,
      oauthConfig.installed.client_secret,
      'http://localhost:8085'
    );
    
    // Set credentials
    oauth2Client.setCredentials({
      access_token: config.gcpAccessToken,
      refresh_token: config.gcpRefreshToken
    });
    
    // Cache for reuse
    cachedOAuthClient = oauth2Client;
    cachedConfig = config;
    
    console.log('[UnifiedAuth] OAuth client created successfully');
    return oauth2Client;
    
  } catch (error: any) {
    console.error('[UnifiedAuth] Failed to get OAuth client:', error.message);
    return null;
  }
}

/**
 * Gets project list using unified auth
 */
export async function listProjects(): Promise<any[]> {
  const oauth2Client = await getUnifiedOAuthClient();
  if (!oauth2Client) {
    throw new Error('Not authenticated. Please sign in.');
  }
  
  const cloudResourceManager = google.cloudresourcemanager({
    version: 'v1',
    auth: oauth2Client
  });
  
  const response = await cloudResourceManager.projects.list({
    pageSize: 200,
    filter: 'lifecycleState:ACTIVE'
  });
  
  if (response.data.projects) {
    return response.data.projects.map((project: any) => ({
      projectId: project.projectId,
      projectNumber: project.projectNumber,
      name: project.name,
      createTime: project.createTime,
      lifecycleState: project.lifecycleState
    }));
  }
  return [];
}

/**
 * Checks billing status using unified auth
 */
export async function checkBilling(projectId: string): Promise<any> {
  const oauth2Client = await getUnifiedOAuthClient();
  if (!oauth2Client) {
    throw new Error('Not authenticated. Please sign in.');
  }
  
  const cloudbilling = google.cloudbilling({
    version: 'v1',
    auth: oauth2Client
  });
  
  const response = await cloudbilling.projects.getBillingInfo({
    name: `projects/${projectId}`
  });
  
  return {
    enabled: !!response.data.billingEnabled,
    billingAccountName: response.data.billingAccountName
  };
}

/**
 * Lists billing accounts using unified auth
 */
export async function listBillingAccounts(): Promise<any[]> {
  const oauth2Client = await getUnifiedOAuthClient();
  if (!oauth2Client) {
    throw new Error('Not authenticated. Please sign in.');
  }
  
  const cloudbilling = google.cloudbilling({
    version: 'v1',
    auth: oauth2Client
  });
  
  const response = await cloudbilling.billingAccounts.list({
    pageSize: 100
  });
  
  if (response.data.billingAccounts) {
    return response.data.billingAccounts.map((account: any) => ({
      name: account.name,
      displayName: account.displayName,
      open: account.open
    }));
  }
  return [];
}

/**
 * Links billing account using unified auth
 */
export async function linkBillingAccount(projectId: string, billingAccountName: string): Promise<any> {
  const oauth2Client = await getUnifiedOAuthClient();
  if (!oauth2Client) {
    throw new Error('Not authenticated. Please sign in.');
  }
  
  const cloudbilling = google.cloudbilling({
    version: 'v1',
    auth: oauth2Client
  });
  
  await cloudbilling.projects.updateBillingInfo({
    name: `projects/${projectId}`,
    requestBody: {
      billingAccountName: billingAccountName
    }
  });
  
  return { success: true };
}

/**
 * Clears cached OAuth client
 */
export function clearCache(): void {
  cachedOAuthClient = null;
  cachedConfig = null;
  console.log('[UnifiedAuth] Cache cleared');
}