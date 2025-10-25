import OpenAI from 'openai';
import { logger } from '@/lib/utils/logger';
import { ExternalServiceError } from '@/lib/utils/errors';

export class Transcriber {
  private openai: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    this.openai = new OpenAI({ apiKey });
  }

  async transcribe(audioBase64: string): Promise<{ text: string; confidence?: number }> {
    try {
      logger.info('Starting audio transcription');

      // Convert base64 to buffer
      const audioBuffer = this.base64ToBuffer(audioBase64);

      // Create a File-like object for the API
      const audioFile = new File([audioBuffer], 'audio.webm', { type: 'audio/webm' });

      // Call Whisper API
      const response = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'en',
      });

      logger.info('Transcription completed successfully');

      return {
        text: response.text,
      };
    } catch (error) {
      logger.error('Transcription failed', error);
      throw new ExternalServiceError(
        'Failed to transcribe audio. Please try again.',
        'OpenAI Whisper'
      );
    }
  }

  private base64ToBuffer(base64: string): Buffer {
    // Remove data URL prefix if present
    const base64Data = base64.replace(/^data:audio\/\w+;base64,/, '');
    return Buffer.from(base64Data, 'base64');
  }
}

export const transcriber = new Transcriber();
