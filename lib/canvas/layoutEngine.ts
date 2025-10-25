import { Position, Size } from '@/types/canvas';
import { PlacementContext } from './types';

export class LayoutEngine {
  private readonly VERTICAL_SPACING = 20; // Minimal spacing between objects
  private readonly HORIZONTAL_SPACING = 20; // Minimal spacing between objects
  private readonly DEFAULT_POSITION: Position = { x: 50, y: 50 };

  calculatePosition(context: PlacementContext, objectSize: Size): Position {
    const { existingObjects, relatedObjectIds, placement } = context;

    // If no existing objects, place at center
    if (existingObjects.length === 0) {
      return this.DEFAULT_POSITION;
    }

    // Handle explicit placement strategies
    if (placement) {
      return this.getPositionByStrategy(placement, existingObjects, objectSize);
    }

    // Handle related objects grouping
    if (relatedObjectIds && relatedObjectIds.length > 0) {
      return this.getGroupedPosition(existingObjects, relatedObjectIds, objectSize);
    }

    // Default: use smart positioning
    return this.getSmartPosition(existingObjects, objectSize);
  }

  private getPositionByStrategy(
    strategy: 'center' | 'below-last' | 'right-of-last' | 'grouped',
    existingObjects: PlacementContext['existingObjects'],
    objectSize: Size
  ): Position {
    switch (strategy) {
      case 'center':
        return this.DEFAULT_POSITION;

      case 'below-last':
        return this.getPositionBelowLast(existingObjects, objectSize);

      case 'right-of-last':
        return this.getPositionRightOfLast(existingObjects, objectSize);

      case 'grouped':
        return this.getGroupedPosition(existingObjects, [], objectSize);

      default:
        return this.DEFAULT_POSITION;
    }
  }

  private getPositionBelowLast(
    existingObjects: PlacementContext['existingObjects'],
    objectSize: Size
  ): Position {
    const lastObject = existingObjects[existingObjects.length - 1];
    return {
      x: lastObject.position.x,
      y: lastObject.position.y + lastObject.size.height + this.VERTICAL_SPACING,
    };
  }

  private getPositionRightOfLast(
    existingObjects: PlacementContext['existingObjects'],
    objectSize: Size
  ): Position {
    const lastObject = existingObjects[existingObjects.length - 1];
    return {
      x: lastObject.position.x + lastObject.size.width + this.HORIZONTAL_SPACING,
      y: lastObject.position.y,
    };
  }

  private getGroupedPosition(
    existingObjects: PlacementContext['existingObjects'],
    relatedObjectIds: string[],
    objectSize: Size
  ): Position {
    // Find related objects
    const relatedObjects = existingObjects.filter(obj => relatedObjectIds.includes(obj.id));

    if (relatedObjects.length === 0) {
      return this.getPositionBelowLast(existingObjects, objectSize);
    }

    // Calculate centroid of related objects
    const avgX = relatedObjects.reduce((sum, obj) => sum + obj.position.x, 0) / relatedObjects.length;
    const maxY = Math.max(...relatedObjects.map(obj => obj.position.y + obj.size.height));

    return {
      x: avgX,
      y: maxY + this.VERTICAL_SPACING,
    };
  }

  private getSmartPosition(
    existingObjects: PlacementContext['existingObjects'],
    objectSize: Size
  ): Position {
    if (existingObjects.length === 0) {
      return this.DEFAULT_POSITION;
    }

    const canvasWidth = 1200; // Assume canvas width
    const canvasHeight = 800; // Assume canvas height
    
    // Try to place to the right of the last object first
    const lastObject = existingObjects[existingObjects.length - 1];
    const rightPosition = {
      x: lastObject.position.x + lastObject.size.width + this.HORIZONTAL_SPACING,
      y: lastObject.position.y,
    };
    
    // Check if this position fits within canvas and doesn't overlap
    if (this.isValidPosition(rightPosition, objectSize, existingObjects, canvasWidth, canvasHeight)) {
      return rightPosition;
    }
    
    // Try to place below the last object
    const belowPosition = {
      x: lastObject.position.x,
      y: lastObject.position.y + lastObject.size.height + this.VERTICAL_SPACING,
    };
    
    if (this.isValidPosition(belowPosition, objectSize, existingObjects, canvasWidth, canvasHeight)) {
      return belowPosition;
    }
    
    // Try to find the best position by scanning from top-left
    return this.findBestPosition(objectSize, existingObjects, canvasWidth, canvasHeight);
  }

  private isValidPosition(
    position: Position,
    objectSize: Size,
    existingObjects: PlacementContext['existingObjects'],
    canvasWidth: number,
    canvasHeight: number
  ): boolean {
    // Check canvas bounds
    if (position.x < 0 || position.y < 0 || 
        position.x + objectSize.width > canvasWidth || 
        position.y + objectSize.height > canvasHeight) {
      return false;
    }
    
    // Check for overlaps with existing objects
    const newObjectBounds = {
      left: position.x,
      right: position.x + objectSize.width,
      top: position.y,
      bottom: position.y + objectSize.height,
    };
    
    for (const existing of existingObjects) {
      const existingBounds = {
        left: existing.position.x,
        right: existing.position.x + existing.size.width,
        top: existing.position.y,
        bottom: existing.position.y + existing.size.height,
      };
      
      // Check for overlap
      if (!(newObjectBounds.right <= existingBounds.left || 
            newObjectBounds.left >= existingBounds.right ||
            newObjectBounds.bottom <= existingBounds.top ||
            newObjectBounds.top >= existingBounds.bottom)) {
        return false;
      }
    }
    
    return true;
  }

  private findBestPosition(
    objectSize: Size,
    existingObjects: PlacementContext['existingObjects'],
    canvasWidth: number,
    canvasHeight: number
  ): Position {
    // Scan from top-left to find the first valid position
    for (let y = 50; y < canvasHeight - objectSize.height; y += 50) {
      for (let x = 50; x < canvasWidth - objectSize.width; x += 50) {
        const position = { x, y };
        if (this.isValidPosition(position, objectSize, existingObjects, canvasWidth, canvasHeight)) {
          return position;
        }
      }
    }
    
    // Fallback: place at default position
    return this.DEFAULT_POSITION;
  }

  calculateMultiplePositions(
    context: PlacementContext,
    objectSizes: Size[]
  ): Position[] {
    const positions: Position[] = [];
    let currentContext = context;

    for (const size of objectSizes) {
      const position = this.calculatePosition(currentContext, size);
      positions.push(position);

      // Update context for next object
      currentContext = {
        ...currentContext,
        existingObjects: [
          ...currentContext.existingObjects,
          {
            id: `temp_${positions.length}`,
            position,
            size,
          },
        ],
      };
    }

    return positions;
  }

  getObjectsInViewport(
    objects: Array<{ id: string; position: Position; size: Size }>,
    viewport: { x: number; y: number; width: number; height: number }
  ): string[] {
    return objects
      .filter(obj => {
        const objRight = obj.position.x + obj.size.width;
        const objBottom = obj.position.y + obj.size.height;
        const viewportRight = viewport.x + viewport.width;
        const viewportBottom = viewport.y + viewport.height;

        return (
          obj.position.x < viewportRight &&
          objRight > viewport.x &&
          obj.position.y < viewportBottom &&
          objBottom > viewport.y
        );
      })
      .map(obj => obj.id);
  }
}

export const layoutEngine = new LayoutEngine();
