import { Session, Turn } from '@/types/session';
import { CanvasObject } from '@/types/canvas';
import { logger } from '@/lib/utils/logger';
import type { RAGRetrievalResult } from '@/types/rag';

export interface TeachingContext {
  conversationHistory: string;
  highlightedObjects: string;
  canvasState: string;
  recentTopics: string[];
  ragContext?: string;
  retrievedObjects?: string[];
}

export class ContextBuilder {
  async buildContext(
    session: Session,
    currentQuestion: string,
    highlightedObjectIds?: string[],
    highlightedObjectsData?: CanvasObject[],  // Direct object data from frontend
    maxTurns: number = 10
  ): Promise<TeachingContext> {
    const recentTurns = session.turns.slice(-maxTurns);
    const conversationHistory = this.formatConversationHistory(recentTurns);

    // Use provided highlighted objects data from frontend, or fall back to session objects
    const objectsToFormat = highlightedObjectsData && highlightedObjectsData.length > 0
      ? highlightedObjectsData
      : session.canvasObjects;

    const highlightedObjects = highlightedObjectIds && highlightedObjectIds.length > 0
      ? this.formatHighlightedObjects(objectsToFormat, highlightedObjectIds)
      : '';

    const canvasState = this.formatCanvasState(session.canvasObjects);
    const recentTopics = this.extractTopics(recentTurns);

    // Build RAG context if enabled
    let ragContext: string | undefined;
    let retrievedObjects: string[] | undefined;

    if (process.env.ENABLE_RAG === 'true') {
      const ragResult = await this.buildRAGContext(
        session,
        currentQuestion,
        highlightedObjectIds || [],
        highlightedObjectsData || []
      );
      ragContext = ragResult.context;
      retrievedObjects = ragResult.objectIds;
    }

    logger.debug('Built teaching context', {
      turns: recentTurns.length,
      highlightedCount: highlightedObjectIds?.length || 0,
      objectsCount: session.canvasObjects.length,
      hasRAGContext: !!ragContext,
      retrievedObjectCount: retrievedObjects?.length || 0
    });

    return {
      conversationHistory,
      highlightedObjects,
      canvasState,
      recentTopics,
      ragContext,
      retrievedObjects
    };
  }

  private formatConversationHistory(turns: Turn[]): string {
    if (turns.length === 0) {
      return 'No previous conversation.';
    }

    return turns
      .map(turn => {
        const role = turn.role === 'user' ? 'Student' : 'Mentora';
        return `${role}: ${turn.content}`;
      })
      .join('\n\n');
  }

  private formatHighlightedObjects(
    allObjects: CanvasObject[],
    highlightedIds: string[]
  ): string {
    const highlighted = allObjects.filter(obj => highlightedIds.includes(obj.id));

    if (highlighted.length === 0) {
      return '';
    }

    return highlighted
      .map(obj => {
        const refName = obj.metadata.referenceName || obj.id;
        return `- ${refName} (${obj.type}): ${this.getObjectContent(obj)}`;
      })
      .join('\n');
  }

  private formatCanvasState(objects: CanvasObject[]): string {
    if (objects.length === 0) {
      return 'Canvas is empty.';
    }

    const summary = objects
      .map(obj => {
        const refName = obj.metadata.referenceName || obj.id;
        return `- ${refName} (${obj.type}) at position (${obj.position.x}, ${obj.position.y})`;
      })
      .join('\n');

    return `Canvas objects (${objects.length} total):\n${summary}`;
  }

  private getObjectContent(obj: CanvasObject): string {
    switch (obj.type) {
      case 'latex':
        return obj.data.latex;
      case 'graph':
        return obj.data.equation;
      case 'code':
        return obj.data.code.substring(0, 100) + (obj.data.code.length > 100 ? '...' : '');
      case 'text':
        return obj.data.content.substring(0, 100) + (obj.data.content.length > 100 ? '...' : '');
      case 'diagram':
        return obj.data.description;
      default:
        return '';
    }
  }

  private extractTopics(turns: Turn[]): string[] {
    // Simple topic extraction based on keywords
    const keywords = new Set<string>();
    const commonWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'this', 'that']);

    turns.forEach(turn => {
      const words = turn.content.toLowerCase().split(/\s+/);
      words.forEach(word => {
        const cleaned = word.replace(/[^a-z]/g, '');
        if (cleaned.length > 3 && !commonWords.has(cleaned)) {
          keywords.add(cleaned);
        }
      });
    });

    return Array.from(keywords).slice(0, 5);
  }

  buildHighlightedSummary(objects: CanvasObject[], highlightedIds: string[]): string {
    const highlighted = objects.filter(obj => highlightedIds.includes(obj.id));

    if (highlighted.length === 0) {
      return 'No objects highlighted';
    }

    const types = highlighted.map(obj => obj.type);
    const uniqueTypes = [...new Set(types)];

    return `Student highlighted ${highlighted.length} object(s): ${uniqueTypes.join(', ')}`;
  }

  /**
   * Build RAG context by retrieving relevant knowledge from ChromaDB
   */
  private async buildRAGContext(
    session: Session,
    currentQuestion: string,
    highlightedObjectIds: string[],
    highlightedObjectsData: CanvasObject[]
  ): Promise<{ context: string; objectIds: string[] }> {
    try {
      // Use provided object data from frontend, or fall back to session objects
      const highlightedObjects = highlightedObjectsData.length > 0
        ? highlightedObjectsData
        : session.canvasObjects.filter(obj => highlightedObjectIds.includes(obj.id));

      // Create summary of recent conversation
      const recentTurns = session.turns.slice(-3);
      const chatHistorySummary = recentTurns
        .map(turn => {
          const preview = turn.content.substring(0, 100);
          return `${turn.role}: ${preview}${turn.content.length > 100 ? '...' : ''}`;
        })
        .join('\n');

      logger.info('📋 RAG RETRIEVAL REQUEST', {
        query: currentQuestion,
        sessionId: session.id,
        highlightedObjectCount: highlightedObjects.length,
        chatHistorySummaryLength: chatHistorySummary.length
      });

      // Use safe RAG service that doesn't cause build errors
      const { safeRetrieveContext } = await import('@/lib/rag/safeRagService');

      const result = await safeRetrieveContext(
        currentQuestion,
        highlightedObjects,
        chatHistorySummary,
        session.id,
        session.subject
      );

      // If no context retrieved, return early
      if (!result.context) {
        return { context: '', objectIds: [] };
      }

      // Return the formatted context
      return result;

    } catch (error) {
      logger.error('Failed to build RAG context', { error });

      // Return empty context on error (graceful degradation)
      return {
        context: '',
        objectIds: []
      };
    }
  }
}

export const contextBuilder = new ContextBuilder();
