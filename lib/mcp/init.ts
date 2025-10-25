/**
 * MCP Initialization
 *
 * Initialize MCP manager on server startup.
 * This uses a singleton pattern to ensure initialization only happens once.
 */

import { mcpManager } from './manager';
import { logger } from '@/lib/utils/logger';

let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize MCP connections
 * Safe to call multiple times - will only initialize once
 */
export async function initializeMCP(): Promise<void> {
  if (isInitialized) {
    logger.debug('MCP already initialized');
    return;
  }

  if (initPromise) {
    logger.debug('MCP initialization already in progress, waiting...');
    return initPromise;
  }

  initPromise = (async () => {
    try {
      logger.info('Starting MCP initialization...');
      await mcpManager.initialize();
      isInitialized = true;
      logger.info('MCP initialization complete');
    } catch (error) {
      logger.error('MCP initialization failed:', error);
      // Don't throw - allow server to start even if MCP fails
      // Individual endpoints can handle missing MCP connections
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Cleanup MCP connections on shutdown
 */
export async function shutdownMCP(): Promise<void> {
  if (isInitialized) {
    logger.info('Shutting down MCP connections...');
    await mcpManager.disconnectAll();
    isInitialized = false;
    logger.info('MCP shutdown complete');
  }
}

/**
 * Check if MCP is initialized
 */
export function isMCPInitialized(): boolean {
  return isInitialized;
}
