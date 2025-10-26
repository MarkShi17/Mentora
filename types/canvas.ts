export type CanvasObjectType = 'latex' | 'graph' | 'code' | 'text' | 'diagram' | 'image' | 'video';

export type Subject = 'math' | 'bio' | 'code' | 'design';

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface CanvasObjectMetadata {
  createdAt: number;
  turnId: string;
  referenceName?: string;
  tags: string[];
  // Allow additional metadata from MCP tools
  [key: string]: any;
}

export type GenerationState = 'generating' | 'complete' | 'error';

export interface BaseCanvasObject {
  id: string;
  type: CanvasObjectType;
  position: Position;
  size: Size;
  zIndex: number;
  metadata: CanvasObjectMetadata;
  generationState?: GenerationState;
  placeholder?: boolean;
  label?: string;
}

export interface LatexObject extends BaseCanvasObject {
  type: 'latex';
  data: {
    type: 'latex';
    latex: string;
    rendered: string;
  };
}

export interface GraphObject extends BaseCanvasObject {
  type: 'graph';
  data: {
    type: 'graph';
    equation: string;
    svg: string;
    dataPoints: [number, number][];
  };
}

export interface CodeObject extends BaseCanvasObject {
  type: 'code';
  data: {
    type: 'code';
    code: string;
    language: string;
    highlighted?: string;
  };
}

export interface TextObject extends BaseCanvasObject {
  type: 'text';
  data: {
    type: 'text';
    content: string;
    fontSize: number;
  };
}

export interface DiagramObject extends BaseCanvasObject {
  type: 'diagram';
  data: {
    type: 'diagram';
    svg: string;
    description: string;
  };
}

export interface ImageObject extends BaseCanvasObject {
  type: 'image';
  data: {
    type: 'image';
    url: string;
    alt: string;
  };
}

export interface VideoObject extends BaseCanvasObject {
  type: 'video';
  data: {
    type: 'video';
    url: string;
    alt?: string;
  };
}

export type CanvasObject =
  | LatexObject
  | GraphObject
  | CodeObject
  | TextObject
  | DiagramObject
  | ImageObject
  | VideoObject;

export type AnimationType = 'fade' | 'slide' | 'draw';

export interface ObjectPlacement {
  objectId: string;
  position: Position;
  animateIn?: AnimationType;
  timing: number;
}

export interface ObjectReference {
  objectId: string;
  mention: string;
  timestamp: number;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface CanvasSnapshot {
  objects: CanvasObject[];
  viewport: Viewport;
}
