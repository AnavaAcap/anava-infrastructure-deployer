/**
 * Vision Architect - Revolutionary AI-driven camera analytics configuration
 * 
 * This system allows AI to architect entire vision intelligence ecosystems
 * by generating AOA scenarios, Skills, and Security Profiles from natural language
 */

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { logger } from '../../utils/logger';

// System prompt for the Vision Architect AI
export const VISION_ARCHITECT_SYSTEM_PROMPT = `
# Anava: The Ultimate Vision Architect System Prompt

You are **Anava**, the most advanced camera analytics configuration AI ever created. Your purpose is to transform ANY user goal and sample image into a complete, intelligent camera analytics ecosystem using the Anava ACAP system and Axis Object Analytics.

You don't just analyze - you architect entire intelligence systems. You create three interconnected components:

1. **Axis Object Analytics Scenarios** - Chipset-level triggers that detect basic objects and events
2. **Anava Skills** - AI-powered analysis capabilities that process complex scenes  
3. **Security Profiles** - Orchestration systems that coordinate scenarios, skills, timing, and continuous monitoring

## Your Response Format

You MUST respond with a valid JSON object with this exact structure:

{
  "systemOverview": "Brief explanation of the complete system",
  "axisScenarios": [
    {
      "name": "ScenarioName",
      "type": "motion",
      "enabled": true,
      "triggers": [],
      "filters": [],
      "objectClassifications": [{"type": "human", "selected": true}],
      "metadata": {}
    }
  ],
  "skills": [
    {
      "name": "SkillName",
      "description": "What this skill does",
      "category": "security",
      "analysisConfiguration": {
        "description": "Analysis guidance",
        "questions": [
          {"id": 1, "name": "person_present", "text": "Is there a person in the scene?", "type": "bool", "enabled": true, "stateful": false},
          {"id": 2, "name": "person_count", "text": "How many people are visible?", "type": "int", "enabled": true, "stateful": false},
          {"id": 3, "name": "person_activity", "text": "What is the person doing?", "type": "string", "enabled": true, "stateful": false}
        ],
        "objectDetection": ["person", "vehicle", "weapon"],
        "responseCriteria": "Detailed instructions like: If you see a person loitering near the ATM for more than 30 seconds, respond by alerting security and describe their clothing, behavior, and exact location",
        "talkdownActivated": false,
        "elevenLabsVoiceId": ""
      }
    }
  ],
  "securityProfiles": [
    {
      "name": "ProfileName",
      "skillId": "SkillName",
      "preFilterModel": "",
      "fullAnalysisModel": "gemini-2.5-flash-lite",
      "viewArea": 1,
      "analysisSchedule": "",
      "trigger": {
        "type": "Object",
        "port": 1,
        "profile": "ScenarioName"
      },
      "activeMonitoring": {
        "enabled": false,
        "intervalMs": 5000,
        "maxDurationSec": 120
      }
    }
  ],
  "systemJustification": "Why this configuration meets the user's goals"
}

## CRITICAL AOA Scenario Rules

AOA (Axis Object Analytics) ONLY supports these scenario types:
- **"motion"** - Motion detection with area triggers (USE THIS FOR PERSON/OBJECT DETECTION)
- **"fence"** - Virtual fence/perimeter protection
- **"crosslinecount"** - Line crossing counter
- **"occupancy"** - Area occupancy monitoring

NEVER use type "object" - it doesn't exist! For person or vehicle detection, use type "motion" with objectClassifications.

### Object Classification Format
When detecting specific objects, use objectClassifications array:
- For humans: [{"type": "human", "selected": true}]
- For vehicles: [{"type": "vehicle", "selected": true}]
- For both: [{"type": "human", "selected": true}, {"type": "vehicle", "selected": true}]
- For all objects: [] (empty array)

### Trigger Format
Always include proper trigger structure:
- type: "includeArea" for area-based detection
- vertices: Array of [x, y] coordinates defining the area (normalized -1 to 1)

## Critical Field Explanations

### questions Array
Questions must follow this EXACT format for each question object:
- **id**: Sequential integer starting from 1
- **name**: Snake_case identifier (e.g., "person_present", "vehicle_count", "activity_type")
- **text**: The actual question text to analyze
- **type**: Must be "bool", "int", or "string"
- **enabled**: Always true unless specifically disabled
- **stateful**: Set to true if answer should persist across frames (e.g., "has_weapon_been_seen")

Example questions for different scenarios:
```
Security: 
[
  {"id": 1, "name": "unauthorized_person", "text": "Is there an unauthorized person in the restricted area?", "type": "bool", "enabled": true, "stateful": false},
  {"id": 2, "name": "person_count", "text": "How many people are in the scene?", "type": "int", "enabled": true, "stateful": false},
  {"id": 3, "name": "suspicious_behavior", "text": "Describe any suspicious behavior", "type": "string", "enabled": true, "stateful": false}
]

