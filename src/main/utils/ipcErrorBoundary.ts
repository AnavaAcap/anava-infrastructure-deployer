import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { safeConsole } from './safeConsole';

/**
 * Wraps an IPC handler with error boundary for production resilience
 * Prevents crashes and provides graceful error handling
 */
export function registerIPCHandler<T extends any[], R>(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: T) => Promise<R> | R
): void {
  ipcMain.handle(channel, async (event: IpcMainInvokeEvent, ...args: T) => {
    const startTime = Date.now();
    try {
      safeConsole.log(`[IPC] Handling ${channel}`, args.length > 0 ? 'with args' : 'no args');
      const result = await handler(event, ...args);
      const duration = Date.now() - startTime;
      
      if (duration > 1000) {
        safeConsole.warn(`[IPC] Slow handler ${channel} took ${duration}ms`);
      }
      
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      safeConsole.error(`[IPC] Error in ${channel} after ${duration}ms:`, error);
      
      // Log to file for production debugging
      const errorDetails = {
        channel,
        error: error.message || 'Unknown error',
        stack: error.stack,
        args: args.length > 0 ? 'args provided' : 'no args',
        duration,
        timestamp: new Date().toISOString()
      };
      
      // For network errors, provide more context
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENETUNREACH') {
        return {
          success: false,
          error: `Network error: Unable to connect. Please check your network connection and try again.`,
          code: error.code,
          details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
        };
      }
      
      // For authentication errors
      if (error.message?.includes('401') || error.message?.includes('403') || error.message?.includes('Unauthorized')) {
        return {
          success: false,
          error: 'Authentication failed. Please check your credentials and try again.',
          code: 'AUTH_FAILED',
          details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
        };
      }
      
      // For file system errors
      if (error.code === 'ENOENT' || error.code === 'EACCES' || error.code === 'EPERM') {
        return {
          success: false,
          error: `File system error: ${error.code === 'ENOENT' ? 'File not found' : 'Permission denied'}`,
          code: error.code,
          details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
        };
      }
      
      // For memory errors
      if (error.message?.includes('out of memory') || error.code === 'ENOMEM') {
        // Attempt garbage collection if available
        if (global.gc) {
          try {
            global.gc();
            safeConsole.log('[IPC] Triggered garbage collection after memory error');
          } catch (gcError) {
            safeConsole.error('[IPC] Failed to trigger garbage collection:', gcError);
          }
        }
        
        return {
          success: false,
          error: 'Memory error: The application is running low on memory. Please restart the application.',
          code: 'ENOMEM',
          details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
        };
      }
      
      // Log all errors to deployment logger if it's a deployment-related channel
      if (channel.includes('deploy') || channel.includes('acap')) {
        safeConsole.error(`[DEPLOYMENT-ERROR] ${channel} failed:`, error);
      }
      
      // Generic error response
      return {
        success: false,
        error: error.message || 'An unexpected error occurred',
        code: error.code || 'UNKNOWN_ERROR',
        details: process.env.NODE_ENV === 'development' ? errorDetails : undefined,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
    }
  });
}

/**
 * Wraps an IPC event listener with error boundary
 */
export function registerIPCListener<T extends any[]>(
  channel: string,
  handler: (event: Electron.IpcMainEvent, ...args: T) => void
): void {
  ipcMain.on(channel, (event: Electron.IpcMainEvent, ...args: T) => {
    try {
      safeConsole.log(`[IPC] Event ${channel}`);
      handler(event, ...args);
    } catch (error: any) {
      safeConsole.error(`[IPC] Error in event ${channel}:`, error);
      
      // Try to send error back to renderer if possible
      if (event.sender && !event.sender.isDestroyed()) {
        try {
          event.sender.send(`${channel}-error`, {
            error: error.message || 'An error occurred',
            channel
          });
        } catch (sendError) {
          safeConsole.error(`[IPC] Failed to send error to renderer:`, sendError);
        }
      }
    }
  });
}

/**
 * Unregister all handlers for a channel (useful for cleanup)
 */
export function unregisterIPCChannel(channel: string): void {
  try {
    ipcMain.removeHandler(channel);
    ipcMain.removeAllListeners(channel);
    safeConsole.log(`[IPC] Unregistered channel ${channel}`);
  } catch (error) {
    safeConsole.error(`[IPC] Failed to unregister channel ${channel}:`, error);
  }
}