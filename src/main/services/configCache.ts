import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { DeploymentConfig } from '../../types';

interface CachedConfig {
  userEmail: string;
  config: DeploymentConfig & {
    apiGatewayUrl?: string;
    apiKey?: string;
    firebaseConfig?: any;
  };
  timestamp: string;
}

export class ConfigCacheService {
  private cacheDir: string;
  private cacheFile: string;

  constructor() {
    this.cacheDir = path.join(app.getPath('userData'), 'cache');
    this.cacheFile = path.join(this.cacheDir, 'deployment-configs.json');
    this.ensureCacheDir();
  }

  private ensureCacheDir() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private loadCache(): Record<string, CachedConfig> {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = fs.readFileSync(this.cacheFile, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading config cache:', error);
    }
    return {};
  }

  private saveCache(cache: Record<string, CachedConfig>) {
    try {
      fs.writeFileSync(this.cacheFile, JSON.stringify(cache, null, 2));
    } catch (error) {
      console.error('Error saving config cache:', error);
    }
  }

  saveConfig(userEmail: string, config: DeploymentConfig & any) {
    const cache = this.loadCache();
    cache[userEmail] = {
      userEmail,
      config,
      timestamp: new Date().toISOString()
    };
    this.saveCache(cache);
    console.log(`[ConfigCache] Saved configuration for ${userEmail}`);
  }

  getConfig(userEmail: string): CachedConfig | null {
    const cache = this.loadCache();
    const cached = cache[userEmail];
    
    if (cached) {
      console.log(`[ConfigCache] Retrieved configuration for ${userEmail} from ${cached.timestamp}`);
      return cached;
    }
    
    return null;
  }

  getAllConfigs(): CachedConfig[] {
    const cache = this.loadCache();
    return Object.values(cache).sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  clearConfig(userEmail: string) {
    const cache = this.loadCache();
    delete cache[userEmail];
    this.saveCache(cache);
    console.log(`[ConfigCache] Cleared configuration for ${userEmail}`);
  }

  clearAllConfigs() {
    this.saveCache({});
    console.log('[ConfigCache] Cleared all configurations');
  }
}

export const configCacheService = new ConfigCacheService();