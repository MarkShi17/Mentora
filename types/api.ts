import { CanvasObject, ObjectPlacement, ObjectReference, CanvasSnapshot, Subject } from './canvas';
import { Session, SessionPreview } from './session';

// POST /api/qa Request/Response
export type TeachingMode = 'guided' | 'direct';

export interface QARequest {
  sessionId: string;
  question: string;
  highlightedObjects?: string[];
  mode?: TeachingMode;
  context?: {
    recentConversation?: string[];
    topics?: string[];
    conversationHistory?: string[];
  };
}

export interface QAResponse {
  turnId: string;
  answer: {
    text: string;
    narration: string;
    audioUrl?: string;
  };
  canvasObjects: CanvasObject[];
  objectPlacements: ObjectPlacement[];
  references: ObjectReference[];
}

// GET /api/sessions Response
export interface SessionsListResponse {
  sessions: SessionPreview[];
}

// POST /api/sessions Request/Response
export interface CreateSessionRequest {
  title?: string;
  subject: Subject;
}

export interface CreateSessionResponse {
  session: Session;
}

// GET /api/sessions/:id Response
export interface SessionDetailsResponse {
  session: Session;
  canvasSnapshot: CanvasSnapshot;
}

// POST /api/transcript Request/Response
export interface TranscriptRequest {
  audio: string;
  sessionId: string;
}

export interface TranscriptResponse {
  text: string;
  confidence?: number;
}

// Health check
export interface HealthResponse {
  status: 'ok';
  timestamp: number;
  version: string;
}
