/**
 * RAG Search API Endpoint
 *
 * Search the ChromaDB knowledge base
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
import { RAGSearchRequest, RAGSearchResponse } from '@/types/rag';
import { getRagServices, isChromaDBAvailable } from '@/lib/rag/ragWrapper';

/**
 * POST /api/rag/search
 * Search the knowledge base
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

    const body = await request.json() as RAGSearchRequest;

    if (!body.query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Get RAG services through the wrapper
    const services = await getRagServices();
    const chromaClient = await services.getChromaClient();
    const retrievalService = await services.getRetrievalService();

    // Initialize ChromaDB client
    await chromaClient.initialize();

    const startTime = Date.now();

    // Perform search
    const results = await retrievalService.retrieveContext({
      currentMessage: body.query,
      subject: body.subject,
      topK: body.topK || 5,
      minRelevanceScore: parseFloat(process.env.RAG_MIN_RELEVANCE_SCORE || '0.7')
    });

    const queryTime = Date.now() - startTime;

    logger.info('RAG search completed', {
      query: body.query,
      resultsCount: results.textSnippets.length,
      queryTime
    });

    const response: RAGSearchResponse = {
      results: body.includeMetadata ? results : {
        ...results,
        metadata: [] // Remove metadata if not requested
      },
      queryTime
    };

    return NextResponse.json(response);

  } catch (error) {
    logger.error('RAG search failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    );
  }
}