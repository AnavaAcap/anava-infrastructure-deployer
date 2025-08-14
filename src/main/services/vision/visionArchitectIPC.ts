/**
 * IPC handlers for Vision Architect system
 */

import { ipcMain } from 'electron';
import { VisionArchitect, generateAndDeployVisionSystem } from './visionArchitect';
import { logger } from '../../utils/logger';

export function registerVisionArchitectHandlers() {
  // Generate vision system from user goals
  ipcMain.handle('vision-architect-generate', async (
    _event,
    geminiApiKey: string,
    userGoal: string,
    imageDescription?: string
  ) => {
    try {
      logger.info('[Vision IPC] Generating system for goal:', userGoal);
      
      const architect = new VisionArchitect(geminiApiKey);
      const result = await architect.generateVisionSystem({
        userGoal,
        imageDescription
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

  // Deploy generated system to camera
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