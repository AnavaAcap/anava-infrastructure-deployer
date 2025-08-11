/**
 * Safe localStorage wrapper with error handling
 * Prevents crashes when localStorage is unavailable or quota exceeded
 */

interface StorageWrapper {
  getItem(key: string): string | null;
  setItem(key: string, value: string): boolean;
  removeItem(key: string): boolean;
  clear(): boolean;
}

class SafeStorage implements StorageWrapper {
  private storage: Storage | null = null;
  private inMemoryStorage: Map<string, string> = new Map();
  private isAvailable: boolean = false;

  constructor() {
    this.checkAvailability();
  }

  private checkAvailability(): void {
    try {
      const testKey = '__localStorage_test__';
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(testKey, 'test');
        window.localStorage.removeItem(testKey);
        this.storage = window.localStorage;
        this.isAvailable = true;
      }
    } catch (error) {
      console.warn('[SafeStorage] localStorage not available, using in-memory fallback:', error);
      this.isAvailable = false;
    }
  }

  getItem(key: string): string | null {
    try {
      if (this.isAvailable && this.storage) {
        return this.storage.getItem(key);
      }
      return this.inMemoryStorage.get(key) || null;
    } catch (error) {
      console.error('[SafeStorage] Error reading from storage:', error);
      // Fallback to in-memory
      return this.inMemoryStorage.get(key) || null;
    }
  }

  setItem(key: string, value: string): boolean {
    try {
      if (this.isAvailable && this.storage) {
        this.storage.setItem(key, value);
        // Also store in memory as backup
        this.inMemoryStorage.set(key, value);
        return true;
      }
      // Fallback to in-memory only
      this.inMemoryStorage.set(key, value);
      return true;
    } catch (error) {
      console.error('[SafeStorage] Error writing to storage:', error);
      
      // Check if quota exceeded
      if (error instanceof DOMException && 
          (error.code === 22 || error.code === 1014 || error.name === 'QuotaExceededError')) {
        console.warn('[SafeStorage] Storage quota exceeded, clearing old data...');
        this.clearOldData();
        
        // Try once more
        try {
          if (this.storage) {
            this.storage.setItem(key, value);
            this.inMemoryStorage.set(key, value);
            return true;
          }
        } catch (retryError) {
          console.error('[SafeStorage] Failed even after clearing:', retryError);
        }
      }
      
      // Final fallback to in-memory
      this.inMemoryStorage.set(key, value);
      return false;
    }
  }

  removeItem(key: string): boolean {
    try {
      if (this.isAvailable && this.storage) {
        this.storage.removeItem(key);
      }
      this.inMemoryStorage.delete(key);
      return true;
    } catch (error) {
      console.error('[SafeStorage] Error removing from storage:', error);
      this.inMemoryStorage.delete(key);
      return false;
    }
  }

  clear(): boolean {
    try {
      if (this.isAvailable && this.storage) {
        this.storage.clear();
      }
      this.inMemoryStorage.clear();
      return true;
    } catch (error) {
      console.error('[SafeStorage] Error clearing storage:', error);
      this.inMemoryStorage.clear();
      return false;
    }
  }

  private clearOldData(): void {
    if (!this.storage) return;
    
    try {
      // Clear items older than 7 days
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      
      const keysToRemove: string[] = [];
      
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (!key) continue;
        
        // Check if it's a timestamped key
        if (key.includes('_timestamp_')) {
          const parts = key.split('_timestamp_');
          const timestamp = parseInt(parts[1]);
          
          if (!isNaN(timestamp) && (now - timestamp) > maxAge) {
            keysToRemove.push(key);
          }
        }
      }
      
      // Remove old keys
      keysToRemove.forEach(key => {
        this.storage?.removeItem(key);
      });
      
      console.log(`[SafeStorage] Cleared ${keysToRemove.length} old items`);
    } catch (error) {
      console.error('[SafeStorage] Error clearing old data:', error);
    }
  }
}

// Export singleton instance
export const safeStorage = new SafeStorage();

// Helper functions for JSON storage
export function getStoredJSON<T>(key: string, defaultValue: T): T {
  try {
    const stored = safeStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored) as T;
    }
  } catch (error) {
    console.error(`[SafeStorage] Error parsing JSON for key ${key}:`, error);
  }
  return defaultValue;
}

export function setStoredJSON<T>(key: string, value: T): boolean {
  try {
    const json = JSON.stringify(value);
    return safeStorage.setItem(key, json);
  } catch (error) {
    console.error(`[SafeStorage] Error stringifying JSON for key ${key}:`, error);
    return false;
  }
}

// Add timestamp to keys for automatic cleanup
export function setStoredJSONWithTimestamp<T>(key: string, value: T): boolean {
  const timestampedKey = `${key}_timestamp_${Date.now()}`;
  return setStoredJSON(timestampedKey, value);
}