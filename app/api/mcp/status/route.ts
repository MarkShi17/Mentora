/**
 * GET /api/mcp/status
 *
 * Get status of all MCP servers and available tools.
 */

import { NextResponse } from 'next/server';
import { mcpManager } from '@/lib/mcp';
import { initializeMCP } from '@/lib/mcp/init';
import { logger } from '@/lib/utils/logger';

export async function GET() {
  try {
    // Ensure MCP is initialized
    await initializeMCP();

    const states = mcpManager.getServerStates();
    const allTools = mcpManager.getAllTools();

    // Convert Maps to objects for JSON serialization
    const serversArray = Array.from(states.entries()).map(([serverId, state]) => ({
      id: serverId,
      name: state.config.name,
      description: state.config.description,
      status: state.status,
      transport: state.config.transport,
      enabled: state.config.enabled,
      error: state.error,
      tools: allTools.get(serverId) || [],
    }));

    const connectedCount = mcpManager.getConnectedCount();
    const totalEnabled = serversArray.filter((s) => s.enabled).length;

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        total: serversArray.length,
        enabled: totalEnabled,
        connected: connectedCount,
        disconnected: totalEnabled - connectedCount,
      },
      servers: serversArray,
    });
  } catch (error) {
    logger.error('Error getting MCP status:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get MCP server status',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
