/**
 * MCP Tool Definitions for Claude
 *
 * Defines which MCP tools are available to Claude and how to map
 * between Claude's tool calling format and MCP server requests.
 */

import { Tool } from '@anthropic-ai/sdk/resources/messages.mjs';

/**
 * MCP tools available to Claude for teaching
 */
export const MCP_TOOLS_FOR_CLAUDE: Tool[] = [
  {
    name: 'render_animation',
    description: `Create animated mathematical visualizations using Manim. PREFERRED for math: animated proofs, function transformations, geometric concepts, calculus demonstrations. Code must define a Scene class.`,
    input_schema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: `Manim scene code. Must define a Scene class, e.g.:

class MainScene(Scene):
    def construct(self):
        circle = Circle()
        self.play(Create(circle))
        self.wait()`,
        },
        scene_name: {
          type: 'string',
          description: 'Name of the scene class to render (default: MainScene)',
        },
        quality: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'production'],
          description: 'Rendering quality (default: medium)',
        },
        format: {
          type: 'string',
          enum: ['mp4', 'gif', 'png'],
          description: 'Output format (default: mp4)',
        },
      },
      required: ['code'],
    },
  },
  {
    name: 'execute_python',
    description: `Execute Python for custom static plots, data analysis, or scientific diagrams when specialized tools don't fit. Libraries: numpy, pandas, matplotlib, seaborn, scipy. Returns PNG images.`,
    input_schema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Python code to execute. Use matplotlib.pyplot (imported as plt) for visualizations. Call plt.figure() to create plots.',
        },
        packages: {
          type: 'array',
          items: { type: 'string' },
          description: 'Additional packages to ensure are available (optional)',
        },
      },
      required: ['code'],
    },
  },
  {
    name: 'render_biology_diagram',
    description: `Generate pre-built biology template diagrams: cell_structure, dna_transcription, photosynthesis, mitosis_phases, crispr_mechanism, cell_cycle, gene_expression. Use for standard biology processes. For custom pathways use generate, for 3D structures use visualize_molecule.`,
    input_schema: {
      type: 'object',
      properties: {
        diagram_type: {
          type: 'string',
          enum: [
            'cell_structure',
            'dna_transcription',
            'photosynthesis',
            'mitosis_phases',
            'crispr_mechanism',
            'cell_cycle',
            'gene_expression',
          ],
          description: 'Choose the built-in diagram template to render'
        },
        title: {
          type: 'string',
          description: 'Optional title rendered on the diagram'
        },
        annotations: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional bullet annotations placed below the diagram'
        },
        highlight: {
          type: 'array',
          items: { type: 'string' },
          description: 'Structures to emphasize (e.g., ["nucleus", "mitochondria"])'
        }
      },
      required: ['diagram_type']
    },
  },
  {
    name: 'search_biorender',
    description: `Search BioRender's 30,000+ professional biology illustrations. Find diagrams matching topics, processes, or structures. Filter by category if needed.`,
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search keywords, e.g., "cell cycle checkpoint" or "CRISPR complex"',
        },
        category: {
          type: 'string',
          description: 'Optional BioRender category filter (e.g., "Cell Biology", "Genetics")',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_biorender_figure',
    description: `Retrieve a specific BioRender illustration by figure ID. Use after search_biorender to get publication-quality diagrams.`,
    input_schema: {
      type: 'object',
      properties: {
        figure_id: {
          type: 'string',
          description: 'BioRender figure identifier (e.g., "BR-12345") returned from a search',
        },
        format: {
          type: 'string',
          enum: ['png', 'svg'],
          description: 'Preferred output format (default: png)',
        },
      },
      required: ['figure_id'],
    },
  },
  {
    name: 'generate',
    description: `Create custom flowchart diagrams using Mermaid syntax. PREFERRED for biological pathways, metabolic processes, signaling cascades, regulatory networks. Shows branching, feedback loops, decision points. Provide Mermaid code (flowchart/sequence/state).`,
    input_schema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: `Mermaid code block. Example for a flowchart:
flowchart LR
  A[Signal] --> B{Checkpoints}
  B -->|G1| C[DNA Synthesis]
  B -->|G2| D[Repair]`,
        },
        type: {
          type: 'string',
          enum: ['flowchart', 'sequence', 'state', 'class', 'er', 'mindmap'],
          description: 'Mermaid renderer preset best suited for the given code',
        },
        theme: {
          type: 'string',
          enum: ['default', 'neutral', 'forest', 'dark'],
          description: 'Optional Mermaid styling theme (default: theme configured server-side)',
        },
      },
      required: ['code', 'type'],
    },
  },
  {
    name: 'visualize_molecule',
    description: `Render 3D molecular structures using PyMOL. PREFERRED for protein/DNA structures: Cas9, enzymes, antibodies, protein-DNA complexes, active sites. Requires PDB ID. Styles: cartoon, surface, sticks, spheres, electrostatic. Can highlight specific residues.`,
    input_schema: {
      type: 'object',
      properties: {
        pdb_id: {
          type: 'string',
          description: 'PDB accession identifier (e.g., "4OO8" for Cas9)',
        },
        style: {
          type: 'string',
          enum: ['cartoon', 'surface', 'sticks', 'spheres', 'electrostatic'],
          description: 'Preferred rendering style (default: cartoon)',
        },
        highlight_residues: {
          type: 'array',
          items: { type: 'string' },
          description: 'Residue identifiers to highlight (e.g., ["ARG1335", "HIS840"])',
        },
        orientation: {
          type: 'string',
          description: 'Optional camera orientation instructions (e.g., "align to guide RNA groove")',
        },
      },
      required: ['pdb_id'],
    },
  },
  {
    name: 'fetch_protein',
    description: `Lookup protein by name via UniProt. Get metadata, accession IDs, PDB structures. Use before visualize_molecule.`,
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Common protein name or UniProt identifier',
        },
        organism: {
          type: 'string',
          description: 'Optional organism filter to disambiguate results',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'sequentialthinking',
    description: `Break down complex problems into sequential thinking steps. Use for multi-step problem solving, proofs, derivations, or careful reasoning before explaining to student.`,
    input_schema: {
      type: 'object',
      properties: {
        thought: {
          type: 'string',
          description: 'Your current thinking step or analysis',
        },
        nextThoughtNeeded: {
          type: 'boolean',
          description: 'Whether you need to continue thinking',
        },
        thoughtNumber: {
          type: 'integer',
          description: 'Current thought number in the sequence',
          minimum: 1,
        },
        totalThoughts: {
          type: 'integer',
          description: 'Estimated total thoughts needed',
          minimum: 1,
        },
      },
      required: ['thought', 'nextThoughtNeeded', 'thoughtNumber', 'totalThoughts'],
    },
  },
];

/**
 * Map tool names to MCP server IDs
 */
export const TOOL_TO_SERVER_MAP: Record<string, string> = {
  execute_python: 'python',
  render_animation: 'manim',
  render_biology_diagram: 'python',
  search_biorender: 'biorender',
  get_biorender_figure: 'biorender',
  generate: 'mermaid',
  visualize_molecule: 'chatmol',
  fetch_protein: 'chatmol',
  sequentialthinking: 'sequential-thinking',
};

/**
 * Check if a tool is a visualization tool that should create canvas objects
 */
export function isVisualizationTool(toolName: string): boolean {
  return (
    toolName === 'execute_python' ||
    toolName === 'render_animation' ||
    toolName === 'render_biology_diagram' ||
    toolName === 'get_biorender_figure' ||
    toolName === 'generate' ||
    toolName === 'visualize_molecule'
  );
}

/**
 * Check if a tool is a thinking tool that enhances reasoning
 */
export function isThinkingTool(toolName: string): boolean {
  return toolName === 'sequentialthinking';
}
