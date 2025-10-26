/**
 * RAG Clear API Endpoint
 *
 * Clear the ChromaDB collection (development only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';

/**
 * DELETE /api/rag/clear
 * Clear the entire knowledge base (development only)
 */
export async function DELETE(request: NextRequest) {
  try {
    // Check if RAG is enabled
    if (process.env.ENABLE_RAG !== 'true') {
      return NextResponse.json(
        { error: 'RAG is not enabled' },
        { status: 503 }
      );
    }

    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Collection reset not allowed in production' },
        { status: 403 }
      );
    }

    // Dynamically import RAG services
    const { getChromaClient } = await import('@/lib/rag');
    const chromaClient = await getChromaClient();

    // Initialize ChromaDB client
    await chromaClient.initialize();

    // Reset the collection
    await chromaClient.resetCollection();

    logger.warn('⚠️ ChromaDB collection cleared');

    return NextResponse.json({
      success: true,
      message: 'Collection cleared successfully'
    });

  } catch (error) {
    logger.error('Failed to clear collection', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to clear collection' },
      { status: 500 }
    );
  }
}