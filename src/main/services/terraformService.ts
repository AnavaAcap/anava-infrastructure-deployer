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
    
    // Map Node.js platform/arch to Terraform naming
    let tfBinary = 'terraform';
    if (platform === 'win32') {
      tfBinary = 'terraform.exe';
    }
    
    // In production, terraform would be in app resources
    // In development, it would be in terraform-bin directory
    if (app.isPackaged) {
      this.terraformPath = path.join(
        process.resourcesPath,
        'terraform-bin',
        tfBinary
      );
    } else {
      this.terraformPath = path.join(
        __dirname,
        '..',
        '..',
        '..',
        'terraform-bin',
        tfBinary
      );
    }
    
    // Work directory for Terraform files - use timestamp to ensure unique
    this.workDir = path.join(app.getPath('userData'), 'terraform-workspace', Date.now().toString());
  }

  async initialize(): Promise<void> {
    console.log('[Terraform] Initializing Terraform service...');
    console.log('[Terraform] Terraform binary path:', this.terraformPath);
    console.log('[Terraform] Working directory:', this.workDir);
    
    // Create work directory
    await fs.mkdir(this.workDir, { recursive: true });
    
    // Verify Terraform binary exists
    try {
      await fs.access(this.terraformPath, fs.constants.X_OK);
      console.log('[Terraform] ✅ Terraform binary verified');
    } catch (error) {
      console.error('[Terraform] ❌ Terraform binary not accessible:', error);
      throw new Error(`Terraform binary not found at ${this.terraformPath}`);
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
  credentials = file("${credentialsPath}")
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
    await this.runTerraform(['init'], this.workDir);
    console.log('[Terraform] ✅ Terraform initialized');
    
    // Try to import existing configuration (in case it was initialized manually)
    try {
      console.log('[Terraform] Checking if Identity Platform config already exists...');
      await this.runTerraform(
        ['import', 'google_identity_platform_config.default', `projects/${projectId}`],
        this.workDir
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
    await this.runTerraform(['apply', '-auto-approve'], this.workDir);
    
    console.log('[Terraform] ✅ Firebase Auth initialized successfully with Terraform!');
  }

  private runTerraform(args: string[], cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`Running: terraform ${args.join(' ')}`);
      
      const terraform = spawn(this.terraformPath, args, {
        cwd,
        env: {
          ...process.env
          // TF_LOG: 'INFO' // Commented out to reduce verbose logging
        }
      });
      
      terraform.stdout.on('data', (data) => {
        console.log(`[Terraform] ${data.toString()}`);
      });
      
      terraform.stderr.on('data', (data) => {
        const output = data.toString();
        // Only show actual errors, not INFO logs
        if (!output.includes('[INFO]') && !output.includes('Terraform will perform')) {
          console.error(`[Terraform] ${output}`);
        }
      });
      
      terraform.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Terraform exited with code ${code}`));
        }
      });
      
      terraform.on('error', (error) => {
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