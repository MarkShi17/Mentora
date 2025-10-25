/**
 * Multimodal RAG (Retrieval-Augmented Generation)
 * 
 * Lightweight in-memory implementation for memory storage and retrieval
 * Note: For production, use ChromaDB or another vector database
 */

import { logger } from '@/lib/utils/logger';
import { CanvasObject } from '@/types/canvas';

interface MemoryItem {
  id: string;
  content: string;
  type: 'question' | 'answer' | 'concept' | 'visualization';
  metadata: {
    sessionId: string;
    timestamp: number;
    brainType?: string;
    tags?: string[];
    objectIds?: string[];
  };
}

export class MultimodalRAG {
  private memories: MemoryItem[] = [];
  private initialized: boolean = false;

  constructor() {
    // Lightweight in-memory storage
    this.memories = [];
  }

  /**
   * Initialize the RAG system
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    logger.info('Lightweight in-memory RAG initialized');
  }

  /**
   * Store a memory item
   */
  async addMemory(
    content: string,
    type: MemoryItem['type'],
    metadata: MemoryItem['metadata']
  ): Promise<void> {
    try {
      const id = `mem_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const memory: MemoryItem = {
        id,
        content,
        type,
        metadata: {
          sessionId: metadata.sessionId,
          timestamp: metadata.timestamp,
          brainType: metadata.brainType,
          tags: metadata.tags || [],
          objectIds: metadata.objectIds || [],
        },
      };

      this.memories.push(memory);

      // Keep only last 1000 memories to prevent memory bloat
      if (this.memories.length > 1000) {
        this.memories = this.memories.slice(-1000);
      }

      logger.info('Memory stored', { type, id });
    } catch (error) {
      logger.error('Failed to store memory', error);
    }
  }

  /**
   * Retrieve relevant memories for a given query
   */
  async retrieveMemories(
    query: string,
    options?: {
      limit?: number;
      filter?: {
        sessionId?: string;
        type?: MemoryItem['type'];
        brainType?: string;
        tags?: string[];
      };
    }
  ): Promise<MemoryItem[]> {
    try {
      // Simple keyword-based retrieval
      const queryLower = query.toLowerCase();
      const keywords = queryLower.split(/\s+/);

      // Filter memories
      let filtered = this.memories;

      if (options?.filter) {
        if (options.filter.sessionId) {
          filtered = filtered.filter(m => m.metadata.sessionId === options.filter?.sessionId);
        }
        if (options.filter.type) {
          filtered = filtered.filter(m => m.type === options.filter?.type);
        }
        if (options.filter.brainType) {
          filtered = filtered.filter(m => m.metadata.brainType === options.filter?.brainType);
        }
      }

      // Score by keyword matches
      const scored = filtered.map(memory => {
        const contentLower = memory.content.toLowerCase();
        let score = 0;
        
        for (const keyword of keywords) {
          if (keyword.length > 2 && contentLower.includes(keyword)) {
            score += 1;
          }
        }

        return { memory, score };
      });

      // Sort by score and return top results
      const results = scored
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, options?.limit || 5)
        .map(item => item.memory);

      logger.info('Memories retrieved', {
        query: query.substring(0, 50),
        count: results.length,
      });

      return results;
    } catch (error) {
      logger.error('Failed to retrieve memories', error);
      return [];
    }
  }

  /**
   * Store canvas objects as memory
   */
  async storeCanvasObjects(
    sessionId: string,
    objects: CanvasObject[],
    brainType?: string
  ): Promise<void> {
    if (objects.length === 0) {
      return;
    }

    for (const obj of objects) {
      const content = this.extractObjectContent(obj);
      if (content) {
        await this.addMemory(content, 'visualization', {
          sessionId,
          timestamp: Date.now(),
          brainType,
          tags: [obj.type],
          objectIds: [obj.id],
        });
      }
    }
  }

  /**
   * Extract searchable content from a canvas object
   */
  private extractObjectContent(obj: CanvasObject): string | null {
    if (!obj.data) return null;

    switch (obj.type) {
      case 'latex':
        return `Mathematical equation: ${obj.data.latex || ''}`;
      case 'code':
        return `Code: ${obj.data.code || ''}`;
      case 'text':
        return `Text content: ${obj.data.content || ''}`;
      case 'graph':
        return `Graph: ${obj.data.equation || ''}`;
      case 'diagram':
        return `Diagram: ${obj.data.description || ''}`;
      case 'image':
        return obj.metadata?.referenceName || 'Image visualization';
      default:
        return null;
    }
  }

  /**
   * Build context from retrieved memories
   */
  async buildMemoryContext(
    query: string,
    sessionId: string,
    brainType?: string
  ): Promise<string> {
    const memories = await this.retrieveMemories(query, {
      limit: 3,
      filter: {
        sessionId,
        brainType,
      },
    });

    if (memories.length === 0) {
      return '';
    }

    const contextParts = memories.map((mem, i) => 
      `[Memory ${i + 1}] ${mem.content}`
    );

    return `RELEVANT PAST CONTEXT:\n${contextParts.join('\n\n')}\n\n`;
  }
}

export const multimodalRAG = new MultimodalRAG();
