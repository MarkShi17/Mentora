import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/agent/sessionManager';
import { CreateSessionRequest, CreateSessionResponse, SessionsListResponse } from '@/types/api';
import { handleError } from '@/lib/utils/errors';
import { logger } from '@/lib/utils/logger';

export async function GET(): Promise<NextResponse<SessionsListResponse>> {
  try {
    const sessions = sessionManager.getAllSessions();

    const response: SessionsListResponse = {
      sessions,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Failed to get sessions', error);
    const errorResponse = handleError(error);
    return NextResponse.json(
      { error: errorResponse.message },
      { status: errorResponse.statusCode }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<CreateSessionResponse>> {
  try {
    const body = (await request.json()) as CreateSessionRequest;

    if (!body.subject) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    }

    const session = sessionManager.createSession(body.subject, body.title);

    const response: CreateSessionResponse = {
      session,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    logger.error('Failed to create session', error);
    const errorResponse = handleError(error);
    return NextResponse.json(
      { error: errorResponse.message },
      { status: errorResponse.statusCode }
    );
  }
}
