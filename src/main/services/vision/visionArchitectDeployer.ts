/**
 * Vision Architect Deployer - Handles deployment of generated systems to camera
 * Uses the correct ACAP endpoints for skills, profiles, and AOA scenarios
 */

import { logger } from '../../utils/logger';
import AOAService from '../aoa/aoaService';
import axios from 'axios';
import https from 'https';

export class VisionArchitectDeployer {
  private cameraIp: string;
  private username: string;
  private password: string;
  private aoaService: AOAService;

  constructor(cameraIp: string, username: string, password: string) {
    this.cameraIp = cameraIp;
    this.username = username;
    this.password = password;
    this.aoaService = new AOAService(cameraIp, username, password);
  }

  /**
   * Deploy a complete vision system to the camera
   * Professional end-to-end deployment with no mocking
   */
  async deploySystem(systemConfig: any): Promise<{
    success: boolean;
    deployed: {
      scenarios: number;
      skills: number;
      profiles: number;
    };
    errors: string[];
    details?: {
      skillIds?: string[];
      profileIds?: string[];
      scenarioIds?: number[];
    };
  }> {
    const errors: string[] = [];
    const deployedSkillIds: string[] = [];
    const deployedProfileIds: string[] = [];
    const deployedScenarioIds: number[] = [];
    
    let deployedScenarios = 0;
    let deployedSkills = 0;
    let deployedProfiles = 0;
    
    const skillIdMap = new Map<string, string>(); // Map skill names to created IDs

    logger.info('========================================');
    logger.info('[Vision Deployer] STARTING DEPLOYMENT');
    logger.info('========================================');
    logger.info('[Vision Deployer] Target Camera:', this.cameraIp);
    logger.info('[Vision Deployer] Components to Deploy:', {
      scenarios: systemConfig.axisScenarios?.length || 0,
      skills: systemConfig.skills?.length || 0,
      profiles: systemConfig.securityProfiles?.length || 0
    });

    try {
      // Step 1: Deploy Skills
      if (systemConfig.skills?.length > 0) {
        logger.info('[Vision Deployer] === STEP 1: DEPLOYING SKILLS ===');
        
        for (const skill of systemConfig.skills) {
          try {
            logger.info(`[Vision Deployer] Creating skill: ${skill.name}`);
            
            const skillId = await this.createSkill(skill);
            
            if (skillId) {
              skillIdMap.set(skill.name, skillId);
              deployedSkillIds.push(skillId);
              deployedSkills++;
              logger.info(`[Vision Deployer] ✅ Skill created: ${skill.name} (ID: ${skillId})`);
            } else {
              throw new Error('No skill ID returned');
            }
          } catch (error: any) {
            logger.error(`[Vision Deployer] ❌ Failed to create skill ${skill.name}:`, error.message);
            errors.push(`Failed to create skill ${skill.name}: ${error.message}`);
          }
        }
        
        logger.info(`[Vision Deployer] Skills deployed: ${deployedSkills}/${systemConfig.skills.length}`);
      }

      // Step 2: Deploy Security Profiles
      if (systemConfig.securityProfiles?.length > 0) {
        logger.info('[Vision Deployer] === STEP 2: DEPLOYING SECURITY PROFILES ===');
        
        for (const profile of systemConfig.securityProfiles) {
          try {
            logger.info(`[Vision Deployer] Creating profile: ${profile.name}`);
            
            // Map skill name to actual skill ID
            const skillId = skillIdMap.get(profile.skillId) || profile.skillId;
            const profileWithSkillId = { ...profile, skillId };
            
            const profileId = await this.createSecurityProfile(profileWithSkillId);
            
            if (profileId) {
              deployedProfileIds.push(profileId);
              deployedProfiles++;
              logger.info(`[Vision Deployer] ✅ Profile created: ${profile.name} (ID: ${profileId})`);
            } else {
              throw new Error('No profile ID returned');
            }
          } catch (error: any) {
            logger.error(`[Vision Deployer] ❌ Failed to create profile ${profile.name}:`, error.message);
            errors.push(`Failed to create profile ${profile.name}: ${error.message}`);
          }
        }
        
        logger.info(`[Vision Deployer] Profiles deployed: ${deployedProfiles}/${systemConfig.securityProfiles.length}`);
      }

      // Step 3: Deploy AOA Scenarios
      if (systemConfig.axisScenarios?.length > 0) {
        logger.info('[Vision Deployer] === STEP 3: DEPLOYING AOA SCENARIOS ===');
        
        // Ensure AOA is running
        try {
          await this.aoaService.startAOA();
          logger.info('[Vision Deployer] AOA application started');
        } catch (error: any) {
          logger.warn('[Vision Deployer] Could not start AOA:', error.message);
        }
        
        for (const scenario of systemConfig.axisScenarios) {
          try {
            logger.info(`[Vision Deployer] Creating AOA scenario: ${scenario.name}`);
            
            const scenarioId = await this.createAOAScenario(scenario);
            
            if (scenarioId) {
              deployedScenarioIds.push(scenarioId);
              deployedScenarios++;
              logger.info(`[Vision Deployer] ✅ AOA scenario created: ${scenario.name} (ID: ${scenarioId})`);
            } else {
              throw new Error('Failed to create scenario');
            }
          } catch (error: any) {
            logger.error(`[Vision Deployer] ❌ Failed to create AOA scenario ${scenario.name}:`, error.message);
            errors.push(`Failed to create AOA scenario ${scenario.name}: ${error.message}`);
          }
        }
        
        logger.info(`[Vision Deployer] AOA scenarios deployed: ${deployedScenarios}/${systemConfig.axisScenarios.length}`);
      }

    } catch (error: any) {
      logger.error('[Vision Deployer] Deployment failed:', error);
      errors.push(`General deployment error: ${error.message}`);
    }

    // Summary
    logger.info('========================================');
    logger.info('[Vision Deployer] DEPLOYMENT COMPLETE');
    logger.info('========================================');
    logger.info('[Vision Deployer] Deployment Summary:');
    logger.info(`  Skills: ${deployedSkills}/${systemConfig.skills?.length || 0}`);
    logger.info(`  Profiles: ${deployedProfiles}/${systemConfig.securityProfiles?.length || 0}`);
    logger.info(`  AOA Scenarios: ${deployedScenarios}/${systemConfig.axisScenarios?.length || 0}`);
    logger.info(`  Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      logger.error('[Vision Deployer] Deployment Errors:', errors);
    }

    return {
      success: errors.length === 0,
      deployed: {
        scenarios: deployedScenarios,
        skills: deployedSkills,
        profiles: deployedProfiles
      },
      errors,
      details: {
        skillIds: deployedSkillIds,
        profileIds: deployedProfileIds,
        scenarioIds: deployedScenarioIds
      }
    };
  }

  /**
   * Create a skill via ACAP endpoint
   */
  private async createSkill(skill: any): Promise<string | null> {
    try {
      const url = `https://${this.cameraIp}/local/BatonAnalytic/baton_analytic.cgi?command=createSkill`;
      
      const response = await this.makeAuthenticatedRequest('POST', url, skill);
      
      if (response.status === 200 || response.status === 201) {
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        
        if (data.status === 'success' || data.skillId) {
          return data.skillId || `skill_${Date.now()}`;
        }
      }
      
      throw new Error(`Failed with status ${response.status}: ${response.data}`);
    } catch (error: any) {
      logger.error('[Vision Deployer] Error creating skill:', error.message);
      throw error;
    }
  }

