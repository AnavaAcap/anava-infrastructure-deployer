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
  private acapDir: string;
  private githubRepo = 'AnavaAcap/acap-releases';

  constructor() {
    this.acapDir = path.join(os.tmpdir(), 'anava-acaps');
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
    if (filename.includes('aarch64')) return 'aarch64';
    if (filename.includes('armv7hf')) return 'armv7hf';
    if (filename.includes('x86_64')) return 'x86_64';
    if (filename.includes('i386')) return 'i386';
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
}