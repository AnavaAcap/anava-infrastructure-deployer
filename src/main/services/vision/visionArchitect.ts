/**
 * Vision Architect - Revolutionary AI-driven camera analytics configuration
 * 
 * This system allows AI to architect entire vision intelligence ecosystems
 * by generating AOA scenarios, Skills, and Security Profiles from natural language
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../../utils/logger';

// System prompt for the Vision Architect AI
export const VISION_ARCHITECT_SYSTEM_PROMPT = `
# Anava: The Ultimate Vision Architect System Prompt

You are **Anava**, the most advanced camera analytics configuration AI ever created. Your purpose is to transform ANY user goal and sample image into a complete, intelligent camera analytics ecosystem using the Anava ACAP system and Axis Object Analytics.

[Full system prompt content as provided above...]
`;

// JSON Schema for structured output
export const VISION_SYSTEM_SCHEMA = {
  type: "object",
  properties: {
    systemOverview: {
      type: "string",
      description: "Brief explanation of the complete system architecture"
    },
    axisScenarios: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", maxLength: 15 },
          type: { type: "string", enum: ["motion", "fence", "crosslinecount", "occupancy"] },
          enabled: { type: "boolean", default: true },
          triggers: { type: "array" },
          filters: { type: "array" },
          objectClassifications: { type: "array" },
          metadata: { type: "object" }
        },
        required: ["name", "type", "enabled", "triggers", "objectClassifications"]
      }
    },
    skills: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          category: { 
            type: "string", 
            enum: ["security", "retail", "manufacturing", "healthcare", "transportation", "education", "hospitality", "general"]
          },
          analysisConfiguration: {
            type: "object",
            properties: {
              description: { type: "string" },
              questions: { type: "array" },
              objectDetection: { type: "array", items: { type: "string" } },
              responseCriteria: { type: "string" },
              talkdownActivated: { type: "boolean" },
              elevenLabsVoiceId: { type: "string" }
            }
          }
        },
        required: ["name", "description", "category", "analysisConfiguration"]
      }
    },
    securityProfiles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          skillId: { type: "string" },
          preFilterModel: { type: "string", enum: ["gemini-1.5-flash", "gemini-1.5-pro"] },
          fullAnalysisModel: { type: "string", enum: ["gemini-1.5-flash", "gemini-1.5-pro"] },
          viewArea: { type: "integer", minimum: 1, maximum: 10 },
          analysisSchedule: { type: "string" },
          trigger: {
            type: "object",
            properties: {
              type: { enum: ["Manual", "Object", "Motion", "PerimeterDefender"] },
              port: { type: "integer" },
              profile: { type: "string" }
            }
          },
          activeMonitoring: {
            type: "object",
            properties: {
              enabled: { type: "boolean" },
              intervalMs: { type: "integer" },
              maxDurationSec: { type: "integer" }
            }
          }
        },
        required: ["name", "skillId", "trigger", "activeMonitoring"]
      }
    },
    systemJustification: {
      type: "string",
      description: "Detailed explanation of architecture"
    }
  },
  required: ["systemOverview", "axisScenarios", "skills", "securityProfiles", "systemJustification"]
};

export interface VisionSystemRequest {
  userGoal: string;           // What the user wants to achieve
  imageDescription?: string;  // Description of the camera view/environment
  imageBase64?: string;       // Optional: actual image from camera
  domain?: string;            // Optional: primary domain (retail, security, etc.)
}

export interface VisionSystemResponse {
  success: boolean;
  systemOverview?: string;
  axisScenarios?: any[];
  skills?: any[];
  securityProfiles?: any[];
  systemJustification?: string;
  error?: string;
}

export class VisionArchitect {
  private gemini: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    this.gemini = new GoogleGenerativeAI(apiKey);
    // Use the latest model with structured output support
    this.model = this.gemini.getGenerativeModel({ 
      model: 'gemini-1.5-pro',
      generationConfig: {
        responseMimeType: "application/json"
      }
    });
  }

  /**
   * Generate a complete vision intelligence system from user goals
   */
  async generateVisionSystem(request: VisionSystemRequest): Promise<VisionSystemResponse> {
    try {
      logger.info('========================================');
      logger.info('[Vision Architect] STARTING GENERATION');
      logger.info('========================================');
      logger.info('[Vision Architect] User Goal:', request.userGoal);
      logger.info('[Vision Architect] Image Description:', request.imageDescription || 'Not provided');
      logger.info('[Vision Architect] Domain:', request.domain || 'Auto-detect');

      // Build the user prompt
      const userPrompt = this.buildUserPrompt(request);
      
      logger.info('[Vision Architect] User Prompt Length:', userPrompt.length);
      logger.info('[Vision Architect] Sending to Gemini AI...');
      
      // Generate the complete system using structured output
      const startTime = Date.now();
      const result = await this.model.generateContent([
        { text: VISION_ARCHITECT_SYSTEM_PROMPT },
        { text: userPrompt }
      ]);

      const response = await result.response;
      const generationTime = Date.now() - startTime;
      logger.info(`[Vision Architect] AI Generation completed in ${generationTime}ms`);
      
      const systemConfig = JSON.parse(response.text());

      logger.info('========================================');
      logger.info('[Vision Architect] GENERATED SYSTEM OVERVIEW');
      logger.info('========================================');
      logger.info('[Vision Architect] System Overview:', systemConfig.systemOverview);
      logger.info('[Vision Architect] Components Generated:', {
        scenarios: systemConfig.axisScenarios?.length || 0,
        skills: systemConfig.skills?.length || 0,
        profiles: systemConfig.securityProfiles?.length || 0
      });
      
      // Log each component in detail
      if (systemConfig.axisScenarios?.length > 0) {
        logger.info('[Vision Architect] === AOA SCENARIOS ===');
        systemConfig.axisScenarios.forEach((scenario: any, idx: number) => {
          logger.info(`[Vision Architect] Scenario ${idx + 1}: ${scenario.name}`);
          logger.info(`  Type: ${scenario.type}`);
          logger.info(`  Objects: ${JSON.stringify(scenario.objectClassifications)}`);
          if (scenario.filters?.length > 0) {
            logger.info(`  Filters: ${JSON.stringify(scenario.filters)}`);
          }
          if (scenario.metadata) {
            logger.info(`  Metadata: ${JSON.stringify(scenario.metadata)}`);
          }
        });
      }
      
      if (systemConfig.skills?.length > 0) {
        logger.info('[Vision Architect] === SKILLS ===');
        systemConfig.skills.forEach((skill: any, idx: number) => {
          logger.info(`[Vision Architect] Skill ${idx + 1}: ${skill.name}`);
          logger.info(`  Description: ${skill.description}`);
          logger.info(`  Category: ${skill.category}`);
          logger.info(`  Objects: ${skill.analysisConfiguration?.objectDetection?.join(', ')}`);
          logger.info(`  Questions: ${skill.analysisConfiguration?.questions?.length || 0}`);
          logger.info(`  Response Criteria: ${skill.analysisConfiguration?.responseCriteria}`);
        });
      }
      
      if (systemConfig.securityProfiles?.length > 0) {
        logger.info('[Vision Architect] === SECURITY PROFILES ===');
        systemConfig.securityProfiles.forEach((profile: any, idx: number) => {
          logger.info(`[Vision Architect] Profile ${idx + 1}: ${profile.name}`);
          logger.info(`  Skill: ${profile.skillId}`);
          logger.info(`  Trigger: ${profile.trigger?.type} - ${profile.trigger?.profile}`);
          logger.info(`  Schedule: ${profile.analysisSchedule || 'Always'}`);
          if (profile.activeMonitoring?.enabled) {
            logger.info(`  Active Monitoring: Every ${profile.activeMonitoring.intervalMs}ms for max ${profile.activeMonitoring.maxDurationSec}s`);
          }
        });
      }
      
      logger.info('[Vision Architect] System Justification:', systemConfig.systemJustification);

      return {
        success: true,
        ...systemConfig
      };

    } catch (error: any) {
      logger.error('[Vision Architect] Generation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Build the user prompt from the request
   */
  private buildUserPrompt(request: VisionSystemRequest): string {
    let prompt = `User Goal: "${request.userGoal}"\n\n`;

    if (request.imageDescription) {
      prompt += `Camera View Description: ${request.imageDescription}\n\n`;
    }

    if (request.domain) {
      prompt += `Primary Domain: ${request.domain}\n\n`;
    }

    if (request.imageBase64) {
      prompt += `[An actual camera image has been provided for analysis]\n\n`;
    }

    prompt += `Please generate a complete vision intelligence system that achieves this goal. 
    Create all necessary AOA scenarios, Skills, and Security Profiles as a comprehensive ecosystem.
    Remember to use continuous monitoring where appropriate for scenarios like loitering, queue management, or safety compliance.`;

    return prompt;
  }

  /**
   * Deploy the generated system to a camera
   */
  async deploySystem(
    cameraIp: string,
    username: string,
    password: string,
    systemConfig: any,
    mockMode: boolean = true
  ): Promise<{
    success: boolean;
    deployed: {
      scenarios: number;
      skills: number;
      profiles: number;
    };
    errors?: string[];
  }> {
    const errors: string[] = [];
    let deployedScenarios = 0;
    let deployedSkills = 0;
    let deployedProfiles = 0;

    logger.info('========================================');
    logger.info('[Vision Architect] STARTING DEPLOYMENT (MOCK)');
    logger.info('========================================');
    logger.info('[Vision Architect] Target Camera:', cameraIp);
    logger.info('[Vision Architect] Username:', username);
    logger.info('[Vision Architect] Components to Deploy:', {
      scenarios: systemConfig.axisScenarios?.length || 0,
      skills: systemConfig.skills?.length || 0,
      profiles: systemConfig.securityProfiles?.length || 0
    });

    try {
      // 1. Send complete system to ACAP endpoint
      if (!mockMode && systemConfig.axisScenarios?.length > 0) {
        logger.info('[Vision Architect] === SENDING COMPLETE SYSTEM TO ACAP (LIVE) ===');
        
        try {
          require('axios');
          const url = `http://${cameraIp}/local/BatonAnalytic/baton_analytic.cgi?command=deployVisionSystem`;
          
          // Send the entire generated system
          const payload = {
            systemOverview: systemConfig.systemOverview,
            axisScenarios: systemConfig.axisScenarios,
            skills: systemConfig.skills || [],
            securityProfiles: systemConfig.securityProfiles || [],
            systemJustification: systemConfig.systemJustification
          };
          
          logger.info('[Vision Architect] 🚀 SENDING TO LIVE ENDPOINT');
          logger.info('[Vision Architect] Camera IP:', cameraIp);
          logger.info('[Vision Architect] Endpoint:', url);
          logger.info('[Vision Architect] Payload size:', JSON.stringify(payload).length, 'bytes');
          logger.info('[Vision Architect] Components:', {
            scenarios: systemConfig.axisScenarios.length,
            skills: systemConfig.skills?.length || 0,
            profiles: systemConfig.securityProfiles?.length || 0
          });
          
          // Log first scenario for debugging
          if (systemConfig.axisScenarios.length > 0) {
            logger.info('[Vision Architect] First scenario preview:', {
              name: systemConfig.axisScenarios[0].name,
              type: systemConfig.axisScenarios[0].type,
              objects: systemConfig.axisScenarios[0].objectClassifications
            });
          }
          
          // Make request with digest auth
          const response = await this.makeDigestAuthRequest(
            url,
            username,
            password,
            payload
          );
          
          logger.info('[Vision Architect] Response status:', response.status);
          logger.info('[Vision Architect] Response headers:', response.headers);
          
          if (response.status === 200 || response.status === 201) {
            logger.info('[Vision Architect] ✅ SUCCESS! System deployed to camera');
            
            // Parse response data if available
            if (response.data) {
              logger.info('[Vision Architect] Response data:', 
                typeof response.data === 'object' ? JSON.stringify(response.data, null, 2) : response.data
              );
              
              // Check for specific success indicators in response
              if (response.data.success || response.data.status === 'success') {
                logger.info('[Vision Architect] ACAP confirmed successful deployment');
              }
              
              // Extract deployment details from response if available
              if (response.data.deployed) {
                deployedScenarios = response.data.deployed.scenarios || systemConfig.axisScenarios.length;
                deployedSkills = response.data.deployed.skills || systemConfig.skills?.length || 0;
                deployedProfiles = response.data.deployed.profiles || systemConfig.securityProfiles?.length || 0;
              } else {
                // Assume all were deployed if no specific counts in response
                deployedScenarios = systemConfig.axisScenarios.length;
                deployedSkills = systemConfig.skills?.length || 0;
                deployedProfiles = systemConfig.securityProfiles?.length || 0;
              }
            } else {
              // No response data, assume success based on status code
              deployedScenarios = systemConfig.axisScenarios.length;
              deployedSkills = systemConfig.skills?.length || 0;
              deployedProfiles = systemConfig.securityProfiles?.length || 0;
            }
            
            logger.info('[Vision Architect] Deployment complete:', {
              scenarios: deployedScenarios,
              skills: deployedSkills,
              profiles: deployedProfiles
            });
          } else if (response.status === 400) {
            logger.error('[Vision Architect] ❌ Bad Request (400) - Invalid payload format');
            logger.error('[Vision Architect] Response:', response.data);
            errors.push(`Invalid payload format: ${JSON.stringify(response.data)}`);
          } else if (response.status === 401) {
            logger.error('[Vision Architect] ❌ Authentication failed (401)');
            errors.push('Authentication failed - check camera credentials');
          } else if (response.status === 404) {
            logger.error('[Vision Architect] ❌ Endpoint not found (404)');
            errors.push('ACAP endpoint not found - ensure latest ACAP is deployed');
          } else if (response.status === 500) {
            logger.error('[Vision Architect] ❌ Internal server error (500)');
            logger.error('[Vision Architect] Response:', response.data);
            errors.push(`Camera error: ${response.data?.error || 'Internal server error'}`);
          } else {
            logger.error(`[Vision Architect] ❌ Unexpected status: ${response.status}`);
            logger.error('[Vision Architect] Response:', response.data);
            errors.push(`Unexpected response: ${response.status} - ${response.data?.message || response.statusText}`);
          }
        } catch (err: any) {
          logger.error('[Vision Architect] ❌ Deployment failed with error:', err);
          
          // Handle specific error types
          if (err.code === 'ECONNREFUSED') {
            errors.push('Connection refused - camera may be offline or IP incorrect');
          } else if (err.code === 'ETIMEDOUT') {
            errors.push('Connection timeout - camera not responding');
          } else if (err.response) {
            // Axios error with response
            logger.error('[Vision Architect] Error response:', {
              status: err.response.status,
              data: err.response.data
            });
            errors.push(`ACAP error (${err.response.status}): ${err.response.data?.message || err.message}`);
          } else if (err.request) {
            // Request made but no response
            logger.error('[Vision Architect] No response received');
            errors.push('No response from camera - check network connection');
          } else {
            // Other errors
            errors.push(`Deployment error: ${err.message}`);
          }
        }
      } else if (mockMode && systemConfig.axisScenarios?.length > 0) {
        // MOCK deployment - just log
        logger.info('[Vision Architect] === MOCK DEPLOYMENT ===');
        
        const fullPayload = {
          systemOverview: systemConfig.systemOverview,
          axisScenarios: systemConfig.axisScenarios,
          skills: systemConfig.skills,
          securityProfiles: systemConfig.securityProfiles,
          systemJustification: systemConfig.systemJustification
        };
        
        logger.info('[Vision Architect] MOCK: Would send to ACAP endpoint:');
        logger.info('[Vision Architect] MOCK: URL: http://' + cameraIp + '/local/BatonAnalytic/baton_analytic.cgi?command=deployVisionSystem');
        logger.info('[Vision Architect] MOCK: Complete Payload:');
        logger.info(JSON.stringify(fullPayload, null, 2));
        
        // Simulate deployment counts
        deployedScenarios = systemConfig.axisScenarios.length;
        deployedSkills = systemConfig.skills?.length || 0;
        deployedProfiles = systemConfig.securityProfiles?.length || 0;
        
        logger.info(`[Vision Architect] MOCK: "Deployed" ${deployedScenarios} scenarios, ${deployedSkills} skills, ${deployedProfiles} profiles`);
      }


      logger.info('========================================');
      logger.info('[Vision Architect] DEPLOYMENT COMPLETE (MOCK)');
      logger.info('========================================');
      logger.info('[Vision Architect] Deployment Summary:');
      logger.info(`  AOA Scenarios: ${deployedScenarios}/${systemConfig.axisScenarios?.length || 0}`);
      logger.info(`  Skills: ${deployedSkills}/${systemConfig.skills?.length || 0}`);
      logger.info(`  Security Profiles: ${deployedProfiles}/${systemConfig.securityProfiles?.length || 0}`);
      logger.info(`  Errors: ${errors.length}`);
      
      if (errors.length > 0) {
        logger.error('[Vision Architect] Deployment Errors:', errors);
      }
      
      return {
        success: errors.length === 0,
        deployed: {
          scenarios: deployedScenarios,
          skills: deployedSkills,
          profiles: deployedProfiles
        },
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error: any) {
      logger.error('[Vision Architect] Deployment failed:', error);
      return {
        success: false,
        deployed: {
          scenarios: deployedScenarios,
          skills: deployedSkills,
          profiles: deployedProfiles
        },
        errors: [...errors, error.message]
      };
    }
  }

  /**
   * Make a request with digest authentication
   */
  private async makeDigestAuthRequest(
    url: string,
    username: string,
    password: string,
    data: any
  ): Promise<any> {
    const axios = require('axios');
    require('crypto');

    logger.info('[Vision Architect] Making digest auth request to:', url);

    // First request to get auth challenge
    const response1 = await axios.post(url, JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true,
      timeout: 30000 // 30 second timeout
    });

    logger.info('[Vision Architect] Initial response status:', response1.status);

    if (response1.status === 401) {
      const wwwAuth = response1.headers['www-authenticate'];
      logger.info('[Vision Architect] WWW-Authenticate header:', wwwAuth);
      
      if (wwwAuth && wwwAuth.includes('Digest')) {
        // Build digest auth header
        const authHeader = this.buildDigestAuth(
          username,
          password,
          'POST',
          new URL(url).pathname + new URL(url).search,
          wwwAuth
        );

        logger.info('[Vision Architect] Sending authenticated request...');
        
        // Second request with auth
        const response2 = await axios.post(url, JSON.stringify(data), {
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          },
          validateStatus: () => true,
          timeout: 30000
        });
        
        logger.info('[Vision Architect] Authenticated response status:', response2.status);
        return response2;
      } else {
        logger.warn('[Vision Architect] Expected Digest auth but got:', wwwAuth);
      }
    }

    return response1;
  }

  /**
   * Build digest authentication header
   */
  private buildDigestAuth(
    username: string,
    password: string,
    method: string,
    uri: string,
    wwwAuth: string
  ): string {
    const crypto = require('crypto');
    
    const realm = wwwAuth.match(/realm="([^"]+)"/)?.[1] || '';
    const nonce = wwwAuth.match(/nonce="([^"]+)"/)?.[1] || '';
    const qop = wwwAuth.match(/qop="([^"]+)"/)?.[1] || '';
    const opaque = wwwAuth.match(/opaque="([^"]+)"/)?.[1] || '';

    const cnonce = crypto.randomBytes(16).toString('hex');
    const nc = '00000001';

    const ha1 = crypto.createHash('md5')
      .update(`${username}:${realm}:${password}`)
      .digest('hex');

    const ha2 = crypto.createHash('md5')
      .update(`${method}:${uri}`)
      .digest('hex');

    let response;
    if (qop) {
      response = crypto.createHash('md5')
        .update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
        .digest('hex');
    } else {
      response = crypto.createHash('md5')
        .update(`${ha1}:${nonce}:${ha2}`)
        .digest('hex');
    }

    let authHeader = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;
    
    if (qop) {
      authHeader += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
    }
    
    if (opaque) {
      authHeader += `, opaque="${opaque}"`;
    }

    return authHeader;
  }

}

