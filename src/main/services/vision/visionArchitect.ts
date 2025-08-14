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

You don't just analyze - you architect entire intelligence systems. You create four interconnected components:

1. **Axis Object Analytics Scenarios** - Chipset-level triggers that detect basic objects and events
2. **Anava Skills** - AI-powered analysis capabilities that process complex scenes  
3. **Security Profiles** - Orchestration systems that coordinate scenarios, skills, timing, and continuous monitoring
4. **VAPIX Schedules** - Time-based activation control to scope monitoring to specific days/times

## Core Operating Principles

### 1. Complete Ecosystem Design
Create MULTIPLE skills and profiles to solve problems holistically. Never try to do everything in one skill - that leads to hallucination and poor performance.

### 2. Decomposition & Specialization (Anti-Hallucination Protocol)
Break down complex requests into specialized, focused SKILLS:
- ✅ GOOD: QueueLengthMonitor, PPEDetection_HardHats, SuspiciousLoitering, VehicleDwellTime
- ❌ BAD: GeneralSecurity, StoreAnalytics, SafetyMonitoring, EverythingDetector

### 3. Hierarchical Analysis (Objects → Questions → Insights)
Follow strict hierarchy:
1. **Objects**: Identify fundamental visual elements 
2. **Questions**: Ask verifiable questions about objects and interactions
3. **Insights**: Synthesize answers into actionable intelligence

### 4. Action-Oriented Intelligence
Every SKILL and PROFILE must produce actionable intelligence, not passive observations. The responseCriteria determines what's important enough to report.

### 5. Domain Versatility
You can handle ANY domain: security, retail optimization, manufacturing efficiency, healthcare monitoring, transportation management, educational environments, construction safety, hospitality services, or any other application imaginable.

## Response Philosophy

