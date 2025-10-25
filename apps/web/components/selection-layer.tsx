'use client';

import { useState } from "react";
import type { CSSProperties } from "react";
import type { CanvasObject } from "@/types";
import { ObjectContextMenu, ObjectMenuButton } from "@/components/object-context-menu";

type SelectionLayerProps = {
  objects: CanvasObject[];
  transform: { x: number; y: number; k: number };
  selectionMethod?: "click" | "lasso";
  lastSelectedObjectId?: string | null;
  onDelete: (objectIds: string[]) => void;
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
};

export function SelectionLayer({
  objects,
  transform,
  selectionMethod,
  lastSelectedObjectId,
  onDelete,
  dragState,
  onResizeStart,
  resizeState
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

  // Render resize handles for a single selected object
  const renderResizeHandles = (obj: CanvasObject) => {
    if (!onResizeStart) return null;

    const dims = getDimensions(obj);
    const handleSize = 8 / transform.k; // Scale handle size inversely with zoom
    const handleOffset = handleSize / 2;

    const corners = [
      { name: 'nw', x: dims.x - handleOffset, y: dims.y - handleOffset, cursor: 'nw-resize' },
      { name: 'ne', x: dims.x + dims.width - handleOffset, y: dims.y - handleOffset, cursor: 'ne-resize' },
      { name: 'sw', x: dims.x - handleOffset, y: dims.y + dims.height - handleOffset, cursor: 'sw-resize' },
      { name: 'se', x: dims.x + dims.width - handleOffset, y: dims.y + dims.height - handleOffset, cursor: 'se-resize' }
    ];

    return corners.map(corner => (
      <div
        key={corner.name}
        className="absolute pointer-events-auto bg-white border-2 border-sky-500 rounded-sm hover:bg-sky-100 z-50"
        style={{
          left: corner.x,
          top: corner.y,
          width: handleSize,
          height: handleSize,
          cursor: corner.cursor
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
      />
    ));
  };

  // Apply the same transform as the object layer
  const stageStyle: CSSProperties = {
    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
    transformOrigin: "0 0"
  };

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
              <div className="mb-2 flex justify-center items-center pointer-events-auto">
                <div className="rounded-full bg-sky-500 px-2 py-1 text-xs font-medium text-black shadow whitespace-nowrap flex items-center">
                  <span>Highlighted</span>
                  <ObjectMenuButton onOpenMenu={handleOpenMenu} />
                </div>
              </div>
            </div>
            {/* Resize handles */}
            {renderResizeHandles(obj)}
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
              <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[calc(100%+8px)] pointer-events-auto">
                <div className="rounded-full bg-sky-500 px-2 py-1 text-xs font-medium text-black shadow whitespace-nowrap flex items-center">
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
            <div className="mb-2 flex justify-center items-center pointer-events-auto">
              <div className="rounded-full bg-sky-500 px-2 py-1 text-xs font-medium text-black shadow whitespace-nowrap flex items-center">
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
