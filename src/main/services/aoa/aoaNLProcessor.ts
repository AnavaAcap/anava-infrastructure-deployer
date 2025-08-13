/**
 * Natural Language to AOA Scenario Processor
 * Uses Gemini AI to convert natural language descriptions into AOA configurations
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../../utils/logger';
import { AOAService } from './aoaService';

export interface NLScenarioRequest {
  description: string;
  cameraContext?: string; // e.g., "parking lot", "entrance", "hallway"
  strictness?: 'low' | 'medium' | 'high'; // How closely to match the description
}

export interface NLScenarioResponse {
  success: boolean;
  scenario?: {
    name: string;
    type: 'motion' | 'fence' | 'crosslinecount' | 'occupancy';
    area: Array<[number, number]>;
    objectTypes: {
      humans?: boolean;
      vehicles?: boolean;
      vehicleSubTypes?: string[];
    };
    filters?: {
      timeInArea?: number;
      minimumSize?: { width: number; height: number };
      maximumSize?: { width: number; height: number };
      swayingObjectDistance?: number;
      shortLivedLimit?: number;
    };
    crosslineDirection?: 'left-right' | 'right-left' | 'both';
    occupancyThreshold?: number;
  };
  explanation?: string;
  confidence?: number;
  error?: string;
}

export class AOANaturalLanguageProcessor {
  private gemini: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    this.gemini = new GoogleGenerativeAI(apiKey);
    this.model = this.gemini.getGenerativeModel({ model: 'gemini-pro' });
  }

  /**
   * Convert natural language description to AOA scenario configuration
   */
  async processNaturalLanguage(request: NLScenarioRequest): Promise<NLScenarioResponse> {
    try {
      logger.info('[AOA NL] Processing description:', request.description);

      const prompt = this.buildPrompt(request);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse the JSON response from Gemini
      const scenarioConfig = this.parseGeminiResponse(text);
      
      if (!scenarioConfig) {
        throw new Error('Failed to parse Gemini response');
      }

      // Add reasonable defaults and validate
      const finalScenario = this.validateAndEnhanceScenario(scenarioConfig, request);

      return {
        success: true,
        scenario: finalScenario,
        explanation: scenarioConfig.explanation,
        confidence: scenarioConfig.confidence
      };

    } catch (error: any) {
      logger.error('[AOA NL] Error processing natural language:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Build the prompt for Gemini
   */
  private buildPrompt(request: NLScenarioRequest): string {
    const aoaCapabilities = `
    Axis Object Analytics (AOA) Capabilities:
    
    OBJECT TYPES:
    - Humans (people, persons)
    - Vehicles with subtypes: car, bus, truck, motorcycle/bicycle
    
    SCENARIO TYPES:
    - motion: Detect objects moving in an area
    - fence: Detect crossing a virtual fence line
    - crosslinecount: Count objects crossing a line with direction
    - occupancy: Monitor area occupancy levels
    
    FILTERS (all optional):
    - timeInArea: Trigger only if object stays in area for X seconds (loitering, dwelling)
    - minimumSize: Ignore objects smaller than specified percentage (width%, height%)
    - maximumSize: Ignore objects larger than specified percentage
    - swayingObjectDistance: Ignore swaying objects like trees, flags
    - shortLivedLimit: Ignore objects that appear for less than X seconds
    
    TRIGGER CONDITIONS:
    - Area-based triggers use normalized coordinates from -1 to 1
    - Crossline counting can specify direction: left-right, right-left, or both
    - Time in Area is perfect for detecting loitering, waiting, or dwelling
    `;

    const examples = `
    EXAMPLES:
    
    1. "A person walking their dog" ->
       - Humans: true (person walking)
       - Motion detection in full area
       - No time filter (walking is transient)
       - Small size filter to avoid detecting the dog as human
    
    2. "Someone loitering by the entrance for more than 10 seconds" ->
       - Humans: true
       - Motion detection
       - timeInArea: 10 seconds
       - Area focused on entrance zone
    
    3. "Cars parking" ->
       - Vehicles: true, subtype: car
       - Motion detection
       - timeInArea: 5-10 seconds (car stops and stays)
       - Larger minimum size to filter out people
    
    4. "People running" ->
       - Humans: true
       - Motion detection
       - shortLivedLimit: 1-2 seconds (runners pass quickly)
       - No time in area (running is fast movement)
    
    5. "Delivery truck at loading dock" ->
       - Vehicles: true, subtype: truck
       - Motion detection or occupancy
       - timeInArea: 30+ seconds
       - Area focused on loading dock
       - Large minimum size filter
    
    6. "Crowd forming" ->
       - Humans: true
       - Occupancy type scenario
       - occupancyThreshold: 5+ people
       - timeInArea: 10+ seconds
    
    7. "Someone jumping the fence" ->
       - Humans: true
       - Fence type scenario
       - No time filter (crossing is instant)
       - Virtual fence line placement
    
    8. "Counting customers entering store" ->
       - Humans: true
       - crosslinecount type
       - Direction: into store (e.g., left-right)
       - Line placed at entrance
    `;

    return `
    ${aoaCapabilities}
    
    ${examples}
    
    USER REQUEST: "${request.description}"
    ${request.cameraContext ? `CAMERA CONTEXT: ${request.cameraContext}` : ''}
    ${request.strictness ? `MATCHING STRICTNESS: ${request.strictness}` : 'MATCHING STRICTNESS: medium'}
    
    Analyze the user's description and map it to AOA capabilities. Consider:
    1. What objects are involved? (humans, vehicles, both?)
    2. What behavior is described? (moving, stopping, crossing, dwelling?)
    3. What timing is implied? (quick pass-through, loitering, permanent?)
    4. What area should be monitored? (full view, specific zone?)
    5. What filters would help reduce false positives?
    
    Respond with a JSON object (and only JSON, no markdown formatting) with this structure:
    {
      "name": "Short descriptive name (max 15 chars)",
      "type": "motion|fence|crosslinecount|occupancy",
      "objectTypes": {
        "humans": true/false,
        "vehicles": true/false,
        "vehicleSubTypes": ["car", "truck"] // only if vehicles true
      },
      "filters": {
        "timeInArea": null or number in seconds,
        "minimumSize": null or {"width": percentage, "height": percentage},
        "maximumSize": null or {"width": percentage, "height": percentage},
        "swayingObjectDistance": null or number,
        "shortLivedLimit": null or number in seconds
      },
      "areaConfig": {
        "coverage": "full|entrance|exit|center|custom",
        "vertices": [[x1,y1], [x2,y2], ...] // normalized -1 to 1
      },
      "crosslineDirection": "left-right|right-left|both", // only for crosslinecount
      "occupancyThreshold": null or number, // only for occupancy
      "explanation": "Brief explanation of how this maps to the user request",
      "confidence": 0.0 to 1.0,
      "assumptions": ["list of assumptions made"],
      "alternatives": ["other possible interpretations"]
    }
    
    BE CREATIVE but ACCURATE. If the description implies complex behavior, use appropriate filters.
    For example, "walking a dog" implies human movement but not loitering, while "waiting for a bus" implies loitering.
    `;
  }

  /**
   * Parse Gemini's response
   */
  private parseGeminiResponse(text: string): any {
    try {
      // Remove any markdown formatting if present
      const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (error) {
      logger.error('[AOA NL] Failed to parse Gemini response:', text);
      
      // Try to extract JSON from the text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e) {
          logger.error('[AOA NL] Failed to extract JSON from response');
        }
      }
      
      return null;
    }
  }

  /**
   * Validate and enhance the scenario with defaults
   */
  private validateAndEnhanceScenario(config: any, request: NLScenarioRequest): any {
    // Ensure we have a valid scenario type
    if (!['motion', 'fence', 'crosslinecount', 'occupancy'].includes(config.type)) {
      config.type = 'motion'; // Default to motion detection
    }

    // Ensure we have at least one object type
    if (!config.objectTypes?.humans && !config.objectTypes?.vehicles) {
      config.objectTypes = { humans: true }; // Default to human detection
    }

    // Set area based on coverage type or use provided vertices
    if (config.areaConfig?.coverage === 'full' || !config.areaConfig?.vertices) {
      config.area = [[-0.9, -0.9], [-0.9, 0.9], [0.9, 0.9], [0.9, -0.9]];
    } else if (config.areaConfig?.coverage === 'entrance') {
      config.area = [[-0.9, -0.5], [-0.9, 0.9], [0.9, 0.9], [0.9, -0.5]];
    } else if (config.areaConfig?.coverage === 'exit') {
      config.area = [[-0.9, -0.9], [-0.9, 0.5], [0.9, 0.5], [0.9, -0.9]];
    } else if (config.areaConfig?.coverage === 'center') {
      config.area = [[-0.5, -0.5], [-0.5, 0.5], [0.5, 0.5], [0.5, -0.5]];
    } else {
      config.area = config.areaConfig.vertices;
    }

    // For crossline, ensure we have a line (2 points)
    if (config.type === 'crosslinecount' && config.area.length > 2) {
      config.area = [config.area[0], config.area[2]]; // Use first and third point as line
    }

    // Clean up filters - remove null values
    if (config.filters) {
      const cleanFilters: any = {};
      if (config.filters.timeInArea > 0) {
        cleanFilters.timeInArea = config.filters.timeInArea;
      }
      if (config.filters.minimumSize) {
        cleanFilters.minimumSize = config.filters.minimumSize;
      }
      if (config.filters.maximumSize) {
        cleanFilters.maximumSize = config.filters.maximumSize;
      }
      if (config.filters.swayingObjectDistance > 0) {
        cleanFilters.swayingObjectDistance = config.filters.swayingObjectDistance;
      }
      if (config.filters.shortLivedLimit > 0) {
        cleanFilters.shortLivedLimit = config.filters.shortLivedLimit;
      }
      config.filters = Object.keys(cleanFilters).length > 0 ? cleanFilters : undefined;
    }

    // Build final scenario object
    const scenario: any = {
      name: config.name || 'NL Scenario',
      type: config.type,
      area: config.area,
      objectTypes: config.objectTypes,
      filters: config.filters
    };

    // Add type-specific properties
    if (config.type === 'crosslinecount' && config.crosslineDirection) {
      scenario.crosslineDirection = config.crosslineDirection;
    }
    if (config.type === 'occupancy' && config.occupancyThreshold) {
      scenario.occupancyThreshold = config.occupancyThreshold;
    }

    return scenario;
  }

  /**
   * Generate example scenarios for common use cases
   */
  async generateCommonScenarios(): Promise<Record<string, any>> {
    const commonScenarios = {
      'Loitering Detection': await this.processNaturalLanguage({
        description: 'People standing around or waiting for more than 30 seconds'
      }),
      'Vehicle Parking': await this.processNaturalLanguage({
        description: 'Cars parking in the parking lot'
      }),
      'Entrance Counter': await this.processNaturalLanguage({
        description: 'Count people entering through the main door'
      }),
      'Delivery Detection': await this.processNaturalLanguage({
        description: 'Delivery trucks stopping at the loading dock'
      }),
      'Running Detection': await this.processNaturalLanguage({
        description: 'People running through the area'
      }),
      'Crowd Formation': await this.processNaturalLanguage({
        description: 'Groups of people gathering together'
      }),
      'Pet Detection': await this.processNaturalLanguage({
        description: 'People walking with their dogs'
      }),
      'Queue Monitoring': await this.processNaturalLanguage({
        description: 'People waiting in line'
      })
    };

    return commonScenarios;
  }
}

/**
 * Helper function to create and deploy NL-based scenario
 */
export async function deployNLScenario(
  cameraIp: string,
  username: string,
  password: string,
  geminiApiKey: string,
  description: string,
  context?: string
): Promise<{
  success: boolean;
  message: string;
  scenarioId?: number;
  details?: any;
}> {
  try {
    // Process natural language
    const nlProcessor = new AOANaturalLanguageProcessor(geminiApiKey);
    const nlResponse = await nlProcessor.processNaturalLanguage({
      description,
      cameraContext: context
    });

    if (!nlResponse.success || !nlResponse.scenario) {
      throw new Error(`Failed to process description: ${nlResponse.error}`);
    }

    logger.info('[AOA NL] Generated scenario:', nlResponse.scenario);
    logger.info('[AOA NL] Explanation:', nlResponse.explanation);
    logger.info('[AOA NL] Confidence:', nlResponse.confidence);

    // Deploy to camera using AOA service
    const aoaService = new AOAService(cameraIp, username, password);
    const result = await aoaService.createAdvancedScenario(nlResponse.scenario);

    if (result) {
      // Send the scenario name and description to ACAP endpoint
      try {
        await sendScenarioToACAP(
          cameraIp, 
          username, 
          password, 
          nlResponse.scenario.name, 
          description
        );
        logger.info(`[AOA NL] Successfully sent scenario '${nlResponse.scenario.name}' to ACAP`);
      } catch (acapError: any) {
        logger.warn('[AOA NL] Failed to send scenario to ACAP:', acapError.message);
        // Don't fail the overall operation if ACAP notification fails
      }

      return {
        success: true,
        message: `Successfully created scenario "${nlResponse.scenario.name}" from natural language`,
        details: {
          scenario: nlResponse.scenario,
          explanation: nlResponse.explanation,
          confidence: nlResponse.confidence
        }
      };
    } else {
      throw new Error('Failed to create scenario on camera');
    }

  } catch (error: any) {
    logger.error('[AOA NL] Deployment failed:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Send AOA scenario configuration to ACAP endpoint
 * This allows the ACAP to generate descriptions based on the created scenario
 */
async function sendScenarioToACAP(
  cameraIp: string,
  username: string,
  password: string,
  scenarioName: string,
  description: string
): Promise<void> {
  const axios = require('axios');
  const crypto = require('crypto');

  logger.info(`[AOA NL] Sending scenario '${scenarioName}' to ACAP endpoint`);

  const requestData = {
    trigger: scenarioName,     // The AOA scenario name that was created
    description: description   // The original natural language description
  };

  const url = `http://${cameraIp}/local/BatonAnalytic/baton_analytic.cgi?command=generateFromDescription`;

  try {
    // First request to get digest auth challenge
    const response1 = await axios.post(url, JSON.stringify(requestData), {
      headers: {
        'Content-Type': 'application/json'
      },
      validateStatus: () => true,
      timeout: 10000
    });

    if (response1.status === 401) {
      // Handle digest authentication
      const wwwAuth = response1.headers['www-authenticate'];
      if (wwwAuth && wwwAuth.includes('Digest')) {
        // Build digest auth header
        const authHeader = buildDigestAuth(username, password, 'POST', 
          `/local/BatonAnalytic/baton_analytic.cgi?command=generateFromDescription`, wwwAuth);

        const response2 = await axios.post(url, JSON.stringify(requestData), {
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });

        if (response2.status === 200) {
          logger.info('[AOA NL] Successfully sent scenario to ACAP');
          if (response2.data) {
            logger.info('[AOA NL] ACAP response:', response2.data);
          }
        } else {
          logger.warn(`[AOA NL] ACAP responded with status ${response2.status}`);
        }
      }
    } else if (response1.status === 200) {
      logger.info('[AOA NL] Successfully sent scenario to ACAP (no auth)');
      if (response1.data) {
        logger.info('[AOA NL] ACAP response:', response1.data);
      }
    } else {
      logger.warn(`[AOA NL] ACAP responded with status ${response1.status}`);
    }
  } catch (error: any) {
    throw new Error(`Failed to send scenario to ACAP: ${error.message}`);
  }
}

/**
 * Build digest authentication header
 */
function buildDigestAuth(
  username: string, 
  password: string, 
  method: string, 
  uri: string, 
  wwwAuth: string
): string {
  const crypto = require('crypto');
  
  // Parse the WWW-Authenticate header
  const realm = wwwAuth.match(/realm="([^"]+)"/)?.[1] || '';
  const nonce = wwwAuth.match(/nonce="([^"]+)"/)?.[1] || '';
  const qop = wwwAuth.match(/qop="([^"]+)"/)?.[1] || '';
  const opaque = wwwAuth.match(/opaque="([^"]+)"/)?.[1] || '';

  // Generate client nonce
  const cnonce = crypto.randomBytes(16).toString('hex');
  const nc = '00000001';

  // Calculate hashes
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

  // Build the Authorization header
  let authHeader = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;
  
  if (qop) {
    authHeader += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
  }
  
  if (opaque) {
    authHeader += `, opaque="${opaque}"`;
  }

  return authHeader;
}