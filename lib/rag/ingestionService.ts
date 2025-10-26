/**
 * Ingestion Service for ChromaDB
 *
 * Handles ingesting canvas objects and conversation turns into the vector database
 */

import { getChromaClient } from './chromaClient';
import { CanvasObject } from '@/types/canvas';
import { Turn } from '@/types/session';
import { logger } from '@/lib/utils/logger';
import type { IngestionMetadata } from './types';

export class IngestionService {
  private chromaClient = getChromaClient();

  /**
   * Ingest a canvas object into ChromaDB
   */
  public async ingestCanvasObject(
    object: CanvasObject,
    sessionId: string,
    turnId: string,
    subject: string
  ): Promise<void> {
    try {
      const collection = await this.chromaClient.getCollection();

      // Prepare document based on object type
      let document = '';
      let metadata: IngestionMetadata = {
        type: 'canvas_object',
        sessionId,
        turnId,
        objectId: object.id,
        objectType: object.type,
        timestamp: Date.now(),
        subject,
        tags: object.metadata?.tags || []
      };

      switch (object.type) {
        case 'text':
          document = object.data.content;
          break;

        case 'code':
          document = object.data.content;
          metadata.language = object.data.language || 'unknown';
          metadata.tags.push(`lang:${metadata.language}`);
          break;

        case 'latex':
          // Store both the LaTeX and a description
          document = `LaTeX equation: ${object.data.equation}`;
          if (object.data.referenceName) {
            document += ` (${object.data.referenceName})`;
          }
          metadata.tags.push('math', 'equation');
          break;

        case 'image':
        case 'video':
          // Store description and path for multi-modal objects
          document = `${object.type}: ${object.data.url || object.data.src}`;
          if (object.data.alt) {
            document += ` - ${object.data.alt}`;
          }
          metadata.tags.push('visual', object.type);
          break;

        case 'diagram':
          // Store diagram description
          document = `Diagram: ${object.data.description || 'Visual diagram'}`;
          metadata.tags.push('visual', 'diagram');
          break;

        case 'graph':
          // Store graph equation and description
          document = `Graph of function: ${object.data.equation}`;
          metadata.tags.push('math', 'graph');
          break;

        default:
          logger.warn('Unknown object type for ingestion', { type: object.type });
          return;
      }

      // Add to collection
      await collection.add({
        ids: [`${object.type}_${object.id}`],
        documents: [document],
        metadatas: [metadata as any],
        // For images/videos, we could store embeddings separately if we have image paths
        // images: object.type === 'image' ? [object.data.src] : undefined
      });

      logger.debug('✅ Ingested canvas object', {
        objectId: object.id,
        type: object.type,
        sessionId,
        turnId
      });

    } catch (error) {
      logger.error('Failed to ingest canvas object', {
        objectId: object.id,
        error
      });
      throw error;
    }
  }

  /**
   * Ingest a conversation turn
   */
  public async ingestConversationTurn(
    turn: {
      question: string;
      response: string;
      objects?: string[];
    },
    sessionId: string,
    turnId: string,
    subject: string
  ): Promise<void> {
    try {
      const collection = await this.chromaClient.getCollection();

      // Combine question and response for better context
      const document = `Question: ${turn.question}\n\nAnswer: ${turn.response}`;

      const metadata: IngestionMetadata = {
        type: 'conversation',
        sessionId,
        turnId,
        timestamp: Date.now(),
        subject,
        tags: ['conversation', `subject:${subject}`]
      };

      // Add linked object IDs if any
      if (turn.objects && turn.objects.length > 0) {
        metadata.tags.push('has_objects');
        (metadata as any).linkedObjects = turn.objects;
      }

      await collection.add({
        ids: [`conv_${turnId}`],
        documents: [document],
        metadatas: [metadata as any]
      });

      logger.debug('✅ Ingested conversation turn', {
        turnId,
        sessionId,
        objectCount: turn.objects?.length || 0
      });

    } catch (error) {
      logger.error('Failed to ingest conversation turn', {
        turnId,
        error
      });
      throw error;
    }
  }

