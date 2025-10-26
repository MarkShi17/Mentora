import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/agent/sessionManager';
import { mentorAgent } from '@/lib/agent/mentorAgent';
import { synthesizer } from '@/lib/voice/synthesizer';
import { contextBuilder } from '@/lib/agent/contextBuilder';
import { QARequest, QAResponse, VoiceOption } from '@/types/api';
import { handleError, ValidationError } from '@/lib/utils/errors';
import { logger } from '@/lib/utils/logger';
import { generateTurnId } from '@/lib/utils/ids';

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
    const body = (await request.json()) as QARequest;

    // Validate request
    if (!body.sessionId) {
      throw new ValidationError('Session ID is required');
    }

    if (!body.question) {
      throw new ValidationError('Question is required');
    }

    logger.info('Processing QA request', {
      sessionId: body.sessionId,
      mode: body.mode || 'guided',
    });

    // Get session, create if it doesn't exist (fallback for in-memory storage issues)
    let session;
    let actualSessionId = body.sessionId;
    try {
      session = sessionManager.getSession(body.sessionId);
    } catch (error) {
      // Session not found, create a new one as fallback
      logger.warn(`Session ${body.sessionId} not found, creating fallback session`);
      session = sessionManager.createSession('math', `Session ${body.sessionId}`);
      actualSessionId = session.id; // Use the new session ID
    }

    // Add user turn
    sessionManager.addTurn(actualSessionId, {
      role: 'user',
      content: body.question,
      timestamp: Date.now(),
      highlightedContext: body.highlightedObjects
        ? {
            objectIds: body.highlightedObjects,
            summary: contextBuilder.buildHighlightedSummary(
              session.canvasObjects,
              body.highlightedObjects
            ),
          }
        : undefined,
    });

    const userName = body.userName?.trim() || '';
    const explanationLevel = body.explanationLevel || 'intermediate';
    const voice: VoiceOption = body.voice ?? 'alloy';

    // Generate teaching response
    const assistantTurnId = generateTurnId();
    const agentResponse = await mentorAgent.generateResponse(
      body.question,
      session,
      body.highlightedObjects,
      body.mode || 'guided',
      assistantTurnId,
      body.context,
      {
        userName,
        explanationLevel,
        voice,
      }
    );

    // Generate TTS audio
    let audioUrl: string | undefined;
    try {
      audioUrl = await synthesizer.synthesize(agentResponse.narration, voice);
    } catch (error) {
      logger.warn('TTS generation failed, continuing without audio', error);
    }

    // Add canvas objects to session
    sessionManager.addCanvasObjects(actualSessionId, agentResponse.canvasObjects);

    // Add assistant turn
    sessionManager.addTurn(actualSessionId, {
      role: 'assistant',
      content: agentResponse.text,
      timestamp: Date.now(),
      audioUrl,
      objectsCreated: agentResponse.canvasObjects.map(obj => obj.id),
      objectsReferenced: agentResponse.references.map(ref => ref.objectId),
    });

    // Build response
    logger.info('Agent response structure', {
      hasText: !!agentResponse.text,
      hasNarration: !!agentResponse.narration,
      hasCanvasObjects: !!agentResponse.canvasObjects,
      hasObjectPlacements: !!agentResponse.objectPlacements,
      hasReferences: !!agentResponse.references,
    });
    
    const response: QAResponse = {
      turnId: assistantTurnId,
      answer: {
        text: agentResponse.text,
        narration: agentResponse.narration,
        audioUrl,
      },
      canvasObjects: agentResponse.canvasObjects,
      objectPlacements: agentResponse.objectPlacements,
      references: agentResponse.references,
    };

    logger.info('QA request processed successfully', {
      turnId: assistantTurnId,
      objectsCreated: agentResponse.canvasObjects.length,
    });

    return NextResponse.json(response, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    logger.error('Failed to process QA request', error);
    const errorResponse = handleError(error);
    return NextResponse.json(
      { error: errorResponse.message },
      { 
        status: errorResponse.statusCode,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      }
    );
  }
}
