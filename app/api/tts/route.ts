import { NextRequest, NextResponse } from 'next/server';
import { ttsService } from '@/lib/voice/ttsService';
import { logger } from '@/lib/utils/logger';

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { text, voice = 'nova' } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required and must be a string' },
        {
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        }
      );
    }

    if (text.length > 4096) {
      return NextResponse.json(
        { error: 'Text too long. Maximum 4096 characters allowed.' },
        {
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        }
      );
    }

    logger.info('TTS request received', { textLength: text.length, voice });

    // Generate speech
    const audioBuffer = await ttsService.generateSpeech(text, voice);

    // Return audio as base64
    const base64Audio = audioBuffer.toString('base64');

    return NextResponse.json(
      { 
        audio: base64Audio,
        format: 'mp3',
        voice,
        textLength: text.length
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      }
    );

  } catch (error) {
    logger.error('TTS API error', { error: error instanceof Error ? error.message : 'Unknown error' });
    
    return NextResponse.json(
      { error: 'Failed to generate speech' },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      }
    );
  }
}
