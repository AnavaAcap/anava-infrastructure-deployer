import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import { app } from 'electron';
import * as os from 'os';

export class TerraformService {
  private terraformPath: string;
  private workDir: string;

  constructor() {
    // Terraform binary location
    const platform = os.platform();
    const arch = os.arch();
    
    // Determine the correct binary name based on platform
    let tfBinary: string;
    if (platform === 'win32') {
      tfBinary = 'terraform.exe';
    } else if (platform === 'darwin') {
      tfBinary = arch === 'arm64' ? 'terraform-darwin-arm64' : 'terraform-darwin-x64';
    } else if (platform === 'linux') {
      tfBinary = 'terraform-linux';
    } else {
      // Fallback to generic terraform
      tfBinary = 'terraform';
    }
    
    // In production, terraform would be in app resources
    // In development, it would be in terraform-bin directory
    const baseDir = app.isPackaged 
      ? process.resourcesPath
      : path.join(__dirname, '..', '..', '..');
    
    this.terraformPath = path.join(baseDir, 'terraform-bin', tfBinary);
    
    // For Windows, also check if just terraform.exe exists (for compatibility)
    if (platform === 'win32' && !require('fs').existsSync(this.terraformPath)) {
      const altPath = path.join(baseDir, 'terraform-bin', 'terraform.exe');
      if (require('fs').existsSync(altPath)) {
        this.terraformPath = altPath;
      }
    }
    
    // Work directory for Terraform files - use timestamp to ensure unique
    this.workDir = path.join(app.getPath('userData'), 'terraform-workspace', Date.now().toString());
  }

  async initialize(): Promise<void> {
    console.log('[Terraform] Initializing Terraform service...');
    console.log('[Terraform] Platform:', os.platform(), 'Arch:', os.arch());
    console.log('[Terraform] Terraform binary path:', this.terraformPath);
    console.log('[Terraform] Working directory:', this.workDir);
    
    // Create work directory
    await fs.mkdir(this.workDir, { recursive: true });
    
    // Verify Terraform binary exists
    try {
      await fs.access(this.terraformPath, fs.constants.F_OK);
      console.log('[Terraform] ✅ Terraform binary exists');
      
      // On Windows, skip X_OK check as it's not reliable
      // Windows determines executability by file extension
      if (os.platform() !== 'win32') {
        try {
          await fs.access(this.terraformPath, fs.constants.X_OK);
          console.log('[Terraform] ✅ Terraform binary is executable');
        } catch (execError) {
          console.warn('[Terraform] ⚠️ Binary may not be executable, attempting to fix...');
          // Try to make it executable
          const fs_sync = require('fs');
          fs_sync.chmodSync(this.terraformPath, '755');
          console.log('[Terraform] ✅ Set executable permissions');
        }
      } else {
        console.log('[Terraform] ✅ Windows binary (.exe) assumed executable');
      }
      
      // Get file stats for debugging
      const stats = await fs.stat(this.terraformPath);
      console.log('[Terraform] Binary size:', Math.round(stats.size / 1024 / 1024), 'MB');
      console.log('[Terraform] Binary permissions:', stats.mode.toString(8));
      
      // Verify it's a real binary (not empty or too small)
      if (stats.size < 1000000) { // Less than 1MB is suspicious
        throw new Error(`Terraform binary appears to be corrupted (size: ${stats.size} bytes)`);
      }
      
    } catch (error: any) {
      console.error('[Terraform] ❌ Terraform binary problem:', error);
      console.error('[Terraform] Error code:', error.code);
      console.error('[Terraform] Error message:', error.message);
      
      // Try to list the directory contents for debugging
      try {
        const dir = path.dirname(this.terraformPath);
        console.error('[Terraform] Looking in directory:', dir);
        const files = await fs.readdir(dir);
        console.error('[Terraform] Directory contents:', files);
        
        // Check sizes of files found
        for (const file of files) {
          const filePath = path.join(dir, file);
          try {
            const fileStats = await fs.stat(filePath);
            console.error(`[Terraform]   - ${file}: ${Math.round(fileStats.size / 1024)}KB`);
          } catch (e) {
            console.error(`[Terraform]   - ${file}: (unable to stat)`);
          }
        }
      } catch (dirError) {
        console.error('[Terraform] Could not list directory:', dirError);
      }
      
      // Provide helpful error message based on the platform
      let helpMessage = '';
      if (os.platform() === 'win32') {
        helpMessage = '\n\nFor Windows: Ensure terraform.exe is present in the terraform-bin directory. Run "npm run download-terraform-win" to download it.';
      } else {
        helpMessage = '\n\nRun "npm run download-terraform" to download the Terraform binary for your platform.';
      }
      
      throw new Error(`Terraform binary not found or not valid at ${this.terraformPath}. ${error.message}${helpMessage}`);
    }
  }

