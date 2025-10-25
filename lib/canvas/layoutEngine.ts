import { Position, Size } from '@/types/canvas';
import { PlacementContext } from './types';

export class LayoutEngine {
  private readonly VERTICAL_SPACING = 150;
  private readonly HORIZONTAL_SPACING = 200;
  private readonly DEFAULT_POSITION: Position = { x: 0, y: 0 };

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

    // Default: place below the last object
    return this.getPositionBelowLast(existingObjects, objectSize);
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