Safety:
[
  {"id": 1, "name": "ppe_compliance", "text": "Are all workers wearing required PPE?", "type": "bool", "enabled": true, "stateful": false},
  {"id": 2, "name": "hazard_present", "text": "Is there a safety hazard present?", "type": "bool", "enabled": true, "stateful": true},
  {"id": 3, "name": "hazard_description", "text": "Describe the safety hazard if present", "type": "string", "enabled": true, "stateful": false}
]
```

### objectDetection Array
List of objects to detect as simple strings. Common values:
- "person", "vehicle", "car", "truck", "bike"
- "weapon", "knife", "gun"
- "package", "bag", "box"
- "animal", "dog", "cat"
- "face", "license_plate"

### responseCriteria
This is the AI's exact instructions for when and how to respond. Format it as: "If you see [specific condition], respond by [specific action] with the goal of [desired outcome] and include [specific details to report]"

Examples:
- "If you see someone attempting to climb the fence, immediately alert security with their exact location, clothing description, and direction of movement"
- "If a vehicle parks in the loading zone for more than 5 minutes, notify operations team with license plate, vehicle type, and duration"
- "If you detect weapons or suspicious objects, trigger emergency alert and describe the threat type, person's appearance, and their current actions"

### talkdownActivated
Set to TRUE when the AI should audibly interact with the scene to achieve the user's goals. Use this for:
- Deterrence: "Please step back from the restricted area"
- Customer service: "Welcome! A staff member will assist you shortly"
- Safety warnings: "Hard hat required in this area"
- Queue management: "Please proceed to counter 3"

Only set to true if verbal interaction would help achieve the stated goal.

### Model Recommendations
- **preFilterModel**: Always use "" (empty string) - this is for future functionality
- **fullAnalysisModel**: Always use "gemini-2.5-flash-lite" for best performance and cost

## Key Guidelines

1. **Always return valid JSON** - No text before or after the JSON object
2. **ALWAYS use "motion" type for person/vehicle detection** - Never use "object" type
3. **Create multiple skills** for comprehensive coverage - don't try to do everything in one skill
4. **Match trigger profiles** - The profile name in triggers should match the scenario names
5. **Use continuous monitoring** for scenarios like loitering, queue management, or safety compliance
6. **Keep scenario names short** - Maximum 15 characters
7. **Focus on the user's goal** - Every component should serve their stated objective
8. **Include "selected": true** in all objectClassifications entries
9. **Write detailed responseCriteria** - Be specific about conditions, actions, goals, and what to report
10. **Use talkdownActivated thoughtfully** - Only when verbal interaction helps achieve the goal

## Complete Skill Example

Here's a properly formatted skill for "Monitor for suspicious activity":

```
{
  "name": "SuspiciousActivity",
  "description": "Detects and analyzes suspicious behavior patterns",
  "category": "security",
  "analysisConfiguration": {
    "description": "Monitor for unauthorized access, loitering, or suspicious behavior",
    "questions": [
      {"id": 1, "name": "person_detected", "text": "Is there a person in view?", "type": "bool", "enabled": true, "stateful": false},
      {"id": 2, "name": "person_count", "text": "How many people are visible?", "type": "int", "enabled": true, "stateful": false},
      {"id": 3, "name": "loitering_detected", "text": "Is someone loitering in the area?", "type": "bool", "enabled": true, "stateful": true},
      {"id": 4, "name": "activity_description", "text": "What activity is occurring?", "type": "string", "enabled": true, "stateful": false},
      {"id": 5, "name": "threat_level", "text": "What is the threat level (0-10)?", "type": "int", "enabled": true, "stateful": false}
    ],
    "objectDetection": ["person", "vehicle", "weapon", "bag", "face"],
    "responseCriteria": "If you detect someone loitering for more than 30 seconds near restricted areas, or see suspicious behavior like attempting to hide, looking around nervously, or carrying suspicious objects, immediately alert security with the person's location, physical description, clothing, behavior details, and threat assessment. Include whether they have any bags or potential weapons.",
    "talkdownActivated": true,
    "elevenLabsVoiceId": ""
  }
}
```

## Example for "Tell me about any suspicious activity"

For a security-focused request, create:
- **AOA Scenarios**: Motion detection, loitering detection, perimeter monitoring
- **Skills**: WeaponDetection, SuspiciousLoitering, UnauthorizedAccess, AfterHoursActivity
- **Profiles**: Different profiles for business hours vs after hours, with appropriate triggers

### CORRECT Scenario Example:
For person detection, use:
- name: "PersonDetect"
- type: "motion" (NOT "object"!)
- enabled: true
- triggers: Array with includeArea type and vertices
- filters: Empty array or specific filters
- objectClassifications: [{"type": "human", "selected": true}]

WRONG: Using type "object" - this doesn't exist in AOA
RIGHT: Using type "motion" with objectClassifications for person/vehicle detection

Remember: Return ONLY the JSON object, no additional text or explanation.
`;

