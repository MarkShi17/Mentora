export type Session = {
  id: string;
  title: string;
  createdAt: string;
};

export type MessageRole = "user" | "assistant";

export type BrainType = 'math' | 'biology' | 'code' | 'design' | 'general';

export type ImageAttachment = {
  id: string;
  type: 'image';
  url?: string;  // Public URL if uploaded to server
  base64?: string;  // Base64 data URL for client-side only
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  extractedText?: string;  // Text extracted via OCR/Vision API
};

export type Message = {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  highlightIds?: string[];
  canvasObjectIds?: string[];  // IDs of canvas objects created during this message
  attachments?: ImageAttachment[];  // Image attachments
  brainType?: BrainType;
  brainConfidence?: number;
  mcpToolsUsed?: string[];
  interrupted?: boolean;  // Whether this message was stopped/interrupted
  interruptedAt?: string;  // Timestamp when interrupted
  isStreaming?: boolean;  // Currently streaming text
  isPlayingAudio?: boolean;  // Currently playing audio
  audioComplete?: boolean;  // Audio has finished playing naturally (not interrupted)
};

export type CanvasObjectType = "diagram" | "note" | "formula" | "image" | "text" | "code" | "graph" | "latex";

export type CanvasObject = {
  id: string;
  type: CanvasObjectType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  selected?: boolean;
  zIndex?: number;
  hidden?: boolean;  // For voice-activated demo reveals
  demoGroup?: 'intro' | 'architecture' | 'features';  // Demo reveal grouping
  data?: {
    content?: string;    // For text/note type (supports Markdown with inline math)
    svg?: string;        // For diagram/graph type
    code?: string;       // For code type
    language?: string;   // For code type (programming language)
    latex?: string;      // For latex type (LaTeX source code)
    rendered?: string;   // For latex type (image URL - legacy fallback)
  };
  metadata?: Record<string, unknown>;
};

export type SourceLink = {
  id: string;
  title: string;
  url: string;
  snippet: string;
  score: number;
};

export type TimelineEventType = "prompt" | "response" | "visual" | "source";

export type TimelineEvent = {
  id: string;
  timestamp: string;
  type: TimelineEventType;
  description: string;
  payload?: Record<string, unknown>;
};

export type Pin = {
  id: string;
  label: string;
  x: number;
  y: number;
  createdAt: string;
};

export type ObjectPlacement = {
  strategy: string;
  relativeToId?: string;
};

export type ObjectReference = {
  mention: string;
  objectId: string;
};

export type StreamEvent =
  | { type: 'cached_intro'; data: { id: string; text: string; audio: string; category: string; duration: number } }
  | { type: 'text_chunk'; data: { text: string } }
  | { type: 'audio_chunk'; data: { audio: string; text: string; sentenceIndex: number } }
  | { type: 'canvas_object'; data: { object: any; placement: ObjectPlacement } }
  | { type: 'reference'; data: ObjectReference }
  | { type: 'brain_selected'; data: { brainType: BrainType; brainName: string; confidence: number; reasoning: string } }
  | { type: 'mcp_tool_start'; data: { toolName: string; serverId: string; description: string } }
  | { type: 'mcp_tool_complete'; data: { toolName: string; serverId: string; success: boolean; error?: string; duration: number } }
  | { type: 'complete'; data?: any }
  | { type: 'error'; data: { message: string } }
  | { type: 'interrupted'; data: { message: string; code: string } };

export type ConnectionAnchor = 'north' | 'east' | 'south' | 'west';

export type ObjectConnection = {
  id: string;
  sourceObjectId: string;
  targetObjectId: string;
  sourceAnchor: ConnectionAnchor;
  targetAnchor: ConnectionAnchor;
  createdAt: string;
};

