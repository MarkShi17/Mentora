/**
 * Sentence Parser Utility
 *
 * Detects sentence boundaries in streaming text for progressive TTS generation.
 * Handles various punctuation marks and edge cases.
 */

export interface Sentence {
  text: string;
  index: number;
  isComplete: boolean;
}

export class SentenceParser {
  private buffer: string = '';
  private sentenceCount: number = 0;
  private readonly minSentenceLength: number = 10;

  // Sentence-ending punctuation
  private readonly endMarkers = /[.!?]+/;

  // Abbreviations that shouldn't trigger sentence breaks
  private readonly abbreviations = new Set([
    'Dr', 'Mr', 'Mrs', 'Ms', 'Prof', 'Sr', 'Jr',
    'etc', 'vs', 'e.g', 'i.e', 'cf', 'viz',
    'Ph.D', 'M.D', 'B.A', 'M.A', 'B.S', 'M.S'
  ]);

  /**
   * Add text chunk to buffer and extract complete sentences
   */
  addChunk(chunk: string): Sentence[] {
    this.buffer += chunk;
    return this.extractCompleteSentences();
  }

  /**
   * Extract all complete sentences from buffer
   */
  private extractCompleteSentences(): Sentence[] {
    const sentences: Sentence[] = [];

    // Split on sentence boundaries but keep the delimiter
    const parts = this.buffer.split(/([.!?]+\s+)/);

    let currentSentence = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      if (!part.trim()) continue;

      currentSentence += part;

      // Check if this is a sentence-ending delimiter
      if (this.endMarkers.test(part)) {
        const trimmed = currentSentence.trim();

        // Validate it's actually a complete sentence
        if (this.isCompleteSentence(trimmed)) {
          sentences.push({
            text: trimmed,
            index: this.sentenceCount++,
            isComplete: true
          });

          currentSentence = '';
        }
      }
    }

    // Update buffer with remaining incomplete text
    this.buffer = currentSentence;

    return sentences;
  }

  /**
   * Check if text is a complete sentence
   */
  private isCompleteSentence(text: string): boolean {
    // Too short to be a meaningful sentence
    if (text.length < this.minSentenceLength) {
      return false;
    }

    // Check if it ends with sentence-ending punctuation
    if (!this.endMarkers.test(text)) {
      return false;
    }

    // Check if it's just an abbreviation
    const words = text.split(/\s+/);
    const lastWord = words[words.length - 1]?.replace(/[.!?]+$/, '');

    if (this.abbreviations.has(lastWord)) {
      return false;
    }

    // Looks like a complete sentence
    return true;
  }

  /**
   * Get the current buffer (incomplete sentence)
   */
  getBuffer(): string {
    return this.buffer;
  }

  /**
   * Flush remaining buffer as final sentence
   */
  flush(): Sentence | null {
    if (!this.buffer.trim()) {
      return null;
    }

    const sentence: Sentence = {
      text: this.buffer.trim(),
      index: this.sentenceCount++,
      isComplete: true
    };

    this.buffer = '';
    return sentence;
  }

  /**
   * Reset parser state
   */
  reset(): void {
    this.buffer = '';
    this.sentenceCount = 0;
  }

  /**
   * Get current sentence count
   */
  getSentenceCount(): number {
    return this.sentenceCount;
  }
}

/**
 * Split text into sentences (synchronous utility)
 */
export function splitIntoSentences(text: string): string[] {
  const parser = new SentenceParser();
  const sentences = parser.addChunk(text);

  // Add any remaining buffer
  const final = parser.flush();
  if (final) {
    sentences.push(final);
  }

  return sentences.map(s => s.text);
}
