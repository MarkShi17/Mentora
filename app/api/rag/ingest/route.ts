/**
 * RAG Ingestion API Endpoint
 *
 * Manually trigger ingestion of canvas objects and conversation turns
 */

import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/agent/sessionManager';
import { logger } from '@/lib/utils/logger';
import { RAGIngestRequest } from '@/types/rag';
import { getRagServices, isChromaDBAvailable } from '@/lib/rag/ragWrapper';

/**
 * POST /api/rag/ingest
 * Manually ingest session data into ChromaDB
 */
export async function POST(request: NextRequest) {
  try {
    // Check if ChromaDB is available
    const available = await isChromaDBAvailable();
    if (!available) {
      return NextResponse.json(
        { error: 'RAG is not enabled or ChromaDB is not available' },
        { status: 503 }
      );
    }

    const body = await request.json() as RAGIngestRequest;

    if (!body.sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Get session
    const session = sessionManager.getSession(body.sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Get RAG services through the wrapper
    const services = await getRagServices();
    const chromaClient = await services.getChromaClient();
    const ingestionService = await services.getIngestionService();

    // Initialize ChromaDB client
    await chromaClient.initialize();

    let ingestedObjects = 0;
    let ingestedTurns = 0;

    if (body.ingestAll) {
      // Ingest all canvas objects and turns
      const allTurns = session.turns.map((turn, index) => ({
        question: turn.role === 'user' ? turn.content : '',
        response: turn.role === 'assistant' ? turn.content : '',
        turnId: `turn_${session.id}_${index}`,
        objects: []
      })).filter(t => t.question || t.response);

      await ingestionService.ingestBatch(
        session.canvasObjects,
        allTurns,
        session.id,
        session.subject || 'general'
      );

      ingestedObjects = session.canvasObjects.length;
      ingestedTurns = allTurns.length;

    } else if (body.objectIds && body.objectIds.length > 0) {
      // Ingest specific objects
      const objects = session.canvasObjects.filter(
        obj => body.objectIds!.includes(obj.id)
      );

      for (const obj of objects) {
        await ingestionService.ingestCanvasObject(
          obj,
          session.id,
          obj.metadata?.turnId || 'manual',
          session.subject || 'general'
        );
        ingestedObjects++;
      }

    } else {
      // Ingest last turn
      const lastTurn = session.turns[session.turns.length - 1];
      if (lastTurn) {
        const turnObjects = session.canvasObjects.filter(
          obj => obj.metadata?.turnId === lastTurn.id
        );

        await ingestionService.ingestConversationTurn(
          {
            question: lastTurn.role === 'user' ? lastTurn.content : '',
            response: lastTurn.role === 'assistant' ? lastTurn.content : '',
            objects: turnObjects.map(o => o.id)
          },
          session.id,
          lastTurn.id,
          session.subject || 'general'
        );

        ingestedTurns = 1;
        ingestedObjects = turnObjects.length;
      }
    }

    logger.info('Manual ingestion completed', {
      sessionId: body.sessionId,
      ingestedObjects,
      ingestedTurns
    });

    return NextResponse.json({
      success: true,
      ingestedObjects,
      ingestedTurns,
      sessionId: body.sessionId
    });

  } catch (error) {
    logger.error('RAG ingestion failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ingestion failed' },
      { status: 500 }
    );
  }
}