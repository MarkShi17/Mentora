import { NextResponse } from 'next/server';
import { HealthResponse } from '@/types/api';
import { initializeMCP, isMCPInitialized } from '@/lib/mcp/init';

export async function GET(): Promise<NextResponse<HealthResponse>> {
  // Initialize MCP on first health check (lazy initialization)
  if (!isMCPInitialized()) {
    // Don't await - let it initialize in background
    initializeMCP().catch((error) => {
      console.error('Background MCP initialization failed:', error);
    });
  }

  const response: HealthResponse = {
    status: 'ok',
    timestamp: Date.now(),
    version: '0.1.0',
  };

  return NextResponse.json(response);
}
