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

  biorender: {
    id: 'biorender',
    name: 'BioRender Illustrations',
    description: 'Search and retrieve BioRender scientific illustration assets via remote MCP server',
    transport: 'http',
    url: process.env.BIORENDER_MCP_URL || 'https://mcp.services.biorender.com/mcp',
    env: {
      BIORENDER_OAUTH_CLIENT_ID: process.env.BIORENDER_OAUTH_CLIENT_ID || '',
      BIORENDER_OAUTH_CLIENT_SECRET: process.env.BIORENDER_OAUTH_CLIENT_SECRET || '',
    },
    // Note: BioRender uses OAuth authentication which requires user login flow
    // Full support requires implementing OAuth authorization code flow
    enabled: process.env.ENABLE_BIORENDER === 'true',
    timeout: 45000,
  },

  mermaid: {
    id: 'mermaid',
    name: 'Mermaid Diagramming',
    description: 'Generate process and pathway diagrams using Mermaid syntax',
    transport: 'stdio',
    command: process.env.MERMAID_MCP_COMMAND || 'npx',
    args: process.env.MERMAID_MCP_COMMAND
      ? process.env.MERMAID_MCP_ARGS?.split(' ').filter(Boolean)
      : ['-y', '@modelcontextprotocol/server-mermaid'],
    enabled: process.env.ENABLE_MERMAID === 'true',
    timeout: 40000,
  },

  chatmol: {
    id: 'chatmol',
    name: 'ChatMol Molecular Visualization',
    description: 'Render 3D molecular structures via PyMOL/ChimeraX integration',
    transport: 'http',
    url: process.env.CHATMOL_MCP_URL || 'http://chatmol-mcp:8000',
    env: {
      PYMOL_PATH: process.env.PYMOL_PATH || '',
      CHATMOL_API_KEY: process.env.CHATMOL_API_KEY || '',
    },
    enabled: process.env.ENABLE_CHATMOL === 'true' && !!process.env.PYMOL_PATH,
    timeout: 90000,
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