  /**
   * Create a security profile via ACAP endpoint
   */
  private async createSecurityProfile(profile: any): Promise<string | null> {
    try {
      const url = `https://${this.cameraIp}/local/BatonAnalytic/baton_analytic.cgi?command=createSecurityProfile`;
      
      const response = await this.makeAuthenticatedRequest('POST', url, profile);
      
      if (response.status === 200 || response.status === 201) {
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        
        if (data.status === 'success' || data.profileId) {
          return data.profileId || `profile_${Date.now()}`;
        }
      }
      
      throw new Error(`Failed with status ${response.status}: ${response.data}`);
    } catch (error: any) {
      logger.error('[Vision Deployer] Error creating profile:', error.message);
      throw error;
    }
  }

  /**
   * Create an AOA scenario using the AOAService
   */
  private async createAOAScenario(scenario: any): Promise<number | null> {
    try {
      // Get existing scenarios to find next available ID
      const existingScenarios = await this.aoaService.getScenarios();
      const existingIds = existingScenarios.map(s => s.id);
      
      // Find next available ID (avoid conflicts)
      let nextId = 1;
      while (existingIds.includes(nextId)) {
        nextId++;
      }
      
      // Convert Vision Architect scenario format to AOA format with proper ID
      const aoaScenario = this.convertToAOAFormat(scenario);
      aoaScenario.id = nextId;
      
      logger.info(`[Vision Deployer] Creating AOA scenario "${scenario.name}" with ID ${nextId}`);
      
      // Create the scenario using AOAService
      const success = await this.aoaService.createScenario(aoaScenario);
      
      if (success) {
        // Get the created scenario ID
        const scenarios = await this.aoaService.getScenarios();
        const created = scenarios.find(s => s.name === scenario.name);
        return created?.id || nextId;
      }
      
      return null;
    } catch (error: any) {
      logger.error('[Vision Deployer] Error creating AOA scenario:', error.message);
      throw error;
    }
  }

