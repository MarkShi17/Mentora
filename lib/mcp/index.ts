/**
 * MCP Module Exports
 *
 * Central export point for all MCP-related functionality.
 */

export { MCPClient } from './client';
export { mcpManager } from './manager';
export {
  MCP_SERVERS,
  getServerConfig,
  getEnabledServers,
  validateServerConfig,
} from './config';

// Re-export types
export type {
  MCPTransportType,
  MCPServerConfig,
  MCPServerStatus,
  MCPServerState,
  MCPTool,
  MCPToolCallRequest,
  MCPToolCallResponse,
  MCPResource,
  SequentialThinkingInput,
  ManimAnimationInput,
  PythonExecutionInput,
  GitHubToolInput,
  FigmaToolInput,
  MCPServerRegistry,
  MCPServerId,
} from '@/types/mcp';

export { MCP_SERVER_IDS } from '@/types/mcp';
