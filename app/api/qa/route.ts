import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/agent/sessionManager';
import { mentorAgent } from '@/lib/agent/mentorAgent';
import { synthesizer } from '@/lib/voice/synthesizer';
import { contextBuilder } from '@/lib/agent/contextBuilder';
import { QARequest, QAResponse } from '@/types/api';
import { handleError, ValidationError } from '@/lib/utils/errors';
import { logger } from '@/lib/utils/logger';
import { generateTurnId } from '@/lib/utils/ids';

export async function POST(request: NextRequest): Promise<NextResponse<QAResponse>> {
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

    // Get session
    const session = sessionManager.getSession(body.sessionId);

    // Add user turn
    const userTurnId = generateTurnId();
    sessionManager.addTurn(body.sessionId, {
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

    // Generate teaching response
    const assistantTurnId = generateTurnId();
    const agentResponse = await mentorAgent.generateResponse(
      body.question,
      session,
      body.highlightedObjects,
      body.mode || 'guided',
      assistantTurnId
    );

    // Generate TTS audio
    let audioUrl: string | undefined;
    try {
      audioUrl = await synthesizer.synthesize(agentResponse.narration);
    } catch (error) {
      logger.warn('TTS generation failed, continuing without audio', error);
    }

    // Add canvas objects to session
    sessionManager.addCanvasObjects(body.sessionId, agentResponse.canvasObjects);

    // Add assistant turn
    sessionManager.addTurn(body.sessionId, {
      role: 'assistant',
      content: agentResponse.text,
      timestamp: Date.now(),
      audioUrl,
      objectsCreated: agentResponse.canvasObjects.map(obj => obj.id),
      objectsReferenced: agentResponse.references.map(ref => ref.objectId),
    });

    // Build response
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

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Failed to process QA request', error);
    const errorResponse = handleError(error);
    return NextResponse.json(
      { error: errorResponse.message },
      { status: errorResponse.statusCode }
    );
  }
}
