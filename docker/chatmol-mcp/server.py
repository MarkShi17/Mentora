"""
ChatMol MCP Server - 3D molecular visualization for Mentora

Provides an MCP server that can visualize molecular structures using PyMOL.
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
from typing import Any, Dict, List, Optional


class ChatMolMCPServer:
    """MCP Server for molecular visualization using PyMOL"""

    def __init__(self):
        self.media_dir = Path("/app/media")
        self.media_dir.mkdir(exist_ok=True)
        self.pymol_path = os.environ.get("PYMOL_PATH", "/usr/bin/pymol")

        self.tools = [
            {
                "name": "visualize_molecule",
                "description": "Visualize a 3D molecular structure using PyMOL",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "pdb_id": {
                            "type": "string",
                            "description": "PDB accession ID (e.g., '4OO8' for Cas9)"
                        },
                        "style": {
                            "type": "string",
                            "enum": ["cartoon", "surface", "sticks", "spheres", "electrostatic"],
                            "description": "Rendering style (default: cartoon)"
                        },
                        "highlight_residues": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Residues to highlight (e.g., ['ARG1335', 'HIS840'])"
                        },
                        "orientation": {
                            "type": "string",
                            "description": "Camera orientation instructions"
                        },
                        "format": {
                            "type": "string",
                            "enum": ["png", "gif"],
                            "description": "Output format (default: png)"
                        }
                    },
                    "required": ["pdb_id"]
                }
            },
            {
                "name": "fetch_protein",
                "description": "Fetch protein information from UniProt",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "Protein name or UniProt ID"
                        },
                        "organism": {
                            "type": "string",
                            "description": "Organism filter (optional)"
                        }
                    },
                    "required": ["name"]
                }
            }
        ]

    async def list_tools(self) -> Dict[str, Any]:
        """List available tools"""
        return {"tools": self.tools}

    async def visualize_molecule(
        self,
        pdb_id: str,
        style: str = "cartoon",
        highlight_residues: Optional[List[str]] = None,
        orientation: Optional[str] = None,
        format: str = "png"
    ) -> Dict[str, Any]:
        """Visualize a molecule using PyMOL"""
        try:
            # Check if PyMOL is available
            if not os.path.exists(self.pymol_path):
                return {
                    "content": [{
                        "type": "text",
                        "text": (
                            f"ChatMol MCP: PyMOL not installed at {self.pymol_path}\n\n"
                            f"Request: Visualize PDB {pdb_id} in {style} style\n"
                            + (f"Highlight residues: {', '.join(highlight_residues)}\n" if highlight_residues else "")
                            + "\nTo enable ChatMol visualization:\n"
                            + "1. Install PyMOL on your system\n"
                            + "2. Set PYMOL_PATH environment variable\n"
                            + "3. Rebuild the Docker container\n\n"
                            + "Alternative: Use Python MCP's render_biology_diagram for 2D biological diagrams.\n\n"
                            + f"Note: You can view PDB {pdb_id} at https://www.rcsb.org/structure/{pdb_id}"
                        )
                    }],
                    "isError": False
                }

            # Create temporary PyMOL script
            with tempfile.NamedTemporaryFile(mode='w', suffix='.pml', delete=False) as f:
                script_file = f.name

                # Write PyMOL commands
                f.write(f"fetch {pdb_id}, molecule\n")
                f.write("hide everything, molecule\n")

                # Apply style
                if style == "cartoon":
                    f.write("show cartoon, molecule\n")
                    f.write("color cyan, molecule\n")
                elif style == "surface":
                    f.write("show surface, molecule\n")
                elif style == "sticks":
                    f.write("show sticks, molecule\n")
                elif style == "spheres":
                    f.write("show spheres, molecule\n")
                elif style == "electrostatic":
                    f.write("show surface, molecule\n")
                    f.write("color white, molecule\n")
                    f.write("util.cbaw molecule\n")

                # Highlight residues if specified
                if highlight_residues:
                    for residue in highlight_residues:
                        f.write(f"show sticks, resi {residue}\n")
                        f.write(f"color red, resi {residue}\n")

                # Set orientation
                f.write("orient molecule\n")
                f.write("zoom molecule\n")

                # Output file
                output_file = self.media_dir / f"{pdb_id}_{style}.{format}"
                f.write(f"png {output_file}, width=800, height=600, dpi=150, ray=1\n")
                f.write("quit\n")

            # Run PyMOL in command-line mode
            result = subprocess.run(
                [self.pymol_path, "-cq", script_file],
                capture_output=True,
                text=True,
                timeout=120
            )

            if result.returncode != 0:
                return {
                    "content": [{
                        "type": "text",
                        "text": f"PyMOL rendering failed:\n{result.stderr}"
                    }],
                    "isError": True
                }

            # Check if output file exists
            if not output_file.exists():
                return {
                    "content": [{
                        "type": "text",
                        "text": f"Output file not found. PyMOL may have failed to render.\n\nOutput:\n{result.stdout}"
                    }],
                    "isError": True
                }

            # Read and encode output
            with open(output_file, 'rb') as f:
                content_bytes = f.read()
                content_base64 = base64.b64encode(content_bytes).decode('utf-8')

            # Clean up temp file
            os.unlink(script_file)

            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"Molecular structure {pdb_id} rendered successfully ({style} style)."
                    },
                    {
                        "type": "image",
                        "data": content_base64,
                        "mimeType": f"image/{format}"
                    }
                ],
                "isError": False
            }

        except subprocess.TimeoutExpired:
            return {
                "content": [{
                    "type": "text",
                    "text": "Molecular rendering timed out (max 2 minutes)"
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

    async def fetch_protein(
        self,
        name: str,
        organism: Optional[str] = None
    ) -> Dict[str, Any]:
        """Fetch protein information from UniProt"""
        try:
            # This is a simplified implementation
            # In a real implementation, you would query UniProt API
            return {
                "content": [{
                    "type": "text",
                    "text": f"Protein information fetch not fully implemented yet.\n\nSearching for: {name}"
                    + (f" in {organism}" if organism else "")
                    + "\n\nPlease use PDB ID directly with visualize_molecule tool."
                }],
                "isError": False
            }
        except Exception as e:
            error_trace = traceback.format_exc()
            return {
                "content": [{
                    "type": "text",
                    "text": f"Fetch Error:\n{str(e)}\n\nTraceback:\n{error_trace}"
                }],
                "isError": True
            }

    async def call_tool(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call a tool by name"""
        if name == "visualize_molecule":
            return await self.visualize_molecule(
                pdb_id=arguments.get("pdb_id", ""),
                style=arguments.get("style", "cartoon"),
                highlight_residues=arguments.get("highlight_residues"),
                orientation=arguments.get("orientation"),
                format=arguments.get("format", "png")
            )
        elif name == "fetch_protein":
            return await self.fetch_protein(
                name=arguments.get("name", ""),
                organism=arguments.get("organism")
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
                    "name": "chatmol-mcp",
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

    server = ChatMolMCPServer()

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

    print("ChatMol MCP Server starting on http://0.0.0.0:8000", file=sys.stderr)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, '0.0.0.0', 8000)
    await site.start()

    # Keep running
    while True:
        await asyncio.sleep(3600)


if __name__ == "__main__":
    asyncio.run(http_server())
