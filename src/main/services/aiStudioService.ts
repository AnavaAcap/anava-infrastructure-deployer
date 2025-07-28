import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { shell } from 'electron';

export class AIStudioService {
  private auth: OAuth2Client;

  constructor(auth: OAuth2Client) {
    this.auth = auth;
  }

  /**
   * Get or create an AI Studio API key for the project
   */
  async getOrCreateAPIKey(projectId: string): Promise<string | null> {
    try {
      console.log('[AI Studio] Checking for existing AI Studio API keys...');
      
      const apikeys = google.apikeys({ version: 'v2', auth: this.auth });
      
      // List existing keys
      const listResponse = await apikeys.projects.locations.keys.list({
        parent: `projects/${projectId}/locations/global`,
      });

      // Look for existing AI Studio key
      const existingKey = listResponse.data.keys?.find(key => 
        key.displayName?.includes('AI Studio') || 
        key.displayName?.includes('Gemini')
      );

      if (existingKey && existingKey.name) {
        console.log('[AI Studio] Found existing AI Studio API key');
        
        // Get the key string
        const keyResponse = await apikeys.projects.locations.keys.get({
          name: existingKey.name,
        });
        
        return keyResponse.data.keyString || null;
      }

      // Create a new AI Studio API key
      console.log('[AI Studio] Creating new AI Studio API key...');
      
      const createResponse = await apikeys.projects.locations.keys.create({
        parent: `projects/${projectId}/locations/global`,
        keyId: `ai-studio-key-${Date.now()}`,
        requestBody: {
          displayName: 'AI Studio API Key (Anava Vision)',
          restrictions: {
            apiTargets: [
              {
                service: 'generativelanguage.googleapis.com',
              }
            ],
          },
        },
      });

      // Wait for operation to complete
      const operationName = createResponse.data.name;
      if (operationName) {
        console.log('[AI Studio] Waiting for API key creation...');
        
        let operation;
        do {
          await new Promise(resolve => setTimeout(resolve, 2000));
          operation = await apikeys.operations.get({ name: operationName });
        } while (!operation.data.done);

        if (operation.data.response) {
          const keyName = operation.data.response.name;
          const keyResponse = await apikeys.projects.locations.keys.get({
            name: keyName,
          });
          
          return keyResponse.data.keyString || null;
        }
      }

      return null;
    } catch (error) {
      console.error('[AI Studio] Error creating API key:', error);
      return null;
    }
  }

  /**
   * Open AI Studio in the browser for manual key creation
   */
  async openAIStudioConsole(): Promise<void> {
    const url = 'https://aistudio.google.com/app/apikey';
    console.log('[AI Studio] Opening AI Studio console:', url);
    await shell.openExternal(url);
  }

  /**
   * Enable the Generative Language API for the project
   */
  async enableGenerativeLanguageAPI(projectId: string): Promise<void> {
    try {
      console.log('[AI Studio] Enabling Generative Language API...');
      
      const serviceusage = google.serviceusage({ version: 'v1', auth: this.auth });
      
      await serviceusage.services.enable({
        name: `projects/${projectId}/services/generativelanguage.googleapis.com`,
      });
      
      console.log('[AI Studio] Generative Language API enabled successfully');
      
      // Wait for API to be fully enabled
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error: any) {
      if (error.message?.includes('already enabled')) {
        console.log('[AI Studio] Generative Language API is already enabled');
      } else {
        console.error('[AI Studio] Error enabling API:', error);
        throw error;
      }
    }
  }

  /**
   * Get instructions for manual AI Studio setup
   */
  getManualSetupInstructions(): string {
    return `
To create an AI Studio API key manually:

1. Click "Open AI Studio Console" below
2. Sign in with your Google account
3. Click "Create API key"
4. Select your project: ${this.auth.projectId || 'your-project'}
5. Copy the API key and paste it in the field above

Note: The API key provides direct access to Gemini models without 
complex infrastructure setup.
    `.trim();
  }
}