// JSON Schema for structured output
export const VISION_SYSTEM_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    systemOverview: {
      type: SchemaType.STRING,
      description: "Brief explanation of the complete system architecture"
    },
    axisScenarios: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          type: { 
            type: SchemaType.STRING,
            enum: ["motion", "fence", "crosslinecount", "occupancy"] // Only valid AOA types
          },
          enabled: { type: SchemaType.BOOLEAN },
          triggers: { 
            type: SchemaType.ARRAY, 
            items: { 
              type: SchemaType.OBJECT,
              properties: {
                type: { type: SchemaType.STRING },
                vertices: { type: SchemaType.ARRAY }
              }
            }
          },
          filters: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: {} } },
          objectClassifications: { 
            type: SchemaType.ARRAY, 
            items: { 
              type: SchemaType.OBJECT,
              properties: {
                type: { type: SchemaType.STRING },
                selected: { type: SchemaType.BOOLEAN }
              }
            }
          },
          metadata: { type: SchemaType.OBJECT, properties: {} }
        },
        required: ["name", "type", "enabled", "triggers", "objectClassifications"]
      }
    },
    skills: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING },
          category: { type: SchemaType.STRING },
          analysisConfiguration: {
            type: SchemaType.OBJECT,
            properties: {
              description: { type: SchemaType.STRING },
              questions: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: {} } },
              objectDetection: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              responseCriteria: { type: SchemaType.STRING },
              talkdownActivated: { type: SchemaType.BOOLEAN },
              elevenLabsVoiceId: { type: SchemaType.STRING }
            }
          }
        },
        required: ["name", "description", "category", "analysisConfiguration"]
      }
    },
    securityProfiles: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          skillId: { type: SchemaType.STRING },
          preFilterModel: { type: SchemaType.STRING }, // Should be empty string
          fullAnalysisModel: { type: SchemaType.STRING }, // Should be gemini-2.5-flash-lite
          viewArea: { type: SchemaType.NUMBER },
          analysisSchedule: { type: SchemaType.STRING },
          trigger: {
            type: SchemaType.OBJECT,
            properties: {
              type: { type: SchemaType.STRING },
              port: { type: SchemaType.NUMBER },
              profile: { type: SchemaType.STRING }
            }
          },
          activeMonitoring: {
            type: SchemaType.OBJECT,
            properties: {
              enabled: { type: SchemaType.BOOLEAN },
              intervalMs: { type: SchemaType.NUMBER },
              maxDurationSec: { type: SchemaType.NUMBER }
            }
          }
        },
        required: ["name", "skillId", "trigger", "activeMonitoring"]
      }
    },
    systemJustification: {
      type: SchemaType.STRING,
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
  private modelName: string = 'gemini-2.5-flash-lite';
  private apiKey: string;

  constructor(apiKey: string, modelName?: string) {
    this.apiKey = apiKey;
    this.gemini = new GoogleGenerativeAI(apiKey);
    // Use the specified model or default to gemini-2.5-flash-lite for best rate limits
    this.modelName = modelName || 'gemini-2.5-flash-lite';
    this.model = this.gemini.getGenerativeModel({ 
      model: this.modelName,
      generationConfig: {
        responseMimeType: "application/json",
        // responseSchema: VISION_SYSTEM_SCHEMA, // TODO: Fix schema typing
        temperature: 0.7,
        maxOutputTokens: 4000 // Increased for complete system responses
      }
    });
  }

  /**
   * Get list of available Gemini models
   */
  async listAvailableModels(): Promise<{ name: string; displayName: string; description: string }[]> {
    try {
      // Use the REST API to list models
      const axios = require('axios');
      const response = await axios.get('https://generativelanguage.googleapis.com/v1/models', {
        params: {
          key: this.apiKey
        }
      });
      
      const models = response.data.models || [];
      
      // Filter for generation models that support generateContent and are Gemini models
      const generativeModels = models
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .filter((m: any) => m.name?.includes('gemini'))
        .map((m: any) => {
          const modelName = m.name?.replace('models/', '') || '';
          let displayName = m.displayName || modelName;
          
          // Add helpful labels to display names
          if (modelName.includes('flash-lite')) {
            displayName += ' (Best for Free Tier)';
          } else if (modelName === 'gemini-1.5-flash') {
            displayName += ' (Recommended)';
          } else if (modelName.includes('2.5')) {
            displayName += ' (Latest)';
          }
          
          return {
            name: modelName,
            displayName: displayName,
            description: m.description || ''
          };
        })
        .sort((a: any, b: any) => {
          // Sort by priority for free tier usage
          const priority: { [key: string]: number } = {
            'gemini-2.0-flash-lite': 1,
            'gemini-2.0-flash-lite-001': 1,
            'gemini-1.5-flash': 2,
            'gemini-1.5-flash-8b': 3,
            'gemini-1.5-flash-8b-001': 3,
            'gemini-2.0-flash': 4,
            'gemini-2.0-flash-001': 4,
            'gemini-2.5-flash': 5,
            'gemini-1.5-flash-002': 6,
            'gemini-1.5-pro': 7,
            'gemini-1.5-pro-002': 7,
            'gemini-2.5-pro': 8
          };
          
          const aPriority = priority[a.name] || 99;
          const bPriority = priority[b.name] || 99;
          
          if (aPriority !== bPriority) {
            return aPriority - bPriority;
          }
          // If same priority, sort alphabetically
          return a.name.localeCompare(b.name);
        });

      logger.info('[Vision Architect] Available models from API:', generativeModels.map((m: any) => m.name).join(', '));
      return generativeModels;
    } catch (error: any) {
      logger.error('[Vision Architect] Failed to list models:', error);
      // Return empty array - let the UI handle showing an error
      return [];
    }
  }

  /**
   * Validate API key by attempting to list models
   */
  static async validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const axios = require('axios');
      // Try to list models as a validation check
      const response = await axios.get('https://generativelanguage.googleapis.com/v1/models', {
        params: {
          key: apiKey,
          pageSize: 1 // Just need to verify we can access the API
        }
      });
      
      if (response.data.models) {
        return { valid: true };
      }
      return { valid: true }; // API responded successfully
    } catch (error: any) {
      logger.error('[Vision Architect] API key validation failed:', error);
      
      if (error.response?.status === 400 || error.response?.status === 401 || 
          error.response?.data?.error?.message?.includes('API_KEY_INVALID') || 
          error.response?.data?.error?.message?.includes('API key not valid')) {
        return { valid: false, error: 'Invalid API key. Please check your key and try again.' };
      } else if (error.response?.status === 429 || error.message?.includes('429') || error.message?.includes('quota')) {
        return { valid: true }; // Key is valid but rate limited
      }
      return { valid: false, error: error.response?.data?.error?.message || error.message || 'Failed to validate API key' };
    }
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
      
      logger.info('[Vision Architect] === FULL PROMPTS ===');
      logger.info('[Vision Architect] System Prompt Length:', VISION_ARCHITECT_SYSTEM_PROMPT.length);
      logger.info('[Vision Architect] System Prompt (first 2000 chars):');
      logger.info(VISION_ARCHITECT_SYSTEM_PROMPT.substring(0, 2000));
      logger.info('[Vision Architect] User Prompt:');
      logger.info(userPrompt);
      logger.info('[Vision Architect] Using model:', this.modelName);
      logger.info('[Vision Architect] Has image:', !!request.imageBase64);
      
      // Prepare the content parts
      const contentParts: any[] = [
        { text: VISION_ARCHITECT_SYSTEM_PROMPT },
        { text: userPrompt }
      ];
      
      // Add the image if provided
      if (request.imageBase64) {
        logger.info('[Vision Architect] Including camera image in request');
        contentParts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: request.imageBase64.replace(/^data:image\/[a-z]+;base64,/, '')
          }
        });
      }
      
      // Retry logic for rate limits
      let result: any = null;
      let retries = 3;
      let lastError: any = null;
      
      const startTime = Date.now();
      
      while (retries > 0 && !result) {
        try {
          logger.info('[Vision Architect] Sending request to Gemini...');
          // Generate the complete system using structured output
          result = await this.model.generateContent(contentParts);
          logger.info('[Vision Architect] Received response from Gemini');
          break; // Success, exit loop
        } catch (error: any) {
          lastError = error;
          
          // Check if it's a rate limit error
          if (error.status === 429 || error.message?.includes('429') || error.message?.includes('quota')) {
            retries--;
            if (retries > 0) {
              logger.warn(`[Vision Architect] Rate limit hit, waiting 5 seconds... (${retries} retries left)`);
              await new Promise(resolve => setTimeout(resolve, 5000));
              continue;
            }
          }
          
          // For other errors, throw immediately
          throw error;
        }
      }
      
      // If we exhausted retries, throw the last error
      if (!result && lastError) {
        logger.error('[Vision Architect] Exhausted retries. Last error:', lastError);
        throw lastError;
      }

      const response = await result.response;
      const generationTime = Date.now() - startTime;
      logger.info(`[Vision Architect] AI Generation completed in ${generationTime}ms`);
      
      // Log the raw response
      const rawResponseText = response.text();
      logger.info('[Vision Architect] === RAW RESPONSE ===');
      logger.info('[Vision Architect] Response length:', rawResponseText.length, 'characters');
      
      // Log first 1000 chars of response for debugging
      if (rawResponseText.length > 0) {
        logger.info('[Vision Architect] Response preview (first 1000 chars):');
        logger.info(rawResponseText.substring(0, 1000));
        
        if (rawResponseText.length > 1000) {
          logger.info('[Vision Architect] ... (truncated, full response is', rawResponseText.length, 'chars)');
        }
      }
      
      // Parse the response
      let systemConfig: any;
      try {
        systemConfig = JSON.parse(rawResponseText);
        logger.info('[Vision Architect] Successfully parsed JSON response');
      } catch (parseError: any) {
        logger.error('[Vision Architect] Failed to parse response as JSON:', parseError);
        logger.error('[Vision Architect] Raw response that failed to parse:', rawResponseText);
        throw new Error(`Failed to parse AI response: ${parseError.message}`);
      }

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
      prompt += `[IMPORTANT: A real-time camera image is included with this request. Please analyze the actual scene visible in the image to understand the environment, objects, layout, and any specific details that should inform the vision system configuration.]\n\n`;
    }

    prompt += `Please generate a complete vision intelligence system that achieves this goal. 
    Create all necessary AOA scenarios, Skills, and Security Profiles as a comprehensive ecosystem.
    Remember to use continuous monitoring where appropriate for scenarios like loitering, queue management, or safety compliance.
    
    IMPORTANT: Return your response as valid JSON matching the required schema. Do not include any text before or after the JSON.`;

    return prompt;
  }

  /**
   * Deploy the generated system to a camera using correct ACAP endpoints
   * NO MOCK MODE - this is done professionally end-to-end
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
    details?: {
      skillIds?: string[];
      profileIds?: string[];
      scenarioIds?: number[];
    };
  }> {
    // Import the deployer
    const { VisionArchitectDeployer } = require('./visionArchitectDeployer');
    
    // Create deployer instance
    const deployer = new VisionArchitectDeployer(cameraIp, username, password);
    
    // Deploy the system using the correct endpoints
    // Professional end-to-end deployment
    const result = await deployer.deploySystem(systemConfig);
    
    return result;
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
  imageDescription?: string,
  modelName?: string
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
    logger.info('Model:', modelName || 'gemini-1.5-flash (default)');
    logger.info('API Key Length:', geminiApiKey?.length || 0);
    
    const architect = new VisionArchitect(geminiApiKey, modelName);
    
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

    // Deploy to camera (no mock mode - real deployment only)
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