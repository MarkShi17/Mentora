/**
 * Question Classifier
 *
 * Analyzes user questions to determine their type/category
 * for selecting appropriate cached intro responses
 */

import { QuestionCategory } from '@/lib/voice/cachedResponses';
import { logger } from '@/lib/utils/logger';

// Keywords for each category
const CATEGORY_KEYWORDS: Record<QuestionCategory, string[]> = {
  greeting: [
    'hello', 'hi', 'hey', 'good morning', 'good afternoon',
    'good evening', 'greetings', 'howdy'
  ],
  explanation: [
    'explain', 'how does', 'how do', 'why does', 'why do',
    'how come', 'tell me about', 'describe', 'walk me through',
    'break down', 'clarify', 'elaborate'
  ],
  calculation: [
    'calculate', 'compute', 'solve', 'what is', 'what\'s',
    'find the value', 'evaluate', 'add', 'subtract', 'multiply',
    'divide', 'equals', 'sum', 'product', 'quotient', 'difference',
    'plus', 'minus', 'times', 'divided', 'integral', 'derivative'
  ],
  concept: [
    'concept', 'theory', 'principle', 'idea', 'notion',
    'understand', 'grasp', 'comprehend', 'meaning of',
    'significance', 'importance'
  ],
  definition: [
    'what is a', 'what are', 'define', 'definition',
    'meaning', 'what does', 'stands for', 'refer to',
    'terminology', 'glossary'
  ],
  problem_solving: [
    'solve', 'problem', 'issue', 'challenge', 'help me',
    'assist', 'figure out', 'work through', 'approach',
    'strategy', 'method', 'technique', 'fix', 'debug'
  ],
  general: [] // Fallback category
};

export class QuestionClassifier {
  /**
   * Classify a question into a category based on keywords and patterns
   */
  static classifyQuestion(question: string): QuestionCategory {
    const lowerQuestion = question.toLowerCase().trim();

    // Check for greeting first (usually at the start)
    if (this.startsWithGreeting(lowerQuestion)) {
      logger.debug('Question classified as greeting', { question });
      return 'greeting';
    }

    // Score each category based on keyword matches
    const scores: Record<QuestionCategory, number> = {
      greeting: 0,
      explanation: 0,
      calculation: 0,
      concept: 0,
      definition: 0,
      problem_solving: 0,
      general: 0
    };

    // Calculate scores for each category
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (category === 'general') continue;

      for (const keyword of keywords) {
        if (lowerQuestion.includes(keyword)) {
          scores[category as QuestionCategory] += 1;

          // Give extra weight to certain patterns
          if (lowerQuestion.startsWith(keyword)) {
            scores[category as QuestionCategory] += 0.5;
          }
        }
      }
    }

    // Check for specific patterns that strongly indicate a category
    if (this.isCalculation(lowerQuestion)) {
      scores.calculation += 3;
    }
    if (this.isExplanation(lowerQuestion)) {
      scores.explanation += 3;
    }
    if (this.isDefinition(lowerQuestion)) {
      scores.definition += 3;
    }

    // Find the category with the highest score
    let maxScore = 0;
    let selectedCategory: QuestionCategory = 'general';

    for (const [category, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        selectedCategory = category as QuestionCategory;
      }
    }

    // If no clear category, use general
    if (maxScore === 0) {
      selectedCategory = 'general';
    }

    logger.debug('Question classified', {
      question: question.substring(0, 50),
      category: selectedCategory,
      scores
    });

    return selectedCategory;
  }

  /**
   * Check if question starts with a greeting
   */
  private static startsWithGreeting(question: string): boolean {
    const greetingStarters = [
      'hello', 'hi ', 'hey', 'good morning', 'good afternoon',
      'good evening', 'greetings', 'howdy'
    ];

    for (const greeting of greetingStarters) {
      if (question.startsWith(greeting)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if question is likely a calculation
   */
  private static isCalculation(question: string): boolean {
    // Check for mathematical expressions
    const mathPatterns = [
      /\d+\s*[\+\-\*\/\^]\s*\d+/,  // Basic arithmetic
      /what is \d+/,                // "what is 5 + 3"
      /calculate/,                   // Explicit calculation request
      /solve.*equation/,             // Equation solving
      /find.*value/,                 // Finding values
      /\d+\s*(plus|minus|times|divided)/  // Word-based math
    ];

    for (const pattern of mathPatterns) {
      if (pattern.test(question)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if question is asking for an explanation
   */
  private static isExplanation(question: string): boolean {
    const explanationPatterns = [
      /^(can you |could you |please )?explain/,
      /^how (does|do|did)/,
      /^why (does|do|did|is|are)/,
      /^tell me (about|how|why)/,
      /^walk me through/,
      /^help me understand/
    ];

    for (const pattern of explanationPatterns) {
      if (pattern.test(question)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if question is asking for a definition
   */
  private static isDefinition(question: string): boolean {
    const definitionPatterns = [
      /^what (is|are) (a |an |the )?[\w\s]+\??$/,
      /^define /,
      /definition of/,
      /what does .* mean/,
      /meaning of/
    ];

    for (const pattern of definitionPatterns) {
      if (pattern.test(question)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get confidence score for classification (for logging/debugging)
   */
  static getClassificationConfidence(
    question: string,
    category: QuestionCategory
  ): number {
    const lowerQuestion = question.toLowerCase().trim();
    let matchCount = 0;
    let totalKeywords = 0;

    if (category !== 'general') {
      const keywords = CATEGORY_KEYWORDS[category];
      totalKeywords = keywords.length;

      for (const keyword of keywords) {
        if (lowerQuestion.includes(keyword)) {
          matchCount++;
        }
      }
    }

    // Calculate confidence as percentage of keywords matched
    const confidence = totalKeywords > 0
      ? matchCount / totalKeywords
      : 0.5; // Default confidence for general category

    return Math.min(confidence, 1.0); // Cap at 100%
  }
}

// Export convenience function
export function classifyQuestion(question: string): QuestionCategory {
  return QuestionClassifier.classifyQuestion(question);
}