  async initializeFirebaseAuth(
    projectId: string,
    credentialsPath: string,
    options?: {
      enableAnonymous?: boolean;
      authorizedDomains?: string[];
      adminEmail?: string;
      projectNumber?: string;
    }
  ): Promise<void> {
    console.log('[Terraform] Starting Firebase Auth initialization...');
    console.log('[Terraform] Project ID:', projectId);
    console.log('[Terraform] Credentials path:', credentialsPath);
    console.log('[Terraform] Options:', JSON.stringify(options, null, 2));
    
    // Create authorized domains list
    const authorizedDomains = options?.authorizedDomains || [
      `${projectId}.firebaseapp.com`,
      'localhost'
    ];
    
    console.log('[Terraform] Authorized domains:', authorizedDomains);
    
    // Create Terraform configuration for Firebase Auth
    const tfConfig = `
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  credentials = file("${credentialsPath.replace(/\\/g, '/')}")
  project     = "${projectId}"
}

# Enable required APIs (they should already be enabled, but ensure they are)
resource "google_project_service" "firebase" {
  service = "firebase.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "identitytoolkit" {
  service = "identitytoolkit.googleapis.com"
  disable_on_destroy = false
}

# Initialize Firebase Auth configuration
# This is the programmatic equivalent of clicking "Get Started" in Firebase Console
resource "google_identity_platform_config" "default" {
  depends_on = [
    google_project_service.firebase,
    google_project_service.identitytoolkit
  ]
  
  project = "${projectId}"
  
  # Auto-delete anonymous users after 30 days
  autodelete_anonymous_users = true
  
  # Configure sign-in providers
  sign_in {
    # Enable Email/Password authentication
    email {
      enabled = true
      password_required = true
    }
    
    ${options?.enableAnonymous ? `
    # Enable anonymous authentication
    anonymous {
      enabled = true
    }` : ''}
  }
  
  # Enable OAuth providers (Google Sign-In)
  # Note: This requires setting up OAuth client in GCP Console
  # The OAuth client ID must be configured separately
  
  # Authorized domains for OAuth redirects
  authorized_domains = ${JSON.stringify(authorizedDomains)}
}


# Output the configuration
output "auth_config" {
  value = google_identity_platform_config.default
  sensitive = true
}

output "auth_enabled" {
  value = true
  description = "Indicates that Firebase Auth has been initialized"
}

`;

    // Write Terraform configuration
    const tfPath = path.join(this.workDir, 'firebase-auth.tf');
    await fs.writeFile(tfPath, tfConfig);
    console.log('[Terraform] ✅ Terraform configuration written to:', tfPath);
    
    // Run Terraform init
    console.log('[Terraform] Running terraform init...');
    await this.runTerraform(['init'], this.workDir, credentialsPath);
    console.log('[Terraform] ✅ Terraform initialized');
    
    // Try to import existing configuration (in case it was initialized manually)
    try {
      console.log('[Terraform] Checking if Identity Platform config already exists...');
      await this.runTerraform(
        ['import', 'google_identity_platform_config.default', `projects/${projectId}`],
        this.workDir,
        credentialsPath
      );
      console.log('[Terraform] ✅ Existing Identity Platform config imported successfully');
    } catch (error: any) {
      // Import failed, which means the config doesn't exist yet
      console.log('[Terraform] ℹ️  No existing config found, will create new one');
      console.log('[Terraform] Import error (this is expected):', error.message);
    }
    
    // Run Terraform apply
    console.log('[Terraform] Running terraform apply to create/update Firebase Auth configuration...');
    console.log('[Terraform] This will enable email/password and anonymous authentication...');
    await this.runTerraform(['apply', '-auto-approve'], this.workDir, credentialsPath);
    
    console.log('[Terraform] ✅ Firebase Auth initialized successfully with Terraform!');
  }

