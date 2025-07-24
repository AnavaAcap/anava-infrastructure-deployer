import { EventEmitter } from 'events';
import { 
  VisionAgent,
  AgentCondition,
  AgentTrigger,
  AgentAction,
  TriggerType,
  ConditionType,
  ActionType,
  AgentEvent,
  AgentEventType,
  Point,
} from '../../types/visionAgent';
import { visionService } from './visionService';

/**
 * REAL Agent Execution Engine
 * Uses the MCP server's actual capabilities to implement agent logic
 */
export class AgentExecutionEngine extends EventEmitter {
  private agent: VisionAgent;
  private isRunning: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastAnalysisTime: number = 0;
  private trackedObjects: Map<string, TrackedObject> = new Map();

  constructor(agent: VisionAgent) {
    super();
    this.agent = agent;
  }

  async start() {
    if (this.isRunning) return;
    
    console.log(`[AgentEngine] Starting agent: ${this.agent.name}`);
    this.isRunning = true;

    // Ensure MCP server is connected
    const mcpStatus = visionService.getServerStatus();
    if (mcpStatus !== 'running') {
      throw new Error('MCP server not connected. Please connect to camera first.');
    }

    // Start the appropriate monitoring based on triggers
    for (const trigger of this.agent.config.triggers) {
      await this.setupTrigger(trigger);
    }

    this.emit('started', { agentId: this.agent.id });
  }

  stop() {
    console.log(`[AgentEngine] Stopping agent: ${this.agent.name}`);
    this.isRunning = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.trackedObjects.clear();
    this.emit('stopped', { agentId: this.agent.id });
  }

  private async setupTrigger(trigger: AgentTrigger) {
    switch (trigger.type) {
      case TriggerType.OBJECT_DETECTED:
        // Use periodic image analysis to detect objects
        this.startObjectDetectionMonitoring(trigger);
        break;
        
      case TriggerType.MOTION_DETECTED:
        // Monitor camera events for motion
        this.startMotionEventMonitoring();
        break;
        
      case TriggerType.SOUND_DETECTED:
        // Monitor audio events
        this.startAudioEventMonitoring();
        break;
        
      case TriggerType.SCHEDULE:
        // Check schedule and activate/deactivate
        this.startScheduleMonitoring();
        break;
    }
  }

