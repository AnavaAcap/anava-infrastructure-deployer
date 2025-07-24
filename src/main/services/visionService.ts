import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { app } from 'electron';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
// import { HealthCheckService } from './healthCheckService';

interface CameraConnection {
  id: string;
  name: string;
  host: string;
  username: string;
  password: string;
  port?: number;
  secure?: boolean;
  isDefault?: boolean;
  lastUsed?: Date;
}

interface MCPServerConfig {
  host: string;
  username: string;
  password: string;
  port?: number;
  secure?: boolean;
  elevenLabsApiKey?: string;
  googleApiKey?: string;
  voiceId?: string;
}

class VisionService {
  private mcpProcess: ChildProcess | null = null;
  private mcpClient: Client | null = null;
  private connectionsPath: string;
  // private healthChecker: HealthCheckService;
  private isConnecting: boolean = false;
  // private connectionRetries: number = 0;
  // private maxRetries: number = 3;
  private isConnected: boolean = false;

  constructor() {
    // Store connections in app data directory
    const userDataPath = app.getPath('userData');
    this.connectionsPath = path.join(userDataPath, 'vision-connections.json');
    // this.healthChecker = new HealthCheckService();
    
    // Ensure connections file exists
    this.ensureConnectionsFile();
  }

  private ensureConnectionsFile() {
    if (!fs.existsSync(this.connectionsPath)) {
      fs.writeFileSync(this.connectionsPath, JSON.stringify([], null, 2));
    }
  }

