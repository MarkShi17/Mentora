'use client';

import type { CSSProperties } from "react";
import type { CanvasObject } from "@/types";

type SelectionLayerProps = {
  objects: CanvasObject[];
  transform: { x: number; y: number; k: number };
  selectionMethod?: "click" | "lasso";
  lastSelectedObjectId?: string | null;
  dragState?: {
    objectId: string;
    selectedObjectIds: string[];
    startWorld: { x: number; y: number };
    startScreen: { x: number; y: number };
    startPositions: Record<string, { x: number; y: number }>;
    currentDelta: { x: number; y: number };
    wasSelectedAtStart: boolean;
  } | null;
};

export function SelectionLayer({
  objects,
  transform,
  selectionMethod,
  lastSelectedObjectId,
  dragState
}: SelectionLayerProps) {
  const selectedObjects = objects.filter((object) => object.selected);
  if (selectedObjects.length === 0) {
    return null;
  }

  const padding = 8;

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
            <div className="mb-2 flex justify-center">
              <div className="rounded-full bg-sky-500 px-2 py-1 text-xs font-medium text-black shadow whitespace-nowrap">
                Highlighted
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Multiple objects with lasso selection - show bounding box only (objects have their own borders)
  if (selectionMethod === "lasso") {
    // Use actual width and height from objects, with drag-adjusted positions
    const positions = selectedObjects.map(obj => {
      const pos = getPosition(obj);
      return {
        x: pos.x,
        y: pos.y,
        width: obj.width || obj.size?.width || 300,
        height: obj.height || obj.size?.height || 150
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
            <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[calc(100%+8px)] rounded-full bg-sky-500 px-2 py-1 text-xs font-medium text-black shadow whitespace-nowrap">
              {selectedObjects.length} Selected
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Multiple objects with click selection - only show label on last selected (objects have their own borders)
  const lastSelectedObject = selectedObjects.find(obj => obj.id === lastSelectedObjectId);

  if (!lastSelectedObject) {
    return null;
  }

  const lastPos = getPosition(lastSelectedObject);

  return (
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
          <div className="mb-2 flex justify-center">
            <div className="rounded-full bg-sky-500 px-2 py-1 text-xs font-medium text-black shadow whitespace-nowrap">
              Highlighted
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
