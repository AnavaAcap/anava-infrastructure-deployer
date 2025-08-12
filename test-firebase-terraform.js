#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const projectId = 'testwindows-36dr';
const workDir = path.join(os.tmpdir(), 'terraform-test-' + Date.now());

console.log('Testing Firebase Auth Terraform initialization...');
console.log('Project:', projectId);
console.log('Work directory:', workDir);

// Create work directory
fs.mkdirSync(workDir, { recursive: true });

// Create service account key (using ADC for testing)
const keyFile = path.join(workDir, 'sa-key.json');

// Get the current user's credentials from gcloud
const getCredsCmd = spawn('gcloud', ['auth', 'application-default', 'print-access-token'], {
  stdio: ['ignore', 'pipe', 'pipe']
});

getCredsCmd.on('close', (code) => {
  if (code !== 0) {
    console.error('Failed to get credentials. Make sure you are logged in with gcloud.');
    process.exit(1);
  }
  
  // Create Terraform configuration
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
  project = "${projectId}"
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
    
    # Enable anonymous authentication
    anonymous {
      enabled = true
    }
  }
  
  # Authorized domains for OAuth redirects
  authorized_domains = ["${projectId}.firebaseapp.com", "localhost"]
}

output "auth_enabled" {
  value = true
  description = "Indicates that Firebase Auth has been initialized"
}
`;

  const tfPath = path.join(workDir, 'firebase-auth.tf');
  fs.writeFileSync(tfPath, tfConfig);
  console.log('✅ Terraform configuration written to:', tfPath);

  // Find terraform binary
  let terraformPath = 'terraform';
  if (os.platform() === 'win32') {
    terraformPath = 'terraform.exe';
  }
  
  // Check if terraform exists in the project
  const projectTerraformPath = path.join(__dirname, 'terraform-bin', terraformPath);
  if (fs.existsSync(projectTerraformPath)) {
    terraformPath = projectTerraformPath;
    console.log('Using project terraform binary:', terraformPath);
  } else {
    console.log('Using system terraform binary');
  }

  // Run terraform init
  console.log('\n=== Running terraform init ===');
  const tfInit = spawn(terraformPath, ['init'], {
    cwd: workDir,
    stdio: 'inherit'
  });

  tfInit.on('close', (code) => {
    if (code !== 0) {
      console.error('❌ Terraform init failed with code:', code);
      process.exit(1);
    }
    
    console.log('✅ Terraform initialized');
    
    // Try to import existing configuration
    console.log('\n=== Checking for existing Identity Platform config ===');
    const tfImport = spawn(terraformPath, 
      ['import', 'google_identity_platform_config.default', `projects/${projectId}`],
      {
        cwd: workDir,
        stdio: 'inherit'
      }
    );

    tfImport.on('close', (importCode) => {
      if (importCode !== 0) {
        console.log('ℹ️  No existing config found (this is expected for new projects)');
      } else {
        console.log('✅ Existing config imported');
      }
      
      // Run terraform plan to see what will be created
      console.log('\n=== Running terraform plan ===');
      const tfPlan = spawn(terraformPath, ['plan'], {
        cwd: workDir,
        stdio: 'inherit'
      });

      tfPlan.on('close', (planCode) => {
        if (planCode !== 0) {
          console.error('❌ Terraform plan failed with code:', planCode);
          console.error('\n=== POSSIBLE ISSUES ===');
          console.error('1. Check if the project has billing enabled');
          console.error('2. Check if Firebase project is initialized');
          console.error('3. Check API permissions for the service account');
          console.error('4. Try running: gcloud auth application-default login');
          process.exit(1);
        }
        
        console.log('\n✅ Terraform plan succeeded!');
        
        // Run terraform apply
        console.log('\n=== Running terraform apply ===');
        const tfApply = spawn(terraformPath, ['apply', '-auto-approve'], {
          cwd: workDir,
          stdio: 'inherit'
        });

        tfApply.on('close', (applyCode) => {
          if (applyCode !== 0) {
            console.error('❌ Terraform apply failed with code:', applyCode);
            console.error('\n=== DEBUGGING INFO ===');
            console.error('Check the error messages above for details.');
            console.error('Common issues:');
            console.error('- Firebase project not initialized');
            console.error('- Missing permissions');
            console.error('- API quota exceeded');
            
            // Clean up
            console.log('\nCleaning up work directory...');
            fs.rmSync(workDir, { recursive: true, force: true });
            process.exit(1);
          }
          
          console.log('\n✅ Firebase Auth initialized successfully with Terraform!');
          
          // Clean up
          console.log('\nCleaning up work directory...');
          fs.rmSync(workDir, { recursive: true, force: true });
          
          console.log('\n=== SUCCESS ===');
          console.log(`Firebase Authentication has been initialized for project: ${projectId}`);
          console.log('Email/Password and Anonymous auth are now enabled.');
        });
      });
    });
  });
});