"""
BioRender MCP Server - Professional scientific illustrations for Mentora

Provides an MCP server that can search and retrieve BioRender illustrations.
Note: This is a simplified implementation. Full BioRender API access requires API key.
"""

import asyncio
import json
import sys
import os
import traceback
from typing import Any, Dict, List, Optional


class BioRenderMCPServer:
    """MCP Server for BioRender scientific illustrations"""

    def __init__(self):
        self.api_key = os.environ.get("BIORENDER_API_KEY", "")

        self.tools = [
            {
                "name": "search_biorender",
                "description": "Search BioRender's library of 30,000+ professional scientific illustrations",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Search keywords (e.g., 'cell cycle checkpoint', 'CRISPR complex')"
                        },
                        "category": {
                            "type": "string",
                            "description": "Optional BioRender category filter (e.g., 'Cell Biology', 'Genetics')"
                        }
                    },
                    "required": ["query"]
                }
            },
            {
                "name": "get_biorender_figure",
                "description": "Retrieve a specific BioRender illustration by figure ID",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "figure_id": {
                            "type": "string",
                            "description": "BioRender figure identifier (e.g., 'BR-12345')"
                        },
                        "format": {
                            "type": "string",
                            "enum": ["png", "svg"],
                            "description": "Preferred output format (default: png)"
                        }
                    },
                    "required": ["figure_id"]
                }
            }
        ]

    async def list_tools(self) -> Dict[str, Any]:
        """List available tools"""
        return {"tools": self.tools}

    async def search_biorender(
        self,
        query: str,
        category: Optional[str] = None
    ) -> Dict[str, Any]:
        """Search BioRender library"""
        try:
            # Check if API key is configured
            if not self.api_key:
                return {
                    "content": [{
                        "type": "text",
                        "text": (
                            "BioRender API key not configured.\n\n"
                            "To use BioRender integration:\n"
                            "1. Request API access from BioRender (https://biorender.com)\n"
                            "2. Set BIORENDER_API_KEY environment variable\n"
                            "3. Enable with ENABLE_BIORENDER=true\n\n"
                            f"Search query: '{query}'"
                            + (f" in category '{category}'" if category else "")
                            + "\n\nFor now, use the Python MCP render_biology_diagram tool "
                            + "for biology diagrams."
                        )
                    }],
                    "isError": False
                }

            # TODO: Implement real BioRender API search when API is available
            # For now, return informative message
            return {
                "content": [{
                    "type": "text",
                    "text": (
                        f"BioRender search for: '{query}'"
                        + (f" in {category}" if category else "")
                        + "\n\n"
                        + "BioRender MCP integration is configured but API implementation pending.\n"
                        + "The BioRender-Anthropic partnership was announced recently (Oct 2025).\n\n"
                        + "Alternative: Use render_biology_diagram tool for biology visuals."
                    )
                }],
                "isError": False
            }

        except Exception as e:
            error_trace = traceback.format_exc()
            return {
                "content": [{
                    "type": "text",
                    "text": f"Search Error:\n{str(e)}\n\nTraceback:\n{error_trace}"
                }],
                "isError": True
            }

    async def get_biorender_figure(
        self,
        figure_id: str,
        format: str = "png"
    ) -> Dict[str, Any]:
        """Retrieve a specific BioRender figure"""
        try:
            if not self.api_key:
                return {
                    "content": [{
                        "type": "text",
                        "text": (
                            "BioRender API key not configured.\n\n"
                            f"Attempting to retrieve figure: {figure_id} ({format})\n\n"
                            "Please configure BIORENDER_API_KEY to use this feature."
                        )
                    }],
                    "isError": False
                }

            # TODO: Implement real BioRender API figure retrieval
            return {
                "content": [{
                    "type": "text",
                    "text": (
                        f"BioRender figure retrieval: {figure_id}\n"
                        + "API implementation pending.\n\n"
                        + "Alternative: Use render_biology_diagram tool."
                    )
                }],
                "isError": False
            }

        except Exception as e:
            error_trace = traceback.format_exc()
            return {
                "content": [{
                    "type": "text",
                    "text": f"Retrieval Error:\n{str(e)}\n\nTraceback:\n{error_trace}"
                }],
                "isError": True
            }

    async def call_tool(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call a tool by name"""
        if name == "search_biorender":
            return await self.search_biorender(
                query=arguments.get("query", ""),
                category=arguments.get("category")
            )
        elif name == "get_biorender_figure":
            return await self.get_biorender_figure(
                figure_id=arguments.get("figure_id", ""),
                format=arguments.get("format", "png")
            )
        else:
            return {
                "content": [{
                    "type": "text",
                    "text": f"Unknown tool: {name}"
                }],
                "isError": True
            }

    async def handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Handle MCP JSON-RPC request"""
        method = request.get("method")
        params = request.get("params", {})

        if method == "tools/list":
            result = await self.list_tools()
        elif method == "tools/call":
            tool_name = params.get("name")
            arguments = params.get("arguments", {})
            result = await self.call_tool(tool_name, arguments)
        elif method == "initialize":
            result = {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {}
                },
                "serverInfo": {
                    "name": "biorender-mcp",
                    "version": "1.0.0"
                }
            }
        else:
            result = {"error": f"Unknown method: {method}"}

        return {
            "jsonrpc": "2.0",
            "id": request.get("id"),
            "result": result
        }


async def http_server():
    """Run server in HTTP mode"""
    from aiohttp import web

    server = BioRenderMCPServer()

    async def handle_request_http(request):
        """Handle HTTP MCP request"""
        try:
            body = await request.json()
            response = await server.handle_request(body)
            return web.json_response(response)
        except Exception as e:
            return web.json_response({
                "jsonrpc": "2.0",
                "error": {
                    "code": -32603,
                    "message": f"Internal error: {str(e)}"
                }
            }, status=500)

    app = web.Application()
    app.router.add_post('/mcp', handle_request_http)
    app.router.add_get('/health', lambda _: web.json_response({"status": "ok"}))

    print("BioRender MCP Server starting on http://0.0.0.0:8000", file=sys.stderr)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, '0.0.0.0', 8000)
    await site.start()

    # Keep running
    while True:
        await asyncio.sleep(3600)


if __name__ == "__main__":
    asyncio.run(http_server())
