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
    description: `Render beautiful mathematical animations using Manim (Mathematical Animation Engine).

PREFERRED for mathematical visualizations! Use this tool when you need to:
- Create animated mathematical concepts (Pythagorean theorem, geometry, calculus, algebra)
- Show step-by-step mathematical transformations with smooth animations
- Visualize function behavior over time with dynamic graphs
- Create animated proofs or demonstrations with moving shapes and equations
- Illustrate mathematical relationships dynamically with colors and transitions
- Generate professional-quality mathematical videos and GIFs

This tool creates stunning, animated visualizations that are perfect for teaching mathematical concepts. The code must define a Scene class that inherits from Manim's Scene.`,
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
    description: `Execute Python code to generate static visualizations, data analysis, and scientific plots.

Use this tool when you need to:
- Create static matplotlib/seaborn visualizations (plots, charts, graphs)
- Generate scientific diagrams (biology, chemistry, physics)
- Perform data analysis and create visual results
- Create custom static diagrams and plots
- Demonstrate algorithm visualizations with static images

Note: For mathematical concepts and animated visualizations, prefer the render_animation tool instead.

Available libraries: numpy, pandas, matplotlib, seaborn, plotly, scipy

The tool will return base64-encoded PNG images of any matplotlib plots created.`,
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
    description: `Generate **curated template diagrams** for standard biology concepts using pre-built matplotlib templates.

Use this tool ONLY when you need one of these specific templates:
- Cell structure (organelles and basic layout)
- DNA transcription/translation (basic central dogma)
- Photosynthesis (chloroplast overview)
- Mitosis phases (standard phase diagram)
- CRISPR mechanism (basic overview)
- Cell cycle (G1/S/G2/M phases)
- Gene expression (DNA→RNA→protein)

**When NOT to use:**
- For custom biological pathways or sequences (use create_mermaid_diagram instead)
- For 3D molecular structures (use visualize_molecule instead)
- For data plots or custom diagrams (use execute_python instead)

Arguments allow selecting the template, providing a custom title, annotations, and highlight labels.`,
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
    description: `Search BioRender's library of 30,000+ professionally designed biology illustrations and icons.

Use this tool to discover ready-made diagrams or assets that match a given topic, process, or structure. Provide a focused query and optionally filter by BioRender category.`,
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
    description: `Retrieve a specific BioRender illustration by its figure identifier.

Use this after searching BioRender to pull down the curated, publication-quality diagram for display in the lesson.`,
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
    name: 'create_mermaid_diagram',
    description: `Create **custom process flowcharts and pathway diagrams** using Mermaid syntax.

**PREFERRED for biological pathways and multi-step processes:**
- CRISPR/Cas9 editing workflow (guide RNA → target DNA → cleavage → repair)
- Cell signaling pathways (receptor → cascade → response)
- Metabolic pathways (glycolysis, Krebs cycle steps)
- Cell cycle checkpoints and state transitions
- Gene regulation networks
- Immune response sequences
- Any multi-step biological process with decision points

**Advantages over templates:**
- Fully customizable to match the specific question
- Can show branching, feedback loops, and decision points
- Ideal for explaining "how" and "when" in biological processes

Provide valid Mermaid code (flowchart, sequence, or state diagram) to generate SVG outputs for the canvas.`,
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
    description: `Render **3D molecular structures** using PyMOL for high-quality protein and nucleic acid visualization.

**PREFERRED for molecular-level biology:**
- Protein structures (Cas9, hemoglobin, antibodies, enzymes)
- Protein-DNA/RNA complexes (CRISPR-Cas9 bound to DNA)
- Active sites and binding pockets
- Enzyme-substrate interactions
- Structural biology and molecular mechanisms

**When to use:**
- Questions about protein structure, shape, or molecular interactions
- Explaining "how" proteins work at the molecular level
- Showing specific residues or domains (can highlight)

Requires PDB ID (e.g., "4OO8" for Cas9). Supports multiple styles: cartoon, surface, sticks, spheres, electrostatic.`,
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
    description: `Lookup a protein by name via UniProt to retrieve metadata, accession IDs, and related structure information before visualization.`,
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
    name: 'sequential_thinking',
    description: `Use structured sequential thinking to break down complex problems into steps.

Use this tool when you need to:
- Solve complex multi-step problems
- Break down difficult concepts into manageable pieces
- Work through proofs or derivations step-by-step
- Analyze problems that require careful reasoning
- Show your thinking process explicitly

This tool helps you think through problems systematically before explaining them to the student.`,
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
  create_mermaid_diagram: 'mermaid',
  visualize_molecule: 'chatmol',
  fetch_protein: 'chatmol',
  sequential_thinking: 'sequential-thinking',
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
    toolName === 'create_mermaid_diagram' ||
    toolName === 'visualize_molecule'
  );
}

/**
 * Check if a tool is a thinking tool that enhances reasoning
 */
export function isThinkingTool(toolName: string): boolean {
  return toolName === 'sequential_thinking';
}