  async loadConnections(): Promise<CameraConnection[]> {
    try {
      const data = fs.readFileSync(this.connectionsPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to load connections:', error);
      return [];
    }
  }

  async saveConnections(connections: CameraConnection[]): Promise<void> {
    try {
      fs.writeFileSync(this.connectionsPath, JSON.stringify(connections, null, 2));
    } catch (error) {
      console.error('Failed to save connections:', error);
      throw error;
    }
  }

  async startMCPServer(config: MCPServerConfig): Promise<{ success: boolean; error?: string }> {
    if (this.isConnecting) {
      return { success: false, error: 'Connection already in progress' };
    }

    if (this.mcpProcess) {
      return { success: false, error: 'MCP server is already running' };
    }

    this.isConnecting = true;
    // this.connectionRetries = 0;

    try {
      // Find the MCP server executable
      const mcpServerPath = await this.findMCPServerPath();
      if (!mcpServerPath) {
        throw new Error('MCP server not found. Please ensure @anava/mcp-server is installed.');
      }

      console.log('Starting MCP server at:', mcpServerPath);

      // Prepare environment variables
      const env: any = {
        ...process.env,
        ANAVA_HOST: config.host,
        ANAVA_USERNAME: config.username,
        ANAVA_PASSWORD: config.password,
        ANAVA_PORT: String(config.port || 443),
        ANAVA_SECURE: String(config.secure !== false),
        ANAVA_TIMEOUT: '30000',
        NODE_ENV: 'production',
      };

      // Add optional API keys if provided
      if (config.elevenLabsApiKey) {
        env.ELEVENLABS_API_KEY = config.elevenLabsApiKey;
      }
      if (config.googleApiKey) {
        env.GOOGLE_API_KEY = config.googleApiKey;
        env.GEMINI_API_KEY = config.googleApiKey;
      }
      if (config.voiceId) {
        env.DEFAULT_VOICE_ID = config.voiceId;
      }

      // Spawn the MCP server process
      this.mcpProcess = spawn('node', [mcpServerPath], {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Set up process event handlers
      this.mcpProcess.on('error', (error) => {
        console.error('MCP server process error:', error);
        this.cleanup();
      });

      this.mcpProcess.on('exit', (code, signal) => {
        console.log(`MCP server exited with code ${code} and signal ${signal}`);
        this.cleanup();
      });

      // Create MCP client
      const transport = new StdioClientTransport({
        command: 'node',
        args: [mcpServerPath],
        env,
      });

      this.mcpClient = new Client({
        name: 'anava-vision-electron',
        version: '1.0.0',
      }, {
        capabilities: {
          tools: {},
          prompts: {},
          resources: {},
        },
      });

      // Connect the client
      await this.mcpClient.connect(transport);

      // Wait for the server to be ready
      await this.waitForServerReady();

      this.isConnecting = false;
      this.isConnected = true;
      return { success: true };
    } catch (error: any) {
      console.error('Failed to start MCP server:', error);
      this.isConnecting = false;
      this.cleanup();
      return { success: false, error: error.message };
    }
  }

  async stopMCPServer(): Promise<void> {
    this.isConnected = false;
    this.cleanup();
  }

  private cleanup() {
    if (this.mcpClient) {
      try {
        this.mcpClient.close();
      } catch (error) {
        console.error('Error closing MCP client:', error);
      }
      this.mcpClient = null;
    }

    if (this.mcpProcess) {
      try {
        this.mcpProcess.kill('SIGTERM');
      } catch (error) {
        console.error('Error killing MCP process:', error);
      }
      this.mcpProcess = null;
    }
  }

  private async findMCPServerPath(): Promise<string | null> {
    // Try multiple possible locations
    const possiblePaths = [
      // Local node_modules in the app
      path.join(app.getAppPath(), 'node_modules', '@anava', 'mcp-server', 'dist', 'index.js'),
      // Global npm installation
      path.join(os.homedir(), '.npm', 'node_modules', '@anava', 'mcp-server', 'dist', 'index.js'),
      // Local development path
      path.join(os.homedir(), 'anava-mcp-server', 'dist', 'index.js'),
      // Bundled with the app
      path.join(app.getAppPath(), 'resources', 'mcp-server', 'dist', 'index.js'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return null;
  }

  private async waitForServerReady(timeout: number = 5000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (this.mcpClient && this.isConnected) {
        // Try to list tools to verify the server is responsive
        try {
          const tools = await this.mcpClient.listTools();
          if (tools && tools.tools.length > 0) {
            console.log('MCP server is ready with tools:', tools.tools.map(t => t.name));
            return;
          }
        } catch (error) {
          // Server not ready yet
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error('MCP server failed to become ready within timeout');
  }

  async captureImage(): Promise<{ success: boolean; response?: string; error?: string }> {
    if (!this.mcpClient || !this.isConnected) {
      return { success: false, error: 'MCP server not connected' };
    }

    try {
      const result = await this.mcpClient.callTool({ name: 'anava_capture_image', arguments: {} });
      return { success: true, response: JSON.stringify(result, null, 2) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async captureAndAnalyze(prompt?: string): Promise<{ success: boolean; response?: string; error?: string }> {
    if (!this.mcpClient || !this.isConnected) {
      return { success: false, error: 'MCP server not connected' };
    }

    try {
      const result = await this.mcpClient.callTool({ 
        name: 'anava_capture_analyze', 
        arguments: {
          prompt: prompt || 'What do you see in this image?'
        }
      });
      return { success: true, response: JSON.stringify(result, null, 2) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async speak(text: string): Promise<{ success: boolean; response?: string; error?: string }> {
    if (!this.mcpClient || !this.isConnected) {
      return { success: false, error: 'MCP server not connected' };
    }

    try {
      const result = await this.mcpClient.callTool({ name: 'anava_speak', arguments: { text } });
      return { success: true, response: JSON.stringify(result, null, 2) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getEvents(limit?: number): Promise<{ success: boolean; response?: string; error?: string }> {
    if (!this.mcpClient || !this.isConnected) {
      return { success: false, error: 'MCP server not connected' };
    }

    try {
      const result = await this.mcpClient.callTool({ 
        name: 'anava_get_events', 
        arguments: {
          limit: limit || 10
        }
      });
      return { success: true, response: JSON.stringify(result, null, 2) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async sendCommand(command: string): Promise<{ success: boolean; response?: string; error?: string }> {
    if (!this.mcpClient || !this.isConnected) {
      return { success: false, error: 'MCP server not connected' };
    }

    try {
      // Parse the command and determine which tool to call
      const lowerCommand = command.toLowerCase();
      
      if (lowerCommand.includes('holy_grail')) {
        // Extract the specific holy grail command
        const match = command.match(/holy_grail_(\w+)/);
        if (match) {
          const toolName = `holy_grail_${match[1]}`;
          const result = await this.mcpClient.callTool({ name: toolName, arguments: {} });
          return { success: true, response: JSON.stringify(result, null, 2) };
        }
      }

      // Default: try to call the command as a tool name
      const result = await this.mcpClient.callTool({ name: command, arguments: {} });
      return { success: true, response: JSON.stringify(result, null, 2) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  getServerStatus(): 'stopped' | 'starting' | 'running' | 'error' {
    if (this.isConnecting) return 'starting';
    if (this.mcpClient && this.isConnected) return 'running';
    if (this.mcpProcess) return 'error';
    return 'stopped';
  }
}

export const visionService = new VisionService();