  private runTerraform(args: string[], cwd: string, credentialsPath?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`[Terraform] Running: ${path.basename(this.terraformPath)} ${args.join(' ')}`);
      console.log(`[Terraform] Working directory: ${cwd}`);
      console.log(`[Terraform] Full binary path: ${this.terraformPath}`);
      
      // Collect all output for better error reporting
      let stdoutBuffer = '';
      let stderrBuffer = '';
      
      // Windows-specific spawn options
      const spawnOptions: any = {
        cwd,
        env: {
          ...process.env,
          // Set Google credentials if provided
          ...(credentialsPath ? { GOOGLE_APPLICATION_CREDENTIALS: credentialsPath } : {}),
          // Enable more detailed logging for debugging
          TF_LOG: 'ERROR', // Show only errors, not verbose info
          // Windows-specific: Ensure proper PATH
          ...(os.platform() === 'win32' ? { 
            PATH: `${process.env.PATH};${path.dirname(this.terraformPath)}` 
          } : {})
        }
      };
      
      // On Windows, we need special handling
      if (os.platform() === 'win32') {
        // Use windowsHide to prevent console window popup
        spawnOptions.windowsHide = true;
        // Don't use shell:true on Windows as it can cause path issues
        spawnOptions.shell = false;
        // Ensure Windows uses proper path separators
        spawnOptions.cwd = cwd.replace(/\//g, '\\');
      }
      
      console.log('[Terraform] Spawn options:', JSON.stringify(spawnOptions, null, 2));
      
      const terraform = spawn(this.terraformPath, args, spawnOptions);
      
      terraform.stdout.on('data', (data) => {
        const output = data.toString();
        stdoutBuffer += output;
        console.log(`[Terraform stdout] ${output}`);
      });
      
      terraform.stderr.on('data', (data) => {
        const output = data.toString();
        stderrBuffer += output;
        // Always log stderr for debugging
        console.error(`[Terraform stderr] ${output}`);
      });
      
      terraform.on('close', (code) => {
        if (code === 0) {
          console.log('[Terraform] ✅ Command completed successfully');
          resolve();
        } else {
          console.error(`[Terraform] ❌ Command failed with exit code ${code}`);
          console.error('[Terraform] Full stdout:', stdoutBuffer);
          console.error('[Terraform] Full stderr:', stderrBuffer);
          
          // Create a more detailed error message
          const errorDetails = stderrBuffer || stdoutBuffer || 'No error details available';
          reject(new Error(`Terraform exited with code ${code}. Error: ${errorDetails}`));
        }
      });
      
      terraform.on('error', (error) => {
        console.error('[Terraform] Failed to spawn process:', error);
        reject(error);
      });
    });
  }

  async cleanup(): Promise<void> {
    // Clean up Terraform state and files
    try {
      await fs.rm(this.workDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup Terraform workspace:', error);
    }
  }

  async getAuthConfig(): Promise<any> {
    // Read Terraform state to get the auth configuration
    const statePath = path.join(this.workDir, 'terraform.tfstate');
    const stateContent = await fs.readFile(statePath, 'utf-8');
    const state = JSON.parse(stateContent);
    
    // Extract the auth config from state
    const resources = state.resources || [];
    const authConfig = resources.find((r: any) => 
      r.type === 'google_identity_platform_config' && 
      r.name === 'default'
    );
    
    if (authConfig && authConfig.instances && authConfig.instances[0]) {
      return authConfig.instances[0].attributes;
    }
    
    return null;
  }
}

// Usage in deployment engine:
/*
const terraformService = new TerraformService();
await terraformService.initialize();

try {
  // Create service account key for Terraform
  const keyPath = await createServiceAccountKey(projectId);
  
  // Initialize Firebase Auth with Terraform
  await terraformService.initializeFirebaseAuth(projectId, keyPath);
  
  // Get the configuration
  const authConfig = await terraformService.getAuthConfig();
  console.log('Auth config:', authConfig);
  
} finally {
  await terraformService.cleanup();
}
*/