We have a 1M token context window. Be COMPREHENSIVE and DETAILED. Create complete systems with multiple skills and profiles. The goal is to demonstrate maximum value and capability. Don't hold back - generate rich, detailed configurations that truly showcase the power of the Anava system.

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
  "schedules": [
    {
      "name": "CustomScheduleName",
      "description": "What this custom schedule controls",
      "scheduleType": "weekly",
      "enabled": true,
      "weeklySchedule": {
        "monday": [{"startTime": "07:00", "endTime": "15:30", "description": "School hours"}],
        "tuesday": [{"startTime": "07:00", "endTime": "15:30", "description": "School hours"}],
        "wednesday": [{"startTime": "07:00", "endTime": "15:30", "description": "School hours"}],
        "thursday": [{"startTime": "07:00", "endTime": "15:30", "description": "School hours"}],
        "friday": [{"startTime": "07:00", "endTime": "15:30", "description": "School hours"}]
      },
      "metadata": {
        "createdBy": "VisionArchitect",
        "purpose": "customTiming",
        "visionArchitectGenerated": true
      }
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
      "fullAnalysisModel": "gemini-2.5-pro",
      "viewArea": 1,
      "analysisSchedule": "CustomScheduleName",
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

## Understanding Continuous/Active Monitoring

**Critical Concept**: Many scenarios require ongoing analysis, not just single-frame detection.

**Example Flow**:
1. **Initial Trigger**: AOA detects "3+ people in area for 10+ seconds" (loitering)
2. **Activation**: System begins continuous monitoring at specified intervals 
3. **Ongoing Analysis**: Every 5 seconds, analyze: "Still loitering?", "Suspicious behavior?", "Weapons?"
4. **Dynamic Decision**: Continue if relevant, stop when conditions change
5. **Maximum Duration**: Stop after 2 minutes to prevent infinite monitoring

**Key Applications**:
- **Loitering**: Monitor behavior evolution over time
- **Queue Management**: Track wait times and abandonment patterns
- **Safety Compliance**: Continuous PPE verification during work
- **Customer Analytics**: Dwell time at displays
- **Equipment Monitoring**: Ongoing machinery status

## Schedule Intelligence - Smart Schedule Management

**IMPORTANT**: Cameras have some built-in schedules. DO NOT duplicate these, but CREATE custom schedules for unique scenarios:

**Existing Camera Schedules (DO NOT CREATE THESE)**:
- "Office Hours Weekdays" - Standard business hours M-F
- "Weekends" - Saturday-Sunday coverage
- "After Hours" - Evening/night coverage
- Empty string "" = "AlwaysOn" - 24/7 monitoring

**Schedule Creation Strategy**:
- **For 24/7 monitoring**: Use "analysisSchedule": "" (empty string = always on)
- **For standard business**: Use "analysisSchedule": "Office Hours Weekdays"
- **For weekends**: Use "analysisSchedule": "Weekends"
- **For after hours**: Use "analysisSchedule": "After Hours"
- **For unique timing**: CREATE custom schedules with descriptive names

**When to CREATE Custom Schedules**:
- School hours (different from office hours)
- Specific delivery windows
- Custom operational hours
- Event-based monitoring
- Seasonal schedules

**Custom Schedule Examples**:
- "SchoolHours" - 7:00 AM to 3:30 PM weekdays
- "DeliveryWindow" - 6:00 AM to 10:00 AM weekdays  
- "LunchRush" - 11:30 AM to 1:30 PM weekdays
- "EventSecurity" - Custom event timing

**Critical Rules**:
1. **Always check existing schedules first** - use them if they fit
2. **Create custom schedules** only when existing ones don't match the need
3. **Give custom schedules descriptive names** that explain their purpose
4. **Use empty string** for always-on monitoring

## Critical Field Explanations

### questions Array (CRITICAL FOR INTELLIGENCE)
Questions are the HEART of your analysis. Create 3-8 meaningful questions per skill that build intelligence hierarchically.

**Format Requirements**:
- **id**: Sequential integer starting from 1
- **name**: Snake_case identifier (e.g., "person_present", "vehicle_count", "activity_type")
- **text**: The actual question text to analyze
- **type**: Must be "bool", "int", or "string"
- **enabled**: Always true unless specifically disabled
- **stateful**: Set to true if answer should persist across frames (e.g., "has_weapon_been_seen")

**Question Design Strategy**:
1. Start with detection: "Is there a [object] present?"
2. Add counting: "How many [objects] are visible?"
3. Add state assessment: "What is the state/condition of [object]?"
4. Add behavior analysis: "What activity is occurring?"
5. Add relationship analysis: "How are [objects] interacting?"
6. Add temporal analysis: "How long has [condition] been true?"

Example questions for different scenarios:

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

### analysisSchedule - Using Camera's Built-in Schedules
Reference to a schedule name that controls when this profile is active:
- Empty string = Always active 24/7 (most common choice)
- "BusinessHours" = If camera has built-in business hours schedule
- "NightTime" = If camera has built-in night/after-hours schedule
- "Weekends" = If camera has built-in weekend schedule
- "WorkingHours" = If camera has built-in working hours schedule

**Schedule Usage Guidelines**:
- General monitoring: Use empty string (always on)
- Business analytics: Use "BusinessHours" if available, otherwise empty string
- Security monitoring: Use empty string for 24/7, or "NightTime" if available
- When in doubt: Use empty string for always-on monitoring

**NOTE**: Create custom schedules only when existing camera schedules don't fit your needs

### activeMonitoring Configuration (ESSENTIAL FOR CONTINUOUS INTELLIGENCE)
Most real-world scenarios need CONTINUOUS monitoring, not just single-shot detection:

- **enabled**: Set to TRUE for scenarios needing ongoing analysis:
  - Loitering/dwelling situations
  - Queue monitoring
  - Safety compliance verification
  - Customer journey tracking
  - Equipment status monitoring
  
- **intervalMs**: How often to re-analyze (typically 3000-10000ms):
  - 3000ms: High-priority security situations
  - 5000ms: Standard monitoring (loitering, queues)
  - 10000ms: Low-frequency checks (equipment status)
  
- **maxDurationSec**: Maximum monitoring time (typically 60-300 seconds):
  - 60s: Quick verification scenarios
  - 120s: Standard loitering/queue monitoring
  - 300s: Extended customer journey tracking

### Model Recommendations
- **preFilterModel**: Always use "" (empty string) - this is for future functionality
- **fullAnalysisModel**: Always use "gemini-2.5-pro" for maximum intelligence and system quality

## Key Guidelines for Maximum Impact

1. **Always return valid JSON** - No text before or after the JSON object
2. **Smart schedule management** - Use existing schedules when they fit, create custom schedules only when needed
3. **Create 3-6 skills minimum** - Each focused on ONE specific aspect (anti-hallucination)
4. **Create 2-4 profiles minimum** - Different sensitivities/priorities
5. **Generate 5-8 questions per skill** - Build hierarchical intelligence
6. **Enable activeMonitoring** - Most scenarios need continuous analysis
7. **ALWAYS use "motion" type for person/vehicle detection** - Never use "object" type
8. **Write comprehensive responseCriteria** - 2-3 sentences with specific triggers
9. **Keep scenario names short** - Maximum 15 characters
10. **Use talkdownActivated strategically** - When voice adds value
11. **Use analysisSchedule wisely** - Empty string for always-on, or existing schedule names
12. **Think ecosystems, not components** - How do all pieces work together?
13. **Be detailed and thorough** - We have 1M tokens, use them wisely
14. **Demonstrate value** - Show how AI transforms basic detection into intelligence

## Complete Skill Example

Here's a properly formatted skill for "Monitor for suspicious activity":

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

## Domain-Specific System Examples

### Retail Analytics
**User Goal**: "Monitor my store entrance for business insights"
**System Design**:
- **Skills**: CustomerDwellTime, QueueLengthAnalysis, ProductInteractionTracking, AbandonmentDetection
- **Profiles**: BusinessHours_Analytics (continuous queue monitoring), PeakHours_Alerts (threshold-based)
- **Intelligence**: Purchase intent signals, staffing optimization, conversion metrics

### Manufacturing Safety
**User Goal**: "Ensure safety compliance in my factory"
**System Design**:
- **Skills**: PPE_HardHats, PPE_SafetyVests, MachineryProximity, HazardZoneCompliance
- **Profiles**: WorkHours_Safety (continuous monitoring), Maintenance_Mode (reduced sensitivity)
- **Intelligence**: Compliance violations, near-miss incidents, safety score tracking

### Security & Loss Prevention
**User Goal**: "Detect suspicious activity after hours"
**System Design**:
- **Skills**: WeaponDetection, LoiteringAnalysis, PerimeterBreach, UnusualBehavior
- **Profiles**: AfterHours_High (maximum sensitivity), BusinessHours_Balanced (filtered alerts)
- **Intelligence**: Threat assessment, intrusion detection, behavioral anomalies

### Healthcare Monitoring
**User Goal**: "Monitor patient safety in corridors"
**System Design**:
- **Skills**: PatientFallRisk, WanderingDetection, StaffResponseTime, EquipmentTracking
- **Profiles**: 24x7_PatientSafety (continuous), Emergency_Response (high priority)
- **Intelligence**: Fall prevention, elopement risk, response metrics

### Transportation & Logistics
**User Goal**: "Optimize loading dock operations"
**System Design**:
- **Skills**: VehicleDwellTime, LoadingEfficiency, SafetyZoneViolations, QueueManagement
- **Profiles**: Delivery_Hours (vehicle focus), Off_Hours_Security (intrusion detection)
- **Intelligence**: Throughput optimization, safety compliance, bottleneck identification

### School Safety Example (WITH SCHEDULE INTELLIGENCE)
**User Goal**: "Tell me when my kids get home from school"
**System Design**:
- **Schedule**: "SchoolReturn" - Monday-Friday 2:00 PM to 5:00 PM
- **Skills**: ChildArrivalDetection, ParentNotification, SafetyVerification
- **Profiles**: 
  - SchoolHours_WatchForKids (references "SchoolReturn" schedule, high sensitivity)
  - AfterHours_Security (references "AfterHours" schedule, different focus)
- **Intelligence**: Only triggers during school return hours, preventing 3 AM false alarms
- **Key Feature**: Profile's analysisSchedule field = "SchoolReturn" enables temporal intelligence

## Creating Complete Ecosystems

**CRITICAL**: Always create MULTIPLE complementary skills and profiles that work together:

1. **Avoid Monolithic Skills**: Instead of one "SecurityMonitor" skill, create:
   - WeaponDetection (focused on weapons only)
   - LoiteringDetection (focused on time-in-area)
   - BehaviorAnalysis (focused on suspicious actions)
   
2. **Layer Your Profiles**: Create different sensitivity levels:
   - High_Security_Profile: All skills active, continuous monitoring
   - Standard_Profile: Balanced approach, periodic checks
   - Minimal_Profile: Essential monitoring only

3. **Time-Based Strategies**: Different profiles for different times:
   - BusinessHours: Customer-focused analytics
   - AfterHours: Security-focused detection
   - Maintenance: Reduced sensitivity during cleaning

4. **Synergistic Design**: Skills should complement each other:
   - One skill detects presence
   - Another analyzes behavior
   - Third tracks duration
   - Together they provide complete intelligence

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

## Complete Example - Always-On Security System

Here's how to create a system for "Tell me about any suspicious activity":

{
  "systemOverview": "Comprehensive security monitoring system with AI-powered suspicious activity detection",
  "axisScenarios": [
    {
      "name": "PersonDetect", 
      "type": "motion", 
      "enabled": true, 
      "triggers": [{"type": "includeArea", "vertices": [[-0.9,-0.9],[-0.9,0.9],[0.9,0.9],[0.9,-0.9]]}], 
      "filters": [], 
      "objectClassifications": [{"type": "human", "selected": true}],
      "metadata": {"createdBy": "VisionArchitect"}
    }
  ],
  "schedules": [],
  "skills": [
    {
      "name": "SuspiciousActivity", 
      "description": "Detects and analyzes suspicious behavior patterns", 
      "category": "security", 
      "analysisConfiguration": {
        "questions": [
          {"id": 1, "name": "person_detected", "text": "Is there a person in view?", "type": "bool", "enabled": true, "stateful": false},
          {"id": 2, "name": "suspicious_behavior", "text": "Is the person exhibiting suspicious behavior?", "type": "bool", "enabled": true, "stateful": false}
        ], 
        "responseCriteria": "If you detect suspicious activity like loitering, looking around nervously, or attempting to hide, immediately alert security with detailed description"
      }
    }
  ],
  "securityProfiles": [
    {
      "name": "24x7_Security",
      "skillId": "SuspiciousActivity",
      "analysisSchedule": "",
      "trigger": {"type": "Object", "port": 1, "profile": "PersonDetect"},
      "activeMonitoring": {"enabled": true, "intervalMs": 5000, "maxDurationSec": 120}
    }
  ],
  "systemJustification": "Always-on security system using AI analysis for comprehensive threat detection"
}

**Key Points**: 
- Empty schedules array = use existing camera schedules or always-on monitoring
- Empty analysisSchedule = always-on monitoring  
- Custom schedules only when existing ones don't fit the need

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
    schedules: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          description: { type: SchemaType.STRING },
          scheduleType: { 
            type: SchemaType.STRING,
            enum: ["weekly", "daily", "dateRange", "once"]
          },
          enabled: { type: SchemaType.BOOLEAN },
          weeklySchedule: {
            type: SchemaType.OBJECT,
            properties: {
              monday: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: {} } },
              tuesday: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: {} } },
              wednesday: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: {} } },
              thursday: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: {} } },
              friday: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: {} } },
              saturday: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: {} } },
              sunday: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: {} } }
            }
          },
          dailySchedule: { type: SchemaType.OBJECT, properties: {} },
          dateRangeSchedule: { type: SchemaType.OBJECT, properties: {} },
          onceSchedule: { type: SchemaType.OBJECT, properties: {} },
          metadata: { type: SchemaType.OBJECT, properties: {} }
        },
        required: ["name", "scheduleType", "enabled"]
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
          fullAnalysisModel: { type: SchemaType.STRING }, // Should be gemini-2.5-pro
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
  required: ["systemOverview", "axisScenarios", "schedules", "skills", "securityProfiles", "systemJustification"]
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
  schedules?: any[];
  skills?: any[];
  securityProfiles?: any[];
  systemJustification?: string;
  error?: string;
}

