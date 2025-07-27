export interface ParallelTask<T> {
  name: string;
  fn: () => Promise<T>;
  critical?: boolean; // If true, failure will stop execution
}

export interface ParallelResult<T> {
  name: string;
  success: boolean;
  result?: T;
  error?: Error;
}

export class ParallelExecutor {
  static async executeWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 5,
    backoffMultiplier: number = 2,
    initialDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        // Check if error is retryable
        const isRetryable = 
          error.code === 404 ||
          error.message?.includes('does not exist') ||
          error.message?.includes('not found') ||
          error.message?.includes('eventual consistency') ||
          error.message?.includes('propagat');
        
        if (!isRetryable || attempt === maxRetries - 1) {
          throw error;
        }
        
        const delay = initialDelay * Math.pow(backoffMultiplier, attempt);
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms delay`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError || new Error('Max retries exceeded');
  }

  static async executeBatch<T>(
    tasks: ParallelTask<T>[],
    options: {
      maxConcurrency?: number;
      stopOnError?: boolean;
      onProgress?: (completed: number, total: number) => void;
    } = {}
  ): Promise<ParallelResult<T>[]> {
    const { maxConcurrency = 10, stopOnError = false, onProgress } = options;
    const results: ParallelResult<T>[] = [];
    const inProgress = new Set<Promise<void>>();
    let completed = 0;
    let shouldStop = false;

    for (const task of tasks) {
      if (shouldStop) break;

      // Wait if we've reached max concurrency
      if (inProgress.size >= maxConcurrency) {
        await Promise.race(inProgress);
      }

      const promise = (async () => {
        try {
          console.log(`Starting parallel task: ${task.name}`);
          const result = await task.fn();
          results.push({
            name: task.name,
            success: true,
            result
          });
          console.log(`Completed parallel task: ${task.name}`);
        } catch (error: any) {
          console.error(`Failed parallel task ${task.name}:`, error.message);
          results.push({
            name: task.name,
            success: false,
            error
          });
          
          if (task.critical || stopOnError) {
            shouldStop = true;
          }
        } finally {
          completed++;
          onProgress?.(completed, tasks.length);
        }
      })();

      inProgress.add(promise);
      promise.finally(() => inProgress.delete(promise));
    }

    // Wait for all remaining tasks
    await Promise.all(inProgress);

    return results;
  }

  static async executeGroups<T>(
    groups: ParallelTask<T>[][],
    options: {
      onGroupComplete?: (groupIndex: number) => void;
      stopOnError?: boolean;
    } = {}
  ): Promise<ParallelResult<T>[][]> {
    const allResults: ParallelResult<T>[][] = [];
    
    for (let i = 0; i < groups.length; i++) {
      console.log(`Executing parallel group ${i + 1}/${groups.length}`);
      const groupResults = await this.executeBatch(groups[i], {
        stopOnError: options.stopOnError
      });
      
      allResults.push(groupResults);
      options.onGroupComplete?.(i);
      
      // Check if any critical task failed
      if (options.stopOnError && groupResults.some(r => !r.success)) {
        break;
      }
    }
    
    return allResults;
  }

  static createProgressTracker(total: number, onUpdate: (progress: number) => void) {
    let completed = 0;
    return {
      increment: () => {
        completed++;
        onUpdate((completed / total) * 100);
      },
      getCurrent: () => completed,
      getProgress: () => (completed / total) * 100
    };
  }
}