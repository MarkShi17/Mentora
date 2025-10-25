/**
 * MCP Server Configuration
 *
 * Defines all MCP server connections for the Mentora platform.
 */

import { MCPServerConfig, MCPServerRegistry } from '@/types/mcp';

/**
 * Default MCP server configurations
 */
export const MCP_SERVERS: MCPServerRegistry = {
  'sequential-thinking': {
    id: 'sequential-thinking',
    name: 'Sequential Thinking',
    description: 'Structured step-by-step problem solving and analysis',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    enabled: true,
    timeout: 30000, // 30 seconds
  },

  manim: {
    id: 'manim',
    name: 'Manim Animation',
    description: 'Mathematical animation generation using Manim',
    transport: 'http',
    url: process.env.MANIM_MCP_URL || 'http://manim-mcp:8000',
    enabled: process.env.ENABLE_MANIM === 'true',
    timeout: 120000, // 2 minutes for animation rendering
  },

  python: {
    id: 'python',
    name: 'Python Execution',
    description: 'Execute Python code for diagrams and visualizations',
    transport: 'http',
    url: process.env.PYTHON_MCP_URL || 'http://python-mcp:8000',
    enabled: process.env.ENABLE_PYTHON === 'true',
    timeout: 60000, // 1 minute
  },

  github: {
    id: 'github',
    name: 'GitHub Integration',
    description: 'Search code, files, and repositories on GitHub',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: {
      GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN || '',
    },
    enabled: !!process.env.GITHUB_TOKEN,
    timeout: 30000,
  },

  figma: {
    id: 'figma',
    name: 'Figma Integration',
    description: 'Access Figma designs and components',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-figma'],
    env: {
      FIGMA_PERSONAL_ACCESS_TOKEN: process.env.FIGMA_TOKEN || '',
    },
    enabled: !!process.env.FIGMA_TOKEN,
    timeout: 30000,
  },
};

/**
 * Get server configuration by ID
 */
export function getServerConfig(serverId: string): MCPServerConfig | undefined {
  return MCP_SERVERS[serverId as keyof MCPServerRegistry];
}

/**
 * Get all enabled server configurations
 */
export function getEnabledServers(): MCPServerConfig[] {
  return Object.values(MCP_SERVERS).filter((server) => server.enabled);
}

/**
 * Validate server configuration
 */
export function validateServerConfig(config: MCPServerConfig): string[] {
  const errors: string[] = [];

  if (!config.id) {
    errors.push('Server ID is required');
  }

  if (!config.name) {
    errors.push('Server name is required');
  }

  if (!config.transport) {
    errors.push('Transport type is required');
  }

  if (config.transport === 'stdio') {
    if (!config.command) {
      errors.push('Command is required for stdio transport');
    }
  } else if (config.transport === 'http') {
    if (!config.url) {
      errors.push('URL is required for http transport');
    }
  } else {
    errors.push(`Invalid transport type: ${config.transport}`);
  }

  return errors;
}
