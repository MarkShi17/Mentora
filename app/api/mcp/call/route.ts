/**
 * POST /api/mcp/call
 *
 * Call a tool on an MCP server.
 *
 * Request body:
 * {
 *   "serverId": "sequential-thinking",
 *   "toolName": "sequential_thinking",
 *   "arguments": { ... }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { mcpManager } from '@/lib/mcp';
import { initializeMCP } from '@/lib/mcp/init';
import { logger } from '@/lib/utils/logger';
import { MCPToolCallRequest } from '@/types/mcp';

export async function POST(request: NextRequest) {
  try {
    // Ensure MCP is initialized before calling tools
    await initializeMCP();

    const body = await request.json();

    // Validate request
    if (!body.serverId) {
      return NextResponse.json(
        {
          success: false,
          error: 'serverId is required',
        },
        { status: 400 }
      );
    }

    if (!body.toolName) {
      return NextResponse.json(
        {
          success: false,
          error: 'toolName is required',
        },
        { status: 400 }
      );
    }

    const toolCallRequest: MCPToolCallRequest = {
      serverId: body.serverId,
      toolName: body.toolName,
      arguments: body.arguments || {},
    };

    logger.info(`MCP tool call: ${toolCallRequest.serverId}/${toolCallRequest.toolName}`);

    // Call the tool
    const response = await mcpManager.callTool(toolCallRequest);

    if (!response.success) {
      return NextResponse.json(
        {
          success: false,
          error: response.error || 'Tool call failed',
          content: response.content,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      serverId: toolCallRequest.serverId,
      toolName: toolCallRequest.toolName,
      content: response.content,
    });
  } catch (error) {
    logger.error('Error calling MCP tool:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to call MCP tool',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
