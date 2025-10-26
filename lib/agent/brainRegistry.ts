/**
 * Brain Registry
 * 
 * Defines all available specialized brains with their capabilities and MCP tools
 */

import { Brain, BrainType } from '@/types/brain';

export const BRAINS: Record<BrainType, Brain> = {
  math: {
    id: 'math',
    type: 'math',
    name: 'Math Brain',
    description: 'Specialized for mathematical concepts, equations, proofs, and visualizations',
    capabilities: [
      'Algebra and calculus',
      'Mathematical proofs and derivations',
      'Animated mathematical visualizations',
      'Step-by-step problem solving',
      'Function analysis and graphing',
    ],
    model: 'claude-3-5-haiku-20241022', // Fast for math
    mcpTools: ['render_animation', 'sequentialthinking'],
    promptEnhancement: `You are a specialized math tutor. Focus on:
- Breaking down complex mathematical concepts into clear steps
- Using Manim for stunning animated mathematical visualizations
- Applying sequential thinking for structured problem solving
- Creating visual proofs and demonstrations
- Explaining mathematical relationships dynamically`,
  },

  biology: {
    id: 'biology',
    type: 'biology',
    name: 'Biology Brain',
    description: 'Specialized for biological concepts, diagrams, and scientific visualizations',
    capabilities: [
      'Cell biology diagrams',
      'Anatomical structures',
      'Biological processes and cycles',
      'Scientific data visualization',
      'Laboratory simulations',
      'Professional illustration sourcing',
      '3D molecular visualization',
    ],
    model: 'claude-3-5-haiku-20241022', // Fast for biology
    mcpTools: [
      'execute_python',
      'render_biology_diagram',
      'search_biorender',
      'get_biorender_figure',
      'generate',
      'visualize_molecule',
      'fetch_protein',
      'sequentialthinking',
    ],
    promptEnhancement: `Biology tutor with MCP visualization tools. Your goal: make each topic intuitive, accurate, and visually clear.
**CRITICAL: Always use MCP tools, NEVER generic "diagram" objects.**
Tool priority:
1. render_biology_diagram - for cell_cycle, crispr_mechanism, mitosis_phases, gene_expression, etc.
2. generate - for custom pathways (Mermaid flowcharts)
3. visualize_molecule - for 3D protein structures (use fetch_protein first)
4. execute_python - only if above don't fit

- Pair visuals with brief, structured explanations
- Emphasize function, mechanism, and significance
- Connect concepts to real-world examples
- Keep focused—avoid unnecessary detail`,
  }, //  - **BioRender-style** for cells, tissues, or systems when it strengthens understanding -----no work


  code: {
    id: 'code',
    type: 'code',
    name: 'Code Brain',
    description: 'Specialized for programming, algorithms, code examples, and GitHub integration',
    capabilities: [
      'Programming concepts and syntax',
      'Algorithm explanations',
      'Code examples and snippets',
      'GitHub code search',
      'Debugging assistance',
    ],
    model: 'claude-3-5-haiku-20241022', // Fast for code
    mcpTools: ['sequentialthinking'], // github integration when available
    promptEnhancement: `You are a specialized programming tutor. Focus on:
- Explaining code step-by-step with clear examples
- Breaking down algorithms into understandable parts
- Using sequential thinking for complex problem solving
- Providing practical code examples and best practices
- Teaching debugging and problem-solving skills`,
  },

  design: {
    id: 'design',
    type: 'design',
    name: 'Design Brain',
    description: 'Specialized for design concepts, visual aesthetics, and Figma integration',
    capabilities: [
      'UI/UX design principles',
      'Visual composition and layout',
      'Color theory and typography',
      'Design system references',
      'Figma component integration',
    ],
    model: 'claude-3-5-haiku-20241022', // Fast for design
    mcpTools: [], // figma integration when available
    promptEnhancement: `You are a specialized design tutor. Focus on:
- Teaching design principles and best practices
- Explaining visual composition and aesthetics
- Discussing color theory and typography
- Providing design critiques and suggestions
- Connecting design concepts to real examples`,
  },

  general: {
    id: 'general',
    type: 'general',
    name: 'General Brain',
    description: 'General-purpose teaching with flexible approach',
    capabilities: [
      'Adaptive teaching for any subject',
      'Context-aware explanations',
      'Flexible visualization creation',
      'Comprehensive coverage',
    ],
    model: 'claude-sonnet-4-5-20250929', // Powerful for general knowledge
    mcpTools: ['render_animation', 'execute_python', 'sequentialthinking'],
    promptEnhancement: `You are a versatile general tutor. Focus on:
- Adapting your teaching style to the subject matter
- Using appropriate visualizations for each topic
- Providing clear, comprehensive explanations
- Breaking down complex topics into digestible parts
- Creating engaging and informative content`,
  },
};

/**
 * Get brain configuration by type
 */
export function getBrain(type: BrainType): Brain {
  return BRAINS[type];
}

/**
 * Get all available brains
 */
export function getAllBrains(): Brain[] {
  return Object.values(BRAINS);
}
