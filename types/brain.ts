/**
 * Brain System Types
 * 
 * Defines specialized "brains" with different capabilities and MCP tools
 */

export type BrainType = 'math' | 'biology' | 'code' | 'design' | 'general';

export interface Brain {
  id: string;
  type: BrainType;
  name: string;
  description: string;
  capabilities: string[];
  model: string; // Claude model to use (e.g., 'claude-3-5-haiku-20241022')
  mcpTools: string[]; // MCP tools this brain uses
  promptEnhancement: string; // Additional prompt instructions for this brain
}

export interface BrainSelectionResult {
  selectedBrain: Brain;
  confidence: number;
  reasoning: string;
}
