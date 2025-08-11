import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';

const isDevelopment = process.env.NODE_ENV !== 'production';

class Logger {
  private logFile: string;
  private standardLogFile: string;
  private stream: fs.WriteStream | null = null;
  private standardStream: fs.WriteStream | null = null;

  constructor() {
    // Create logs directory in user's home for debugging (accessible and writable)
    // os.homedir() works on ALL platforms (Windows, macOS, Linux)
    const homeDir = os.homedir();
    const debugLogsDir = path.join(homeDir, 'anava-debug-logs');
    
    try {
      if (!fs.existsSync(debugLogsDir)) {
        fs.mkdirSync(debugLogsDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create debug logs directory:', error);
    }

    // ALSO create in standard location
    const standardLogsDir = app.getPath('logs');
    try {
      if (!fs.existsSync(standardLogsDir)) {
        fs.mkdirSync(standardLogsDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create standard logs directory:', error);
    }

    // Create log file with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFile = path.join(debugLogsDir, `anava-vision-${timestamp}.log`);
    this.standardLogFile = path.join(standardLogsDir, `anava-vision-${timestamp}.log`);
    
    // Create write streams for BOTH locations
    this.stream = fs.createWriteStream(this.logFile, { flags: 'a' });
    this.standardStream = fs.createWriteStream(this.standardLogFile, { flags: 'a' });
    
    // Log startup info
    this.log('=== Anava Vision Started ===');
    this.log(`Version: ${app.getVersion()}`);
    this.log(`Electron: ${process.versions.electron}`);
    this.log(`Platform: ${process.platform} ${process.arch}`);
    this.log(`DEBUG Log file: ${this.logFile}`);
    this.log(`Standard Log file: ${this.standardLogFile}`);
    this.log(`User data: ${app.getPath('userData')}`);
    this.log('=========================================\n');
  }

  formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ' ' + args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ') : '';
    return `[${timestamp}] [${level}] ${message}${formattedArgs}`;
  }

  writeToFile(message: string) {
    // Write to BOTH log files
    if (this.stream && !this.stream.destroyed) {
      this.stream.write(message + '\n');
    }
    if (this.standardStream && !this.standardStream.destroyed) {
      this.standardStream.write(message + '\n');
    }
  }

  log(message: string, ...args: any[]) {
    const formatted = this.formatMessage('INFO', message, ...args);
    if (isDevelopment) {
      process.stdout.write(formatted + '\n');
    }
    this.writeToFile(formatted);
  }

  info(message: string, ...args: any[]) {
    this.log(message, ...args);
  }

  warn(message: string, ...args: any[]) {
    const formatted = this.formatMessage('WARN', message, ...args);
    if (isDevelopment) {
      process.stderr.write(formatted + '\n');
    }
    this.writeToFile(formatted);
  }

  error(message: string, ...args: any[]) {
    const formatted = this.formatMessage('ERROR', message, ...args);
    if (isDevelopment) {
      process.stderr.write(formatted + '\n');
    }
    this.writeToFile(formatted);
  }

  debug(message: string, ...args: any[]) {
    if (isDevelopment) {
      const formatted = this.formatMessage('DEBUG', message, ...args);
      process.stdout.write(formatted + '\n');
      this.writeToFile(formatted);
    }
  }

  getLogFilePath(): string {
    return this.logFile;
  }

  close() {
    if (this.stream) {
      this.stream.end();
    }
    if (this.standardStream) {
      this.standardStream.end();
    }
  }
}

// Create singleton instance
let loggerInstance: Logger | null = null;

export function getLogger(): Logger {
  if (!loggerInstance) {
    loggerInstance = new Logger();
  }
  return loggerInstance;
}

// Export the logger instance
export const logger = getLogger();