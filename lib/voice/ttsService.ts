import OpenAI from 'openai';
import { logger } from '@/lib/utils/logger';

export class TTSService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateSpeech(text: string, voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'nova'): Promise<Buffer> {
    try {
      logger.info('Generating speech with OpenAI TTS', { textLength: text.length, voice });

      const response = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice,
        input: text,
        response_format: 'mp3',
      });

      const buffer = Buffer.from(await response.arrayBuffer());
      logger.info('Speech generated successfully', { bufferSize: buffer.length });

      return buffer;
    } catch (error) {
      logger.error('Failed to generate speech', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new Error('Failed to generate speech');
    }
  }

  async generateSpeechStream(text: string, voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'nova'): Promise<ReadableStream> {
    try {
      logger.info('Generating speech stream with OpenAI TTS', { textLength: text.length, voice });

      const response = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice,
        input: text,
        response_format: 'mp3',
      });

      return response.body as ReadableStream;
    } catch (error) {
      logger.error('Failed to generate speech stream', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new Error('Failed to generate speech stream');
    }
  }

  /**
   * Generate speech for a sentence and return as base64
   * Optimized for low-latency streaming use cases
   */
  async generateSentenceSpeech(
    sentence: string,
    voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'nova',
    sentenceIndex: number = 0
  ): Promise<{ audio: string; format: 'mp3'; voice: string; text: string; sentenceIndex: number }> {
    try {
      logger.debug('Generating speech for sentence', {
        sentenceIndex,
        textLength: sentence.length,
        voice
      });

      const response = await this.openai.audio.speech.create({
        model: 'tts-1', // Use tts-1 for faster generation (vs tts-1-hd)
        voice,
        input: sentence,
        response_format: 'mp3',
      });

      const buffer = Buffer.from(await response.arrayBuffer());
      const base64Audio = buffer.toString('base64');

      logger.debug('Sentence speech generated', {
        sentenceIndex,
        bufferSize: buffer.length
      });

      return {
        audio: base64Audio,
        format: 'mp3',
        voice,
        text: sentence,
        sentenceIndex
      };
    } catch (error) {
      logger.error('Failed to generate sentence speech', {
        sentenceIndex,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Generate speech for multiple sentences in parallel
   * Returns results in order, even if some fail
   */
  async generateMultipleSentencesSpeech(
    sentences: string[],
    voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'nova',
    maxConcurrent: number = 3
  ): Promise<Array<{ audio: string; format: 'mp3'; voice: string; text: string; sentenceIndex: number } | null>> {
    logger.info('Generating speech for multiple sentences', {
      sentenceCount: sentences.length,
      maxConcurrent
    });

    const results: Array<{ audio: string; format: 'mp3'; voice: string; text: string; sentenceIndex: number } | null> = new Array(sentences.length).fill(null);

    // Process in batches to limit concurrency
    for (let i = 0; i < sentences.length; i += maxConcurrent) {
      const batch = sentences.slice(i, i + maxConcurrent);
      const batchPromises = batch.map((sentence, batchIndex) => {
        const sentenceIndex = i + batchIndex;
        return this.generateSentenceSpeech(sentence, voice, sentenceIndex)
          .catch((error) => {
            logger.warn('Failed to generate speech for sentence, continuing', {
              sentenceIndex,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            return null; // Return null for failed sentences
          });
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach((result, batchIndex) => {
        results[i + batchIndex] = result;
      });
    }

    return results;
  }
}

export const ttsService = new TTSService();
