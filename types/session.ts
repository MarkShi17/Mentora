import { CanvasObject, Subject } from './canvas';

export type Role = 'user' | 'assistant';

export interface HighlightedContext {
  objectIds: string[];
  summary: string;
}

export interface Turn {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  audioUrl?: string;
  objectsCreated?: string[];
  objectsReferenced?: string[];
  highlightedContext?: HighlightedContext;
  brainType?: 'math' | 'biology' | 'code' | 'design' | 'general';
  brainConfidence?: number;
  mcpToolsUsed?: string[];
}

export interface Session {
  id: string;
  title: string;
  subject: Subject;
  createdAt: number;
  updatedAt: number;
  turns: Turn[];
  canvasObjects: CanvasObject[];
  selectedBrain?: 'math' | 'biology' | 'code' | 'design' | 'general'; // Brain locked for entire conversation
}

export interface SessionPreview {
  id: string;
  title: string;
  subject: Subject;
  updatedAt: number;
  preview: string;
}
