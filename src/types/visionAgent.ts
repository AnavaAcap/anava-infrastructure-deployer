/**
 * Vision Agent Type Definitions
 * 
 * These types define the structure of Vision Agents - autonomous AI entities
 * that perceive, reason, and act through the camera network.
 */

// Core Agent Types
export interface VisionAgent {
  id: string;
  name: string;
  description: string;
  templateId?: string; // Reference to template if created from one
  cameraId: string; // Primary camera this agent monitors
  status: AgentStatus;
  created: Date;
  lastModified: Date;
  lastActive?: Date;
  config: AgentConfig;
  stats: AgentStats;
  learning: AgentLearning;
}

export enum AgentStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  ERROR = 'error',
  LEARNING = 'learning',
}

// Agent Configuration
export interface AgentConfig {
  triggers: AgentTrigger[];
  conditions: AgentCondition[];
  actions: AgentAction[];
  schedule?: AgentSchedule;
  multiModal?: MultiModalConfig;
  priority: number; // 1-10, higher takes precedence for camera control
}

// Triggers - What starts agent evaluation
export interface AgentTrigger {
  id: string;
  type: TriggerType;
  config: Record<string, any>;
}

export enum TriggerType {
  OBJECT_DETECTED = 'object_detected',
  MOTION_DETECTED = 'motion_detected',
  SOUND_DETECTED = 'sound_detected',
  SCHEDULE = 'schedule',
  MANUAL = 'manual',
  EVENT_CHAIN = 'event_chain', // Triggered by another agent
}

// Conditions - Rules that must be met
export interface AgentCondition {
  id: string;
  type: ConditionType;
  operator: ConditionOperator;
  config: Record<string, any>;
}

export enum ConditionType {
  OBJECT_IN_ZONE = 'object_in_zone',
  LINE_CROSSED = 'line_crossed',
  OBJECT_COUNT = 'object_count',
  TIME_IN_ZONE = 'time_in_zone',
  OBJECT_MISSING = 'object_missing',
  ATTRIBUTE_CHECK = 'attribute_check', // e.g., wearing vest
  MULTI_MODAL = 'multi_modal', // Combined conditions
}

export enum ConditionOperator {
  AND = 'and',
  OR = 'or',
  NOT = 'not',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  EQUALS = 'equals',
}

// Actions - What the agent does
export interface AgentAction {
  id: string;
  type: ActionType;
  priority: ActionPriority;
  config: Record<string, any>;
}

export enum ActionType {
  CREATE_ALERT = 'create_alert',
  SEND_NOTIFICATION = 'send_notification',
  SPEAK = 'speak',
  TRIGGER_DEVICE = 'trigger_device', // Lights, locks, etc.
  WEBHOOK = 'webhook',
  EMAIL = 'email',
  BOOKMARK = 'bookmark',
  START_RECORDING = 'start_recording',
  TRIGGER_AGENT = 'trigger_agent', // Chain to another agent
  TRACK_OBJECT = 'track_object', // Follow with PTZ
}

export enum ActionPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

// Schedule Configuration
export interface AgentSchedule {
  timezone: string;
  rules: ScheduleRule[];
}

export interface ScheduleRule {
  days: number[]; // 0-6, Sunday-Saturday
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  active: boolean;
}

// Multi-Modal Configuration
export interface MultiModalConfig {
  dataSources: DataSource[];
  fusionWindow: number; // Seconds to correlate events
}

export interface DataSource {
  type: DataSourceType;
  config: Record<string, any>;
}

export enum DataSourceType {
  CAMERA_AUDIO = 'camera_audio',
  WEATHER_API = 'weather_api',
  CALENDAR = 'calendar',
  ACCESS_CONTROL = 'access_control',
  IOT_SENSORS = 'iot_sensors',
}

// Region of Interest (ROI) Definitions
export interface RegionOfInterest {
  id: string;
  name: string;
  type: ROIType;
  points: Point[]; // Polygon points or line endpoints
  cameraId: string;
}

export enum ROIType {
  POLYGON = 'polygon',
  LINE = 'line',
  CIRCLE = 'circle',
}

export interface Point {
  x: number; // Percentage of frame width (0-100)
  y: number; // Percentage of frame height (0-100)
}

// Agent Templates
export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: TemplateCategory;
  config: Partial<AgentConfig>;
  requiredInputs: TemplateInput[];
  popularity: number; // For marketplace ranking
}

export enum TemplateCategory {
  SECURITY = 'security',
  SAFETY = 'safety',
  OPERATIONS = 'operations',
  ANALYTICS = 'analytics',
  CUSTOM = 'custom',
}

export interface TemplateInput {
  id: string;
  label: string;
  type: 'roi' | 'time' | 'number' | 'text' | 'select';
  required: boolean;
  defaultValue?: any;
  options?: any[]; // For select type
}

// Agent Learning & Feedback
export interface AgentLearning {
  feedbackCount: number;
  accuracy: number; // 0-1
  lastTrained?: Date;
  improvements: LearningImprovement[];
}

export interface LearningImprovement {
  date: Date;
  type: 'false_positive' | 'false_negative' | 'correct';
  context: Record<string, any>;
  applied: boolean;
}

// Agent Statistics
export interface AgentStats {
  activations: number;
  alerts: number;
  falsePositives: number;
  uptime: number; // Seconds
  lastActivation?: Date;
  performance: {
    avgResponseTime: number; // ms
    cpuUsage: number; // percentage
    memoryUsage: number; // MB
  };
}

// Agent Events (for real-time monitoring)
export interface AgentEvent {
  id: string;
  agentId: string;
  timestamp: Date;
  type: AgentEventType;
  data: Record<string, any>;
  thumbnail?: string; // Base64 image
}

export enum AgentEventType {
  ACTIVATED = 'activated',
  CONDITION_MET = 'condition_met',
  ACTION_TAKEN = 'action_taken',
  ERROR = 'error',
  LEARNING_UPDATE = 'learning_update',
}

// Agent Creation Wizard State
export interface AgentWizardState {
  currentStep: number;
  template?: AgentTemplate;
  agent: Partial<VisionAgent>;
  regions: RegionOfInterest[];
  testMode: boolean;
}

// Agent Execution Context
export interface AgentExecutionContext {
  agent: VisionAgent;
  currentFrame?: VideoFrame;
  detections?: ObjectDetection[];
  multiModalData?: Record<string, any>;
  history: AgentEvent[];
}

export interface VideoFrame {
  timestamp: number;
  width: number;
  height: number;
  data: ArrayBuffer;
}

export interface ObjectDetection {
  class: string;
  confidence: number;
  bbox: BoundingBox;
  attributes?: Record<string, any>;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Agent API Responses
export interface AgentListResponse {
  agents: VisionAgent[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AgentDeploymentResult {
  success: boolean;
  agentId: string;
  message?: string;
  warnings?: string[];
}

// Agent Collaboration
export interface AgentCollaboration {
  id: string;
  name: string;
  agents: string[]; // Agent IDs
  handoffRules: HandoffRule[];
}

export interface HandoffRule {
  fromAgent: string;
  toAgent: string;
  condition: AgentCondition;
  dataToPass: string[]; // Fields to pass between agents
}