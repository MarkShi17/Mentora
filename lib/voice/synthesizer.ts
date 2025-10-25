import OpenAI from 'openai';
import { logger } from '@/lib/utils/logger';
import { ExternalServiceError } from '@/lib/utils/errors';

export class Synthesizer {
  private openai: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    this.openai = new OpenAI({ apiKey });
  }

  async synthesize(text: string): Promise<string> {
    try {
      logger.info('Starting TTS synthesis');

      const response = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice: 'alloy',
        input: text,
        response_format: 'mp3',
      });

      // Convert response to buffer
      const buffer = Buffer.from(await response.arrayBuffer());

      // Convert to base64 data URL
      const base64Audio = buffer.toString('base64');
      const dataUrl = `data:audio/mp3;base64,${base64Audio}`;

      logger.info('TTS synthesis completed successfully');

      return dataUrl;
    } catch (error) {
      logger.error('TTS synthesis failed', error);
      throw new ExternalServiceError(
        'Failed to synthesize speech. Please try again.',
        'OpenAI TTS'
      );
    }
  }

  async synthesizeWithTimings(text: string): Promise<{
    audioUrl: string;
    wordTimings: Array<{ word: string; start: number; end: number }>;
  }> {
    // For now, just synthesize without detailed timings
    // In a full implementation, you could use word-level timestamps
    const audioUrl = await this.synthesize(text);

    // Estimate word timings (simplified)
    const words = text.split(/\s+/);
    const estimatedDuration = words.length * 0.4; // ~400ms per word
    const wordTimings = words.map((word, index) => ({
      word,
      start: index * 0.4 * 1000,
      end: (index + 1) * 0.4 * 1000,
    }));

    return {
      audioUrl,
      wordTimings,
    };
  }
}

export const synthesizer = new Synthesizer();
