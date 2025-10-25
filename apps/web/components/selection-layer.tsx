'use client';

import type { CSSProperties } from "react";
import type { CanvasObject } from "@/types";

type SelectionLayerProps = {
  objects: CanvasObject[];
  transform: { x: number; y: number; k: number };
  selectionMethod?: "click" | "lasso";
  lastSelectedObjectId?: string | null;
};

export function SelectionLayer({
  objects,
  transform,
  selectionMethod,
  lastSelectedObjectId
}: SelectionLayerProps) {
  const selectedObjects = objects.filter((object) => object.selected);
  if (selectedObjects.length === 0) {
    return null;
  }

  const padding = 8;

  // Apply the same transform as the object layer
  const stageStyle: CSSProperties = {
    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
    transformOrigin: "0 0"
  };

  // Single object selection - only show label (object already has border)
  if (selectedObjects.length === 1) {
    const obj = selectedObjects[0];

    return (
      <div className="pointer-events-none absolute inset-0">
        <div className="relative h-full w-full" style={stageStyle}>
          {/* Label positioned above object */}
          <div
            className="absolute"
            style={{
              left: obj.x,
              top: obj.y,
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
    // Get the actual positions, but add generous estimates for sizes since stored width/height don't match CSS
    const positions = selectedObjects.map(obj => ({
      x: obj.x,
      y: obj.y,
      // Add generous size estimates based on object type
      estimatedWidth: obj.type === 'text' ? 350 : obj.type === 'code' ? 500 : obj.type === 'diagram' || obj.type === 'graph' ? 400 : 300,
      estimatedHeight: obj.type === 'text' ? 150 : obj.type === 'code' ? 250 : obj.type === 'diagram' || obj.type === 'graph' ? 300 : 150
    }));

    const minX = Math.min(...positions.map(p => p.x));
    const minY = Math.min(...positions.map(p => p.y));
    const maxX = Math.max(...positions.map(p => p.x + p.estimatedWidth));
    const maxY = Math.max(...positions.map(p => p.y + p.estimatedHeight));

    const boundingWidth = maxX - minX;
    const boundingHeight = maxY - minY;

    // Extra generous padding for the bounding box
    const boundingPadding = 24;

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

  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="relative h-full w-full" style={stageStyle}>
        {/* Label positioned above the last selected object */}
        <div
          className="absolute"
          style={{
            left: lastSelectedObject.x,
            top: lastSelectedObject.y,
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
