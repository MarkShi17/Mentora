/**
 * MCP Client Implementation
 *
 * Handles connections to MCP servers via stdio and HTTP transports.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  MCPServerConfig,
  MCPServerStatus,
  MCPToolCallResponse,
  MCPTool,
} from '@/types/mcp';
import { logger } from '@/lib/utils/logger';

/**
 * MCP Client wrapper for a single server
 */
export class MCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private status: MCPServerStatus = 'disconnected';
  private availableTools: MCPTool[] = [];
  private connectionError: string | null = null;

  constructor(private config: MCPServerConfig) {}

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this.status === 'connected') {
      logger.info(`MCP server ${this.config.id} already connected`);
      return;
    }

    try {
      this.status = 'connecting';
      logger.info(`Connecting to MCP server: ${this.config.name}`);

      if (this.config.transport === 'stdio') {
        await this.connectStdio();
      } else if (this.config.transport === 'http') {
        await this.connectHttp();
      } else {
        throw new Error(`Unsupported transport: ${this.config.transport}`);
      }

      // Fetch available tools
      await this.loadTools();

      this.status = 'connected';
      this.connectionError = null;
      logger.info(`Successfully connected to ${this.config.name}`);
    } catch (error) {
      this.status = 'error';
      this.connectionError = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to connect to ${this.config.name}: ${this.connectionError}`);
      throw error;
    }
  }

  /**
   * Connect via stdio transport
   */
  private async connectStdio(): Promise<void> {
    if (!this.config.command) {
      throw new Error('Command is required for stdio transport');
    }

    this.transport = new StdioClientTransport({
      command: this.config.command,
      args: this.config.args || [],
      env: {
        ...(process.env as Record<string, string>),
        ...(this.config.env || {}),
      },
    });

    this.client = new Client(
      {
        name: 'mentora-client',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
          resources: {},
        },
      }
    );

    await this.client.connect(this.transport);
  }

  /**
   * Connect via HTTP transport
   */
  private async connectHttp(): Promise<void> {
    // HTTP transport implementation - placeholder for now
    // Will implement when HTTP MCP servers are set up
    throw new Error('HTTP transport not yet implemented');
  }

  /**
   * Load available tools from the server
   */
  private async loadTools(): Promise<void> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    try {
      const response = await this.client.listTools();
      this.availableTools = response.tools.map((tool) => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema as any,
      }));

      logger.info(
        `Loaded ${this.availableTools.length} tools from ${this.config.name}: ${this.availableTools.map((t) => t.name).join(', ')}`
      );
    } catch (error) {
      logger.warn(`Failed to load tools from ${this.config.name}: ${error}`);
      this.availableTools = [];
    }
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(toolName: string, args: Record<string, any>): Promise<MCPToolCallResponse> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    if (this.status !== 'connected') {
      throw new Error(`Server ${this.config.id} is not connected (status: ${this.status})`);
    }

    try {
      logger.debug(`Calling tool ${toolName} on ${this.config.name} with args:`, args);

      const response = await this.client.callTool({
        name: toolName,
        arguments: args,
      });

      // Check if the response indicates an error
      const isError = response.isError ?? false;

      return {
        success: !isError,
        content: Array.isArray(response.content)
          ? response.content.map((item: any) => ({
              type: item.type as 'text' | 'image' | 'resource',
              text: 'text' in item ? item.text : undefined,
              data: 'data' in item ? item.data : undefined,
              mimeType: 'mimeType' in item ? item.mimeType : undefined,
            }))
          : [],
        isError,
      };
    } catch (error) {
      logger.error(`Tool call failed for ${toolName} on ${this.config.name}:`, error);

      return {
        success: false,
        content: [],
        error: error instanceof Error ? error.message : String(error),
        isError: true,
      };
    }
  }

  /**
   * Get available tools
   */
  getTools(): MCPTool[] {
    return this.availableTools;
  }

  /**
   * Get server status
   */
  getStatus(): MCPServerStatus {
    return this.status;
  }

  /**
   * Get connection error if any
   */
  getError(): string | null {
    return this.connectionError;
  }

  /**
   * Disconnect from the server
   */
  async disconnect(): Promise<void> {
    if (this.client && this.status === 'connected') {
      try {
        await this.client.close();
        logger.info(`Disconnected from ${this.config.name}`);
      } catch (error) {
        logger.error(`Error disconnecting from ${this.config.name}:`, error);
      }
    }

    this.client = null;
    this.transport = null;
    this.status = 'disconnected';
    this.availableTools = [];
  }

  /**
   * Health check - verify connection is still alive
   */
  async healthCheck(): Promise<boolean> {
    if (this.status !== 'connected' || !this.client) {
      return false;
    }

    try {
      // Try to list tools as a simple health check
      await this.client.listTools();
      return true;
    } catch (error) {
      logger.warn(`Health check failed for ${this.config.name}:`, error);
      this.status = 'error';
      this.connectionError = 'Health check failed';
      return false;
    }
  }
}
