/**
 * Safe RAG Service
 *
 * This service provides RAG functionality using the Python RAG microservice
 * Avoids JavaScript ChromaDB compatibility issues
 */

import { logger } from '@/lib/utils/logger';
import {
  isRAGServiceAvailable,
  retrieveContext,
  ingestCanvasObjects,
  ingestConversation,
  getRAGStats as getPythonRAGStats
} from './pythonRagClient';

/**
 * Check if RAG is enabled via environment variable
 */
export function isRAGEnabled(): boolean {
  return process.env.ENABLE_RAG === 'true';
}

/**
 * Extract content from canvas object for RAG indexing
 */
function extractObjectContent(obj: any): string {
  if (!obj) return '';

  switch (obj.type) {
    case 'latex':
      return `LaTeX equation: ${obj.data?.equation || ''}`;
    case 'code':
      return `Code (${obj.data?.language || 'unknown'}): ${obj.data?.code || ''}`;
    case 'text':
      return `Text: ${obj.data?.text || ''}`;
    case 'diagram':
      return `Diagram: ${obj.data?.description || 'Visual diagram'}`;
    case 'graph':
      return `Graph: ${obj.data?.title || 'Mathematical graph'}`;
    case 'image':
      return `Image: ${obj.data?.altText || obj.data?.url || 'Image content'}`;
    case 'video':
      return `Video: ${obj.data?.title || obj.data?.url || 'Video content'}`;
    case 'screenshot':
      return `Screenshot: ${obj.data?.description || 'Screenshot'}`;
    default:
      return `${obj.type}: ${JSON.stringify(obj.data || {})}`;
  }
}

/**
 * Safe RAG context retrieval using Python RAG service
 * Prioritizes highlighted objects and retrieves related content
 */
