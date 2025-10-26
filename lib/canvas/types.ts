export interface ObjectGenerationRequest {
  type: 'latex' | 'graph' | 'code' | 'text' | 'diagram' | 'image';
  content: string;
  referenceName?: string;
  parentObjectIds?: string[];
  metadata?: {
    language?: string;
    equation?: string;
    fontSize?: number;
    description?: string;
  };
}

export interface PlacementContext {
  existingObjects: Array<{
    id: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
  }>;
  relatedObjectIds?: string[];
  placement?: 'center' | 'below-last' | 'right-of-last' | 'grouped';
}
