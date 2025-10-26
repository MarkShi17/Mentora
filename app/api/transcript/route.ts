import { NextRequest, NextResponse } from 'next/server';
import { transcriber } from '@/lib/voice/transcriber';
import { TranscriptRequest, TranscriptResponse } from '@/types/api';
import { handleError, ValidationError } from '@/lib/utils/errors';
import { logger } from '@/lib/utils/logger';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as TranscriptRequest;

    if (!body.audio) {
      throw new ValidationError('Audio data is required');
    }

    if (!body.sessionId) {
      throw new ValidationError('Session ID is required');
    }

    logger.info('Transcribing audio', { sessionId: body.sessionId });

    const result = await transcriber.transcribe(body.audio);

    const response: TranscriptResponse = {
      text: result.text,
      confidence: result.confidence,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Failed to transcribe audio', error);
    const errorResponse = handleError(error);
    return NextResponse.json(
      { error: errorResponse.message },
      { status: errorResponse.statusCode }
    );
  }
}