export async function safeRetrieveContext(
  currentMessage: string,
  highlightedObjects: any[],
  chatHistorySummary: string,
  sessionId: string,
  subject?: string
): Promise<{ context: string; objectIds: string[] }> {
  if (!isRAGEnabled()) {
    logger.debug('RAG disabled via environment');
    return { context: '', objectIds: [] };
  }

  try {
    // Check if Python RAG service is available
    const available = await isRAGServiceAvailable();
    if (!available) {
      logger.debug('Python RAG service not available');
      return { context: '', objectIds: [] };
    }

    // Build query from current message and highlighted objects
    let query = currentMessage;

    // Add highlighted object context if available
    if (highlightedObjects && highlightedObjects.length > 0) {
      const objectContext = highlightedObjects
        .map(obj => extractObjectContent(obj))
        .filter(Boolean)
        .join(' ');

      logger.info('🎯 RAG Query with Highlighted Objects', {
        highlightedCount: highlightedObjects.length,
        highlightedTypes: highlightedObjects.map(o => o.type),
        highlightedIds: highlightedObjects.map(o => o.id),
        objectContextLength: objectContext.length,
        objectContextPreview: objectContext.substring(0, 200)
      });

      if (objectContext) {
        query = `${currentMessage} Context: ${objectContext}`;
      }
    } else {
      logger.warn('⚠️ No highlighted objects in RAG query', {
        currentMessage: currentMessage.substring(0, 100)
      });
    }

    // Retrieve context from Python RAG service
    const retrieved = await retrieveContext(
      query,
      sessionId,
      subject,
      parseInt(process.env.RAG_TOP_K || '10'),
      parseFloat(process.env.RAG_MIN_RELEVANCE_SCORE || '0.2')
    );

    logger.info('📚 RAG CONTEXT RETRIEVED', {
      snippetCount: retrieved.textSnippets.length,
      relevanceScores: retrieved.relevanceScores,
      objectIds: retrieved.objectIds,
      topK: parseInt(process.env.RAG_TOP_K || '10'),
      minScore: parseFloat(process.env.RAG_MIN_RELEVANCE_SCORE || '0.2')
    });

    // Log each snippet for debugging
    retrieved.textSnippets.forEach((snippet, idx) => {
      logger.info(`📄 Snippet ${idx + 1}/${retrieved.textSnippets.length}`, {
        score: retrieved.relevanceScores[idx],
        metadata: retrieved.metadata[idx],
        preview: snippet.substring(0, 150) + (snippet.length > 150 ? '...' : '')
      });
    });

    // Format retrieved context for the AI
    const contextParts: string[] = [];

    if (retrieved.textSnippets.length > 0) {
      contextParts.push('\n📚 RETRIEVED KNOWLEDGE (from previous sessions):');
      contextParts.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      retrieved.textSnippets.forEach((snippet, idx) => {
        const score = retrieved.relevanceScores[idx];
        const meta = retrieved.metadata[idx];

        // Add relevance indicator
        const relevanceIndicator = score > 0.8 ? '⭐' : score > 0.6 ? '•' : '◦';

        contextParts.push(`\n${relevanceIndicator} [${idx + 1}] `);

        // Add metadata context
        if (meta?.boosted) {
          contextParts.push('🎯 (from highlighted objects) ');
        } else if (meta?.type === 'conversation') {
          contextParts.push('(from previous conversation) ');
        } else if (meta?.objectType) {
          contextParts.push(`(${meta.objectType} object) `);
        }

        // Add the snippet (truncate if too long)
        const maxLength = 300;
        const trimmedSnippet = snippet.length > maxLength
          ? snippet.substring(0, maxLength) + '...'
          : snippet;

        contextParts.push(trimmedSnippet);
      });

      contextParts.push('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      contextParts.push('\nUse this retrieved knowledge to provide more informed and contextual responses.');
    }

    return {
      context: contextParts.length > 0 ? contextParts.join('\n') : '',
      objectIds: retrieved.objectIds
    };

  } catch (error) {
    logger.error('Failed to retrieve RAG context', { error });
    return { context: '', objectIds: [] };
  }
}

/**
 * Safe auto-ingestion using Python RAG service
 */
export async function safeAutoIngest(
  sessionId: string,
  turnId: string,
  objects: any[],
  question: string,
  response: string,
  subject: string
): Promise<void> {
  if (!isRAGEnabled() || process.env.RAG_AUTO_INGEST === 'false') {
    return;
  }

  try {
    // Check if Python RAG service is available
    const available = await isRAGServiceAvailable();
    if (!available) {
      logger.debug('Python RAG service not available, skipping ingestion');
      return;
    }

    // Ingest canvas objects if any
    if (objects && objects.length > 0) {
      await ingestCanvasObjects(objects, sessionId, subject);
      logger.debug('Ingested canvas objects to RAG', {
        count: objects.length,
        sessionId
      });
    }

    // Ingest conversation
    await ingestConversation(
      turnId,
      question,
      response,
      sessionId,
      subject,
      objects.map(o => o.id)
    );

    logger.info('Auto-ingested to RAG', {
      sessionId,
      turnId,
      objectCount: objects.length
    });

  } catch (error) {
    logger.error('Auto-ingestion failed', { error });
    // Don't throw - ingestion failure shouldn't break the main flow
  }
}

/**
 * Get RAG stats using Python service
 */
export async function safeGetStats() {
  if (!isRAGEnabled()) {
    return {
      error: 'RAG is disabled',
      enabled: false,
      available: false
    };
  }

  try {
    // Check if Python RAG service is available
    const available = await isRAGServiceAvailable();
    if (!available) {
      return {
        error: 'Python RAG service not available',
        enabled: true,
        available: false
      };
    }

    // Get stats from Python service
    const stats = await getPythonRAGStats();

    return {
      totalDocuments: stats.total_documents,
      byType: stats.by_type,
      bySubject: stats.by_subject,
      recentIngestions: 0, // Not tracked in Python service yet
      collectionName: stats.collection_name,
      isHealthy: stats.is_healthy,
      lastUpdated: Date.now(),
      enabled: true,
      available: true,
      config: {
        ragServiceUrl: process.env.RAG_SERVICE_URL || 'http://localhost:8006',
        chromaDbUrl: process.env.CHROMADB_URL || 'http://chromadb:8000',
        collectionName: process.env.CHROMADB_COLLECTION || 'mentora_knowledge',
        embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
        topK: parseInt(process.env.RAG_TOP_K || '5'),
        minRelevanceScore: parseFloat(process.env.RAG_MIN_RELEVANCE_SCORE || '0.7'),
        autoIngest: process.env.RAG_AUTO_INGEST !== 'false'
      }
    };
  } catch (error) {
    logger.error('Failed to get RAG stats', { error });
    return {
      error: error instanceof Error ? error.message : 'Failed to get stats',
      enabled: true,
      available: false
    };
  }
}