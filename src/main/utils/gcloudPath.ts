import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { platform } from 'os';
import path from 'path';

let cachedGcloudPath: string | null = null;

export function findGcloudPath(): string {
  // Return cached path if already found
  if (cachedGcloudPath) {
    return cachedGcloudPath;
  }

  // Common installation paths for gcloud
  const commonPaths = platform() === 'win32' ? [
    'C:\\Program Files (x86)\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd',
    'C:\\Program Files\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd',
    'C:\\Users\\%USERNAME%\\AppData\\Local\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd',
  ] : [
    '/usr/local/bin/gcloud',
    '/usr/bin/gcloud',
    '/opt/homebrew/bin/gcloud',
    '/opt/google-cloud-sdk/bin/gcloud',
    path.join(process.env.HOME || '', 'google-cloud-sdk/bin/gcloud'),
    '/snap/bin/gcloud',
    '/usr/local/google-cloud-sdk/bin/gcloud',
    // Common macOS installation paths
    '/usr/local/Caskroom/google-cloud-sdk/latest/google-cloud-sdk/bin/gcloud',
    path.join(process.env.HOME || '', 'Library/google-cloud-sdk/bin/gcloud'),
  ];

  // Check common paths first
  for (const gcloudPath of commonPaths) {
    const expandedPath = gcloudPath.replace('%USERNAME%', process.env.USERNAME || '');
    if (existsSync(expandedPath)) {
      console.log(`Found gcloud at: ${expandedPath}`);
      cachedGcloudPath = expandedPath;
      return expandedPath;
    }
  }

  // Try to find gcloud using 'which' or 'where' command
  try {
    const findCommand = platform() === 'win32' ? 'where' : 'which';
    const result = execSync(`${findCommand} gcloud`, { encoding: 'utf8' }).trim();
    if (result) {
      console.log(`Found gcloud using ${findCommand}: ${result}`);
      cachedGcloudPath = result.split('\n')[0]; // Take first result if multiple
      return cachedGcloudPath;
    }
  } catch (error) {
    console.log('Could not find gcloud using system command');
  }

  // Try to execute gcloud directly in case it's in a non-standard location but in PATH
  try {
    execSync('gcloud version', { encoding: 'utf8' });
    // If we get here, gcloud is available but we don't know the exact path
    // Return 'gcloud' and hope the shell can find it
    console.log('gcloud is available in PATH');
    cachedGcloudPath = 'gcloud';
    return 'gcloud';
  } catch (error) {
    // gcloud not found
  }

  throw new Error(
    'Google Cloud SDK (gcloud) not found. Please install it from https://cloud.google.com/sdk/install'
  );
}

// Helper function to execute gcloud commands with proper path
export function getGcloudCommand(command: string): string {
  const gcloudPath = findGcloudPath();
  // If gcloud path contains spaces, wrap it in quotes
  const quotedPath = gcloudPath.includes(' ') ? `"${gcloudPath}"` : gcloudPath;
  return command.replace(/^gcloud/, quotedPath);
}