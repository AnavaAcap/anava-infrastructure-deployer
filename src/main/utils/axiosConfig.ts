import axios, { AxiosInstance, AxiosError } from 'axios';
import https from 'https';
import { logger } from './logger';

/**
 * Create a configured axios instance with production-ready settings
 * Includes timeout, retry logic, and error handling
 */
export function createAxiosInstance(config?: {
  timeout?: number;
  retries?: number;
  baseURL?: string;
  rejectUnauthorized?: boolean;
}): AxiosInstance {
  const instance = axios.create({
    timeout: config?.timeout || 30000, // 30 second default timeout
    baseURL: config?.baseURL,
    httpsAgent: new https.Agent({
      rejectUnauthorized: config?.rejectUnauthorized ?? false // Allow self-signed certs for cameras
    }),
    maxRedirects: 5,
    validateStatus: (status) => status < 500 // Don't throw on 4xx errors
  });

  // Request interceptor for logging
  instance.interceptors.request.use(
    (request) => {
      logger.debug(`[Axios] ${request.method?.toUpperCase()} ${request.url}`, {
        timeout: request.timeout,
        headers: request.headers
      });
      return request;
    },
    (error) => {
      logger.error('[Axios] Request error:', error);
      return Promise.reject(error);
    }
  );

  // Response interceptor with retry logic
  const maxRetries = config?.retries ?? 3;
  
  instance.interceptors.response.use(
    (response) => {
      logger.debug(`[Axios] Response ${response.status} from ${response.config.url}`);
      return response;
    },
    async (error: AxiosError) => {
      const { config: requestConfig, response } = error;
      
      if (!requestConfig) {
        logger.error('[Axios] No request config for retry');
        return Promise.reject(error);
      }

      // Track retry count
      const retryCount = (requestConfig as any).__retryCount || 0;
      
      // Determine if we should retry
      const shouldRetry = 
        retryCount < maxRetries &&
        (
          error.code === 'ECONNABORTED' || // Timeout
          error.code === 'ENOTFOUND' ||    // DNS error
          error.code === 'ECONNREFUSED' || // Connection refused
          error.code === 'ETIMEDOUT' ||    // Connection timeout
          error.code === 'ECONNRESET' ||   // Connection reset
          (!response && error.message?.includes('timeout')) || // Generic timeout
          (response && response.status >= 500) // Server errors
        );

      if (shouldRetry) {
        (requestConfig as any).__retryCount = retryCount + 1;
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        logger.warn(`[Axios] Retrying request (${retryCount + 1}/${maxRetries}) after ${delay}ms`, {
          url: requestConfig.url,
          error: error.code || error.message
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Retry the request
        return instance(requestConfig);
      }

      // Log final error
      logger.error('[Axios] Request failed after retries:', {
        url: requestConfig.url,
        method: requestConfig.method,
        status: response?.status,
        error: error.message,
        code: error.code,
        retries: retryCount
      });

      return Promise.reject(error);
    }
  );

  return instance;
}

/**
 * Create axios instance specifically for camera communication
 */
export function createCameraAxiosInstance(timeout = 10000): AxiosInstance {
  return createAxiosInstance({
    timeout,
    retries: 2, // Fewer retries for cameras
    rejectUnauthorized: false // Cameras use self-signed certs
  });
}

/**
 * Create axios instance for GCP API calls
 */
export function createGCPAxiosInstance(): AxiosInstance {
  return createAxiosInstance({
    timeout: 60000, // 60 seconds for GCP operations
    retries: 3,
    rejectUnauthorized: true // Enforce cert validation for GCP
  });
}