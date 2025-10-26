/**
 * RAG (Retrieval-Augmented Generation) Type Definitions
 */

import { CanvasObject } from './canvas';

/**
 * RAG retrieval result from ChromaDB
 */
export interface RAGRetrievalResult {
  /** Retrieved text snippets */
  textSnippets: string[];

  /** References to images/videos with metadata */
  imageReferences: {
    path: string;
    description: string;
    objectId: string;
    metadata: Record<string, any>;
  }[];

  /** Canvas object IDs that can be highlighted */
  canvasObjectIds: string[];

  /** Relevance scores (0-1, higher is better) */
  relevanceScores: number[];

  /** Full metadata from ChromaDB */
  metadata: Array<Record<string, any>>;
}

/**
 * Metadata stored with each ingested item
 */
export interface IngestionMetadata {
  /** Type of content */
  type: 'canvas_object' | 'conversation';

  /** Session this belongs to */
  sessionId: string;

  /** Turn ID for tracking */
  turnId: string;

  /** Canvas object ID if applicable */
  objectId?: string;

  /** Type of canvas object */
  objectType?: CanvasObject['type'];

  /** Unix timestamp */
  timestamp: number;

  /** Subject area (math, biology, code, etc.) */
  subject: string;

  /** Programming language for code objects */
  language?: string;

  /** Tags for categorization */
  tags: string[];

  /** Linked canvas object IDs */
  linkedObjects?: string[];
}

/**
 * Parameters for RAG retrieval
 */
export interface RAGRetrievalParams {
  /** Current user message/question */
  currentMessage: string;

  /** Highlighted canvas objects */
  highlightedObjects?: CanvasObject[];

  /** Summary of recent chat history */
  chatHistorySummary?: string;

  /** Current session ID (optional, for filtering) */
  sessionId?: string;

  /** Subject to filter by */
  subject?: string;

  /** Number of results to retrieve */
  topK?: number;

  /** Minimum relevance score threshold */
  minRelevanceScore?: number;
}

/**
 * Statistics about the RAG knowledge base
 */
export interface RAGStats {
  /** Total number of documents */
  totalDocuments: number;

  /** Documents by type */
  byType: Record<string, number>;

  /** Documents by subject */
  bySubject: Record<string, number>;

  /** Recent ingestions (last hour) */
  recentIngestions: number;

  /** Collection name */
  collectionName: string;

  /** Health status */
  isHealthy: boolean;

  /** Last update timestamp */
  lastUpdated?: number;
}

/**
 * Configuration for RAG system
 */
export interface RAGConfig {
  /** Enable/disable RAG */
  enabled: boolean;

  /** ChromaDB URL */
  chromaDbUrl: string;

  /** Collection name */
  collectionName: string;

  /** Auth token for ChromaDB */
  authToken?: string;

  /** Embedding model to use */
  embeddingModel: string;

  /** Number of results to retrieve */
  topK: number;

  /** Minimum relevance score */
  minRelevanceScore: number;

  /** Auto-ingest new content */
  autoIngest: boolean;
}

/**
 * Request/response types for RAG API endpoints
 */
export interface RAGIngestRequest {
  sessionId: string;
  objectIds?: string[];
  ingestAll?: boolean;
}

export interface RAGSearchRequest {
  query: string;
  subject?: string;
  topK?: number;
  includeMetadata?: boolean;
}

export interface RAGSearchResponse {
  results: RAGRetrievalResult;
  queryTime: number;
}

export interface RAGStatsResponse extends RAGStats {
  config: Partial<RAGConfig>;
}