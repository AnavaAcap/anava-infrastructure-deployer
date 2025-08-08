/**
 * Safe console wrapper that prevents EPIPE errors
 * when console stream is closed (common in Electron apps)
 */
export const safeConsole = {
  log: (...args: any[]) => {
    try {
      console.log(...args);
    } catch (error: any) {
      // Ignore EPIPE errors - they're harmless
      if (error?.code !== 'EPIPE') {
        // Re-throw other errors
        throw error;
      }
    }
  },
  
  error: (...args: any[]) => {
    try {
      console.error(...args);
    } catch (error: any) {
      if (error?.code !== 'EPIPE') {
        throw error;
      }
    }
  },
  
  warn: (...args: any[]) => {
    try {
      console.warn(...args);
    } catch (error: any) {
      if (error?.code !== 'EPIPE') {
        throw error;
      }
    }
  },
  
  info: (...args: any[]) => {
    try {
      console.info(...args);
    } catch (error: any) {
      if (error?.code !== 'EPIPE') {
        throw error;
      }
    }
  }
};