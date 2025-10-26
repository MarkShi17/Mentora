import { CanvasObject, ObjectPlacement, ObjectReference, CanvasSnapshot, Subject } from './canvas';
import { Session, SessionPreview } from './session';

// POST /api/qa Request/Response
export type TeachingMode = 'guided' | 'direct';

export type VoiceOption = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

export interface ImageInput {
  base64: string;  // Base64-encoded image data (with data:image/... prefix)
  mimeType: string;  // image/png, image/jpeg, etc.
}

export interface QARequest {
  sessionId: string;
  question: string;
  highlightedObjects?: string[];
  mode?: TeachingMode;
  images?: ImageInput[];  // Image attachments for vision analysis
  context?: {
    recentConversation?: string[];
    topics?: string[];
    conversationHistory?: string[];
  };
  userName?: string;
  voice?: VoiceOption;
  explanationLevel?: 'beginner' | 'intermediate' | 'advanced';
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

// Streaming QA Types
export type StreamEventType =
  | 'text_chunk'      // Partial text from Claude
  | 'audio_chunk'     // TTS audio for a sentence
  | 'canvas_object'   // New canvas object generated
  | 'reference'       // Object reference detected
  | 'metadata'        // Response metadata
  | 'brain_selected'  // Brain selected for question
  | 'mcp_tool_start'  // MCP tool execution started
  | 'mcp_tool_complete' // MCP tool execution completed
  | 'complete'        // Stream finished
  | 'error';          // Error occurred

export interface BaseStreamEvent {
  type: StreamEventType;
  timestamp: number;
}

export interface TextChunkEvent extends BaseStreamEvent {
  type: 'text_chunk';
  data: {
    text: string;
    sentenceIndex: number;
  };
}

export interface AudioChunkEvent extends BaseStreamEvent {
  type: 'audio_chunk';
  data: {
    audio: string;        // Base64 audio chunk
    text: string;         // Text being spoken
    sentenceIndex: number;
    format: 'mp3';
    voice: string;
  };
}

export interface CanvasObjectEvent extends BaseStreamEvent {
  type: 'canvas_object';
  data: {
    object: CanvasObject;
    placement: ObjectPlacement;
  };
}

export interface ReferenceEvent extends BaseStreamEvent {
  type: 'reference';
  data: ObjectReference;
}

export interface MetadataEvent extends BaseStreamEvent {
  type: 'metadata';
  data: {
    turnId: string;
    totalSentences: number;
    sessionId: string;
  };
}

export interface CompleteEvent extends BaseStreamEvent {
  type: 'complete';
  data: {
    success: true;
    totalSentences: number;
    totalObjects: number;
    totalReferences: number;
  };
}

export interface ErrorEvent extends BaseStreamEvent {
  type: 'error';
  data: {
    message: string;
    code?: string;
  };
}

export interface BrainSelectedEvent extends BaseStreamEvent {
  type: 'brain_selected';
  data: {
    brainType: 'math' | 'biology' | 'code' | 'design' | 'general';
    brainName: string;
    confidence: number;
    reasoning: string;
  };
}

export interface MCPToolStartEvent extends BaseStreamEvent {
  type: 'mcp_tool_start';
  data: {
    toolName: string;
    serverId: string;
    description: string;
  };
}

export interface MCPToolCompleteEvent extends BaseStreamEvent {
  type: 'mcp_tool_complete';
  data: {
    toolName: string;
    serverId: string;
    success: boolean;
    error?: string;
    duration: number;
  };
}

export type StreamEvent =
  | TextChunkEvent
  | AudioChunkEvent
  | CanvasObjectEvent
  | ReferenceEvent
  | MetadataEvent
  | BrainSelectedEvent
  | MCPToolStartEvent
  | MCPToolCompleteEvent
  | CompleteEvent
  | ErrorEvent;

export interface StreamingQARequest extends QARequest {
  stream: true;
}
