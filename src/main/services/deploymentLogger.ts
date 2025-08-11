import { ipcMain } from 'electron';
import { logger } from '../utils/logger';

/**
 * Deployment logger service - captures ALL deployment events
 */
export class DeploymentLogger {
  constructor() {
    this.setupIPC();
  }

  private setupIPC() {
    // Log deployment events from renderer
    ipcMain.on('deployment-log', (_event, level: string, message: string, data?: any) => {
      const logMessage = `[DEPLOYMENT] ${message}`;
      
      switch (level) {
        case 'error':
          logger.error(logMessage, data);
          break;
        case 'warn':
          logger.warn(logMessage, data);
          break;
        case 'debug':
          logger.debug(logMessage, data);
          break;
        default:
          logger.info(logMessage, data);
      }
    });

    // Log deployment step changes
    ipcMain.on('deployment-step', (_event, step: string, camera: any) => {
      logger.info(`[DEPLOYMENT-STEP] ${step}`, {
        cameraId: camera?.id,
        cameraIp: camera?.ip,
        cameraModel: camera?.model
      });
    });

    // Log deployment results
    ipcMain.on('deployment-result', (_event, success: boolean, camera: any, error?: any) => {
      if (success) {
        logger.info(`[DEPLOYMENT-SUCCESS] Camera ${camera?.ip} deployed successfully`);
      } else {
        logger.error(`[DEPLOYMENT-FAILURE] Camera ${camera?.ip} deployment failed`, error);
      }
    });
  }
}

// Create singleton
export const deploymentLogger = new DeploymentLogger();