  private startObjectDetectionMonitoring(trigger: AgentTrigger) {
    const objectTypes = trigger.config.objectTypes || ['person'];
    const checkInterval = trigger.config.interval || 5000; // Default 5 seconds

    this.monitoringInterval = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        // Rate limit to prevent overwhelming the system
        const now = Date.now();
        if (now - this.lastAnalysisTime < checkInterval) {
          return;
        }
        this.lastAnalysisTime = now;

        // Use MCP to capture and analyze the current frame
        const analysisPrompt = this.buildAnalysisPrompt(objectTypes);
        const result = await visionService.captureAndAnalyze(analysisPrompt);

        if (result.success) {
          // Parse the analysis result
          const detections = this.parseAnalysisResult(result.response || '');
          
          // Check conditions with detected objects
          for (const detection of detections) {
            await this.evaluateConditions(detection, trigger);
          }
        }
      } catch (error) {
        console.error(`[AgentEngine] Error in object detection:`, error);
        this.emitEvent(AgentEventType.ERROR, {
          error: error instanceof Error ? error.message : String(error),
          trigger: trigger.type,
        });
      }
    }, checkInterval);
  }

  private buildAnalysisPrompt(objectTypes: string[]): string {
    // Build a specific prompt for the AI to detect objects and their locations
    const objectList = objectTypes.join(', ');
    return `Analyze this image and report any ${objectList} you see. 
For each detected object, provide:
1. Type of object (${objectList})
2. Approximate location in the image (left/center/right, top/middle/bottom)
3. What they are doing (if applicable)
4. Any notable attributes (clothing color, vehicle type, etc.)

Format your response as a JSON array like:
[{"type": "person", "location": {"x": "center", "y": "middle"}, "action": "walking", "attributes": {"clothing": "blue shirt"}}]

If no objects are detected, return an empty array: []`;
  }

  private parseAnalysisResult(response: string): Detection[] {
    try {
      // Extract JSON from the response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.map((item: any) => ({
        type: item.type,
        location: this.convertLocationToCoordinates(item.location),
        action: item.action,
        attributes: item.attributes || {},
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.error('[AgentEngine] Failed to parse analysis result:', error);
      return [];
    }
  }

  private convertLocationToCoordinates(location: any): Point {
    // Convert descriptive location to approximate coordinates
    const xMap: Record<string, number> = { left: 25, center: 50, right: 75 };
    const yMap: Record<string, number> = { top: 25, middle: 50, bottom: 75 };
    
    return {
      x: xMap[location.x] || 50,
      y: yMap[location.y] || 50,
    };
  }

  private async evaluateConditions(detection: Detection, trigger: AgentTrigger) {
    for (const condition of this.agent.config.conditions) {
      const conditionMet = await this.checkCondition(condition, detection);
      
      if (conditionMet) {
        this.emitEvent(AgentEventType.CONDITION_MET, {
          trigger: trigger.type,
          condition: condition.type,
          detection,
        });

        // Execute actions
        await this.executeActions(detection);
      }
    }
  }

  private async checkCondition(condition: AgentCondition, detection: Detection): Promise<boolean> {
    switch (condition.type) {
      case ConditionType.OBJECT_IN_ZONE:
        return this.checkObjectInZone(detection, condition.config.zoneId);
        
      case ConditionType.LINE_CROSSED:
        return this.checkLineCrossed(detection, condition.config.lineId);
        
      case ConditionType.TIME_IN_ZONE:
        return this.checkTimeInZone(detection, condition.config);
        
      case ConditionType.OBJECT_COUNT:
        return this.checkObjectCount(condition.config);
        
      default:
        return false;
    }
  }

  private checkObjectInZone(detection: Detection, zoneId?: string): boolean {
    // For now, just check if object is detected
    // In a real implementation, we'd have zone definitions
    console.log(`[AgentEngine] Checking object in zone ${zoneId}`, detection);
    return true; // Simplified for now
  }

  private checkLineCrossed(detection: Detection, lineId?: string): boolean {
    // Get tracked object or create new
    const objectId = `${detection.type}-${detection.location.x}-${detection.location.y}`;
    const tracked = this.trackedObjects.get(objectId);
    
    if (!tracked) {
      // First time seeing this object
      this.trackedObjects.set(objectId, {
        id: objectId,
        type: detection.type,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        positions: [detection.location],
      });
      return false;
    }

    // Update tracking
    tracked.lastSeen = Date.now();
    tracked.positions.push(detection.location);

    // Simplified line crossing detection
    console.log(`[AgentEngine] Checking line crossed ${lineId}`, detection);
    
    // Check if object moved significantly
    const lastPos = tracked.positions[tracked.positions.length - 2];
    if (!lastPos) return false;

    const distance = Math.sqrt(
      Math.pow(detection.location.x - lastPos.x, 2) + 
      Math.pow(detection.location.y - lastPos.y, 2)
    );
    
    return distance > 10; // Movement threshold
  }

  private checkTimeInZone(detection: Detection, config: any): boolean {
    const objectId = `${detection.type}-zone-${config.zoneId}`;
    const tracked = this.trackedObjects.get(objectId);
    
    if (!tracked) {
      this.trackedObjects.set(objectId, {
        id: objectId,
        type: detection.type,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        positions: [detection.location],
      });
      return false;
    }

    const timeInZone = (Date.now() - tracked.firstSeen) / 1000; // seconds
    return timeInZone >= (config.seconds || 60);
  }

  private checkObjectCount(config: any): boolean {
    const count = Array.from(this.trackedObjects.values()).filter(
      obj => obj.type === config.objectType && 
             (Date.now() - obj.lastSeen) < 10000 // Active in last 10 seconds
    ).length;

    switch (config.operator) {
      case 'greater_than':
        return count > config.value;
      case 'less_than':
        return count < config.value;
      case 'equals':
        return count === config.value;
      default:
        return false;
    }
  }

  private async executeActions(detection: Detection) {
    for (const action of this.agent.config.actions) {
      try {
        await this.executeAction(action, detection);
        
        this.emitEvent(AgentEventType.ACTION_TAKEN, {
          action: action.type,
          success: true,
          detection,
        });
      } catch (error) {
        console.error(`[AgentEngine] Failed to execute action:`, error);
        
        this.emitEvent(AgentEventType.ERROR, {
          action: action.type,
          error: error instanceof Error ? error.message : String(error),
          detection,
        });
      }
    }
  }

  private async executeAction(action: AgentAction, detection: Detection) {
    switch (action.type) {
      case ActionType.CREATE_ALERT:
        await this.createAlert(action, detection);
        break;
        
      case ActionType.SPEAK:
        await this.speakMessage(action, detection);
        break;
        
      case ActionType.SEND_NOTIFICATION:
        await this.sendNotification(action, detection);
        break;
        
      case ActionType.BOOKMARK:
        await this.createBookmark(action, detection);
        break;
        
      case ActionType.WEBHOOK:
        await this.callWebhook(action, detection);
        break;
        
      case ActionType.TRACK_OBJECT:
        await this.trackObject(action, detection);
        break;
    }
  }

  private async createAlert(action: AgentAction, detection: Detection) {
    // Create alert in the system
    const alert = {
      id: `alert-${Date.now()}`,
      agentId: this.agent.id,
      timestamp: new Date(),
      priority: action.priority,
      title: `${this.agent.name} Alert`,
      message: `Detected ${detection.type} ${detection.action || 'in restricted area'}`,
      data: {
        detection,
        agentName: this.agent.name,
        cameraId: this.agent.cameraId,
      },
    };

    // If includeSnapshot is true, capture current image
    if (action.config.includeSnapshot) {
      const snapshot = await visionService.captureImage();
      if (snapshot.success) {
        (alert.data as any).snapshot = snapshot.response;
      }
    }

    // Emit alert event
    this.emit('alert', alert);
  }

  private async speakMessage(action: AgentAction, detection: Detection) {
    let message = action.config.message || 'Alert: Unauthorized access detected';
    
    // Replace placeholders in message
    message = message
      .replace('{object}', detection.type)
      .replace('{action}', detection.action || 'detected')
      .replace('{location}', `${detection.location.x}, ${detection.location.y}`);

    // Use MCP to speak through camera
    const result = await visionService.speak(message);
    
    if (!result.success) {
      throw new Error(`Failed to speak: ${result.error}`);
    }

    // Repeat if configured
    const repeatCount = action.config.repeat || 1;
    for (let i = 1; i < repeatCount; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second pause
      await visionService.speak(message);
    }
  }

  private async sendNotification(action: AgentAction, detection: Detection) {
    // This would integrate with a real notification service
    const notification = {
      title: action.config.title || `${this.agent.name} Alert`,
      body: action.config.body || `Detected ${detection.type}`,
      priority: action.priority,
      data: {
        agentId: this.agent.id,
        detection,
        timestamp: new Date(),
      },
    };

    // For now, just emit the notification event
    this.emit('notification', notification);
  }

  private async createBookmark(action: AgentAction, detection: Detection) {
    // This would integrate with the camera's recording system
    const bookmark = {
      timestamp: new Date(),
      label: action.config.label || `${this.agent.name} Event`,
      color: action.config.color || 'red',
      data: {
        agentId: this.agent.id,
        detection,
      },
    };

    this.emit('bookmark', bookmark);
  }

  private async callWebhook(action: AgentAction, detection: Detection) {
    if (!action.config.url) {
      throw new Error('Webhook URL not configured');
    }

    const payload = {
      event: 'agent_detection',
      agent: {
        id: this.agent.id,
        name: this.agent.name,
      },
      detection,
      timestamp: new Date().toISOString(),
    };

    // Make HTTP request
    const response = await fetch(action.config.url, {
      method: action.config.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...action.config.headers,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
    }
  }

  private async trackObject(_action: AgentAction, detection: Detection) {
    // This would use PTZ cameras to follow the object
    // For now, we'll just log the tracking request
    console.log(`[AgentEngine] Tracking ${detection.type} at ${detection.location.x}, ${detection.location.y}`);
    
    // Could integrate with PTZ control via MCP if available
    this.emit('track', {
      agentId: this.agent.id,
      detection,
      action: 'start_tracking',
    });
  }

  // Monitoring for motion events
  private async startMotionEventMonitoring() {
    // Poll camera events periodically
    setInterval(async () => {
      if (!this.isRunning) return;

      try {
        const events = await visionService.getEvents(10);
        if (events.success) {
          // Process motion events
          const motionEvents = this.parseMotionEvents(events.response || '');
          for (const event of motionEvents) {
            await this.evaluateConditions(event, {
              id: 'motion-trigger',
              type: TriggerType.MOTION_DETECTED,
              config: {},
            });
          }
        }
      } catch (error) {
        console.error('[AgentEngine] Error monitoring motion:', error);
      }
    }, 5000);
  }

  // Monitoring for audio events
  private async startAudioEventMonitoring() {
    // Would use MCP audio event monitoring
    console.log('[AgentEngine] Audio monitoring not yet implemented');
  }

  // Schedule monitoring
  private startScheduleMonitoring() {
    setInterval(() => {
      const shouldBeActive = this.isWithinSchedule();
      if (shouldBeActive && !this.isRunning) {
        this.start();
      } else if (!shouldBeActive && this.isRunning) {
        this.stop();
      }
    }, 60000); // Check every minute
  }

  private isWithinSchedule(): boolean {
    if (!this.agent.config.schedule) return true;

    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    return this.agent.config.schedule.rules.some(rule => {
      if (!rule.active || !rule.days.includes(currentDay)) {
        return false;
      }

      const [startHour, startMin] = rule.startTime.split(':').map(Number);
      const [endHour, endMin] = rule.endTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      if (startMinutes <= endMinutes) {
        return currentTime >= startMinutes && currentTime <= endMinutes;
      } else {
        return currentTime >= startMinutes || currentTime <= endMinutes;
      }
    });
  }

  private parseMotionEvents(response: string): Detection[] {
    // Parse camera events response
    try {
      const events = JSON.parse(response);
      return events.map(() => ({
        type: 'motion',
        location: { x: 50, y: 50 }, // Would need actual location from event
        action: 'detected',
        timestamp: Date.now(),
      }));
    } catch {
      return [];
    }
  }


  private emitEvent(type: AgentEventType, data: any) {
    const event: AgentEvent = {
      id: `event-${Date.now()}`,
      agentId: this.agent.id,
      timestamp: new Date(),
      type,
      data,
    };

    this.emit('agent:event', event);
  }

}

interface Detection {
  type: string;
  location: Point;
  action?: string;
  attributes?: Record<string, any>;
  timestamp: number;
}

interface TrackedObject {
  id: string;
  type: string;
  firstSeen: number;
  lastSeen: number;
  positions: Point[];
}