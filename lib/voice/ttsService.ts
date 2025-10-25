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
}

export const ttsService = new TTSService();
