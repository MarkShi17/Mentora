'use client';

import { useState } from "react";
import type { CSSProperties } from "react";
import type { CanvasObject, ConnectionAnchor as AnchorType, ObjectConnection } from "@/types";
import { ObjectContextMenu, ObjectMenuButton } from "@/components/object-context-menu";
import { ConnectionAnchor } from "@/components/connection-anchor";
import { getAnchorPosition } from "@/lib/connection-utils";

type SelectionLayerProps = {
  objects: CanvasObject[];
  transform: { x: number; y: number; k: number };
  selectionMethod?: "click" | "lasso";
  lastSelectedObjectId?: string | null;
  onDelete: (objectIds: string[]) => void;
  onDeleteConnections?: (objectIds: string[]) => void;
  connections?: ObjectConnection[];
  dragState?: {
    objectId: string;
    selectedObjectIds: string[];
    startWorld: { x: number; y: number };
    startScreen: { x: number; y: number };
    startPositions: Record<string, { x: number; y: number }>;
    currentDelta: { x: number; y: number };
    wasSelectedAtStart: boolean;
  } | null;
  onResizeStart?: (objectId: string, corner: string, event: React.PointerEvent) => void;
  resizeState?: {
    objectId: string;
    corner: string;
    startWorld: { x: number; y: number };
    startDimensions: { x: number; y: number; width: number; height: number };
    currentDimensions: { x: number; y: number; width: number; height: number };
    textScale?: number;
  } | null;
  onConnectionStart?: (objectId: string, anchor: AnchorType, event: React.PointerEvent) => void;
  connectionDragState?: {
    sourceObjectId: string;
    sourceAnchor: AnchorType;
  } | null;
  hoveredAnchor?: { objectId: string; anchor: AnchorType } | null;
  onAnchorHover?: (objectId: string, anchor: AnchorType | null) => void;
};

