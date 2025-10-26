/**
 * Cached Audio Responses
 *
 * Pre-generated audio clips for instant response feedback
 */

export type QuestionCategory =
  | 'greeting'
  | 'explanation'
  | 'calculation'
  | 'concept'
  | 'definition'
  | 'problem_solving'
  | 'general';

export interface CachedIntro {
  id: string;
  category: QuestionCategory;
  text: string;
  audio: string; // Base64 encoded audio
  voice: string;
  duration: number; // Duration in milliseconds
}

// Intro phrases for each category with variations
// NOTE: All phrases have trailing space for proper text concatenation
export const INTRO_PHRASES: Record<QuestionCategory, string[]> = {
  greeting: [
    "Hello! I'd be happy to help you with that. ",
    "Hi there! Let me assist you with this. ",
    "Great to hear from you! I can help with that. "
  ],
  explanation: [
    "Let me explain that for you. ",
    "I'll walk you through this step by step. ",
    "Sure, let me break this down for you. ",
    "I can definitely explain how this works. ",
    "Great question! Let me clarify that. "
  ],
  calculation: [
    "Let me work through this calculation. ",
    "I'll solve this step by step. ",
    "Let's calculate this together. ",
    "I can help you with this math problem. "
  ],
  concept: [
    "That's an interesting concept to explore. ",
    "Let me help you understand this concept. ",
    "This is a fundamental idea worth understanding. ",
    "I'll explain this concept clearly. "
  ],
  definition: [
    "Let me define that for you. ",
    "I'll explain what this means. ",
    "Here's what that term refers to. ",
    "Let me clarify this definition. "
  ],
  problem_solving: [
    "I'll help you work through this problem. ",
    "Let's solve this together. ",
    "I can guide you through the solution. ",
    "Let me show you how to approach this. "
  ],
  general: [
    "I can definitely help with that! ",
    "That's a great question! ",
    "Let me assist you with this. ",
    "I'm here to help! ",
    "Sure, I can help you understand that. "
  ]
};

// Storage for cached audio (will be populated by generation script)
export class CachedResponseManager {
  private cache: Map<string, CachedIntro> = new Map();
  private recentlyUsed: string[] = [];
  private maxRecentSize = 5;

  constructor() {
    // Initialize with empty cache
    // Will be populated by loadCache() method
  }

  /**
   * Load pre-generated audio cache from JSON
   */
  async loadCache(cacheData: CachedIntro[]): Promise<void> {
    for (const intro of cacheData) {
      this.cache.set(intro.id, intro);
    }
    console.log(`Loaded ${cacheData.length} cached audio intros`);
  }

  /**
   * Get a cached intro for a given category
   * Avoids recently used phrases for variety
   */
  getCachedIntro(category: QuestionCategory): CachedIntro | null {
    const categoryIntros = Array.from(this.cache.values())
      .filter(intro => intro.category === category);

    if (categoryIntros.length === 0) {
      // Fallback to general category
      const generalIntros = Array.from(this.cache.values())
        .filter(intro => intro.category === 'general');

      if (generalIntros.length === 0) {
        return null;
      }
      categoryIntros.push(...generalIntros);
    }

    // Filter out recently used intros
    const availableIntros = categoryIntros.filter(
      intro => !this.recentlyUsed.includes(intro.id)
    );

    // If all have been used recently, reset and use any
    const introsToChooseFrom = availableIntros.length > 0
      ? availableIntros
      : categoryIntros;

    // Select random intro
    const selected = introsToChooseFrom[
      Math.floor(Math.random() * introsToChooseFrom.length)
    ];

    // Track as recently used
    this.markAsUsed(selected.id);

    return selected;
  }

  /**
   * Mark an intro as recently used
   */
  private markAsUsed(id: string): void {
    // Remove if already in list
    this.recentlyUsed = this.recentlyUsed.filter(usedId => usedId !== id);

    // Add to front
    this.recentlyUsed.unshift(id);

    // Trim to max size
    if (this.recentlyUsed.length > this.maxRecentSize) {
      this.recentlyUsed = this.recentlyUsed.slice(0, this.maxRecentSize);
    }
  }

  /**
   * Get intro by specific ID
   */
  getIntroById(id: string): CachedIntro | null {
    return this.cache.get(id) || null;
  }

  /**
   * Check if cache is loaded
   */
  isCacheLoaded(): boolean {
    return this.cache.size > 0;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalIntros: number;
    byCategory: Record<QuestionCategory, number>;
    recentlyUsed: number;
  } {
    const byCategory: Record<string, number> = {};

    for (const intro of this.cache.values()) {
      byCategory[intro.category] = (byCategory[intro.category] || 0) + 1;
    }

    return {
      totalIntros: this.cache.size,
      byCategory: byCategory as Record<QuestionCategory, number>,
      recentlyUsed: this.recentlyUsed.length
    };
  }
}

// Singleton instance
export const cachedResponseManager = new CachedResponseManager();