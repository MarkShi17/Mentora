import type { CanvasObject, ConnectionAnchor } from "@/types";

/**
 * Calculate the world position of an anchor point on an object
 * Uses the object's stored dimensions for consistency
 */
export function getAnchorPosition(
  object: CanvasObject,
  anchor: ConnectionAnchor
): { x: number; y: number } {
  const { x, y, width, height } = object;

  switch (anchor) {
    case 'north':
      return { x: x + width / 2, y };
    case 'east':
      return { x: x + width, y: y + height / 2 };
    case 'south':
      return { x: x + width / 2, y: y + height };
    case 'west':
      return { x, y: y + height / 2 };
  }
}

/**
 * Calculate the world position of an anchor point using actual DOM element
 * This is more accurate as it uses the real rendered dimensions
 */
export function getAnchorPositionFromDOM(
  element: HTMLElement,
  anchor: ConnectionAnchor,
  transform: { x: number; y: number; k: number }
): { x: number; y: number } {
  const rect = element.getBoundingClientRect();
  const canvasRect = element.closest('[data-canvas-container]')?.getBoundingClientRect();
  
  if (!canvasRect) {
    // Fallback to stored dimensions if no canvas container found
    return { x: 0, y: 0 };
  }

  // Convert screen coordinates to world coordinates
  const worldX = (rect.left - canvasRect.left - transform.x) / transform.k;
  const worldY = (rect.top - canvasRect.top - transform.y) / transform.k;
  const worldWidth = rect.width / transform.k;
  const worldHeight = rect.height / transform.k;

  switch (anchor) {
    case 'north':
      return { x: worldX + worldWidth / 2, y: worldY };
    case 'east':
      return { x: worldX + worldWidth, y: worldY + worldHeight / 2 };
    case 'south':
      return { x: worldX + worldWidth / 2, y: worldY + worldHeight };
    case 'west':
      return { x: worldX, y: worldY + worldHeight / 2 };
  }
}

/**
 * Generate SVG path for a connection line
 * Uses straight lines for parallel connections, curves only when needed
 */
export function getConnectionPath(
  sourcePos: { x: number; y: number },
  targetPos: { x: number; y: number }
): string {
  const dx = targetPos.x - sourcePos.x;
  const dy = targetPos.y - sourcePos.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Threshold for considering a line "parallel" (within 10 degrees)
  const parallelThreshold = 10;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const absAngle = Math.abs(angle);

  // Check if line is roughly horizontal or vertical
  const isHorizontal = absAngle < parallelThreshold || absAngle > (180 - parallelThreshold);
  const isVertical = Math.abs(absAngle - 90) < parallelThreshold || Math.abs(absAngle + 90) < parallelThreshold;

  // Use straight line for parallel connections
  if (isHorizontal || isVertical) {
    return `M ${sourcePos.x} ${sourcePos.y} L ${targetPos.x} ${targetPos.y}`;
  }

  // Use curve for diagonal connections to avoid overlapping objects
  const offsetAmount = Math.min(distance * 0.2, 50); // Max 50px offset
  const perpAngle = Math.atan2(dy, dx) + Math.PI / 2; // Perpendicular angle
  const controlX = (sourcePos.x + targetPos.x) / 2 + Math.cos(perpAngle) * offsetAmount;
  const controlY = (sourcePos.y + targetPos.y) / 2 + Math.sin(perpAngle) * offsetAmount;

  // Quadratic bezier curve
  return `M ${sourcePos.x} ${sourcePos.y} Q ${controlX} ${controlY} ${targetPos.x} ${targetPos.y}`;
}

/**
 * Check if a point is near a connection line (for hover/click detection)
 */
export function isPointNearLine(
  point: { x: number; y: number },
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number },
  threshold: number = 10
): boolean {
  const { x, y } = point;
  const { x: x1, y: y1 } = lineStart;
  const { x: x2, y: y2 } = lineEnd;

  // Calculate distance from point to line segment
  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = x - xx;
  const dy = y - yy;
  const distance = Math.sqrt(dx * dx + dy * dy);

  return distance <= threshold;
}

/**
 * Find which anchor point (if any) a world position is hovering over
 */
export function getHoveredAnchor(
  object: CanvasObject,
  worldPos: { x: number; y: number },
  anchorRadius: number = 16
): ConnectionAnchor | null {
  const anchors: ConnectionAnchor[] = ['north', 'east', 'south', 'west'];

  for (const anchor of anchors) {
    const anchorPos = getAnchorPosition(object, anchor);
    const dx = worldPos.x - anchorPos.x;
    const dy = worldPos.y - anchorPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance <= anchorRadius) {
            return anchor;
          }
  }

  return null;
}
