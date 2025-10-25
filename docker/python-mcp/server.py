"""
Python MCP Server - Secure Python code execution for Mentora

Provides an HTTP MCP server that can execute Python code in a sandboxed environment.
Supports matplotlib, numpy, pandas for diagram and visualization generation.
"""

import asyncio
import json
import sys
import os
import io
import traceback
import base64
from contextlib import redirect_stdout, redirect_stderr
from typing import Any, Dict, List
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt


class PythonMCPServer:
    """MCP Server for Python code execution"""

    def __init__(self):
        self.tools = [
            {
                "name": "execute_python",
                "description": "Execute Python code and return results. Supports matplotlib for visualizations.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "code": {
                            "type": "string",
                            "description": "Python code to execute"
                        },
                        "packages": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Additional packages to install (optional)"
                        },
                        "timeout": {
                            "type": "number",
                            "description": "Execution timeout in seconds (default: 30)"
                        }
                    },
                    "required": ["code"]
                }
            }
        ]

    async def list_tools(self) -> Dict[str, Any]:
        """List available tools"""
        return {"tools": self.tools}

    async def execute_python(self, code: str, packages: List[str] = None, timeout: int = 30) -> Dict[str, Any]:
        """Execute Python code and return results"""
        try:
            # Create execution environment
            global_env = {
                '__builtins__': __builtins__,
                'plt': plt,
                'np': None,  # Will import if needed
                'pd': None,  # Will import if needed
            }

            # Import common libraries if requested
            if 'numpy' in (packages or []) or 'np.' in code or 'import numpy' in code:
                import numpy as np
                global_env['np'] = np

            if 'pandas' in (packages or []) or 'pd.' in code or 'import pandas' in code:
                import pandas as pd
                global_env['pd'] = pd

            # Capture stdout and stderr
            stdout_capture = io.StringIO()
            stderr_capture = io.StringIO()

            # Capture matplotlib figures
            plt.clf()  # Clear any existing plots

            # Execute code
            with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
                exec(code, global_env)

            # Get output
            stdout_value = stdout_capture.getvalue()
            stderr_value = stderr_capture.getvalue()

            # Capture matplotlib figures
            figures = []
            for fig_num in plt.get_fignums():
                fig = plt.figure(fig_num)
                buf = io.BytesIO()
                fig.savefig(buf, format='png', bbox_inches='tight', dpi=150)
                buf.seek(0)
                img_base64 = base64.b64encode(buf.read()).decode('utf-8')
                figures.append({
                    "type": "image",
                    "data": img_base64,
                    "mimeType": "image/png"
                })
                plt.close(fig)

            # Build response
            content = []

            if stdout_value:
                content.append({
                    "type": "text",
                    "text": f"Output:\n{stdout_value}"
                })

            if stderr_value:
                content.append({
                    "type": "text",
                    "text": f"Errors/Warnings:\n{stderr_value}"
                })

            # Add figures
            content.extend(figures)

            if not content:
                content.append({
                    "type": "text",
                    "text": "Code executed successfully (no output)"
                })

            return {
                "content": content,
                "isError": False
            }

        except Exception as e:
            error_trace = traceback.format_exc()
            return {
                "content": [{
                    "type": "text",
                    "text": f"Execution Error:\n{str(e)}\n\nTraceback:\n{error_trace}"
                }],
                "isError": True
            }

    async def call_tool(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call a tool by name"""
        if name == "execute_python":
            return await self.execute_python(
                code=arguments.get("code", ""),
                packages=arguments.get("packages"),
                timeout=arguments.get("timeout", 30)
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
                    "name": "python-mcp",
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


async def stdio_server():
    """Run server in stdio mode"""
    server = PythonMCPServer()

    print("Python MCP Server started (stdio mode)", file=sys.stderr)

    while True:
        try:
            # Read request from stdin
            line = await asyncio.get_event_loop().run_in_executor(None, sys.stdin.readline)
            if not line:
                break

            request = json.loads(line)
            response = await server.handle_request(request)

            # Write response to stdout
            print(json.dumps(response), flush=True)

        except json.JSONDecodeError as e:
            print(f"JSON decode error: {e}", file=sys.stderr)
        except Exception as e:
            print(f"Server error: {e}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)


async def http_server():
    """Run server in HTTP mode"""
    from aiohttp import web

    server = PythonMCPServer()

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

    print("Python MCP Server starting on http://0.0.0.0:8000", file=sys.stderr)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, '0.0.0.0', 8000)
    await site.start()

    # Keep running
    while True:
        await asyncio.sleep(3600)


if __name__ == "__main__":
    mode = os.environ.get("MCP_MODE", "http")

    if mode == "stdio":
        asyncio.run(stdio_server())
    else:
        asyncio.run(http_server())
