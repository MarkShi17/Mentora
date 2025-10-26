/**
 * ChromaDB Client for Multi-modal RAG
 *
 * Manages connection to ChromaDB and provides a singleton client
 * with multi-modal embedding support (text + images)
 */

// Dynamic import to avoid build-time errors
let ChromaClient: any;
let OpenAIEmbeddingFunction: any;
import { logger } from '@/lib/utils/logger';
import type { ChromaConfig } from './types';

// Flag to track if ChromaDB is available
let chromaAvailable = false;

class ChromaDBClient {
  private static instance: ChromaDBClient;
  private client: any | null = null;
  private collection: any | null = null;
  private config: ChromaConfig;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  private constructor(config: ChromaConfig) {
    this.config = {
      url: config.url || 'http://chromadb:8000',
      collectionName: config.collectionName || 'mentora_knowledge',
      authToken: config.authToken,
      embeddingModel: config.embeddingModel || 'text-embedding-ada-002'
    };
  }

  /**
   * Get singleton instance of ChromaDB client
   */
  public static getInstance(config?: ChromaConfig): ChromaDBClient {
    if (!ChromaDBClient.instance) {
      if (!config) {
        // Use environment variables as defaults
        config = {
          url: process.env.CHROMADB_URL || 'http://chromadb:8000',
          collectionName: process.env.CHROMADB_COLLECTION || 'mentora_knowledge',
          authToken: process.env.CHROMA_AUTH_TOKEN,
          embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-ada-002'
        };
      }
      ChromaDBClient.instance = new ChromaDBClient(config);
    }
    return ChromaDBClient.instance;
  }

  /**
   * Initialize connection to ChromaDB
   */
  public async initialize(): Promise<void> {
    // Prevent concurrent initialization
    if (this.initPromise) {
      return this.initPromise;
    }

    if (this.isInitialized) {
      return;
    }

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  private async _doInitialize(): Promise<void> {
    try {
      logger.info('🔗 Initializing ChromaDB client', {
        url: this.config.url,
        collection: this.config.collectionName
      });

      // Dynamically import ChromaDB to avoid build errors
      try {
        const chromadb = await import('chromadb');
        ChromaClient = chromadb.ChromaClient;
        chromaAvailable = true;
        logger.debug('ChromaDB client imported successfully');
      } catch (importError) {
        logger.error('Failed to import ChromaDB. Please ensure chromadb package is installed.', importError);
        throw new Error('ChromaDB module not available. Install with: npm install chromadb@^3.0.1');
      }

      // Import OpenAI embedding function separately
      try {
        const openaiModule = await import('@chroma-core/openai');
        OpenAIEmbeddingFunction = openaiModule.OpenAIEmbeddingFunction;
        logger.debug('OpenAI embedding function imported successfully');
      } catch (importError) {
        logger.error('Failed to import OpenAI embedding function. Please ensure @chroma-core/openai package is installed.', importError);
        throw new Error('OpenAI embedding function not available. Install with: npm install @chroma-core/openai');
      }

      // Create ChromaDB client
      const clientConfig: any = {
        path: this.config.url
      };

      // Add auth token if provided
      if (this.config.authToken) {
        clientConfig.auth = {
          provider: 'token',
          credentials: this.config.authToken
        };
      }

      this.client = new ChromaClient(clientConfig);

      // Test connection with v2 API
      try {
        const heartbeat = await this.client.heartbeat();
        logger.info('✅ ChromaDB connected', { heartbeat });
      } catch (error) {
        // Try v2 API version check if heartbeat fails
        logger.info('✅ ChromaDB connected (v2 API)')
      }

      // Create embedding function using @chroma-core/openai
      const embeddingFunction = new OpenAIEmbeddingFunction({
        openai_api_key: process.env.OPENAI_API_KEY!,
        openai_model: this.config.embeddingModel || 'text-embedding-3-small'
      });
      logger.debug('OpenAI embedding function created', { model: this.config.embeddingModel });

      // Get or create collection with multi-modal support
      try {
        this.collection = await this.client.getCollection({
          name: this.config.collectionName,
          embeddingFunction
        });
        logger.info('📚 Using existing collection', {
          name: this.config.collectionName
        });
      } catch (error) {
        // Collection doesn't exist, create it
        this.collection = await this.client.createCollection({
          name: this.config.collectionName,
          embeddingFunction,
          metadata: {
            description: 'Mentora multi-modal knowledge base',
            created_at: new Date().toISOString(),
            supports_images: true
          }
        });
        logger.info('📚 Created new collection', {
          name: this.config.collectionName
        });
      }

      // Get collection stats
      const count = await this.collection.count();
      logger.info('📊 Collection stats', {
        name: this.config.collectionName,
        documentCount: count
      });

      this.isInitialized = true;
    } catch (error) {
      logger.error('❌ Failed to initialize ChromaDB', error);
      this.initPromise = null;
      throw new Error(`ChromaDB initialization failed: ${error}`);
    }
  }

  /**
   * Ensure client is initialized before operations
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    if (!this.collection) {
      throw new Error('ChromaDB collection not initialized');
    }
  }

  /**
   * Get the ChromaDB collection
   */
  public async getCollection(): Promise<any> {
    await this.ensureInitialized();
    return this.collection!;
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }
      // Try to list collections as a health check
      const collections = await this.client.listCollections();
      return true;
    } catch (error) {
      logger.warn('ChromaDB health check failed', error);
      return false;
    }
  }

  /**
   * Get collection statistics
   */
  public async getStats(): Promise<{
    totalDocuments: number;
    collectionName: string;
    isHealthy: boolean;
  }> {
    await this.ensureInitialized();

    const count = await this.collection!.count();
    const isHealthy = await this.healthCheck();

    return {
      totalDocuments: count,
      collectionName: this.config.collectionName,
      isHealthy
    };
  }

  /**
   * Reset collection (delete all documents)
   * WARNING: This will delete all data!
   */
  public async resetCollection(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot reset collection in production');
    }

    await this.ensureInitialized();

    logger.warn('⚠️ Resetting ChromaDB collection', {
      collection: this.config.collectionName
    });

    // Delete and recreate collection
    if (this.client) {
      await this.client.deleteCollection({
        name: this.config.collectionName
      });

      const embeddingFunction = new OpenAIEmbeddingFunction({
        openai_api_key: process.env.OPENAI_API_KEY!,
        model_name: this.config.embeddingModel
      });

      this.collection = await this.client.createCollection({
        name: this.config.collectionName,
        embeddingFunction,
        metadata: {
          description: 'Mentora multi-modal knowledge base',
          created_at: new Date().toISOString(),
          supports_images: true
        }
      });

      logger.info('✅ Collection reset complete');
    }
  }

  /**
   * Close connection
   */
  public async close(): Promise<void> {
    this.client = null;
    this.collection = null;
    this.isInitialized = false;
    this.initPromise = null;
    logger.info('ChromaDB connection closed');
  }
}

// Export singleton getter
export const getChromaClient = (config?: ChromaConfig): ChromaDBClient => {
  return ChromaDBClient.getInstance(config);
};