  /**
   * Convert Vision Architect scenario format to AOA API format
   * With hardened prompt, scenarios should already be in correct format
   */
  private convertToAOAFormat(scenario: any): any {
    // Get next available scenario ID (will be overridden in createAOAScenario)
    const scenarioId = Date.now() % 1000;
    
    // Build AOA format scenario - pass through as-is since prompt is hardened
    const aoaScenario: any = {
      id: scenarioId,
      name: scenario.name || 'Scenario',
      type: scenario.type || 'motion', // Should always be valid from hardened prompt
      enabled: scenario.enabled !== false,
      devices: [{ id: 1 }],
      triggers: [],
      filters: [],
      objectClassifications: []
    };
    
    // Convert triggers
    if (scenario.triggers?.length > 0) {
      aoaScenario.triggers = scenario.triggers.map((trigger: any) => {
        const aoaTrigger: any = {
          type: trigger.type || 'includeArea',
          vertices: trigger.vertices || [[-0.9, -0.9], [-0.9, 0.9], [0.9, 0.9], [0.9, -0.9]]
        };
        
        // Add conditions if present (for time in area)
        if (trigger.conditions) {
          aoaTrigger.conditions = trigger.conditions;
        }
        
        return aoaTrigger;
      });
    } else {
      // Default trigger if none specified
      aoaScenario.triggers = [{
        type: 'includeArea',
        vertices: [[-0.9, -0.9], [-0.9, 0.9], [0.9, 0.9], [0.9, -0.9]]
      }];
    }
    
    // Convert filters
    if (scenario.filters?.length > 0) {
      aoaScenario.filters = scenario.filters;
    }
    
    // Convert object classifications
    if (scenario.objectClassifications?.length > 0) {
      aoaScenario.objectClassifications = scenario.objectClassifications.map((obj: any) => ({
        type: obj.type || 'human',
        selected: true
      }));
    } else {
      // Default to human detection
      aoaScenario.objectClassifications = [{ type: 'human', selected: true }];
    }
    
    // Copy metadata if present
    if (scenario.metadata) {
      aoaScenario.metadata = scenario.metadata;
    }
    
    return aoaScenario;
  }

  /**
   * Make an authenticated request to the camera
   */
  private async makeAuthenticatedRequest(method: string, url: string, data?: any): Promise<any> {
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });
    
    try {
      // First request to get auth challenge
      const response1 = await axios({
        method,
        url,
        data: data ? JSON.stringify(data) : undefined,
        headers: { 'Content-Type': 'application/json' },
        validateStatus: () => true,
        timeout: 30000,
        httpsAgent
      });
      
      if (response1.status === 401) {
        const wwwAuth = response1.headers['www-authenticate'];
        
        if (wwwAuth && wwwAuth.toLowerCase().includes('basic')) {
          // Use Basic auth
          const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
          
          const response2 = await axios({
            method,
            url,
            data: data ? JSON.stringify(data) : undefined,
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json'
            },
            validateStatus: () => true,
            timeout: 30000,
            httpsAgent
          });
          
          return response2;
        }
      }
      
      return response1;
    } catch (error: any) {
      logger.error('[Vision Deployer] Request error:', error.message);
      throw error;
    }
  }
}

export default VisionArchitectDeployer;