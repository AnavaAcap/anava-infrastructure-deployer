import { ipcMain } from 'electron';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface ACAPRelease {
  name: string;
  architecture: string;
  size: number;
  downloadUrl: string;
  filename: string;
  isDownloaded: boolean;
}

export class ACAPDownloaderService {
  private static instance: ACAPDownloaderService | null = null;
  private acapDir: string = path.join(os.tmpdir(), 'anava-acaps');
  private githubRepo = 'AnavaAcap/acap-releases';

  constructor() {
    // Prevent multiple instances
    if (ACAPDownloaderService.instance) {
      return ACAPDownloaderService.instance;
    }
    ACAPDownloaderService.instance = this;
    
    this.ensureAcapDirectory();
    this.setupIPC();
  }

  private ensureAcapDirectory() {
    if (!fs.existsSync(this.acapDir)) {
      fs.mkdirSync(this.acapDir, { recursive: true });
    }
  }

  private setupIPC() {
    ipcMain.handle('acap:get-releases', async () => {
      return this.getAvailableReleases();
    });

    ipcMain.handle('acap:download', async (_event, release: ACAPRelease) => {
      return this.downloadACAP(release);
    });
    
    ipcMain.handle('acap:download-to-user', async (_event, release: ACAPRelease) => {
      return this.downloadACAPToUserFolder(release);
    });

    ipcMain.handle('acap:get-local-path', async (_event, filename: string) => {
      return path.join(this.acapDir, filename);
    });
  }

  async getAvailableReleases(): Promise<ACAPRelease[]> {
    try {
      // Fetch latest release from GitHub
      const response = await axios.get(
        `https://api.github.com/repos/${this.githubRepo}/releases/latest`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      const release = response.data;
      const acapFiles: ACAPRelease[] = [];

      // Process each asset
      for (const asset of release.assets) {
        if (asset.name.endsWith('.eap') || asset.name.endsWith('.acap')) {
          const architecture = this.extractArchitecture(asset.name);
          const localPath = path.join(this.acapDir, asset.name);
          
          acapFiles.push({
            name: asset.name,
            architecture,
            size: asset.size,
            downloadUrl: asset.browser_download_url,
            filename: asset.name,
            isDownloaded: fs.existsSync(localPath)
          });
        }
      }

      return acapFiles;
    } catch (error: any) {
      console.error('Failed to fetch ACAP releases:', error);
      throw new Error(`Failed to fetch releases: ${error.message}`);
    }
  }

  private extractArchitecture(filename: string): string {
    // Handle real naming patterns like:
    // signed_Anava_-_Analyze_3_8_1_aarch64_os12.eap
    // Look for architecture patterns with word boundaries
    const patterns = [
      { pattern: /[_\-]aarch64[_\-\.]/, arch: 'aarch64' },
      { pattern: /[_\-]arm64[_\-\.]/, arch: 'aarch64' },
      { pattern: /[_\-]armv7hf[_\-\.]/, arch: 'armv7hf' },
      { pattern: /[_\-]armv7[_\-\.]/, arch: 'armv7hf' },
      { pattern: /[_\-]x86_64[_\-\.]/, arch: 'x86_64' },
      { pattern: /[_\-]i386[_\-\.]/, arch: 'i386' }
    ];
    
    const lowerFilename = filename.toLowerCase();
    for (const { pattern, arch } of patterns) {
      if (pattern.test(lowerFilename)) {
        return arch;
      }
    }
    
    // Fallback to simple contains check
    if (lowerFilename.includes('aarch64')) return 'aarch64';
    if (lowerFilename.includes('armv7hf')) return 'armv7hf';
    if (lowerFilename.includes('x86_64')) return 'x86_64';
    if (lowerFilename.includes('i386')) return 'i386';
    
    return 'unknown';
  }

  async downloadACAP(release: ACAPRelease): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      const localPath = path.join(this.acapDir, release.filename);
      
      // If already downloaded, return success
      if (fs.existsSync(localPath)) {
        return { success: true, path: localPath };
      }

      // Download the file
      const response = await axios.get(release.downloadUrl, {
        responseType: 'stream',
        headers: {
          'Accept': 'application/octet-stream'
        }
      });

      // Save to file
      const writer = fs.createWriteStream(localPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          resolve({ success: true, path: localPath });
        });
        
        writer.on('error', (error) => {
          fs.unlinkSync(localPath);
          reject({ success: false, error: error.message });
        });
      });

    } catch (error: any) {
      console.error('Failed to download ACAP:', error);
      return { success: false, error: error.message };
    }
  }

  async downloadACAPToUserFolder(release: ACAPRelease): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      // Get user's Downloads folder
      const app = require('electron').app;
      const downloadsPath = app.getPath('downloads');
      const localPath = path.join(downloadsPath, release.filename);
      
      // Download the file
      const response = await axios.get(release.downloadUrl, {
        responseType: 'stream',
        headers: {
          'Accept': 'application/octet-stream'
        }
      });

      // Save to file
      const writer = fs.createWriteStream(localPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          console.log(`Downloaded ${release.filename} to ${localPath}`);
          resolve({ success: true, path: localPath });
        });
        
        writer.on('error', (error) => {
          if (fs.existsSync(localPath)) {
            fs.unlinkSync(localPath);
          }
          reject({ success: false, error: error.message });
        });
      });

    } catch (error: any) {
      console.error('Failed to download ACAP to user folder:', error);
      return { success: false, error: error.message };
    }
  }
}