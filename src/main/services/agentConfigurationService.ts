import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { 
  VisionAgent, 
  AgentStatus, 
  AgentDeploymentResult,
  AgentListResponse,
  AgentEvent,
  AgentEventType,
} from '../../types/visionAgent';
import { EventEmitter } from 'events';
import { AgentExecutionEngine } from './agentExecutionEngine';

class AgentConfigurationService extends EventEmitter {
  private agentsPath: string;
  private agents: Map<string, VisionAgent>;
  private agentExecutors: Map<string, AgentExecutionEngine>;
  private agentEvents: Map<string, AgentEvent[]>;

  constructor() {
    super();
    
    // Store agents in app data directory
    const userDataPath = app.getPath('userData');
    this.agentsPath = path.join(userDataPath, 'vision-agents.json');
    this.agents = new Map();
    this.agentExecutors = new Map();
    this.agentEvents = new Map();
    
    // Load existing agents
    this.loadAgents();
  }


  private loadAgents() {
    try {
      if (fs.existsSync(this.agentsPath)) {
        const data = fs.readFileSync(this.agentsPath, 'utf-8');
        const agentsArray: VisionAgent[] = JSON.parse(data);
        
        agentsArray.forEach(agent => {
          // Convert date strings back to Date objects
          agent.created = new Date(agent.created);
          agent.lastModified = new Date(agent.lastModified);
          if (agent.lastActive) {
            agent.lastActive = new Date(agent.lastActive);
          }
          
          this.agents.set(agent.id, agent);
          
          // Auto-deploy active agents
          if (agent.status === AgentStatus.ACTIVE) {
            this.deployAgent(agent.id).catch(err => {
              console.error(`Failed to auto-deploy agent ${agent.id}:`, err);
            });
          }
        });
      }
    } catch (error) {
      console.error('Failed to load agents:', error);
    }
  }

  private saveAgents() {
    try {
      const agentsArray = Array.from(this.agents.values());
      fs.writeFileSync(this.agentsPath, JSON.stringify(agentsArray, null, 2));
    } catch (error) {
      console.error('Failed to save agents:', error);
    }
  }

  async createAgent(agent: VisionAgent): Promise<AgentDeploymentResult> {
    try {
      // Validate agent configuration
      if (!agent.cameraId) {
        throw new Error('Camera ID is required');
      }

      if (!agent.config.triggers || agent.config.triggers.length === 0) {
        throw new Error('At least one trigger is required');
      }

      if (!agent.config.actions || agent.config.actions.length === 0) {
        throw new Error('At least one action is required');
      }

      // Save agent
      this.agents.set(agent.id, agent);
      this.saveAgents();

      // Deploy if active
      if (agent.status === AgentStatus.ACTIVE) {
        return this.deployAgent(agent.id);
      }

      return {
        success: true,
        agentId: agent.id,
        message: 'Agent created successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        agentId: agent.id,
        message: error.message,
      };
    }
  }

  async deployAgent(agentId: string): Promise<AgentDeploymentResult> {
    try {
      const agent = this.agents.get(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      // Stop existing executor if any
      if (this.agentExecutors.has(agentId)) {
        this.agentExecutors.get(agentId)!.stop();
      }

      // Create and start new executor
      const executor = new AgentExecutionEngine(agent);
      
      // Listen to executor events
      executor.on('agent:event', (event) => {
        this.emitAgentEvent(event);
      });
      
      executor.on('alert', (alert) => {
        this.emitAgentEvent({
          id: `event-${Date.now()}`,
          agentId,
          timestamp: new Date(),
          type: AgentEventType.ACTION_TAKEN,
          data: { action: 'alert', alert },
        });
      });
      
      await executor.start();
      this.agentExecutors.set(agentId, executor);

      // Update agent status
      agent.status = AgentStatus.ACTIVE;
      agent.lastActive = new Date();
      this.saveAgents();

      // Emit deployment event
      this.emitAgentEvent({
        id: `event-${Date.now()}`,
        agentId,
        timestamp: new Date(),
        type: AgentEventType.ACTIVATED,
        data: {
          message: 'Agent deployed successfully',
        },
      });

      return {
        success: true,
        agentId,
        message: 'Agent deployed successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        agentId,
        message: error.message,
      };
    }
  }

  async pauseAgent(agentId: string): Promise<AgentDeploymentResult> {
    try {
      const agent = this.agents.get(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      const executor = this.agentExecutors.get(agentId);
      if (executor) {
        executor.stop();
        this.agentExecutors.delete(agentId);
      }

      agent.status = AgentStatus.PAUSED;
      this.saveAgents();

      return {
        success: true,
        agentId,
        message: 'Agent paused',
      };
    } catch (error: any) {
      return {
        success: false,
        agentId,
        message: error.message,
      };
    }
  }

  async resumeAgent(agentId: string): Promise<AgentDeploymentResult> {
    return this.deployAgent(agentId);
  }

  async listAgents(page: number = 1, pageSize: number = 10): Promise<AgentListResponse> {
    const allAgents = Array.from(this.agents.values());
    const total = allAgents.length;
    const start = (page - 1) * pageSize;
    const agents = allAgents.slice(start, start + pageSize);

    return {
      agents,
      total,
      page,
      pageSize,
    };
  }

  async getAgent(agentId: string): Promise<VisionAgent | null> {
    return this.agents.get(agentId) || null;
  }

  async updateAgent(agentId: string, updates: Partial<VisionAgent>): Promise<AgentDeploymentResult> {
    try {
      const agent = this.agents.get(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      // Update agent
      Object.assign(agent, updates, {
        lastModified: new Date(),
      });

      this.saveAgents();

      // Redeploy if active
      if (agent.status === AgentStatus.ACTIVE) {
        return this.deployAgent(agentId);
      }

      return {
        success: true,
        agentId,
        message: 'Agent updated successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        agentId,
        message: error.message,
      };
    }
  }

  async deleteAgent(agentId: string): Promise<AgentDeploymentResult> {
    try {
      // Stop executor if running
      const executor = this.agentExecutors.get(agentId);
      if (executor) {
        executor.stop();
        this.agentExecutors.delete(agentId);
      }

      // Delete agent
      this.agents.delete(agentId);
      this.saveAgents();

      return {
        success: true,
        agentId,
        message: 'Agent deleted successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        agentId,
        message: error.message,
      };
    }
  }

  async getAgentEvents(agentId: string, limit: number = 50): Promise<AgentEvent[]> {
    const events = this.agentEvents.get(agentId) || [];
    return events.slice(-limit); // Return last N events
  }

  emitAgentEvent(event: AgentEvent) {
    // Store event
    const events = this.agentEvents.get(event.agentId) || [];
    events.push(event);
    
    // Keep only last 1000 events per agent
    if (events.length > 1000) {
      events.splice(0, events.length - 1000);
    }
    
    this.agentEvents.set(event.agentId, events);
    
    // Emit to listeners
    this.emit('agent:event', event);
    
    // Send to renderer
    const windows = require('electron').BrowserWindow.getAllWindows();
    windows.forEach((window: any) => {
      window.webContents.send('agent:event', event);
    });
  }
}


export const agentConfigurationService = new AgentConfigurationService();