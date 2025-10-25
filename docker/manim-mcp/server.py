"""
Manim MCP Server - Mathematical animation generation for Mentora

Provides an MCP server that can render Manim animations and return video/GIF outputs.
"""

import asyncio
import json
import sys
import os
import traceback
import base64
import tempfile
import subprocess
from pathlib import Path
from typing import Any, Dict


class ManimMCPServer:
    """MCP Server for Manim animation generation"""

    def __init__(self):
        self.media_dir = Path("/app/media")
        self.media_dir.mkdir(exist_ok=True)

        self.tools = [
            {
                "name": "render_animation",
                "description": "Render a Manim animation from Python code",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "code": {
                            "type": "string",
                            "description": "Manim scene code (must define a Scene class)"
                        },
                        "scene_name": {
                            "type": "string",
                            "description": "Name of the scene class to render (default: 'MainScene')"
                        },
                        "quality": {
                            "type": "string",
                            "enum": ["low", "medium", "high", "production"],
                            "description": "Rendering quality (default: 'medium')"
                        },
                        "format": {
                            "type": "string",
                            "enum": ["mp4", "gif", "png"],
                            "description": "Output format (default: 'mp4')"
                        },
                        "transparent": {
                            "type": "boolean",
                            "description": "Use transparent background (default: false)"
                        }
                    },
                    "required": ["code"]
                }
            }
        ]

    async def list_tools(self) -> Dict[str, Any]:
        """List available tools"""
        return {"tools": self.tools}

    async def render_animation(
        self,
        code: str,
        scene_name: str = "MainScene",
        quality: str = "medium",
        format: str = "mp4",
        transparent: bool = False
    ) -> Dict[str, Any]:
        """Render a Manim animation"""
        try:
            # Create temporary file for scene code
            with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
                scene_file = f.name

                # Ensure code imports Manim
                if 'from manim import' not in code and 'import manim' not in code:
                    f.write("from manim import *\n\n")

                f.write(code)

            # Map quality to Manim flags
            quality_map = {
                "low": "-ql",
                "medium": "-qm",
                "high": "-qh",
                "production": "-qp"
            }

            # Build manim command
            cmd = [
                "manim",
                quality_map.get(quality, "-qm"),
                scene_file,
                scene_name
            ]

            if format == "gif":
                cmd.append("--format=gif")
            elif format == "png":
                cmd.append("--format=png")

            if transparent:
                cmd.append("--transparent")

            # Set output directory
            output_dir = self.media_dir / "videos"
            output_dir.mkdir(parents=True, exist_ok=True)

            env = os.environ.copy()
            env["MEDIA_DIR"] = str(self.media_dir)

            # Run manim
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120,  # 2 minute timeout
                env=env
            )

            if result.returncode != 0:
                return {
                    "content": [{
                        "type": "text",
                        "text": f"Manim rendering failed:\n{result.stderr}"
                    }],
                    "isError": True
                }

            # Find output file
            # Manim typically outputs to media/videos/{filename}/{quality}/{scene_name}.{format}
            # But the actual structure can vary, so we search more broadly
            scene_base = Path(scene_file).stem
            possible_paths = [
                output_dir / scene_base / quality / f"{scene_name}.{format}",
                output_dir / scene_base / f"{scene_name}.{format}",
                self.media_dir / "videos" / f"{scene_name}.{format}",
            ]

            output_file = None
            for path in possible_paths:
                if path.exists():
                    output_file = path
                    break

            # If still not found, search recursively for any file matching the pattern
            if not output_file:
                for path in output_dir.rglob(f"*{scene_name}*.{format}"):
                    output_file = path
                    break

            # If still not found, search for any .gif, .mp4, or .png files in the output directory
            if not output_file:
                for ext in ['gif', 'mp4', 'png']:
                    for path in output_dir.rglob(f"*.{ext}"):
                        output_file = path
                        break
                    if output_file:
                        break

            if not output_file or not output_file.exists():
                return {
                    "content": [{
                        "type": "text",
                        "text": f"Animation rendered but output file not found.\n\nManim output:\n{result.stdout}\n\nSearched paths:\n" + "\n".join(str(p) for p in possible_paths)
                    }],
                    "isError": True
                }

            # Read and encode output
            with open(output_file, 'rb') as f:
                content_bytes = f.read()
                content_base64 = base64.b64encode(content_bytes).decode('utf-8')

            # Determine MIME type
            mime_types = {
                "mp4": "video/mp4",
                "gif": "image/gif",
                "png": "image/png"
            }

            # Clean up temp file
            os.unlink(scene_file)

            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"Animation rendered successfully ({output_file.stat().st_size} bytes)"
                    },
                    {
                        "type": "resource",
                        "resource": {
                            "uri": f"file://{output_file}",
                            "mimeType": mime_types.get(format, "application/octet-stream"),
                            "text": content_base64
                        }
                    }
                ],
                "isError": False
            }

        except subprocess.TimeoutExpired:
            return {
                "content": [{
                    "type": "text",
                    "text": "Animation rendering timed out (max 2 minutes)"
                }],
                "isError": True
            }
        except Exception as e:
            error_trace = traceback.format_exc()
            return {
                "content": [{
                    "type": "text",
                    "text": f"Rendering Error:\n{str(e)}\n\nTraceback:\n{error_trace}"
                }],
                "isError": True
            }

    async def call_tool(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call a tool by name"""
        if name == "render_animation":
            return await self.render_animation(
                code=arguments.get("code", ""),
                scene_name=arguments.get("scene_name", "MainScene"),
                quality=arguments.get("quality", "medium"),
                format=arguments.get("format", "mp4"),
                transparent=arguments.get("transparent", False)
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
                    "name": "manim-mcp",
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
    server = ManimMCPServer()

    print("Manim MCP Server started (stdio mode)", file=sys.stderr)

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

    server = ManimMCPServer()

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

    print("Manim MCP Server starting on http://0.0.0.0:8000", file=sys.stderr)
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
