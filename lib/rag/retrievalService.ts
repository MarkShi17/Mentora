/**
 * Retrieval Service for ChromaDB RAG
 *
 * Handles multi-modal queries to retrieve relevant context from the knowledge base
 */

import { getChromaClient } from './chromaClient';
import { CanvasObject } from '@/types/canvas';
import { logger } from '@/lib/utils/logger';
import type { RetrievalParams, RetrievalResult } from './types';

// Extended types for internal use (backwards compatibility)
export interface ExtendedRetrievalParams extends RetrievalParams {
  currentMessage: string;
  highlightedObjects?: CanvasObject[];
  chatHistorySummary?: string;
}

export interface ExtendedRetrievalResult {
  textSnippets: string[];
  imageReferences: Array<{
    path: string;
    description: string;
    objectId: string;
    metadata: Record<string, any>;
  }>;
  canvasObjectIds: string[];
  relevanceScores: number[];
  metadata: Array<Record<string, any>>;
}

export class RetrievalService {
  private chromaClient = getChromaClient();

  /**
   * Retrieve relevant context from ChromaDB
   */
  public async retrieveContext(params: ExtendedRetrievalParams): Promise<ExtendedRetrievalResult> {
    try {
      const collection = await this.chromaClient.getCollection();

      // Build query texts
      const queryTexts: string[] = [];

      // Add current message
      if (params.currentMessage) {
        queryTexts.push(params.currentMessage);
      }

      // Add chat history summary
      if (params.chatHistorySummary) {
        queryTexts.push(params.chatHistorySummary);
      }

      // Add highlighted object content
      if (params.highlightedObjects && params.highlightedObjects.length > 0) {
        for (const obj of params.highlightedObjects) {
          if (obj.type === 'text' || obj.type === 'code') {
            queryTexts.push(obj.data.content);
          } else if (obj.type === 'latex') {
            queryTexts.push(`Equation: ${obj.data.equation}`);
          } else if (obj.type === 'graph') {
            queryTexts.push(`Graph: ${obj.data.equation}`);
          }
        }
      }

      // Build where clause for filtering
      const where: any = {};

      // Filter by subject if provided
      if (params.subject) {
        where.subject = { $eq: params.subject };
      }

      // Exclude current session to avoid self-references (optional)
      // if (params.sessionId) {
      //   where.sessionId = { $ne: params.sessionId };
      // }

      // Set retrieval parameters
      const topK = params.topK || parseInt(process.env.RAG_TOP_K || '5');
      const minScore = params.minRelevanceScore ||
                       parseFloat(process.env.RAG_MIN_RELEVANCE_SCORE || '0.7');

      logger.info('🔍 Querying ChromaDB', {
        queryCount: queryTexts.length,
        topK,
        subject: params.subject,
        hasHighlightedObjects: !!params.highlightedObjects?.length
      });

      // Query the collection
      const results = await collection.query({
        queryTexts,
        nResults: topK,
        where: Object.keys(where).length > 0 ? where : undefined,
        include: ['documents', 'metadatas', 'distances']
      });

      // Process and format results
      const retrievalResult: ExtendedRetrievalResult = {
        textSnippets: [],
        imageReferences: [],
        canvasObjectIds: [],
        relevanceScores: [],
        metadata: []
      };

      if (!results || !results.documents || results.documents.length === 0) {
        logger.debug('No results from ChromaDB query');
        return retrievalResult;
      }

      // Process each result set (one per query text)
      for (let i = 0; i < results.documents.length; i++) {
        const docs = results.documents[i] || [];
        const metas = results.metadatas?.[i] || [];
        const distances = results.distances?.[i] || [];

        for (let j = 0; j < docs.length; j++) {
          const doc = docs[j];
          const meta = metas[j] as any;
          const distance = distances[j];

          // Convert distance to relevance score (1 - normalized_distance)
          // ChromaDB returns L2 distance, smaller is better
          const relevanceScore = 1 / (1 + distance);

          // Skip if below minimum relevance threshold
          if (relevanceScore < minScore) {
            continue;
          }

          // Add to results
          if (doc) {
            retrievalResult.textSnippets.push(doc);
            retrievalResult.relevanceScores.push(relevanceScore);
          }

          if (meta) {
            retrievalResult.metadata.push(meta);

            // Extract canvas object IDs
            if (meta.objectId) {
              retrievalResult.canvasObjectIds.push(meta.objectId);
            }

            // Extract image references
            if (meta.objectType === 'image' || meta.objectType === 'video') {
              // Parse the document to extract path
              const pathMatch = doc?.match(/(image|video):\s*([^\s]+)/i);
              if (pathMatch) {
                retrievalResult.imageReferences.push({
                  path: pathMatch[2],
                  description: doc || '',
                  objectId: meta.objectId || '',
                  metadata: meta
                });
              }
            }

            // Add linked objects if any
            if (meta.linkedObjects && Array.isArray(meta.linkedObjects)) {
              retrievalResult.canvasObjectIds.push(...meta.linkedObjects);
            }
          }
        }
      }

      // Remove duplicates
      retrievalResult.canvasObjectIds = [...new Set(retrievalResult.canvasObjectIds)];

      // Sort by relevance score
      const sortedIndices = retrievalResult.relevanceScores
        .map((score, index) => ({ score, index }))
        .sort((a, b) => b.score - a.score)
        .map(item => item.index);

      // Reorder results by relevance
      retrievalResult.textSnippets = sortedIndices.map(i => retrievalResult.textSnippets[i]);
      retrievalResult.relevanceScores = sortedIndices.map(i => retrievalResult.relevanceScores[i]);
      retrievalResult.metadata = sortedIndices.map(i => retrievalResult.metadata[i]);

      // Limit to top K
      retrievalResult.textSnippets = retrievalResult.textSnippets.slice(0, topK);
      retrievalResult.relevanceScores = retrievalResult.relevanceScores.slice(0, topK);
      retrievalResult.metadata = retrievalResult.metadata.slice(0, topK);

      logger.info('✅ Retrieved context from ChromaDB', {
        snippetCount: retrievalResult.textSnippets.length,
        imageCount: retrievalResult.imageReferences.length,
        objectIdCount: retrievalResult.canvasObjectIds.length,
        topScore: retrievalResult.relevanceScores[0] || 0
      });

      return retrievalResult;

    } catch (error) {
      logger.error('Failed to retrieve context from ChromaDB', {
        error,
        params
      });

      // Return empty results on error (graceful degradation)
      return {
        textSnippets: [],
        imageReferences: [],
        canvasObjectIds: [],
        relevanceScores: [],
        metadata: []
      };
    }
  }

