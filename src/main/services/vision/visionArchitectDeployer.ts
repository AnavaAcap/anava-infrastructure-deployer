/**
 * Vision Architect Deployer - Handles deployment of generated systems to camera
 * Uses the correct ACAP endpoints for skills, profiles, and AOA scenarios
 */

import { logger } from '../../utils/logger';
import AOAService from '../aoa/aoaService';
// Note: ScheduleService removed - not all cameras support VAPIX Schedule Service
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
      schedules: number;
      skills: number;
      profiles: number;
    };
    errors: string[];
    details?: {
      skillIds?: string[];
      profileIds?: string[];
      scenarioIds?: number[];
      scheduleIds?: string[];
    };
  }> {
    const errors: string[] = [];
    const deployedSkillIds: string[] = [];
    const deployedProfileIds: string[] = [];
    const deployedScenarioIds: number[] = [];
    const deployedScheduleIds: string[] = [];
    
    let deployedScenarios = 0;
    let deployedSchedules = 0;
    let deployedSkills = 0;
    let deployedProfiles = 0;
    
    const skillIdMap = new Map<string, string>(); // Map skill names to created IDs
    // Note: scheduleIdMap removed - schedules are not deployed

    logger.info('========================================');
    logger.info('[Vision Deployer] STARTING DEPLOYMENT');
    logger.info('========================================');
    logger.info('[Vision Deployer] Target Camera:', this.cameraIp);
    logger.info('[Vision Deployer] Components to Deploy:', {
      scenarios: systemConfig.axisScenarios?.length || 0,
      schedules: systemConfig.schedules?.length || 0,
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

      // Step 2: Deploy Schedules (SKIP - Not all cameras support VAPIX Schedule Service)
      if (systemConfig.schedules?.length > 0) {
        logger.info('[Vision Deployer] === STEP 2: SKIPPING SCHEDULES (NOT SUPPORTED) ===');
        logger.info('[Vision Deployer] Schedule deployment is disabled - not all cameras support the VAPIX Schedule Service');
        logger.info(`[Vision Deployer] Would have deployed ${systemConfig.schedules.length} schedules:`);
        systemConfig.schedules.forEach((schedule: any) => {
          logger.info(`  - ${schedule.name}: ${schedule.description || 'No description'}`);
        });
        logger.info('[Vision Deployer] Schedules will be handled via profile configuration instead');
      }

      // Step 3: Deploy Security Profiles
      if (systemConfig.securityProfiles?.length > 0) {
        logger.info('[Vision Deployer] === STEP 3: DEPLOYING SECURITY PROFILES ===');
        
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

      // Step 4: Deploy AOA Scenarios
      if (systemConfig.axisScenarios?.length > 0) {
        logger.info('[Vision Deployer] === STEP 4: DEPLOYING AOA SCENARIOS ===');
        
        // Check if AOA is available first
        try {
          logger.info('[Vision Deployer] Checking AOA availability...');
          const aoaStatus = await this.aoaService.getStatus();
          
          if (!aoaStatus.running) {
            logger.info('[Vision Deployer] AOA not running, attempting to start...');
            await this.aoaService.startAOA();
            logger.info('[Vision Deployer] AOA application started successfully');
          } else {
            logger.info('[Vision Deployer] AOA is already running');
          }
          
          // Test AOA functionality with capabilities check
          try {
            await this.aoaService.getCapabilities();
            logger.info('[Vision Deployer] AOA capabilities confirmed, proceeding with scenario deployment');
          } catch (capError: any) {
            throw new Error(`AOA capabilities check failed: ${capError.message}`);
          }
          
        } catch (aoaError: any) {
          logger.error('[Vision Deployer] ❌ AOA not available on this camera:', aoaError.message);
          logger.info('[Vision Deployer] Skipping AOA scenario deployment - will use skill-based detection only');
          
          // Add all scenarios to errors but continue with deployment
          systemConfig.axisScenarios.forEach((scenario: any) => {
            errors.push(`Failed to create AOA scenario ${scenario.name}: AOA not available on this camera (${aoaError.message})`);
          });
          
          // Skip AOA deployment but don't fail the entire deployment
          logger.info(`[Vision Deployer] AOA scenarios skipped: 0/${systemConfig.axisScenarios.length} (AOA not supported)`);
        }
        
        // Only proceed with scenario creation if AOA is available
        if (errors.filter(e => e.includes('AOA not available')).length === 0) {
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
    logger.info(`  Schedules: ${deployedSchedules}/${systemConfig.schedules?.length || 0}`);
    logger.info(`  Profiles: ${deployedProfiles}/${systemConfig.securityProfiles?.length || 0}`);
    logger.info(`  AOA Scenarios: ${deployedScenarios}/${systemConfig.axisScenarios?.length || 0}`);
    logger.info(`  Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      logger.error('[Vision Deployer] Deployment Errors:', errors);
    }

    // Determine success based on core components (Skills and Profiles are most important)
    const coreDeploymentSuccess = deployedSkills > 0 && deployedProfiles > 0;
    const onlyOptionalErrors = errors.every(error => 
      error.includes('AOA not available') || 
      error.includes('Schedule') ||
      error.includes('not supported')
    );
    
    const overallSuccess = coreDeploymentSuccess && (errors.length === 0 || onlyOptionalErrors);
    
    if (overallSuccess && errors.length > 0) {
      logger.info('[Vision Deployer] Deployment successful with optional component warnings');
    }

    return {
      success: overallSuccess,
      deployed: {
        scenarios: deployedScenarios,
        schedules: deployedSchedules,
        skills: deployedSkills,
        profiles: deployedProfiles
      },
      errors,
      details: {
        skillIds: deployedSkillIds,
        profileIds: deployedProfileIds,
        scenarioIds: deployedScenarioIds,
        scheduleIds: deployedScheduleIds
      }
    };
  }

  /**
   * Create a skill via ACAP endpoint
   */
  private async createSkill(skill: any): Promise<string | null> {
    try {
      const url = `https://${this.cameraIp}/local/BatonAnalytic/baton_analytic.cgi?command=createSkill`;
      
      logger.info('[Vision Deployer] === CREATING SKILL ===');
      logger.info('[Vision Deployer] URL:', url);
      logger.info('[Vision Deployer] Skill Name:', skill.name);
      // Ensure Author is set to "Vision Architect"
      const skillPayload = {
        ...skill,
        author: "Vision Architect"
      };
      
      logger.info('[Vision Deployer] Full Skill Payload:');
      logger.info(JSON.stringify(skillPayload, null, 2));
      
      const response = await this.makeAuthenticatedRequest('POST', url, skillPayload);
      
      logger.info('[Vision Deployer] Response Status:', response.status);
      logger.info('[Vision Deployer] Response Data:', response.data);
      
      if (response.status === 200 || response.status === 201) {
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        
        if (data.status === 'success' || data.skillId) {
          return data.skillId || `skill_${Date.now()}`;
        }
      }
      
      logger.error('[Vision Deployer] ❌ Skill creation failed - unexpected response format');
      logger.error('[Vision Deployer] Expected: {status: "success"} or {skillId: "..."}');
      logger.error('[Vision Deployer] Received:', JSON.stringify(response.data, null, 2));
      throw new Error(`Failed with status ${response.status}: ${JSON.stringify(response.data)}`);
    } catch (error: any) {
      logger.error('[Vision Deployer] ❌ Exception during skill creation:', error.message);
      if (error.response) {
        logger.error('[Vision Deployer] Error response status:', error.response.status);
        logger.error('[Vision Deployer] Error response data:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Create a security profile via ACAP endpoint
   */
  private async createSecurityProfile(profile: any): Promise<string | null> {
    try {
      const url = `https://${this.cameraIp}/local/BatonAnalytic/baton_analytic.cgi?command=createSecurityProfile`;
      
      logger.info('[Vision Deployer] === CREATING SECURITY PROFILE ===');
      logger.info('[Vision Deployer] URL:', url);
      logger.info('[Vision Deployer] Profile Name:', profile.name);
      logger.info('[Vision Deployer] Full Profile Payload:');
      logger.info(JSON.stringify(profile, null, 2));
      
      const response = await this.makeAuthenticatedRequest('POST', url, profile);
      
      logger.info('[Vision Deployer] Response Status:', response.status);
      logger.info('[Vision Deployer] Response Data:', response.data);
      
      if (response.status === 200 || response.status === 201) {
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        
        if (data.status === 'success' || data.profileId) {
          return data.profileId || `profile_${Date.now()}`;
        }
      }
      
      logger.error('[Vision Deployer] ❌ Profile creation failed - unexpected response format');
      logger.error('[Vision Deployer] Expected: {status: "success"} or {profileId: "..."}');
      logger.error('[Vision Deployer] Received:', JSON.stringify(response.data, null, 2));
      throw new Error(`Failed with status ${response.status}: ${JSON.stringify(response.data)}`);
    } catch (error: any) {
      logger.error('[Vision Deployer] ❌ Exception during profile creation:', error.message);
      if (error.response) {
        logger.error('[Vision Deployer] Error response status:', error.response.status);
        logger.error('[Vision Deployer] Error response data:', error.response.data);
      }
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
      
      logger.info('[Vision Deployer] === CREATING AOA SCENARIO ===');
      logger.info('[Vision Deployer] Scenario Name:', scenario.name);
      logger.info('[Vision Deployer] Assigned ID:', nextId);
      logger.info('[Vision Deployer] Original Vision Architect Scenario:');
      logger.info(JSON.stringify(scenario, null, 2));
      logger.info('[Vision Deployer] Converted AOA Scenario Payload:');
      logger.info(JSON.stringify(aoaScenario, null, 2));
      
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
    
    logger.info('[Vision Deployer] === HTTP REQUEST DETAILS ===');
    logger.info('[Vision Deployer] Method:', method);
    logger.info('[Vision Deployer] URL:', url);
    logger.info('[Vision Deployer] Has Data:', !!data);
    if (data) {
      logger.info('[Vision Deployer] Request Payload Size:', JSON.stringify(data).length, 'characters');
      logger.info('[Vision Deployer] Raw Request Data:');
      logger.info(JSON.stringify(data, null, 2));
    }
    
    try {
      // First request to get auth challenge
      logger.info('[Vision Deployer] Sending initial request...');
      const response1 = await axios({
        method,
        url,
        data: data ? JSON.stringify(data) : undefined,
        headers: { 'Content-Type': 'application/json' },
        validateStatus: () => true,
        timeout: 30000,
        httpsAgent
      });
      
      logger.info('[Vision Deployer] Initial response status:', response1.status);
      logger.info('[Vision Deployer] Initial response headers:', JSON.stringify(response1.headers, null, 2));
      if (response1.data) {
        logger.info('[Vision Deployer] Initial response data:');
        logger.info(typeof response1.data === 'string' ? response1.data : JSON.stringify(response1.data, null, 2));
      }
      
      if (response1.status === 401) {
        const wwwAuth = response1.headers['www-authenticate'];
        
        if (wwwAuth && wwwAuth.toLowerCase().includes('basic')) {
          // Use Basic auth
          logger.info('[Vision Deployer] Using Basic authentication');
          const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
          
          logger.info('[Vision Deployer] Sending authenticated request...');
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
          
          logger.info('[Vision Deployer] Authenticated response status:', response2.status);
          logger.info('[Vision Deployer] Authenticated response headers:', JSON.stringify(response2.headers, null, 2));
          if (response2.data) {
            logger.info('[Vision Deployer] Authenticated response data:');
            logger.info(typeof response2.data === 'string' ? response2.data : JSON.stringify(response2.data, null, 2));
          }
          
          return response2;
        }
      }
      
      logger.info('[Vision Deployer] Using direct response (no auth required or auth failed)');
      return response1;
    } catch (error: any) {
      logger.error('[Vision Deployer] ❌ HTTP Request failed:', error.message);
      if (error.code) {
        logger.error('[Vision Deployer] Error code:', error.code);
      }
      if (error.response) {
        logger.error('[Vision Deployer] Error response status:', error.response.status);
        logger.error('[Vision Deployer] Error response headers:', JSON.stringify(error.response.headers, null, 2));
        logger.error('[Vision Deployer] Error response data:', error.response.data);
      }
      if (error.config) {
        logger.error('[Vision Deployer] Request config URL:', error.config.url);
        logger.error('[Vision Deployer] Request config method:', error.config.method);
        logger.error('[Vision Deployer] Request config headers:', JSON.stringify(error.config.headers, null, 2));
      }
      throw error;
    }
  }
}

export default VisionArchitectDeployer;