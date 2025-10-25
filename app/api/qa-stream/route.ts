/**
 * Streaming QA API Endpoint
 *
 * Provides real-time Server-Sent Events (SSE) stream of teaching responses.
 * Claude generates content and OpenAI TTS speaks it sentence-by-sentence.
 */

import { NextRequest } from 'next/server';
import { sessionManager } from '@/lib/agent/sessionManager';
import { streamingOrchestrator } from '@/lib/agent/streamingOrchestrator';
import { contextBuilder } from '@/lib/agent/contextBuilder';
import { brainSelector } from '@/lib/agent/brainSelector';
import { StreamingQARequest } from '@/types/api';
import { ValidationError } from '@/lib/utils/errors';
import { logger } from '@/lib/utils/logger';
import { generateTurnId } from '@/lib/utils/ids';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  const encoder = new TextEncoder();

  // Create ReadableStream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;

      const safeEnqueue = (data: Uint8Array) => {
        if (!isClosed) {
          try {
            controller.enqueue(data);
          } catch (error) {
            logger.warn('Failed to enqueue data, stream may be closed', { error });
            isClosed = true;
          }
        }
      };

      const safeClose = () => {
        if (!isClosed) {
          try {
            controller.close();
            isClosed = true;
          } catch (error) {
            logger.warn('Failed to close stream, may already be closed', { error });
            isClosed = true;
          }
        }
      };

      try {
        const body = (await request.json()) as StreamingQARequest;

        // Validate request
        if (!body.sessionId) {
          throw new ValidationError('Session ID is required');
        }

        if (!body.question) {
          throw new ValidationError('Question is required');
        }

        logger.info('📥 Processing streaming QA request', {
          sessionId: body.sessionId,
          question: body.question,
          mode: body.mode || 'guided',
          highlightedObjects: body.highlightedObjects?.length || 0,
          hasContext: !!body.context
        });

        // Get session
        let session;
        let actualSessionId = body.sessionId;
        try {
          session = sessionManager.getSession(body.sessionId);
        } catch (error) {
          logger.warn(`Session ${body.sessionId} not found, creating fallback session`);
          session = sessionManager.createSession('general', `Session ${body.sessionId}`);
          actualSessionId = session.id;
        }

        // Add user turn
        const userTurnId = generateTurnId();
        logger.info('👤 User question', {
          turnId: userTurnId,
          question: body.question
        });

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

        // Generate assistant turn ID
        const assistantTurnId = generateTurnId();

        // Voice selection (use nova for warmer teaching tone)
        const voice = 'nova';

        logger.info('🤖 Starting AI response generation', {
          assistantTurnId,
          voice,
          sessionId: actualSessionId
        });

        // Select appropriate brain for this question
        const brainResult = await brainSelector.selectBrain(body.question, {
          recentTopics: body.context?.topics,
          canvasObjects: session.canvasObjects,
        });

        logger.info('🧠 Brain selected for streaming', {
          brain: brainResult.selectedBrain.type,
          model: brainResult.selectedBrain.model,
          confidence: brainResult.confidence,
          reasoning: brainResult.reasoning,
        });

        // Emit brain_selected event FIRST
        const brainEvent = `data: ${JSON.stringify({
          type: 'brain_selected',
          timestamp: Date.now(),
          data: {
            brain: brainResult.selectedBrain.type,
            model: brainResult.selectedBrain.model,
            confidence: brainResult.confidence,
            reasoning: brainResult.reasoning
          }
        })}\n\n`;
        safeEnqueue(encoder.encode(brainEvent));

        // Track generated objects and references for session update
        const generatedObjects: any[] = [];
        const generatedReferences: any[] = [];
        let fullText = '';

        // Stream response
        const responseStream = streamingOrchestrator.streamResponse(
          body.question,
          session,
          body.highlightedObjects || [],
          body.mode || 'guided',
          assistantTurnId,
          voice,
          body.context
        );

        for await (const event of responseStream) {
          // Track objects and references
          if (event.type === 'canvas_object') {
            logger.info('🎨 Canvas object created', {
              type: event.data.object.type,
              label: event.data.object.metadata?.referenceName || event.data.object.id
            });
            generatedObjects.push(event.data.object);
            sessionManager.addCanvasObjects(actualSessionId, [event.data.object]);
          }

          if (event.type === 'reference') {
            logger.debug('🔗 Reference created', {
              mention: event.data.mention
            });
            generatedReferences.push(event.data);
          }

          if (event.type === 'text_chunk') {
            logger.debug('📝 Text chunk', {
              sentenceIndex: event.data.sentenceIndex,
              text: event.data.text.substring(0, 50) + '...'
            });
            fullText += event.data.text + ' ';
          }

          if (event.type === 'audio_chunk') {
            logger.debug('🔊 Audio chunk generated', {
              sentenceIndex: event.data.sentenceIndex,
              audioLength: event.data.audio.length
            });
          }

          // Format as SSE and send
          const sseData = `data: ${JSON.stringify(event)}\n\n`;
          safeEnqueue(encoder.encode(sseData));
        }

        // Add assistant turn to session
        sessionManager.addTurn(actualSessionId, {
          role: 'assistant',
          content: fullText.trim(),
          timestamp: Date.now(),
          objectsCreated: generatedObjects.map(obj => obj.id),
          objectsReferenced: generatedReferences.map(ref => ref.objectId),
        });

        logger.info('✅ Streaming QA request completed', {
          turnId: assistantTurnId,
          objectsCreated: generatedObjects.length,
          references: generatedReferences.length,
          responseLength: fullText.length
        });

        // Close stream
        safeClose();
      } catch (error) {
        logger.error('Streaming QA request failed', { error });

        // Send error event
        const errorEvent = {
          type: 'error',
          timestamp: Date.now(),
          data: {
            message: error instanceof Error ? error.message : 'Unknown error occurred',
            code: error instanceof ValidationError ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
          },
        };

        const sseData = `data: ${JSON.stringify(errorEvent)}\n\n`;
        safeEnqueue(encoder.encode(sseData));
        safeClose();
      }
    },

    cancel() {
      logger.info('SSE stream cancelled by client');
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
