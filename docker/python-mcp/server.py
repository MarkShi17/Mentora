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
from typing import Any, Dict, List, Optional
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np


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
            },
            {
                "name": "render_biology_diagram",
                "description": "Generate a biology-focused schematic (cell structure, DNA transcription, photosynthesis).",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "diagram_type": {
                            "type": "string",
                            "enum": ["cell_structure", "dna_transcription", "photosynthesis"],
                            "description": "The diagram template to render"
                        },
                        "title": {
                            "type": "string",
                            "description": "Optional title for the diagram"
                        },
                        "annotations": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Optional annotation strings rendered beneath the diagram"
                        },
                        "highlight": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Key structures to emphasize within the diagram"
                        }
                    },
                    "required": ["diagram_type"]
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

    async def render_biology_diagram(
        self,
        diagram_type: str,
        title: Optional[str] = None,
        annotations: Optional[List[str]] = None,
        highlight: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        try:
            plt.close('all')
            fig, ax = plt.subplots(figsize=(8, 6))
            ax.set_xlim(0, 10)
            ax.set_ylim(0, 10)
            ax.set_aspect('equal')
            ax.axis('off')
            ax.set_facecolor("#f8fafc")

            highlight = highlight or []

            if diagram_type == "cell_structure":
                self._draw_cell_structure(ax, highlight)
            elif diagram_type == "dna_transcription":
                self._draw_dna_transcription(ax, highlight)
            elif diagram_type == "photosynthesis":
                self._draw_photosynthesis(ax, highlight)
            else:
                return {
                    "content": [{
                        "type": "text",
                        "text": f"Unknown diagram_type '{diagram_type}'. Supported: cell_structure, dna_transcription, photosynthesis."
                    }],
                    "isError": True
                }

            if title:
                fig.suptitle(title, fontsize=16, weight='bold')

            if annotations:
                for idx, note in enumerate(annotations):
                    ax.text(
                        0.02,
                        -0.08 - idx * 0.06,
                        f"• {note}",
                        transform=ax.transAxes,
                        fontsize=11,
                        color="#1f2937"
                    )

            buf = io.BytesIO()
            fig.savefig(buf, format='png', bbox_inches='tight', dpi=160)
            buf.seek(0)
            img_base64 = base64.b64encode(buf.read()).decode('utf-8')
            plt.close(fig)

            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"Biology diagram rendered successfully ({diagram_type})."
                    },
                    {
                        "type": "image",
                        "data": img_base64,
                        "mimeType": "image/png"
                    }
                ],
                "isError": False
            }
        except Exception as e:
            error_trace = traceback.format_exc()
            return {
                "content": [{
                    "type": "text",
                    "text": f"Diagram Rendering Error:\n{str(e)}\n\nTraceback:\n{error_trace}"
                }],
                "isError": True
            }

    def _draw_cell_structure(self, ax: plt.Axes, highlight: List[str]) -> None:
        membrane = patches.Circle((5, 5), 4.5, facecolor="#bbf7d0", edgecolor="#047857", linewidth=3, alpha=0.35)
        ax.add_patch(membrane)

        cytoplasm = patches.Circle((5, 5), 4.3, facecolor="#dcfce7", edgecolor="none")
        ax.add_patch(cytoplasm)

        nucleus_edge_color = "#a855f7" if "nucleus" in highlight else "#7c3aed"
        nucleus = patches.Circle((5, 5), 1.5, facecolor="#ede9fe", edgecolor=nucleus_edge_color, linewidth=2.5)
        ax.add_patch(nucleus)
        ax.text(5, 5, "Nucleus", ha='center', va='center', fontsize=12, weight='bold', color="#5b21b6")

        mitochondria_color = "#fb7185" if "mitochondria" in highlight else "#f87171"
        mito_positions = [(7.5, 6.5), (2.8, 3.2)]
        for (mx, my) in mito_positions:
            mito = patches.Ellipse((mx, my), 1.6, 0.8, angle=30, facecolor="#fee2e2", edgecolor=mitochondria_color, linewidth=2)
            ax.add_patch(mito)
            ax.text(mx, my, "Mitochondria", ha='center', va='center', fontsize=9, color="#b91c1c")

        ribosome_color = "#22d3ee" if "ribosome" in highlight else "#0ea5e9"
        for rx, ry in [(4, 7.8), (6.3, 2.5), (3.5, 5.8), (6.5, 4.2)]:
            ribosome = patches.Circle((rx, ry), 0.25, facecolor= "#bae6fd", edgecolor=ribosome_color, linewidth=1.5)
            ax.add_patch(ribosome)
        ax.text(6.6, 4.7, "Ribosome", fontsize=9, color="#0369a1")

        golgi_color = "#facc15" if "golgi" in highlight else "#eab308"
        for offset in range(4):
            golgi = patches.Ellipse((3.2 - offset * 0.35, 7 - offset * 0.25), 2.4 - offset * 0.3, 0.5, angle=-10,
                                    facecolor="#fef08a", edgecolor=golgi_color, linewidth=1.5)
            ax.add_patch(golgi)
        ax.text(2.2, 6.1, "Golgi", fontsize=9, color="#92400e")

        ax.text(5, 9.4, "Cell Membrane", ha='center', fontsize=11, color="#064e3b")

    def _draw_dna_transcription(self, ax: plt.Axes, highlight: List[str]) -> None:
        x = np.linspace(1, 9, 200)
        upper = 5 + 0.8 * np.sin(1.4 * x)
        lower = 5 + 0.8 * np.sin(1.4 * x + np.pi)

        dna_color = "#1d4ed8" if "dna" in highlight else "#2563eb"
        ax.plot(x, upper, color=dna_color, linewidth=2.5)
        ax.plot(x, lower, color=dna_color, linewidth=2.5)

        for t in np.linspace(1.2, 8.8, 18):
            ax.plot([t, t], [lower[np.argmin(np.abs(x - t))], upper[np.argmin(np.abs(x - t))]],
                    color="#60a5fa", linewidth=1.2, alpha=0.6)

        polymerase_color = "#f472b6" if "polymerase" in highlight else "#ec4899"
        polymerase = patches.FancyBboxPatch((3.8, 4.2), 1.4, 1.6,
                                            boxstyle="round,pad=0.3",
                                            facecolor="#fce7f3",
                                            edgecolor=polymerase_color,
                                            linewidth=2.5)
        ax.add_patch(polymerase)
        ax.text(4.5, 5.0, "RNA\nPolymerase", ha='center', va='center', fontsize=10, color="#be185d")

        mrna_color = "#059669" if "mrna" in highlight else "#10b981"
        ax.arrow(4.5, 3.5, 3, -0.8, width=0.06, head_width=0.4, head_length=0.3, length_includes_head=True, color=mrna_color)
        ax.text(7.6, 2.5, "mRNA", fontsize=11, color="#047857", weight='bold')

        ax.text(5, 8.9, "DNA Template Strand", ha='center', fontsize=11, color="#1d4ed8")

    def _draw_photosynthesis(self, ax: plt.Axes, highlight: List[str]) -> None:
        chloroplast_edge = "#22c55e" if "chloroplast" in highlight else "#16a34a"
        chloroplast = patches.Ellipse((5, 5), 8.5, 5.5, facecolor="#bbf7d0", edgecolor=chloroplast_edge, linewidth=3)
        ax.add_patch(chloroplast)
        ax.text(5, 8.6, "Chloroplast", ha='center', fontsize=12, color="#166534", weight='bold')

        thylakoid_color = "#0ea5e9" if "thylakoid" in highlight else "#38bdf8"
        for i, y in enumerate([6.2, 5.5, 4.8]):
            stack = patches.Ellipse((5, y), 6.2, 1.0, facecolor="#e0f2fe", edgecolor=thylakoid_color, linewidth=2)
            ax.add_patch(stack)
            ax.text(5, y, "Thylakoid Stack" if i == 1 else "", ha='center', va='center', fontsize=10, color="#075985")

        stroma_color = "#facc15" if "stroma" in highlight else "#eab308"
        stroma = patches.Rectangle((1.5, 2.5), 7, 1.5, facecolor="#fef08a", edgecolor=stroma_color, linewidth=2)
        ax.add_patch(stroma)
        ax.text(5, 3.1, "Stroma (Calvin Cycle)", ha='center', fontsize=10, color="#92400e")

        ax.annotate("Light", xy=(1.2, 7.2), xytext=(0.4, 9),
                    arrowprops=dict(arrowstyle="->", color="#f59e0b", linewidth=2),
                    fontsize=11, color="#b45309")
        ax.text(0.7, 9.3, "Sunlight", fontsize=10, color="#b97609")

        ax.annotate("O₂", xy=(8.6, 7.2), xytext=(9.3, 8.6),
                    arrowprops=dict(arrowstyle="->", color="#2563eb", linewidth=2),
                    fontsize=11, color="#1d4ed8")

        ax.annotate("Glucose", xy=(8.5, 3.2), xytext=(9.4, 2),
                    arrowprops=dict(arrowstyle="->", color="#16a34a", linewidth=2),
                    fontsize=11, color="#15803d")

        ax.annotate("CO₂", xy=(1.3, 2.6), xytext=(0.6, 1.2),
                    arrowprops=dict(arrowstyle="<-", color="#7c3aed", linewidth=2),
                    fontsize=11, color="#6d28d9")

        ax.annotate("H₂O", xy=(1.5, 4.0), xytext=(0.6, 5.1),
                    arrowprops=dict(arrowstyle="<-", color="#0ea5e9", linewidth=2),
                    fontsize=11, color="#0284c7")

    async def call_tool(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call a tool by name"""
        if name == "execute_python":
            return await self.execute_python(
                code=arguments.get("code", ""),
                packages=arguments.get("packages"),
                timeout=arguments.get("timeout", 30)
            )
        elif name == "render_biology_diagram":
            return await self.render_biology_diagram(
                diagram_type=arguments.get("diagram_type", "cell_structure"),
                title=arguments.get("title"),
                annotations=arguments.get("annotations"),
                highlight=arguments.get("highlight")
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
