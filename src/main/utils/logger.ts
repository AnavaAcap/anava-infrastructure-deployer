import { app } from 'electron';
import path from 'path';
import fs from 'fs';

const isDevelopment = process.env.NODE_ENV !== 'production';

class Logger {
  private logFile: string;
  private stream: fs.WriteStream | null = null;

  constructor() {
    // Create logs directory
    const logsDir = app.getPath('logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Create log file with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFile = path.join(logsDir, `anava-vision-${timestamp}.log`);
    
    // Create write stream
    this.stream = fs.createWriteStream(this.logFile, { flags: 'a' });
    
    // Log startup info
    this.log('=== Anava Vision Started ===');
    this.log(`Version: ${app.getVersion()}`);
    this.log(`Electron: ${process.versions.electron}`);
    this.log(`Platform: ${process.platform} ${process.arch}`);
    this.log(`Log file: ${this.logFile}`);
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
    if (this.stream && !this.stream.destroyed) {
      this.stream.write(message + '\n');
    }
  }

  log(message: string, ...args: any[]) {
    const formatted = this.formatMessage('INFO', message, ...args);
    console.log(formatted);
    this.writeToFile(formatted);
  }

  info(message: string, ...args: any[]) {
    this.log(message, ...args);
  }

  warn(message: string, ...args: any[]) {
    const formatted = this.formatMessage('WARN', message, ...args);
    console.warn(formatted);
    this.writeToFile(formatted);
  }

  error(message: string, ...args: any[]) {
    const formatted = this.formatMessage('ERROR', message, ...args);
    console.error(formatted);
    this.writeToFile(formatted);
  }

  debug(message: string, ...args: any[]) {
    if (isDevelopment) {
      const formatted = this.formatMessage('DEBUG', message, ...args);
      console.debug(formatted);
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

// Also override console methods to capture all logs
const logger = getLogger();

// Export the logger instance
export { logger };
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.log = (...args: any[]) => {
  originalConsoleLog(...args);
  logger.writeToFile(logger.formatMessage('CONSOLE', args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ')));
};

console.error = (...args: any[]) => {
  originalConsoleError(...args);
  logger.writeToFile(logger.formatMessage('ERROR', args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ')));
};

console.warn = (...args: any[]) => {
  originalConsoleWarn(...args);
  logger.writeToFile(logger.formatMessage('WARN', args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
  ).join(' ')));
};