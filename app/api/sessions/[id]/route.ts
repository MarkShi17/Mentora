import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/agent/sessionManager';
import { SessionDetailsResponse } from '@/types/api';
import { handleError } from '@/lib/utils/errors';
import { logger } from '@/lib/utils/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<SessionDetailsResponse>> {
  try {
    const sessionId = params.id;
    const session = sessionManager.getSession(sessionId);

    const response: SessionDetailsResponse = {
      session,
      canvasSnapshot: {
        objects: session.canvasObjects,
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Failed to get session details', error);
    const errorResponse = handleError(error);
    return NextResponse.json(
      { error: errorResponse.message },
      { status: errorResponse.statusCode }
    );
  }
}