  /**
   * Search for specific content (for testing/debugging)
   */
  public async search(
    query: string,
    options?: {
      subject?: string;
      type?: 'canvas_object' | 'conversation';
      limit?: number;
    }
  ): Promise<RetrievalResult> {
    return this.retrieveContext({
      currentMessage: query,
      subject: options?.subject,
      topK: options?.limit || 10
    });
  }

  /**
   * Get similar objects to a given canvas object
   */
  public async findSimilarObjects(
    object: CanvasObject,
    topK: number = 5
  ): Promise<{
    objects: Array<{
      id: string;
      type: string;
      content: string;
      score: number;
    }>;
  }> {
    try {
      // Build query based on object type
      let query = '';
      switch (object.type) {
        case 'text':
        case 'code':
          query = object.data.content;
          break;
        case 'latex':
          query = `Equation: ${object.data.equation}`;
          break;
        case 'graph':
          query = `Graph: ${object.data.equation}`;
          break;
        case 'diagram':
          query = `Diagram: ${object.data.description}`;
          break;
        default:
          query = JSON.stringify(object.data);
      }

      const results = await this.retrieveContext({
        currentMessage: query,
        topK
      });

      const objects = results.metadata.map((meta: any, i: number) => ({
        id: meta.objectId || 'unknown',
        type: meta.objectType || 'unknown',
        content: results.textSnippets[i] || '',
        score: results.relevanceScores[i] || 0
      }));

      return { objects };

    } catch (error) {
      logger.error('Failed to find similar objects', { error });
      return { objects: [] };
    }
  }
}

// Export singleton instance
export const retrievalService = new RetrievalService();