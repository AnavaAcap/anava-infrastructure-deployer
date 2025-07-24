import { ChildProcess, exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { app } from 'electron';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { promisify } from 'util';
// import { HealthCheckService } from './healthCheckService';

const execAsync = promisify(exec);

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
  private mcpServerPath: string;
  // private healthChecker: HealthCheckService;
  private isConnecting: boolean = false;
  // private connectionRetries: number = 0;
  // private maxRetries: number = 3;
  private isConnected: boolean = false;

  constructor() {
    // Store connections in app data directory
    const userDataPath = app.getPath('userData');
    this.connectionsPath = path.join(userDataPath, 'vision-connections.json');
    
    // Set up MCP server paths - use bundled version
    this.mcpServerPath = path.join(app.getAppPath(), 'resources', 'mcp-server', 'dist', 'index.js');
    
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

  async checkMCPServerInstalled(): Promise<{ installed: boolean; path?: string }> {
    try {
      // In production, MCP server is bundled with the app
      const bundledPath = path.join(app.getAppPath(), 'resources', 'mcp-server', 'dist', 'index.js');
      
      // In development, check multiple locations
      if (process.env.NODE_ENV === 'development') {
        // Development paths
        const devPaths = [
          bundledPath,
          path.join(__dirname, '../../resources/mcp-server/dist/index.js'),
          path.join(os.homedir(), 'anava-mcp-server', 'dist', 'index.js'),
        ];
        
        for (const p of devPaths) {
          if (fs.existsSync(p)) {
            return { installed: true, path: p };
          }
        }
        
        return { installed: false };
      }
      
      // Production - check bundled location
      if (fs.existsSync(bundledPath)) {
        return { installed: true, path: bundledPath };
      }
      
      return { installed: false };
    } catch (error) {
      console.error('Error checking MCP server installation:', error);
      return { installed: false };
    }
  }

  async installMCPServer(): Promise<{ success: boolean; error?: string }> {
    // In production, MCP server is bundled - no installation needed
    const checkResult = await this.checkMCPServerInstalled();
    
    if (checkResult.installed) {
      return { success: true };
    }
    
    // In development, we might need to bundle it first
    if (process.env.NODE_ENV === 'development') {
      try {
        console.log('Running MCP server bundling script...');
        const { stdout, stderr } = await execAsync(
          'node scripts/bundle-mcp-server.js',
          { cwd: app.getAppPath() }
        );
        
        console.log('Bundle output:', stdout);
        if (stderr) console.error('Bundle warnings:', stderr);
        
        // Check again after bundling
        const recheckResult = await this.checkMCPServerInstalled();
        if (recheckResult.installed) {
          return { success: true };
        }
      } catch (error: any) {
        console.error('Failed to bundle MCP server:', error);
      }
    }
    
    return { 
      success: false, 
      error: 'MCP server is not available. Please ensure the application was built correctly.' 
    };
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

      // Create MCP client transport (this will spawn the process)
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
      console.log('Connecting MCP client to server...');
      await this.mcpClient.connect(transport);
      console.log('MCP client connected successfully');

      // Wait for the server to be ready
      console.log('Waiting for MCP server to be ready...');
      this.isConnected = true; // Set this before waiting so waitForServerReady can check
      await this.waitForServerReady();
      console.log('MCP server is ready!');

      this.isConnecting = false;
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
    this.isConnected = false;
    this.isConnecting = false;
    
    if (this.mcpClient) {
      try {
        this.mcpClient.close();
      } catch (error) {
        console.error('Error closing MCP client:', error);
      }
      this.mcpClient = null;
    }

    // The process is managed by StdioClientTransport, so we don't need to kill it
    this.mcpProcess = null;
  }

  private async findMCPServerPath(): Promise<string | null> {
    // Try multiple possible locations
    const possiblePaths = [
      // Bundled with the app (primary location for production)
      path.join(app.getAppPath(), 'resources', 'mcp-server', 'dist', 'index.js'),
      // Development bundled location
      path.join(__dirname, '../../resources/mcp-server/dist/index.js'),
      // Local development path
      path.join(os.homedir(), 'anava-mcp-server', 'dist', 'index.js'),
      // Installed MCP server path
      this.mcpServerPath,
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return null;
  }

  private async waitForServerReady(timeout: number = 10000): Promise<void> {
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