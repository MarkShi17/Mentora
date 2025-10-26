/**
 * RAG Module Exports
 *
 * Central export point for all RAG-related functionality
 * Uses lazy loading to avoid build-time ChromaDB import errors
 */

// Lazy-load the services to avoid import errors when ChromaDB is not installed
let _chromaClient: any;
let _ingestionService: any;
let _retrievalService: any;

export async function getChromaClient() {
  if (!_chromaClient) {
    const module = await import('./chromaClient');
    _chromaClient = module.getChromaClient;
  }
  return _chromaClient();
}

export async function getIngestionService() {
  if (!_ingestionService) {
    const module = await import('./ingestionService');
    _ingestionService = module.ingestionService;
  }
  return _ingestionService;
}

export async function getRetrievalService() {
  if (!_retrievalService) {
    const module = await import('./retrievalService');
    _retrievalService = module.retrievalService;
  }
  return _retrievalService;
}

// Export types from separate file to avoid import chain
export type {
  ChromaConfig,
  ChromaDBClient,
  IngestionMetadata,
  RetrievalParams,
  RetrievalResult
} from './types';

// Convenience wrapper for backward compatibility
export const ragServices = {
  chromaClient: getChromaClient,
  ingestion: getIngestionService,
  retrieval: getRetrievalService
};