/**
 * IPC handlers for Vision Architect system
 */

import { ipcMain } from 'electron';
import { VisionArchitect, generateAndDeployVisionSystem } from './visionArchitect';
import { logger } from '../../utils/logger';

let handlersRegistered = false;

export function registerVisionArchitectHandlers() {
  if (handlersRegistered) {
    logger.warn('[Vision IPC] Handlers already registered, skipping...');
    return;
  }
  
  logger.info('========================================');
  logger.info('[Vision IPC] REGISTERING VISION ARCHITECT HANDLERS');
  logger.info('========================================');
  
  handlersRegistered = true;
  
  // Generate vision system from user goals
  ipcMain.handle('vision-architect-generate', async (
    _event,
    geminiApiKey: string,
    userGoal: string,
    imageDescription?: string,
    modelName?: string,
    imageBase64?: string
  ) => {
    try {
      logger.info('========================================');
      logger.info('[Vision IPC] VISION ARCHITECT GENERATION REQUEST');
      logger.info('========================================');
      logger.info('[Vision IPC] User Goal:', userGoal);
      logger.info('[Vision IPC] Image Description:', imageDescription || 'None');
      logger.info('[Vision IPC] Model:', modelName || 'gemini-2.0-flash-lite (default)');
      logger.info('[Vision IPC] API Key present:', !!geminiApiKey);
      logger.info('[Vision IPC] Image provided:', !!imageBase64);
      if (imageBase64) {
        logger.info('[Vision IPC] Image size:', Math.round(imageBase64.length / 1024), 'KB');
      }
      
      const architect = new VisionArchitect(geminiApiKey, modelName);
      const result = await architect.generateVisionSystem({
        userGoal,
        imageDescription,
        imageBase64
      });
      
      return result;
    } catch (error: any) {
      logger.error('[Vision IPC] Generation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // List available models
  ipcMain.handle('vision-architect-list-models', async (
    _event,
    geminiApiKey: string
  ) => {
    try {
      logger.info('[Vision IPC] Listing available models');
      const architect = new VisionArchitect(geminiApiKey);
      const models = await architect.listAvailableModels();
      return { success: true, models };
    } catch (error: any) {
      logger.error('[Vision IPC] Failed to list models:', error);
      return { success: false, error: error.message };
    }
  });

  // Validate API key
  ipcMain.handle('vision-architect-validate-key', async (
    _event,
    geminiApiKey: string
  ) => {
    try {
      logger.info('[Vision IPC] Validating API key');
      const result = await VisionArchitect.validateApiKey(geminiApiKey);
      return result;
    } catch (error: any) {
      logger.error('[Vision IPC] API key validation failed:', error);
      return { valid: false, error: error.message };
    }
  });

  // Deploy generated system to camera (professional end-to-end)
  ipcMain.handle('vision-architect-deploy', async (
    _event,
    cameraIp: string,
    username: string,
    password: string,
    systemConfig: any
  ) => {
    try {
      logger.info('[Vision IPC] Deploying system to camera:', cameraIp);
      
      const architect = new VisionArchitect(''); // API key not needed for deployment
      const result = await architect.deploySystem(
        cameraIp,
        username,
        password,
        systemConfig
      );
      
      return result;
    } catch (error: any) {
      logger.error('[Vision IPC] Deployment failed:', error);
      return {
        success: false,
        deployed: { scenarios: 0, skills: 0, profiles: 0 },
        errors: [error.message]
      };
    }
  });

  // Combined generate and deploy
  ipcMain.handle('vision-architect-full', async (
    _event,
    cameraIp: string,
    username: string,
    password: string,
    geminiApiKey: string,
    userGoal: string,
    imageDescription?: string
  ) => {
    try {
      logger.info('[Vision IPC] Full system generation and deployment');
      
      const result = await generateAndDeployVisionSystem(
        cameraIp,
        username,
        password,
        geminiApiKey,
        userGoal,
        imageDescription
      );
      
      return result;
    } catch (error: any) {
      logger.error('[Vision IPC] Full process failed:', error);
      return {
        success: false,
        message: error.message
      };
    }
  });

  logger.info('[Vision IPC] Vision Architect handlers registered');
}