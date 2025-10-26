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
        self.max_videos = 3  # Keep only 3 most recent videos

        # Clean up old videos on startup (fresh session)
        self.cleanup_old_videos()

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

    def cleanup_old_videos(self):
        """
        Clean up old videos, keeping only the 3 most recent ones.
        Called on startup and after each render.
        """
        try:
            videos_dir = self.media_dir / "videos"
            if not videos_dir.exists():
                return

            # Find all video files (mp4, gif, png)
            video_files = []
            for ext in ['mp4', 'gif', 'png']:
                video_files.extend(videos_dir.rglob(f"*.{ext}"))

            if len(video_files) <= self.max_videos:
                return

            # Sort by modification time (newest first)
            video_files.sort(key=lambda p: p.stat().st_mtime, reverse=True)

            # Keep only the 3 most recent, delete the rest
            files_to_delete = video_files[self.max_videos:]
            deleted_count = 0

            for video_file in files_to_delete:
                try:
                    video_file.unlink()
                    deleted_count += 1
                    print(f"🗑️  Deleted old video: {video_file.name}", file=sys.stderr)
                except Exception as e:
                    print(f"Failed to delete {video_file}: {e}", file=sys.stderr)

            if deleted_count > 0:
                print(f"✅ Cleaned up {deleted_count} old video(s), kept {self.max_videos} most recent", file=sys.stderr)

        except Exception as e:
            print(f"Error during cleanup: {e}", file=sys.stderr)

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
            # Generate unique identifier for this render to prevent file collisions
            import uuid
            import time
            unique_id = f"{int(time.time())}_{uuid.uuid4().hex[:8]}"
            unique_scene_name = f"{scene_name}_{unique_id}"

            # Create temporary file for scene code
            with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
                scene_file = f.name

                # Ensure code imports Manim
                if 'from manim import' not in code and 'import manim' not in code:
                    f.write("from manim import *\n\n")

                # Replace scene class name with unique version to prevent file collisions
                modified_code = code.replace(f"class {scene_name}", f"class {unique_scene_name}")
                f.write(modified_code)

            # Map quality to Manim flags
            quality_map = {
                "low": "-ql",
                "medium": "-qm",
                "high": "-qh",
                "production": "-qp"
            }

            # Build manim command with unique scene name
            cmd = [
                "manim",
                quality_map.get(quality, "-qm"),
                scene_file,
                unique_scene_name
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
                output_dir / scene_base / quality / f"{unique_scene_name}.{format}",
                output_dir / scene_base / f"{unique_scene_name}.{format}",
                self.media_dir / "videos" / f"{unique_scene_name}.{format}",
            ]

            output_file = None
            for path in possible_paths:
                if path.exists():
                    output_file = path
                    break

            # If still not found, search recursively for any file matching the unique scene pattern
            if not output_file:
                for path in output_dir.rglob(f"*{unique_scene_name}*.{format}"):
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

            # Clean up old videos to keep only the 3 most recent
            self.cleanup_old_videos()

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
    print("🎬 Initializing Manim MCP Server (stdio mode)...", file=sys.stderr)
    server = ManimMCPServer()
    print("✅ Manim MCP Server ready (stdio mode)", file=sys.stderr)

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

    print("🎬 Initializing Manim MCP Server (HTTP mode)...", file=sys.stderr)
    server = ManimMCPServer()
    print("✅ Manim MCP Server initialized", file=sys.stderr)

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
