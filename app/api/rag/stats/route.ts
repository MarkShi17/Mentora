/**
 * RAG Statistics API Endpoint
 *
 * Get statistics about the ChromaDB knowledge base
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
import { safeGetStats } from '@/lib/rag/safeRagService';

/**
 * GET /api/rag/stats
 * Get knowledge base statistics
 */
export async function GET(request: NextRequest) {
  try {
    // Get stats using the safe service
    const stats = await safeGetStats();

    // Check if there was an error
    if ('error' in stats) {
      logger.warn('RAG stats unavailable', { error: stats.error });
      return NextResponse.json(stats, { status: 503 });
    }

    logger.info('RAG stats retrieved', {
      totalDocuments: stats.totalDocuments,
      isHealthy: stats.isHealthy
    });

    return NextResponse.json(stats);

  } catch (error) {
    logger.error('Failed to get RAG stats', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get stats' },
      { status: 500 }
    );
  }
}