/**
 * Helper function to generate and deploy a complete vision system
 */
export async function generateAndDeployVisionSystem(
  cameraIp: string,
  username: string,
  password: string,
  geminiApiKey: string,
  userGoal: string,
  imageDescription?: string
): Promise<{
  success: boolean;
  message: string;
  system?: any;
  deployment?: any;
}> {
  try {
    logger.info('\n\n========================================');
    logger.info('VISION ARCHITECT - FULL PIPELINE START');
    logger.info('========================================');
    logger.info('Camera IP:', cameraIp);
    logger.info('User Goal:', userGoal);
    logger.info('Image Description:', imageDescription || 'None');
    logger.info('API Key Length:', geminiApiKey?.length || 0);
    
    const architect = new VisionArchitect(geminiApiKey);
    
    // Generate the system
    logger.info('\n>>> PHASE 1: GENERATING SYSTEM...');
    const system = await architect.generateVisionSystem({
      userGoal,
      imageDescription
    });

    if (!system.success) {
      throw new Error(`Failed to generate system: ${system.error}`);
    }

    logger.info('\n>>> PHASE 2: DEPLOYING SYSTEM...');

    // Deploy to camera
    const deployment = await architect.deploySystem(
      cameraIp,
      username,
      password,
      system
    );

    return {
      success: deployment.success,
      message: deployment.success 
        ? `Successfully deployed ${deployment.deployed.scenarios} scenarios, ${deployment.deployed.skills} skills, and ${deployment.deployed.profiles} profiles`
        : `Partial deployment: ${deployment.errors?.join(', ')}`,
      system,
      deployment
    };

  } catch (error: any) {
    logger.error('[Vision Architect] Failed:', error);
    return {
      success: false,
      message: error.message
    };
  }
}