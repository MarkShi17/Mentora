/**
 * RAG Types
 *
 * Type definitions for RAG system
 * Separated from implementation to avoid build-time import issues
 */

export interface ChromaConfig {
  url: string;
  collectionName: string;
  authToken?: string;
  embeddingModel?: string;
}

export interface ChromaDBClient {
  initialize(): Promise<void>;
  getCollection(): Promise<any>;
  healthCheck(): Promise<boolean>;
  getStats(): Promise<{
    totalDocuments: number;
    collectionName: string;
    isHealthy: boolean;
  }>;
  resetCollection(): Promise<void>;
  close(): Promise<void>;
}

export interface IngestionMetadata {
  type: 'canvas_object' | 'conversation';
  sessionId: string;
  turnId: string;
  objectId?: string;
  objectType?: string;
  timestamp: number;
  subject: string;
  language?: string;
  tags: string[];
  userId?: string;
}

export interface RetrievalParams {
  query: string;
  topK?: number;
  minScore?: number;
  filter?: {
    sessionId?: string;
    subject?: string;
    objectType?: string;
    userId?: string;
  };
  includeMetadata?: boolean;
}

export interface RetrievalResult {
  id: string;
  content: string;
  metadata: IngestionMetadata;
  score: number;
  objectId?: string;
}