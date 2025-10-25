export type Session = {
  id: string;
  title: string;
  createdAt: string;
};

export type MessageRole = "user" | "assistant";

export type Message = {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  highlightIds?: string[];
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
  data?: {
    content?: string;    // For text/note type
    svg?: string;        // For diagram/graph type
    code?: string;       // For code type
    rendered?: string;   // For latex type (image URL)
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
