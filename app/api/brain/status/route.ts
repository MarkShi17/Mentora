import { NextResponse } from 'next/server';
import { getAllBrains } from '@/lib/agent/brainRegistry';

/**
 * GET /api/brain/status
 * 
 * Returns information about available brains and brain selection status
 */
export async function GET() {
  try {
    const brains = getAllBrains();

    return NextResponse.json({
      success: true,
      brains: brains.map(brain => ({
        id: brain.id,
        type: brain.type,
        name: brain.name,
        description: brain.description,
        capabilities: brain.capabilities,
        mcpTools: brain.mcpTools,
      })),
      totalBrains: brains.length,
    });
  } catch (error) {
    console.error('Failed to get brain status:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to get brain status' 
      },
      { status: 500 }
    );
  }
}
