export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  jitter?: boolean;
  retryableErrors?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any, delayMs: number) => void;
}

export class ResilienceUtils {
  /**
   * Execute a function with exponential backoff retry
   */
  static async withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      initialDelayMs = 1000,
      maxDelayMs = 30000,
      backoffMultiplier = 2,
      jitter = true,
      retryableErrors = (error) => this.isRetryableError(error),
      onRetry
    } = options;

    let lastError: any;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        if (attempt === maxAttempts || !retryableErrors(error)) {
          throw error;
        }
        
        // Calculate delay with exponential backoff
        let delayMs = Math.min(
          initialDelayMs * Math.pow(backoffMultiplier, attempt - 1),
          maxDelayMs
        );
        
        // Add jitter to prevent thundering herd
        if (jitter) {
          delayMs = delayMs * (0.5 + Math.random() * 0.5);
        }
        
        if (onRetry) {
          onRetry(attempt, error, delayMs);
        }
        
        await this.sleep(delayMs);
      }
    }
    
    throw lastError;
  }

  /**
   * Execute multiple operations with circuit breaker pattern
   */
  static createCircuitBreaker(options: {
    failureThreshold?: number;
    resetTimeMs?: number;
    halfOpenRequests?: number;
  } = {}) {
    const {
      failureThreshold = 5,
      resetTimeMs = 60000,
      halfOpenRequests = 1
    } = options;
    
    let failures = 0;
    let lastFailureTime = 0;
    let state: 'closed' | 'open' | 'half-open' = 'closed';
    let halfOpenAttempts = 0;
    
    return async <T>(fn: () => Promise<T>): Promise<T> => {
      // Check if circuit should be reset
      if (state === 'open' && Date.now() - lastFailureTime > resetTimeMs) {
        state = 'half-open';
        halfOpenAttempts = 0;
      }
      
      // If circuit is open, fail fast
      if (state === 'open') {
        throw new Error('Circuit breaker is open - service unavailable');
      }
      
      // If half-open, limit requests
      if (state === 'half-open' && halfOpenAttempts >= halfOpenRequests) {
        throw new Error('Circuit breaker is half-open - limiting requests');
      }
      
      try {
        const result = await fn();
        
        // Success - reset failures
        if (state === 'half-open') {
          state = 'closed';
          failures = 0;
        }
        
        return result;
      } catch (error) {
        failures++;
        lastFailureTime = Date.now();
        
        if (state === 'half-open') {
          halfOpenAttempts++;
          state = 'open';
        } else if (failures >= failureThreshold) {
          state = 'open';
        }
        
        throw error;
      }
    };
  }

  /**
   * Check if an error is retryable
   */
  static isRetryableError(error: any): boolean {
    // Network errors
    if (error.code === 'ECONNRESET' || 
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ENETUNREACH') {
      return true;
    }
    
    // HTTP status codes
    const status = error.response?.status || error.status || error.code;
    
    // 5xx errors are generally retryable
    if (status >= 500 && status < 600) {
      return true;
    }
    
    // 429 Too Many Requests
    if (status === 429) {
      return true;
    }
    
    // 409 Conflict (often indicates concurrent modification)
    if (status === 409) {
      return true;
    }
    
    // Google API specific errors
    if (error.message?.includes('UNAVAILABLE') ||
        error.message?.includes('DEADLINE_EXCEEDED') ||
        error.message?.includes('INTERNAL') ||
        error.message?.includes('concurrent policy changes') ||
        error.message?.includes('ETag')) {
      return true;
    }
    
    return false;
  }

  /**
   * Batch operations with controlled concurrency and retry
   */
  static async batchWithRetry<T>(
    items: T[],
    operation: (item: T) => Promise<any>,
    options: {
      batchSize?: number;
      concurrency?: number;
      retryOptions?: RetryOptions;
      onProgress?: (completed: number, total: number) => void;
    } = {}
  ): Promise<any[]> {
    const {
      batchSize = 10,
      concurrency = 3,
      retryOptions,
      onProgress
    } = options;
    
    const results: any[] = [];
    let completed = 0;
    
    // Process in batches
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      // Process batch with controlled concurrency
      const batchPromises = batch.map((item) => {
        return this.withRetry(
          () => operation(item),
          retryOptions
        ).then(result => {
          completed++;
          if (onProgress) {
            onProgress(completed, items.length);
          }
          return result;
        });
      });
      
      // Limit concurrency within batch
      const batchResults = await this.promiseAllWithConcurrency(
        batchPromises,
        concurrency
      );
      
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Execute promises with concurrency limit
   */
  private static async promiseAllWithConcurrency<T>(
    promises: Promise<T>[],
    concurrency: number
  ): Promise<T[]> {
    const results: T[] = new Array(promises.length);
    const executing: Promise<void>[] = [];
    
    for (let i = 0; i < promises.length; i++) {
      const promise = promises[i].then(result => {
        results[i] = result;
      });
      
      executing.push(promise);
      
      if (executing.length >= concurrency) {
        await Promise.race(executing);
        executing.splice(executing.findIndex(p => p === promise), 1);
      }
    }
    
    await Promise.all(executing);
    return results;
  }

  /**
   * Sleep utility
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create an idempotency key for operations
   */
  static createIdempotencyKey(operation: string, ...params: any[]): string {
    const data = JSON.stringify({ operation, params, timestamp: Date.now() });
    return Buffer.from(data).toString('base64');
  }

  /**
   * Wrap an operation to make it idempotent
   */
  static async makeIdempotent<T>(
    key: string,
    operation: () => Promise<T>,
    cache: Map<string, { result: T; timestamp: number }>,
    ttlMs: number = 3600000 // 1 hour default
  ): Promise<T> {
    // Check cache
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < ttlMs) {
      console.log(`Returning cached result for idempotent operation: ${key}`);
      return cached.result;
    }
    
    // Execute operation
    const result = await operation();
    
    // Cache result
    cache.set(key, { result, timestamp: Date.now() });
    
    return result;
  }
}

/**
 * State manager for tracking deployment progress
 */
export class DeploymentStateManager {
  private state: Map<string, any> = new Map();
  private checkpoints: Map<string, any> = new Map();
  
  /**
   * Save current state
   */
  saveState(key: string, value: any): void {
    this.state.set(key, value);
  }
  
  /**
   * Get saved state
   */
  getState(key: string): any {
    return this.state.get(key);
  }
  
  /**
   * Create a checkpoint
   */
  createCheckpoint(name: string): void {
    this.checkpoints.set(name, {
      state: new Map(this.state),
      timestamp: Date.now()
    });
  }
  
  /**
   * Restore from checkpoint
   */
  restoreCheckpoint(name: string): boolean {
    const checkpoint = this.checkpoints.get(name);
    if (!checkpoint) {
      return false;
    }
    
    this.state = new Map(checkpoint.state);
    return true;
  }
  
  /**
   * Get all checkpoints
   */
  getCheckpoints(): string[] {
    return Array.from(this.checkpoints.keys());
  }
  
  /**
   * Clear all state
   */
  clear(): void {
    this.state.clear();
    this.checkpoints.clear();
  }
  
  /**
   * Export state for persistence
   */
  export(): string {
    return JSON.stringify({
      state: Array.from(this.state.entries()),
      checkpoints: Array.from(this.checkpoints.entries())
    });
  }
  
  /**
   * Import state from persistence
   */
  import(data: string): void {
    const parsed = JSON.parse(data);
    this.state = new Map(parsed.state);
    this.checkpoints = new Map(parsed.checkpoints);
  }
}