  /**
   * Batch ingest multiple objects
   */
  public async ingestBatch(
    objects: CanvasObject[],
    turns: Array<{
      question: string;
      response: string;
      turnId: string;
      objects?: string[];
    }>,
    sessionId: string,
    subject: string
  ): Promise<void> {
    try {
      const collection = await this.chromaClient.getCollection();

      const ids: string[] = [];
      const documents: string[] = [];
      const metadatas: any[] = [];

      // Process canvas objects
      for (const object of objects) {
        let document = '';
        let metadata: IngestionMetadata = {
          type: 'canvas_object',
          sessionId,
          turnId: object.metadata?.turnId || 'unknown',
          objectId: object.id,
          objectType: object.type,
          timestamp: object.metadata?.createdAt || Date.now(),
          subject,
          tags: object.metadata?.tags || []
        };

        // Extract document based on type (similar to ingestCanvasObject)
        switch (object.type) {
          case 'text':
            document = object.data.content;
            break;
          case 'code':
            document = object.data.content;
            metadata.language = object.data.language || 'unknown';
            break;
          case 'latex':
            document = `LaTeX equation: ${object.data.equation}`;
            break;
          case 'image':
          case 'video':
            document = `${object.type}: ${object.data.url || object.data.src}`;
            break;
          case 'diagram':
            document = `Diagram: ${object.data.description || 'Visual diagram'}`;
            break;
          case 'graph':
            document = `Graph of function: ${object.data.equation}`;
            break;
          default:
            continue;
        }

        ids.push(`${object.type}_${object.id}`);
        documents.push(document);
        metadatas.push(metadata);
      }

      // Process conversation turns
      for (const turn of turns) {
        const document = `Question: ${turn.question}\n\nAnswer: ${turn.response}`;
        const metadata: IngestionMetadata = {
          type: 'conversation',
          sessionId,
          turnId: turn.turnId,
          timestamp: Date.now(),
          subject,
          tags: ['conversation', `subject:${subject}`]
        };

        if (turn.objects && turn.objects.length > 0) {
          (metadata as any).linkedObjects = turn.objects;
        }

        ids.push(`conv_${turn.turnId}`);
        documents.push(document);
        metadatas.push(metadata);
      }

      // Batch add to collection
      if (ids.length > 0) {
        await collection.add({
          ids,
          documents,
          metadatas
        });

        logger.info('✅ Batch ingested', {
          objectCount: objects.length,
          turnCount: turns.length,
          sessionId
        });
      }

    } catch (error) {
      logger.error('Failed to batch ingest', {
        sessionId,
        error
      });
      throw error;
    }
  }

  /**
   * Delete all documents for a session
   */
  public async deleteSession(sessionId: string): Promise<void> {
    try {
      const collection = await this.chromaClient.getCollection();

      // Query all documents for this session
      const results = await collection.get({
        where: {
          sessionId: { $eq: sessionId }
        }
      });

      if (results.ids && results.ids.length > 0) {
        await collection.delete({
          ids: results.ids
        });

        logger.info('🗑️ Deleted session data from ChromaDB', {
          sessionId,
          documentCount: results.ids.length
        });
      }

    } catch (error) {
      logger.error('Failed to delete session from ChromaDB', {
        sessionId,
        error
      });
      throw error;
    }
  }

  /**
   * Get ingestion statistics
   */
  public async getStats(): Promise<{
    totalDocuments: number;
    byType: Record<string, number>;
    bySubject: Record<string, number>;
    recentIngestions: number;
  }> {
    try {
      const collection = await this.chromaClient.getCollection();
      const allData = await collection.get();

      const stats = {
        totalDocuments: allData.ids?.length || 0,
        byType: {} as Record<string, number>,
        bySubject: {} as Record<string, number>,
        recentIngestions: 0
      };

      if (allData.metadatas) {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);

        for (const metadata of allData.metadatas) {
          // Count by type
          const type = (metadata as any)?.type || 'unknown';
          stats.byType[type] = (stats.byType[type] || 0) + 1;

          // Count by subject
          const subject = (metadata as any)?.subject || 'general';
          stats.bySubject[subject] = (stats.bySubject[subject] || 0) + 1;

          // Count recent
          const timestamp = (metadata as any)?.timestamp;
          if (timestamp && timestamp > oneHourAgo) {
            stats.recentIngestions++;
          }
        }
      }

      return stats;

    } catch (error) {
      logger.error('Failed to get ingestion stats', error);
      throw error;
    }
  }
}

// Export singleton instance
export const ingestionService = new IngestionService();