export function SelectionLayer({
  objects,
  transform,
  selectionMethod,
  lastSelectedObjectId,
  onDelete,
  onDeleteConnections,
  connections = [],
  dragState,
  onResizeStart,
  resizeState,
  onConnectionStart,
  connectionDragState,
  hoveredAnchor,
  onAnchorHover
}: SelectionLayerProps) {
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);

  const selectedObjects = objects.filter((object) => object.selected);
  if (selectedObjects.length === 0) {
    return null;
  }

  const padding = 8;

  const handleOpenMenu = (event: React.MouseEvent) => {
    event.stopPropagation();
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    setMenuPosition({ x: rect.right + 4, y: rect.top });
  };

  const handleCloseMenu = () => {
    setMenuPosition(null);
  };

  // Helper to get position accounting for drag state
  const getPosition = (obj: CanvasObject) => {
    const isBeingDragged = dragState?.selectedObjectIds?.includes(obj.id) ?? false;
    if (isBeingDragged && dragState) {
      return {
        x: obj.x + dragState.currentDelta.x,
        y: obj.y + dragState.currentDelta.y
      };
    }
    return { x: obj.x, y: obj.y };
  };

  // Helper to get dimensions accounting for resize state
  const getDimensions = (obj: CanvasObject) => {
    const isBeingResized = resizeState?.objectId === obj.id;
    if (isBeingResized && resizeState) {
      return {
        x: resizeState.currentDimensions.x,
        y: resizeState.currentDimensions.y,
        width: resizeState.currentDimensions.width,
        height: resizeState.currentDimensions.height
      };
    }
    const pos = getPosition(obj);
    return {
      x: pos.x,
      y: pos.y,
      width: obj.width,
      height: obj.height
    };
  };

  // Check if object has valid measured dimensions
  const hasValidDimensions = (obj: CanvasObject): boolean => {
    return typeof obj.width === 'number' && obj.width > 0 &&
           typeof obj.height === 'number' && obj.height > 0;
  };

  // Render Canva-style resize handles for a single selected object
  const renderResizeHandles = (obj: CanvasObject) => {
    if (!onResizeStart) return null;

    // Don't render handles until object has valid measured dimensions
    if (!hasValidDimensions(obj)) return null;

    const dims = getDimensions(obj);
    const handleSize = 12 / transform.k; // Slightly larger for better visibility
    const handleOffset = handleSize / 2;

    const corners = [
      { name: 'nw', x: dims.x - handleOffset, y: dims.y - handleOffset, cursor: 'nw-resize' },
      { name: 'ne', x: dims.x + dims.width - handleOffset, y: dims.y - handleOffset, cursor: 'ne-resize' },
      { name: 'sw', x: dims.x - handleOffset, y: dims.y + dims.height - handleOffset, cursor: 'sw-resize' },
      { name: 'se', x: dims.x + dims.width - handleOffset, y: dims.y + dims.height - handleOffset, cursor: 'se-resize' }
    ];

    return corners.map(corner => {
      const isBeingResized = resizeState?.objectId === obj.id && resizeState?.corner === corner.name;

      return (
        <div
          key={corner.name}
          className="absolute pointer-events-auto z-50 group"
          style={{
            left: corner.x,
            top: corner.y,
            width: handleSize,
            height: handleSize,
            cursor: corner.cursor,
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onResizeStart(obj.id, corner.name, e);
          }}
          onPointerMove={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          {/* Outer ring for hover effect */}
          <div
            className="absolute inset-0 rounded-full transition-all duration-200"
            style={{
              backgroundColor: 'rgba(14, 165, 233, 0.15)',
              transform: isBeingResized ? 'scale(1.8)' : 'scale(1.2)',
              opacity: isBeingResized ? 1 : 0,
            }}
          />
          {/* Main handle - Canva-style rounded square */}
          <div
            className="absolute inset-0 rounded-sm transition-all duration-200 ease-out"
            style={{
              backgroundColor: 'white',
              border: isBeingResized ? '3px solid #0ea5e9' : '2.5px solid #0ea5e9',
              boxShadow: isBeingResized
                ? '0 0 0 1px white, 0 4px 12px rgba(14, 165, 233, 0.4)'
                : '0 0 0 1px white, 0 2px 6px rgba(14, 165, 233, 0.3)',
              transform: isBeingResized ? 'scale(1.15)' : 'scale(1)',
            }}
          />
          {/* Hover scale effect */}
          <style jsx>{`
            .group:hover > div:last-of-type {
              transform: scale(1.2);
            }
            .group:hover > div:first-of-type {
              opacity: 0.4;
              transform: scale(1.6);
            }
          `}</style>
        </div>
      );
    });
  };

  // Render connection anchors on N/E/S/W sides of object
  const renderConnectionAnchors = (obj: CanvasObject) => {
    if (!onConnectionStart) return null;

    // Don't render anchors until object has valid measured dimensions
    if (!hasValidDimensions(obj)) return null;

    const dims = getDimensions(obj);
    
    const anchors: AnchorType[] = ['north', 'east', 'south', 'west'];

    return anchors.map(anchor => {
      const pos = getAnchorPosition(
        { ...obj, x: dims.x, y: dims.y, width: dims.width, height: dims.height },
        anchor
      );

      const isActive = connectionDragState?.sourceObjectId === obj.id && connectionDragState?.sourceAnchor === anchor;
      const isHovered = hoveredAnchor?.objectId === obj.id && hoveredAnchor?.anchor === anchor;

      // Check if this anchor has a connection
      const hasConnection = connections.some(conn =>
        (conn.sourceObjectId === obj.id && conn.sourceAnchor === anchor) ||
        (conn.targetObjectId === obj.id && conn.targetAnchor === anchor)
      );

      return (
        <ConnectionAnchor
          key={anchor}
          anchor={anchor}
          x={pos.x}
          y={pos.y}
          scale={transform.k}
          isActive={isActive}
          isHovered={isHovered}
          hasConnection={hasConnection}
          onPointerDown={(e) => onConnectionStart(obj.id, anchor, e)}
          onPointerEnter={() => onAnchorHover?.(obj.id, anchor)}
          onPointerLeave={() => onAnchorHover?.(obj.id, null)}
        />
      );
    });
  };

  // Apply the same transform as the object layer
  const stageStyle: CSSProperties = {
    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
    transformOrigin: "0 0"
  };

  // When dragging a connection, show anchors on ALL objects
  if (connectionDragState && onConnectionStart) {
    return (
      <div className="pointer-events-none absolute inset-0">
        <div className="relative h-full w-full" style={stageStyle}>
          {objects.map(obj => {
            // Skip objects without valid dimensions
            if (!hasValidDimensions(obj)) return null;

            const dims = getDimensions(obj);

            const anchors: AnchorType[] = ['north', 'east', 'south', 'west'];

            return anchors.map(anchor => {
              const pos = getAnchorPosition(
                { ...obj, x: dims.x, y: dims.y, width: dims.width, height: dims.height },
                anchor
              );

              const isSourceAnchor = connectionDragState.sourceObjectId === obj.id && connectionDragState.sourceAnchor === anchor;
              const isHovered = hoveredAnchor?.objectId === obj.id && hoveredAnchor?.anchor === anchor;
              const isSourceObject = connectionDragState.sourceObjectId === obj.id;

              // Check if this anchor has a connection
              const hasConnection = connections.some(conn =>
                (conn.sourceObjectId === obj.id && conn.sourceAnchor === anchor) ||
                (conn.targetObjectId === obj.id && conn.targetAnchor === anchor)
              );

              // Don't show other anchors on the source object
              if (isSourceObject && !isSourceAnchor) {
                return null;
              }

              return (
                <ConnectionAnchor
                  key={`${obj.id}-${anchor}`}
                  anchor={anchor}
                  x={pos.x}
                  y={pos.y}
                  scale={transform.k}
                  isActive={isSourceAnchor}
                  isHovered={isHovered}
                  hasConnection={hasConnection}
                  onPointerDown={(e) => {
                    if (!isSourceAnchor) {
                      e.stopPropagation();
                      e.preventDefault();
                    }
                  }}
                />
              );
            });
          })}
        </div>
      </div>
    );
  }

  // Single object selection - only show label (object already has border)
  if (selectedObjects.length === 1) {
    const obj = selectedObjects[0];
    const pos = getPosition(obj);

    return (
      <>
        <div className="pointer-events-none absolute inset-0">
          <div className="relative h-full w-full" style={stageStyle}>
            {/* Label positioned above object */}
            <div
              className="absolute"
              style={{
                left: pos.x,
                top: pos.y,
                transform: "translateY(-100%)"
              }}
            >
              <div className="mb-3 flex justify-center items-center pointer-events-auto">
                <div className="rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-xs font-black text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 whitespace-nowrap flex items-center gap-2 border border-white/30 backdrop-blur-sm">
                  <span>Highlighted</span>
                  <ObjectMenuButton onOpenMenu={handleOpenMenu} />
                </div>
              </div>
            </div>
            {/* Resize handles */}
            {renderResizeHandles(obj)}
            {/* Connection anchors */}
            {renderConnectionAnchors(obj)}
          </div>
        </div>
        {menuPosition && (
          <ObjectContextMenu
            position={menuPosition}
            onClose={handleCloseMenu}
            selectedObjectIds={selectedObjects.map((obj) => obj.id)}
            onDelete={onDelete}
            onDeleteConnections={onDeleteConnections}
          />
        )}
      </>
    );
  }

  // Multiple objects with lasso selection - show bounding box only (objects have their own borders)
  if (selectionMethod === "lasso") {
    // Use drag-adjusted positions for the bounding box to follow the objects
    const positions = selectedObjects.map(obj => {
      const pos = getPosition(obj);
      return {
        x: pos.x,
        y: pos.y,
        width: obj.width || 300,
        height: obj.height || 150
      };
    });

    const minX = Math.min(...positions.map(p => p.x));
    const minY = Math.min(...positions.map(p => p.y));
    const maxX = Math.max(...positions.map(p => p.x + p.width));
    const maxY = Math.max(...positions.map(p => p.y + p.height));

    const boundingWidth = maxX - minX;
    const boundingHeight = maxY - minY;

    // Padding for the bounding box to account for object borders and spacing
    const boundingPadding = 12;

    return (
      <>
        <div className="pointer-events-none absolute inset-0">
          <div className="relative h-full w-full" style={stageStyle}>
            {/* Bounding rectangle encompassing all selected objects */}
            <div
              className="absolute rounded-lg bg-sky-400/10"
              style={{
                left: minX - boundingPadding,
                top: minY - boundingPadding,
                width: boundingWidth + boundingPadding * 2,
                height: boundingHeight + boundingPadding * 2
              }}
            />
            <div
              className="absolute rounded-lg border-2 border-sky-400/80 shadow-[0_0_20px_rgba(56,189,248,0.35)]"
              style={{
                left: minX - boundingPadding,
                top: minY - boundingPadding,
                width: boundingWidth + boundingPadding * 2,
                height: boundingHeight + boundingPadding * 2
              }}
            >
              <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[calc(100%+12px)] pointer-events-auto">
                <div className="rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-xs font-black text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 whitespace-nowrap flex items-center gap-2 border border-white/30 backdrop-blur-sm">
                  <span>{selectedObjects.length} Selected</span>
                  <ObjectMenuButton onOpenMenu={handleOpenMenu} />
                </div>
              </div>
            </div>
          </div>
        </div>
        {menuPosition && (
          <ObjectContextMenu
            position={menuPosition}
            onClose={handleCloseMenu}
            selectedObjectIds={selectedObjects.map((obj) => obj.id)}
            onDelete={onDelete}
            onDeleteConnections={onDeleteConnections}
          />
        )}
      </>
    );
  }

  // Multiple objects with click selection - only show label on last selected (objects have their own borders)
  const lastSelectedObject = selectedObjects.find(obj => obj.id === lastSelectedObjectId);

  if (!lastSelectedObject) {
    return null;
  }

  const lastPos = getPosition(lastSelectedObject);

  return (
    <>
      <div className="pointer-events-none absolute inset-0">
        <div className="relative h-full w-full" style={stageStyle}>
          {/* Label positioned above the last selected object */}
          <div
            className="absolute"
            style={{
              left: lastPos.x,
              top: lastPos.y,
              transform: "translateY(-100%)"
            }}
          >
            <div className="mb-3 flex justify-center items-center pointer-events-auto">
              <div className="rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-xs font-black text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 whitespace-nowrap flex items-center gap-2 border border-white/30 backdrop-blur-sm">
                <span>Highlighted</span>
                <ObjectMenuButton onOpenMenu={handleOpenMenu} />
              </div>
            </div>
          </div>
        </div>
      </div>
      {menuPosition && (
        <ObjectContextMenu
          position={menuPosition}
          onClose={handleCloseMenu}
          selectedObjectIds={selectedObjects.map((obj) => obj.id)}
          onDelete={onDelete}
        />
      )}
    </>
  );
}
