/**
 * Brain Selector
 * 
 * Intelligently selects the most appropriate brain for a given question
 */

import Anthropic from '@anthropic-ai/sdk';
import { Brain, BrainType, BrainSelectionResult } from '@/types/brain';
import { BRAINS } from './brainRegistry';
import { logger } from '@/lib/utils/logger';

export class BrainSelector {
  private anthropic: Anthropic;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    this.anthropic = new Anthropic({ apiKey: this.apiKey });
  }

  /**
   * Select the most appropriate brain for a given question
   */
  async selectBrain(question: string, context?: {
    recentTopics?: string[];
    canvasObjects?: any[];
  }): Promise<BrainSelectionResult> {
    try {
      const brainDescriptions = Object.values(BRAINS).map(brain => ({
        type: brain.type,
        name: brain.name,
        description: brain.description,
        capabilities: brain.capabilities,
      }));

      const contextInfo = context?.recentTopics?.length 
        ? `Recent topics discussed: ${context.recentTopics.join(', ')}`
        : '';

      const systemPrompt = `You are a brain selector for an AI tutoring platform. Analyze the user's question and select the most appropriate specialized brain.

Available brains:
${JSON.stringify(brainDescriptions, null, 2)}

Respond with a JSON object containing:
- selectedBrainType: One of "math", "biology", "code", "design", or "general"
- confidence: A score from 0-1 indicating how confident you are in this selection
- reasoning: A brief explanation of why this brain is most appropriate`;

      const userPrompt = `Question: "${question}"
${contextInfo}

Select the most appropriate brain for this question.`;

      const response = await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307', // Fast and cheap for brain selection
        max_tokens: 500,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from brain selector');
      }

      // Parse JSON response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in brain selector response');
      }

      const result = JSON.parse(jsonMatch[0]);
      const selectedBrain = BRAINS[result.selectedBrainType as BrainType] || BRAINS.general;

      logger.info('Brain selected', {
        question: question.substring(0, 100),
        selectedBrain: selectedBrain.type,
        confidence: result.confidence,
        reasoning: result.reasoning,
      });

      return {
        selectedBrain,
        confidence: result.confidence || 0.5,
        reasoning: result.reasoning || 'Default selection',
      };
    } catch (error) {
      logger.error('Brain selection failed, using general brain', error);
      return {
        selectedBrain: BRAINS.general,
        confidence: 0.3,
        reasoning: 'Brain selection failed, using general brain as fallback',
      };
    }
  }

  /**
   * Quick selection based on keywords (fallback when AI selection fails)
   */
  selectBrainByKeywords(question: string): Brain {
    const lowerQuestion = question.toLowerCase();

    // Math keywords
    if (/algebra|calculus|equation|function|graph|integral|derivative|theorem|proof/.test(lowerQuestion)) {
      return BRAINS.math;
    }

    // Biology keywords
    if (/cell|organism|biology|anatomy|molecule|protein|dna|rna|evolution/.test(lowerQuestion)) {
      return BRAINS.biology;
    }

    // Code keywords
    if (/code|programming|algorithm|function|variable|debug|syntax|loop|array/.test(lowerQuestion)) {
      return BRAINS.code;
    }

    // Design keywords
    if (/design|ui|ux|layout|color|typography|visual|aesthetic/.test(lowerQuestion)) {
      return BRAINS.design;
    }

    return BRAINS.general;
  }
}

export const brainSelector = new BrainSelector();
