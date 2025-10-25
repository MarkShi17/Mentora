/**
 * MCP (Model Context Protocol) Type Definitions
 *
 * Types for MCP client connections, server configurations, and tool interactions.
 */

/**
 * Transport type for MCP connection
 */
export type MCPTransportType = 'stdio' | 'http';

/**
 * MCP Server Configuration
 */
export interface MCPServerConfig {
  /** Unique identifier for the server */
  id: string;
  /** Human-readable name */
  name: string;
  /** Server description */
  description: string;
  /** Transport protocol */
  transport: MCPTransportType;
  /** Command to execute (for stdio) */
  command?: string;
  /** Arguments for command (for stdio) */
  args?: string[];
  /** HTTP URL (for http transport) */
  url?: string;
  /** Environment variables to pass */
  env?: Record<string, string>;
  /** Whether server is enabled */
  enabled: boolean;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * MCP Server Status
 */
export type MCPServerStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * MCP Server State
 */
export interface MCPServerState {
  config: MCPServerConfig;
  status: MCPServerStatus;
  error?: string;
  connectedAt?: Date;
  lastUsedAt?: Date;
}

/**
 * MCP Tool Definition
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * MCP Tool Call Request
 */
export interface MCPToolCallRequest {
  serverId: string;
  toolName: string;
  arguments: Record<string, any>;
}

/**
 * MCP Tool Call Response
 */
export interface MCPToolCallResponse {
  success: boolean;
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
    uri?: string;
  }>;
  error?: string;
  isError?: boolean;
}

/**
 * MCP Resource
 */
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * Sequential Thinking Tool Input
 */
export interface SequentialThinkingInput {
  thought: string;
  nextThoughtNeeded: boolean;
  thoughtNumber: number;
  totalThoughts: number;
  isRevision?: boolean;
  revisesThought?: number;
  branchFromThought?: number;
}

/**
 * Manim Animation Tool Input
 */
export interface ManimAnimationInput {
  code: string;
  scene_name?: string;
  quality?: 'low' | 'medium' | 'high' | 'production';
  format?: 'mp4' | 'gif' | 'webm';
  transparent?: boolean;
}

/**
 * Python Execution Tool Input
 */
export interface PythonExecutionInput {
  code: string;
  packages?: string[];
  timeout?: number;
}

/**
 * GitHub Tool Input
 */
export interface GitHubToolInput {
  action: 'search_code' | 'get_file' | 'create_issue' | 'search_repos';
  query?: string;
  owner?: string;
  repo?: string;
  path?: string;
}

/**
 * Figma Tool Input
 */
export interface FigmaToolInput {
  action: 'get_file' | 'get_components' | 'get_styles' | 'export_node';
  file_key: string;
  node_id?: string;
  format?: 'svg' | 'png' | 'jpg';
}

/**
 * MCP Server Registry
 */
export interface MCPServerRegistry {
  'sequential-thinking': MCPServerConfig;
  'manim': MCPServerConfig;
  'python': MCPServerConfig;
  'github': MCPServerConfig;
  'figma': MCPServerConfig;
}

/**
 * Predefined server IDs
 */
export const MCP_SERVER_IDS = {
  SEQUENTIAL_THINKING: 'sequential-thinking',
  MANIM: 'manim',
  PYTHON: 'python',
  GITHUB: 'github',
  FIGMA: 'figma',
} as const;

export type MCPServerId = typeof MCP_SERVER_IDS[keyof typeof MCP_SERVER_IDS];
