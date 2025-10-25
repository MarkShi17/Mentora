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
  sequential_thinking: 'sequential-thinking',
};

/**
 * Check if a tool is a visualization tool that should create canvas objects
 */
export function isVisualizationTool(toolName: string): boolean {
  return toolName === 'execute_python' || toolName === 'render_animation';
}

/**
 * Check if a tool is a thinking tool that enhances reasoning
 */
export function isThinkingTool(toolName: string): boolean {
  return toolName === 'sequential_thinking';
}
