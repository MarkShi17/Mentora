/**
 * Python RAG Service Client
 *
 * TypeScript client for the Python FastAPI RAG microservice
 * Provides multi-modal RAG capabilities via HTTP requests
 */

import { logger } from '@/lib/utils/logger';

// Configuration
const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || 'http://localhost:8006';

// Type definitions
export interface IngestRequest {
  ids: string[];
  documents?: string[];
  images?: string[];
  metadatas?: Array<Record<string, any>>;
}

export interface SearchRequest {
  query_texts?: string[];
  query_images?: string[];
  n_results?: number;
  where?: Record<string, any>;
  include_metadata?: boolean;
}

export interface SearchResult {
  ids: string[];
  documents: string[];
  metadatas: Array<Record<string, any>>;
  distances: number[];
  relevance_scores: number[];
  count: number;
}

export interface StatsResponse {
  total_documents: number;
  collection_name: string;
  by_type: Record<string, number>;
  by_subject: Record<string, number>;
  is_healthy: boolean;
}

export interface HealthResponse {
  status: string;
  chromadb: string;
  collection: string;
}

/**
 * Check if RAG service is available
 */
export async function isRAGServiceAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${RAG_SERVICE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });

    if (response.ok) {
      const data = await response.json();
      return data.status === 'healthy';
    }

    return false;
  } catch (error) {
    logger.debug('RAG service not available', { error });
    return false;
  }
}

/**
 * Get RAG service health status
 */
export async function getRAGHealth(): Promise<HealthResponse | null> {
  try {
    const response = await fetch(`${RAG_SERVICE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    logger.error('RAG health check failed', { error });
    return null;
  }
}

/**
 * Ingest documents into RAG
 */
export async function ingestDocuments(request: IngestRequest): Promise<{ success: boolean; count: number }> {
  try {
    const response = await fetch(`${RAG_SERVICE_URL}/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Ingestion failed: ${error.detail || response.statusText}`);
    }

    const result = await response.json();

    logger.info('Documents ingested to RAG', {
      count: result.count,
      collection: result.collection
    });

    return result;
  } catch (error) {
    logger.error('Failed to ingest documents', { error });
    throw error;
  }
}

/**
 * Search RAG knowledge base
 */
export async function searchRAG(request: SearchRequest): Promise<SearchResult> {
  try {
    const response = await fetch(`${RAG_SERVICE_URL}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(15000) // 15 second timeout
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Search failed: ${error.detail || response.statusText}`);
    }

    const result = await response.json();

    logger.debug('RAG search completed', {
      results: result.count,
      query: request.query_texts?.[0]?.substring(0, 50)
    });

    return result;
  } catch (error) {
    logger.error('Failed to search RAG', { error });
    throw error;
  }
}

/**
 * Get RAG statistics
 */
export async function getRAGStats(): Promise<StatsResponse> {
  try {
    const response = await fetch(`${RAG_SERVICE_URL}/stats`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Stats failed: ${error.detail || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    logger.error('Failed to get RAG stats', { error });
    throw error;
  }
}

/**
 * Clear RAG collection (development only)
 */
export async function clearRAGCollection(): Promise<void> {
  try {
    const response = await fetch(`${RAG_SERVICE_URL}/clear`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Clear failed: ${error.detail || response.statusText}`);
    }

    logger.info('RAG collection cleared');
  } catch (error) {
    logger.error('Failed to clear RAG collection', { error });
    throw error;
  }
}

/**
 * Delete specific documents from RAG
 */
export async function deleteDocuments(ids?: string[], where?: Record<string, any>): Promise<void> {
  try {
    const response = await fetch(`${RAG_SERVICE_URL}/delete`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids, where }),
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Delete failed: ${error.detail || response.statusText}`);
    }

    logger.info('Documents deleted from RAG', { ids, where });
  } catch (error) {
    logger.error('Failed to delete documents', { error });
    throw error;
  }
}

/**
 * Batch ingest canvas objects
 */
export async function ingestCanvasObjects(
  objects: any[],
  sessionId: string,
  subject: string
): Promise<void> {
  const ids: string[] = [];
  const documents: string[] = [];
  const metadatas: Array<Record<string, any>> = [];

  for (const obj of objects) {
    ids.push(obj.id);

    // Extract text content based on object type
    let content = '';
    if (obj.type === 'latex') {
      content = `LaTeX equation: ${obj.data.equation}`;
    } else if (obj.type === 'code') {
      content = `Code (${obj.data.language}): ${obj.data.code}`;
    } else if (obj.type === 'text') {
      content = obj.data.text;
    } else if (obj.type === 'diagram') {
      content = `Diagram: ${obj.data.description || 'Visual diagram'}`;
    } else if (obj.type === 'graph') {
      content = `Graph: ${obj.data.title || 'Mathematical graph'}`;
    }

    documents.push(content);

    // Add metadata
    metadatas.push({
      sessionId,
      subject,
      objectType: obj.type,
      objectId: obj.id,
      timestamp: Date.now(),
      ...(obj.metadata || {})
    });
  }

  await ingestDocuments({ ids, documents, metadatas });
}

/**
 * Ingest conversation turn
 */
export async function ingestConversation(
  turnId: string,
  question: string,
  response: string,
  sessionId: string,
  subject: string,
  objectIds: string[]
): Promise<void> {
  const conversationText = `Question: ${question}\n\nResponse: ${response}`;

  await ingestDocuments({
    ids: [turnId],
    documents: [conversationText],
    metadatas: [{
      type: 'conversation',
      sessionId,
      subject,
      turnId,
      question: question.substring(0, 200),
      objectIds: JSON.stringify(objectIds), // Convert array to JSON string
      objectCount: objectIds.length,
      timestamp: Date.now()
    }]
  });
}

/**
 * Search for relevant context
 */
export async function retrieveContext(
  query: string,
  sessionId?: string,
  subject?: string,
  topK: number = 5,
  minScore: number = 0.7
): Promise<{
  textSnippets: string[];
  relevanceScores: number[];
  metadata: Array<Record<string, any>>;
  objectIds: string[];
}> {
  // Build where filter
  const where: Record<string, any> = {};
  if (sessionId) where.sessionId = sessionId;
  if (subject) where.subject = subject;

  const results = await searchRAG({
    query_texts: [query],
    n_results: topK,
    where: Object.keys(where).length > 0 ? where : undefined
  });

  // Filter by minimum score
  const filtered = {
    textSnippets: [] as string[],
    relevanceScores: [] as number[],
    metadata: [] as Array<Record<string, any>>,
    objectIds: [] as string[]
  };

  for (let i = 0; i < results.count; i++) {
    if (results.relevance_scores[i] >= minScore) {
      filtered.textSnippets.push(results.documents[i]);
      filtered.relevanceScores.push(results.relevance_scores[i]);
      filtered.metadata.push(results.metadatas[i]);

      // Extract object IDs if available
      const objectId = results.metadatas[i]?.objectId;
      if (objectId && !filtered.objectIds.includes(objectId)) {
        filtered.objectIds.push(objectId);
      }
    }
  }

  logger.debug('Retrieved context from RAG', {
    query: query.substring(0, 50),
    results: filtered.textSnippets.length,
    objectIds: filtered.objectIds.length
  });

  return filtered;
}
