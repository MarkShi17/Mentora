'use client';

import type React from 'react';
import { useMemo, memo } from 'react';
import type { CanvasObject, ObjectConnection, ConnectionAnchor } from '@/types';
import { getAnchorPosition, getConnectionPath } from '@/lib/connection-utils';

type ConnectionDragState = {
  sourceObjectId: string;
  sourceAnchor: ConnectionAnchor;
  currentWorld: { x: number; y: number };
};

type DragState = {
  objectId: string;
  selectedObjectIds: string[];
  startWorld: { x: number; y: number };
  startScreen: { x: number; y: number };
  startPositions: Record<string, { x: number; y: number }>;
  currentDelta: { x: number; y: number };
  wasSelectedAtStart: boolean;
};

type ConnectionLayerProps = {
  connections: ObjectConnection[];
  objects: CanvasObject[];
  transform: { x: number; y: number; k: number };
  hoveredConnectionId?: string | null;
  onConnectionClick?: (connectionId: string) => void;
  onConnectionHover?: (connectionId: string | null) => void;
  connectionDragState?: ConnectionDragState | null;
  hoveredAnchor?: { objectId: string; anchor: ConnectionAnchor } | null;
  dragState?: DragState | null;
};

export function ConnectionLayer({
  connections,
  objects,
  transform,
  hoveredConnectionId = null,
  onConnectionClick,
  onConnectionHover,
  connectionDragState = null,
  hoveredAnchor = null,
  dragState = null
}: ConnectionLayerProps) {
  // Create a map for quick object lookup
  const objectMap = useMemo(() => {
    const map = new Map<string, CanvasObject>();
    objects.forEach(obj => map.set(obj.id, obj));
    return map;
  }, [objects]);

  // Pre-calculate all base paths (memoized - only recalculates when objects change, NOT on drag)
  const connectionPaths = useMemo(() => {
    const paths = new Map<string, string>();
    connections.forEach(conn => {
      const sourceObj = objectMap.get(conn.sourceObjectId);
      const targetObj = objectMap.get(conn.targetObjectId);
      if (sourceObj && targetObj) {
        const sourcePos = getAnchorPosition(sourceObj, conn.sourceAnchor);
        const targetPos = getAnchorPosition(targetObj, conn.targetAnchor);
        const path = getConnectionPath(sourcePos, targetPos);
        paths.set(conn.id, path);
      }
    });
    return paths;
  }, [connections, objectMap]);

  // Filter out connections where source or target object doesn't exist
  const validConnections = connections.filter(conn => {
    const sourceObj = objectMap.get(conn.sourceObjectId);
    const targetObj = objectMap.get(conn.targetObjectId);
    return sourceObj && targetObj;
  });

  return (
    <div className="absolute inset-0 pointer-events-none">
      <svg
        className="absolute inset-0"
        style={{
          width: '100%',
          height: '100%',
          overflow: 'visible',
          willChange: dragState ? 'transform' : 'auto'
        }}
      >
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
          {validConnections.map(connection => {
            const sourceObj = objectMap.get(connection.sourceObjectId)!;
            const targetObj = objectMap.get(connection.targetObjectId)!;

            // Get memoized base path (never recalculates during drag)
            const basePath = connectionPaths.get(connection.id)!;

            // Check if either object is being dragged
            const isSourceDragged = dragState?.selectedObjectIds?.includes(sourceObj.id) ?? false;
            const isTargetDragged = dragState?.selectedObjectIds?.includes(targetObj.id) ?? false;

            // Use SVG transform for instant visual update (like CSS transform on divs)
            const connectionTransform = (isSourceDragged && isTargetDragged && dragState)
              ? `translate(${dragState.currentDelta.x}, ${dragState.currentDelta.y})`
              : undefined;

            // If only one object is dragged, calculate adjusted path
            let finalPathData = basePath;
            if ((isSourceDragged || isTargetDragged) && !(isSourceDragged && isTargetDragged) && dragState) {
              const sourcePos = getAnchorPosition(sourceObj, connection.sourceAnchor);
              const targetPos = getAnchorPosition(targetObj, connection.targetAnchor);

              const adjustedSourcePos = isSourceDragged
                ? { x: sourcePos.x + dragState.currentDelta.x, y: sourcePos.y + dragState.currentDelta.y }
                : sourcePos;
              const adjustedTargetPos = isTargetDragged
                ? { x: targetPos.x + dragState.currentDelta.x, y: targetPos.y + dragState.currentDelta.y }
                : targetPos;
              finalPathData = getConnectionPath(adjustedSourcePos, adjustedTargetPos);
            }

            const isHovered = hoveredConnectionId === connection.id;
            const isSourceSelected = sourceObj.selected;
            const isTargetSelected = targetObj.selected;
            const isHighlighted = isHovered || isSourceSelected || isTargetSelected;

            return (
              <g
                key={connection.id}
                transform={connectionTransform || undefined}
              >
                {/* Invisible thicker path for easier clicking */}
                <path
                  d={finalPathData}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={20 / transform.k}
                  className="pointer-events-auto cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onConnectionClick?.(connection.id);
                  }}
                  onPointerEnter={() => onConnectionHover?.(connection.id)}
                  onPointerLeave={() => onConnectionHover?.(null)}
                />
                {/* Visible connection line */}
                <path
                  d={finalPathData}
                  fill="none"
                  stroke={isHighlighted ? '#8b5cf6' : '#d1d5db'}
                  strokeWidth={isHighlighted ? 2.5 / transform.k : 1.5 / transform.k}
                  strokeLinecap="round"
                  strokeDasharray={isHighlighted ? 'none' : '4 4'}
                  className="pointer-events-none"
                  style={{
                    filter: isHighlighted ? 'drop-shadow(0 1px 2px rgba(139, 92, 246, 0.3))' : 'none'
                  }}
                />
              </g>
            );
          })}

          {/* Preview line when dragging a connection */}
          {connectionDragState && (() => {
            const sourceObj = objectMap.get(connectionDragState.sourceObjectId);
            if (!sourceObj) return null;

            // Calculate base position
            const baseSourcePos = getAnchorPosition(sourceObj, connectionDragState.sourceAnchor);

            // Apply drag delta if source object is being dragged
            const isSourceDragged = dragState?.selectedObjectIds?.includes(sourceObj.id) ?? false;
            const sourcePos = isSourceDragged && dragState
              ? { x: baseSourcePos.x + dragState.currentDelta.x, y: baseSourcePos.y + dragState.currentDelta.y }
              : baseSourcePos;

            // If hovering over a valid target anchor, snap to it; otherwise follow cursor
            let targetPos = connectionDragState.currentWorld;
            if (hoveredAnchor) {
              const targetObj = objectMap.get(hoveredAnchor.objectId);
              if (targetObj && targetObj.id !== sourceObj.id) {
                const baseTargetPos = getAnchorPosition(targetObj, hoveredAnchor.anchor);

                // Apply drag delta if target object is being dragged
                const isTargetDragged = dragState?.selectedObjectIds?.includes(targetObj.id) ?? false;
                targetPos = isTargetDragged && dragState
                  ? { x: baseTargetPos.x + dragState.currentDelta.x, y: baseTargetPos.y + dragState.currentDelta.y }
                  : baseTargetPos;
              }
            }

            const previewPath = getConnectionPath(sourcePos, targetPos);
            const isSnapping = hoveredAnchor !== null;

            return (
              <g key="preview">
                {/* Preview line with dashed stroke */}
                <path
                  d={previewPath}
                  fill="none"
                  stroke="#8b5cf6"
                  strokeWidth={2 / transform.k}
                  strokeLinecap="round"
                  strokeDasharray={`${6 / transform.k} ${3 / transform.k}`}
                  className="pointer-events-none"
                  style={{
                    filter: 'drop-shadow(0 1px 2px rgba(139, 92, 246, 0.4))',
                    opacity: isSnapping ? 1 : 0.6
                  }}
                >
                  {/* Animated dash movement */}
                  <animate
                    attributeName="stroke-dashoffset"
                    from="0"
                    to={`${-9 / transform.k}`}
                    dur="0.5s"
                    repeatCount="indefinite"
                  />
                </path>
              </g>
            );
          })()}
        </g>
      </svg>
    </div>
  );
}
