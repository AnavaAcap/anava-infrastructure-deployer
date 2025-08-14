/**
 * Vision Architect - Revolutionary AI-driven camera analytics configuration
 * 
 * This system allows AI to architect entire vision intelligence ecosystems
 * by generating AOA scenarios, Skills, and Security Profiles from natural language
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../../utils/logger';
import AOAService from '../aoa/aoaService';

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
        responseMimeType: "application/json",
        responseSchema: VISION_SYSTEM_SCHEMA
      }
    });
  }

  /**
   * Generate a complete vision intelligence system from user goals
   */
  async generateVisionSystem(request: VisionSystemRequest): Promise<VisionSystemResponse> {
    try {
      logger.info('[Vision Architect] Processing user goal:', request.userGoal);

      // Build the user prompt
      const userPrompt = this.buildUserPrompt(request);
      
      // Generate the complete system using structured output
      const result = await this.model.generateContent([
        { text: VISION_ARCHITECT_SYSTEM_PROMPT },
        { text: userPrompt }
      ]);

      const response = await result.response;
      const systemConfig = JSON.parse(response.text());

      logger.info('[Vision Architect] Generated system:', {
        scenarios: systemConfig.axisScenarios?.length || 0,
        skills: systemConfig.skills?.length || 0,
        profiles: systemConfig.securityProfiles?.length || 0
      });

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
    systemConfig: any
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

    try {
      // 1. Deploy AOA Scenarios
      if (systemConfig.axisScenarios?.length > 0) {
        const aoaService = new AOAService(cameraIp, username, password);
        
        for (const scenario of systemConfig.axisScenarios) {
          try {
            await aoaService.createScenario(scenario);
            deployedScenarios++;
            logger.info(`[Vision Architect] Deployed AOA scenario: ${scenario.name}`);
          } catch (error: any) {
            errors.push(`AOA scenario '${scenario.name}': ${error.message}`);
          }
        }
      }

      // 2. Deploy Skills (via ACAP API)
      if (systemConfig.skills?.length > 0) {
        for (const skill of systemConfig.skills) {
          try {
            await this.deploySkill(cameraIp, username, password, skill);
            deployedSkills++;
            logger.info(`[Vision Architect] Deployed skill: ${skill.name}`);
          } catch (error: any) {
            errors.push(`Skill '${skill.name}': ${error.message}`);
          }
        }
      }

      // 3. Deploy Security Profiles (via ACAP API)
      if (systemConfig.securityProfiles?.length > 0) {
        for (const profile of systemConfig.securityProfiles) {
          try {
            await this.deployProfile(cameraIp, username, password, profile);
            deployedProfiles++;
            logger.info(`[Vision Architect] Deployed profile: ${profile.name}`);
          } catch (error: any) {
            errors.push(`Profile '${profile.name}': ${error.message}`);
          }
        }
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
   * Deploy a skill to the camera via ACAP API
   */
  private async deploySkill(
    cameraIp: string,
    username: string,
    password: string,
    skill: any
  ): Promise<void> {
    const axios = require('axios');
    const crypto = require('crypto');

    const url = `http://${cameraIp}/local/BatonAnalytic/baton_analytic.cgi?command=createSkill`;
    
    // Make the API call with digest auth
    const response = await this.makeDigestAuthRequest(
      url,
      username,
      password,
      skill
    );

    if (response.status !== 200) {
      throw new Error(`Failed to deploy skill: ${response.status}`);
    }
  }

  /**
   * Deploy a security profile to the camera via ACAP API
   */
  private async deployProfile(
    cameraIp: string,
    username: string,
    password: string,
    profile: any
  ): Promise<void> {
    const url = `http://${cameraIp}/local/BatonAnalytic/baton_analytic.cgi?command=createSecurityProfile`;
    
    const response = await this.makeDigestAuthRequest(
      url,
      username,
      password,
      profile
    );

    if (response.status !== 200) {
      throw new Error(`Failed to deploy profile: ${response.status}`);
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
    const crypto = require('crypto');

    // First request to get auth challenge
    const response1 = await axios.post(url, JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true
    });

    if (response1.status === 401) {
      const wwwAuth = response1.headers['www-authenticate'];
      if (wwwAuth && wwwAuth.includes('Digest')) {
        // Build digest auth header
        const authHeader = this.buildDigestAuth(
          username,
          password,
          'POST',
          new URL(url).pathname + new URL(url).search,
          wwwAuth
        );

        // Second request with auth
        return await axios.post(url, JSON.stringify(data), {
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          }
        });
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
    const architect = new VisionArchitect(geminiApiKey);
    
    // Generate the system
    const system = await architect.generateVisionSystem({
      userGoal,
      imageDescription
    });

    if (!system.success) {
      throw new Error(`Failed to generate system: ${system.error}`);
    }

    logger.info('[Vision Architect] Generated system overview:', system.systemOverview);

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