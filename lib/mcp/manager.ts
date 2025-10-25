/**
 * MCP Connection Manager
 *
 * Manages all MCP server connections and provides a unified interface
 * for tool calls across multiple servers.
 */

import { MCPClient } from './client';
import { getEnabledServers, getServerConfig } from './config';
import {
  MCPServerConfig,
  MCPServerState,
  MCPToolCallRequest,
  MCPToolCallResponse,
  MCPTool,
} from '@/types/mcp';
import { logger } from '@/lib/utils/logger';

/**
 * Singleton MCP Connection Manager
 */
class MCPConnectionManager {
  private clients: Map<string, MCPClient> = new Map();
  private initialized: boolean = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize all enabled MCP servers
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.info('MCP Connection Manager already initialized');
      return;
    }

    logger.info('Initializing MCP Connection Manager...');

    const enabledServers = getEnabledServers();
    logger.info(`Found ${enabledServers.length} enabled MCP servers`);

    // Connect to all enabled servers in parallel
    const connectionPromises = enabledServers.map((config) => this.connectServer(config));

    const results = await Promise.allSettled(connectionPromises);

    // Log results
    results.forEach((result, index) => {
      const config = enabledServers[index];
      if (result.status === 'fulfilled') {
        logger.info(`✓ ${config.name} connected successfully`);
      } else {
        logger.error(`✗ ${config.name} failed to connect: ${result.reason}`);
      }
    });

    this.initialized = true;

    // Start health check interval (every 5 minutes)
    this.startHealthChecks();

    logger.info('MCP Connection Manager initialized');
  }

  /**
   * Connect to a single server
   */
  private async connectServer(config: MCPServerConfig): Promise<void> {
    const client = new MCPClient(config);

    try {
      await client.connect();
      this.clients.set(config.id, client);
    } catch (error) {
      logger.error(`Failed to connect to ${config.name}:`, error);
      // Still add the client so we can track its error state
      this.clients.set(config.id, client);
      throw error;
    }
  }

  /**
   * Call a tool on a specific server
   */
  async callTool(request: MCPToolCallRequest): Promise<MCPToolCallResponse> {
    const client = this.clients.get(request.serverId);

    if (!client) {
      return {
        success: false,
        content: [],
        error: `Server ${request.serverId} not found`,
        isError: true,
      };
    }

    if (client.getStatus() !== 'connected') {
      // Try to reconnect
      const config = getServerConfig(request.serverId);
      if (config) {
        try {
          await client.connect();
        } catch (error) {
          return {
            success: false,
            content: [],
            error: `Server ${request.serverId} is not connected: ${client.getError()}`,
            isError: true,
          };
        }
      }
    }

    return await client.callTool(request.toolName, request.arguments);
  }

  /**
   * Get all available tools from all connected servers
   */
  getAllTools(): Map<string, MCPTool[]> {
    const toolsByServer = new Map<string, MCPTool[]>();

    for (const [serverId, client] of this.clients.entries()) {
      if (client.getStatus() === 'connected') {
        toolsByServer.set(serverId, client.getTools());
      }
    }

    return toolsByServer;
  }

  /**
   * Get tools from a specific server
   */
  getServerTools(serverId: string): MCPTool[] {
    const client = this.clients.get(serverId);
    return client ? client.getTools() : [];
  }

  /**
   * Get status of all servers
   */
  getServerStates(): Map<string, MCPServerState> {
    const states = new Map<string, MCPServerState>();

    for (const [serverId, client] of this.clients.entries()) {
      const config = getServerConfig(serverId);
      if (config) {
        states.set(serverId, {
          config,
          status: client.getStatus(),
          error: client.getError() || undefined,
        });
      }
    }

    return states;
  }

  /**
   * Get state of a specific server
   */
  getServerState(serverId: string): MCPServerState | null {
    const client = this.clients.get(serverId);
    const config = getServerConfig(serverId);

    if (!client || !config) {
      return null;
    }

    return {
      config,
      status: client.getStatus(),
      error: client.getError() || undefined,
    };
  }

  /**
   * Check if a server is connected
   */
  isServerConnected(serverId: string): boolean {
    const client = this.clients.get(serverId);
    return client ? client.getStatus() === 'connected' : false;
  }

  /**
   * Disconnect a specific server
   */
  async disconnectServer(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (client) {
      await client.disconnect();
      logger.info(`Disconnected server: ${serverId}`);
    }
  }

  /**
   * Reconnect a specific server
   */
  async reconnectServer(serverId: string): Promise<void> {
    const config = getServerConfig(serverId);
    if (!config) {
      throw new Error(`Server config not found: ${serverId}`);
    }

    // Disconnect existing client if any
    await this.disconnectServer(serverId);

    // Create and connect new client
    await this.connectServer(config);
  }

  /**
   * Disconnect all servers
   */
  async disconnectAll(): Promise<void> {
    logger.info('Disconnecting all MCP servers...');

    const disconnectPromises = Array.from(this.clients.values()).map((client) =>
      client.disconnect()
    );

    await Promise.allSettled(disconnectPromises);

    this.clients.clear();
    this.initialized = false;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    logger.info('All MCP servers disconnected');
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    if (this.healthCheckInterval) {
      return;
    }

    // Health check every 5 minutes
    this.healthCheckInterval = setInterval(
      async () => {
        logger.debug('Running MCP health checks...');

        for (const [serverId, client] of this.clients.entries()) {
          if (client.getStatus() === 'connected') {
            const healthy = await client.healthCheck();
            if (!healthy) {
              logger.warn(`Server ${serverId} failed health check, attempting reconnect...`);
              try {
                await this.reconnectServer(serverId);
              } catch (error) {
                logger.error(`Failed to reconnect ${serverId}:`, error);
              }
            }
          }
        }
      },
      5 * 60 * 1000
    ); // 5 minutes
  }

  /**
   * Get the number of connected servers
   */
  getConnectedCount(): number {
    return Array.from(this.clients.values()).filter(
      (client) => client.getStatus() === 'connected'
    ).length;
  }
}

// Export singleton instance
export const mcpManager = new MCPConnectionManager();