export class VisionArchitect {
  private gemini: GoogleGenerativeAI;
  private model: any;
  private modelName: string = 'gemini-2.5-pro';
  private apiKey: string;

  constructor(apiKey: string, modelName?: string) {
    this.apiKey = apiKey;
    this.gemini = new GoogleGenerativeAI(apiKey);
    // Use the specified model or default to gemini-2.5-pro for best quality (one-time use)
    this.modelName = modelName || 'gemini-2.5-pro';
    this.model = this.gemini.getGenerativeModel({ 
      model: this.modelName,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: this.buildVisionSystemSchema(),
        temperature: 0.7,
        maxOutputTokens: 16384 // Reasonable limit to avoid API rejection while allowing complete responses
      }
    });
  }

  /**
   * Build response schema for Vision Architect generation
   * Based on the pattern from Gemini.cpp buildAnalysisSchemaFromSkill
   */
  private buildVisionSystemSchema(): any {
    return {
      type: "object",
      description: "Complete vision intelligence system configuration",
      required: ["systemOverview", "axisScenarios", "schedules", "skills", "securityProfiles"],
      properties: {
        systemOverview: {
          type: "string",
          description: "High-level overview of the generated system"
        },
        axisScenarios: {
          type: "array",
          description: "AOA detection scenarios for chipset-level triggers",
          items: {
            type: "object",
            required: ["name", "type", "enabled", "triggers", "objectClassifications"],
            properties: {
              name: { type: "string", description: "Scenario name" },
              type: { type: "string", enum: ["motion", "fence", "crosslinecount", "occupancy"] },
              enabled: { type: "boolean" },
              triggers: {
                type: "array",
                items: {
                  type: "object",
                  required: ["type", "vertices"],
                  properties: {
                    type: { type: "string", enum: ["includeArea", "fence", "countingLine"] },
                    vertices: {
                      type: "array",
                      items: {
                        type: "array",
                        items: { type: "number" },
                        minItems: 2,
                        maxItems: 2
                      }
                    },
                    conditions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          type: { type: "string" },
                          data: { 
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                type: { type: "string" },
                                time: { type: "number" },
                                alarmTime: { type: "number" }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              },
              filters: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string" },
                    active: { type: "boolean" },
                    data: { type: "number" },
                    time: { type: "number" }
                  }
                }
              },
              objectClassifications: {
                type: "array",
                items: {
                  type: "object",
                  required: ["type", "selected"],
                  properties: {
                    type: { type: "string" },
                    selected: { type: "boolean" }
                  }
                }
              },
              metadata: { 
                type: "object",
                properties: {
                  createdBy: { type: "string" },
                  visionArchitectGenerated: { type: "boolean" }
                }
              }
            }
          }
        },
        schedules: {
          type: "array",
          description: "Time-based activation schedules for unique timing needs",
          items: {
            type: "object",
            required: ["name", "scheduleType", "enabled"],
            properties: {
              name: { type: "string", description: "Schedule name" },
              description: { type: "string", description: "Schedule purpose" },
              scheduleType: { 
                type: "string", 
                enum: ["weekly", "daily", "dateRange", "once"]
              },
              enabled: { type: "boolean" },
              weeklySchedule: {
                type: "object",
                properties: {
                  monday: { 
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        startTime: { type: "string", description: "HH:MM format" },
                        endTime: { type: "string", description: "HH:MM format" },
                        description: { type: "string" }
                      }
                    }
                  },
                  tuesday: { 
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        startTime: { type: "string" },
                        endTime: { type: "string" },
                        description: { type: "string" }
                      }
                    }
                  },
                  wednesday: { 
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        startTime: { type: "string" },
                        endTime: { type: "string" },
                        description: { type: "string" }
                      }
                    }
                  },
                  thursday: { 
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        startTime: { type: "string" },
                        endTime: { type: "string" },
                        description: { type: "string" }
                      }
                    }
                  },
                  friday: { 
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        startTime: { type: "string" },
                        endTime: { type: "string" },
                        description: { type: "string" }
                      }
                    }
                  },
                  saturday: { 
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        startTime: { type: "string" },
                        endTime: { type: "string" },
                        description: { type: "string" }
                      }
                    }
                  },
                  sunday: { 
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        startTime: { type: "string" },
                        endTime: { type: "string" },
                        description: { type: "string" }
                      }
                    }
                  }
                }
              },
              metadata: { 
                type: "object",
                properties: {
                  createdBy: { type: "string" },
                  purpose: { type: "string" },
                  visionArchitectGenerated: { type: "boolean" }
                }
              }
            }
          }
        },
        skills: {
          type: "array",
          description: "AI analysis skills for complex scene understanding",
          items: {
            type: "object",
            required: ["name", "description", "category", "analysisConfiguration"],
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              category: { type: "string" },
              analysisConfiguration: {
                type: "object",
                required: ["description", "questions", "responseCriteria"],
                properties: {
                  description: { type: "string" },
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["id", "name", "text", "type", "enabled", "stateful"],
                      properties: {
                        id: { type: "integer" },
                        name: { type: "string" },
                        text: { type: "string" },
                        type: { type: "string", enum: ["bool", "int", "string"] },
                        enabled: { type: "boolean" },
                        stateful: { type: "boolean" }
                      }
                    }
                  },
                  objectDetection: {
                    type: "array",
                    items: { type: "string" }
                  },
                  responseCriteria: { type: "string" },
                  talkdownActivated: { type: "boolean" },
                  elevenLabsVoiceId: { type: "string" }
                }
              }
            }
          }
        },
        securityProfiles: {
          type: "array",
          description: "Security profiles that orchestrate scenarios, skills, and schedules",
          items: {
            type: "object",
            required: ["name", "skillId", "trigger"],
            properties: {
              name: { type: "string" },
              skillId: { type: "string" },
              preFilterModel: { type: "string" },
              fullAnalysisModel: { type: "string" },
              viewArea: { type: "number" },
              analysisSchedule: { type: "string" },
              trigger: {
                type: "object",
                required: ["type", "port", "profile"],
                properties: {
                  type: { type: "string" },
                  port: { type: "number" },
                  profile: { type: "string" }
                }
              },
              activeMonitoring: {
                type: "object",
                required: ["enabled", "intervalMs", "maxDurationSec"],
                properties: {
                  enabled: { type: "boolean" },
                  intervalMs: { type: "number" },
                  maxDurationSec: { type: "number" }
                }
              }
            }
          }
        },
        systemJustification: {
          type: "string",
          description: "Technical explanation of system design decisions"
        }
      }
    };
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
          if (modelName.includes('pro')) {
            displayName += modelName.includes('2.5') ? ' (Best Quality - Default)' : ' (High Quality)';
          } else if (modelName.includes('flash-lite')) {
            displayName += ' (Best for Free Tier)';
          } else if (modelName.includes('flash')) {
            displayName += ' (Fast & Efficient)';
          }
          
          return {
            name: modelName,
            displayName: displayName,
            description: m.description || ''
          };
        })
        .sort((a: any, b: any) => {
          // Sort by priority for Vision Architect - Pro models first for best quality
          const priority: { [key: string]: number } = {
            'gemini-2.5-pro': 1,
            'gemini-2.0-pro': 2,
            'gemini-1.5-pro': 3,
            'gemini-1.5-pro-002': 3,
            'gemini-2.5-flash': 4,
            'gemini-2.0-flash': 5,
            'gemini-2.0-flash-001': 5,
            'gemini-1.5-flash': 6,
            'gemini-1.5-flash-002': 6,
            'gemini-1.5-flash-8b': 7,
            'gemini-1.5-flash-8b-001': 7,
            'gemini-2.0-flash-lite': 8,
            'gemini-2.0-flash-lite-001': 8
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
      
      // Log token usage information
      if (response.usageMetadata) {
        logger.info('[Vision Architect] === TOKEN USAGE ===');
        logger.info('[Vision Architect] Prompt Tokens:', response.usageMetadata.promptTokenCount || 'N/A');
        logger.info('[Vision Architect] Completion Tokens:', response.usageMetadata.candidatesTokenCount || 'N/A');
        logger.info('[Vision Architect] Total Tokens:', response.usageMetadata.totalTokenCount || 'N/A');
        
        // Calculate estimated cost based on model
        if (response.usageMetadata.totalTokenCount) {
          const inputTokens = response.usageMetadata.promptTokenCount || 0;
          const outputTokens = response.usageMetadata.candidatesTokenCount || 0;
          let inputCost = 0;
          let outputCost = 0;
          
          // Pricing per 1M tokens (as of latest rates)
          if (this.modelName.includes('pro')) {
            inputCost = (inputTokens / 1000000) * 3.50;
            outputCost = (outputTokens / 1000000) * 10.50;
          } else if (this.modelName.includes('flash-lite')) {
            inputCost = (inputTokens / 1000000) * 0.35;
            outputCost = (outputTokens / 1000000) * 1.05;
          } else if (this.modelName.includes('flash')) {
            inputCost = (inputTokens / 1000000) * 0.35;
            outputCost = (outputTokens / 1000000) * 1.05;
          }
          
          const totalCost = inputCost + outputCost;
          logger.info('[Vision Architect] Estimated Cost: $' + totalCost.toFixed(4));
          logger.info('[Vision Architect] Input Cost: $' + inputCost.toFixed(4) + ' (', inputTokens, 'tokens)');
          logger.info('[Vision Architect] Output Cost: $' + outputCost.toFixed(4) + ' (', outputTokens, 'tokens)');
        }
      }
      
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
      
      // Parse the response with error recovery
      let systemConfig: any;
      try {
        systemConfig = JSON.parse(rawResponseText);
        logger.info('[Vision Architect] Successfully parsed JSON response');
      } catch (parseError: any) {
        logger.error('[Vision Architect] Failed to parse response as JSON:', parseError);
        logger.error('[Vision Architect] Parse error details:', parseError.message);
        
        // Attempt to recover from truncated JSON
        if (parseError.message.includes('Unterminated string') || parseError.message.includes('Unexpected end')) {
          logger.info('[Vision Architect] Attempting to recover from truncated JSON...');
          
          try {
            // Try to fix common truncation issues
            let fixedJson = rawResponseText.trim();
            
            // If it ends with a comma or incomplete structure, try to close it
            if (!fixedJson.endsWith('}')) {
              // Find the last complete object and close it
              const lastCompleteObjectIndex = fixedJson.lastIndexOf('},');
              if (lastCompleteObjectIndex > 0) {
                // Truncate to last complete object and close the JSON
                fixedJson = fixedJson.substring(0, lastCompleteObjectIndex + 1) + '\n  ]\n}';
                
                logger.info('[Vision Architect] Attempting to parse recovered JSON...');
                systemConfig = JSON.parse(fixedJson);
                logger.info('[Vision Architect] Successfully recovered from truncated JSON!');
              } else {
                throw new Error('Could not recover from JSON truncation');
              }
            }
          } catch (recoveryError: any) {
            logger.error('[Vision Architect] JSON recovery failed:', recoveryError.message);
            logger.error('[Vision Architect] Raw response that failed to parse (first 2000 chars):');
            logger.error(rawResponseText.substring(0, 2000));
            logger.error('[Vision Architect] Raw response that failed to parse (last 1000 chars):');
            logger.error(rawResponseText.substring(Math.max(0, rawResponseText.length - 1000)));
            throw new Error(`Failed to parse AI response: ${parseError.message}. Response may be truncated due to length limits.`);
          }
        } else {
          logger.error('[Vision Architect] Raw response that failed to parse:', rawResponseText);
          throw new Error(`Failed to parse AI response: ${parseError.message}`);
        }
      }

      logger.info('========================================');
      logger.info('[Vision Architect] GENERATED SYSTEM OVERVIEW');
      logger.info('========================================');
      logger.info('[Vision Architect] System Overview:', systemConfig.systemOverview);
      logger.info('[Vision Architect] Components Generated:', {
        scenarios: systemConfig.axisScenarios?.length || 0,
        schedules: systemConfig.schedules?.length || 0,
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
      
      if (systemConfig.schedules?.length > 0) {
        logger.info('[Vision Architect] === SCHEDULES ===');
        systemConfig.schedules.forEach((schedule: any, idx: number) => {
          logger.info(`[Vision Architect] Schedule ${idx + 1}: ${schedule.name}`);
          logger.info(`  Description: ${schedule.description}`);
          logger.info(`  Type: ${schedule.scheduleType}`);
          logger.info(`  Enabled: ${schedule.enabled}`);
          if (schedule.weeklySchedule) {
            const activeDays = Object.keys(schedule.weeklySchedule).filter(day => 
              schedule.weeklySchedule[day]?.length > 0
            );
            logger.info(`  Active Days: ${activeDays.join(', ')}`);
            activeDays.forEach(day => {
              const ranges = schedule.weeklySchedule[day];
              ranges?.forEach((range: any) => {
                logger.info(`    ${day}: ${range.startTime}-${range.endTime} (${range.description || 'No description'})`);
              });
            });
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
    
    IMPORTANT: 
    - Return your response as valid JSON matching the required schema
    - Do not include any text before or after the JSON  
    - Keep descriptions concise but meaningful (1-2 sentences max)
    - Prioritize functionality over lengthy explanations
    - Ensure the JSON is complete and well-formed`;

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
      schedules: number;
      skills: number;
      profiles: number;
    };
    errors?: string[];
    details?: {
      skillIds?: string[];
      profileIds?: string[];
      scenarioIds?: number[];
      scheduleIds?: string[];
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
        ? `Successfully deployed ${deployment.deployed.scenarios} scenarios, ${deployment.deployed.schedules || 0} schedules, ${deployment.deployed.skills} skills, and ${deployment.deployed.profiles} profiles`
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