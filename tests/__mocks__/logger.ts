/**
 * Mock Logger for tests
 */

export class Logger {
  constructor() {}
  
  info = jest.fn();
  error = jest.fn();
  warn = jest.fn();
  debug = jest.fn();
  verbose = jest.fn();
  
  static getInstance() {
    return new Logger();
  }
}

export const getLogger = jest.fn(() => new Logger());

export default new Logger();