/**
 * RAG Wrapper - Conditional loading of RAG modules
 *
 * This wrapper ensures RAG modules are only loaded when ChromaDB is available
 * Prevents build-time import errors in Docker environments
 */

import { logger } from '@/lib/utils/logger';

// Check if ChromaDB is available by attempting to resolve the module
export async function isChromaDBAvailable(): Promise<boolean> {
  if (process.env.ENABLE_RAG !== 'true') {
    return false;
  }

  try {
    // Try to resolve chromadb module without importing
    await eval(`import('chromadb')`);
    return true;
  } catch (error) {
    logger.warn('ChromaDB not available - RAG features disabled', error);
    return false;
  }
}

// Lazy load RAG services only if ChromaDB is available
export async function getRagServices() {
  const available = await isChromaDBAvailable();

  if (!available) {
    throw new Error('RAG is not enabled or ChromaDB is not available');
  }

  // Only import RAG modules if ChromaDB is confirmed available
  // Use eval to completely avoid build-time analysis
  const ragModule = await eval(`import('./index')`);
  return {
    getChromaClient: ragModule.getChromaClient,
    getIngestionService: ragModule.getIngestionService,
    getRetrievalService: ragModule.getRetrievalService
  };
}

// Export a safe stats function that checks availability first
export async function getRAGStats() {
  try {
    const available = await isChromaDBAvailable();

    if (!available) {
      return {
        error: 'RAG is not enabled or ChromaDB is not available',
        enabled: false,
        available: false
      };
    }

    // Import and use RAG services
    const services = await getRagServices();
    const chromaClient = await services.getChromaClient();
    const ingestionService = await services.getIngestionService();

    // Initialize ChromaDB client
    await chromaClient.initialize();

    // Get stats from services
    const clientStats = await chromaClient.getStats();
    const ingestionStats = await ingestionService.getStats();

    return {
      totalDocuments: clientStats.totalDocuments,
      byType: ingestionStats.byType,
      bySubject: ingestionStats.bySubject,
      recentIngestions: ingestionStats.recentIngestions,
      collectionName: clientStats.collectionName,
      isHealthy: clientStats.isHealthy,
      lastUpdated: Date.now(),
      enabled: true,
      available: true,
      config: {
        chromaDbUrl: process.env.CHROMADB_URL || 'http://chromadb:8000',
        collectionName: process.env.CHROMADB_COLLECTION || 'mentora_knowledge',
        embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-ada-002',
        topK: parseInt(process.env.RAG_TOP_K || '5'),
        minRelevanceScore: parseFloat(process.env.RAG_MIN_RELEVANCE_SCORE || '0.7'),
        autoIngest: process.env.RAG_AUTO_INGEST !== 'false'
      }
    };
  } catch (error) {
    logger.error('Failed to get RAG stats', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to get stats',
      enabled: process.env.ENABLE_RAG === 'true',
      available: false
    };
  }
}