import { Session, Turn } from '@/types/session';
import { CanvasObject } from '@/types/canvas';
import { logger } from '@/lib/utils/logger';

export interface TeachingContext {
  conversationHistory: string;
  highlightedObjects: string;
  canvasState: string;
  recentTopics: string[];
}

export class ContextBuilder {
  buildContext(
    session: Session,
    highlightedObjectIds?: string[],
    maxTurns: number = 10
  ): TeachingContext {
    const recentTurns = session.turns.slice(-maxTurns);
    const conversationHistory = this.formatConversationHistory(recentTurns);

    const highlightedObjects = highlightedObjectIds
      ? this.formatHighlightedObjects(session.canvasObjects, highlightedObjectIds)
      : '';

    const canvasState = this.formatCanvasState(session.canvasObjects);
    const recentTopics = this.extractTopics(recentTurns);

    logger.debug('Built teaching context', {
      turns: recentTurns.length,
      highlightedCount: highlightedObjectIds?.length || 0,
      objectsCount: session.canvasObjects.length,
    });

    return {
      conversationHistory,
      highlightedObjects,
      canvasState,
      recentTopics,
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
}

export const contextBuilder = new ContextBuilder();
