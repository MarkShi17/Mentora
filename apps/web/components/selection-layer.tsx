'use client';

import type { CanvasObject } from "@/types";

type SelectionLayerProps = {
  objects: CanvasObject[];
  transform: { x: number; y: number; k: number };
};

export function SelectionLayer({ objects, transform }: SelectionLayerProps) {
  const selectedObjects = objects.filter((object) => object.selected);
  if (selectedObjects.length === 0) {
    return null;
  }

  // Calculate bounding box that encompasses all selected objects
  const minX = Math.min(...selectedObjects.map(obj => obj.x));
  const minY = Math.min(...selectedObjects.map(obj => obj.y));
  const maxX = Math.max(...selectedObjects.map(obj => obj.x + obj.width));
  const maxY = Math.max(...selectedObjects.map(obj => obj.y + obj.height));

  const boundingWidth = maxX - minX;
  const boundingHeight = maxY - minY;

  // Transform to screen coordinates
  const screenX = transform.x + minX * transform.k;
  const screenY = transform.y + minY * transform.k;
  const width = boundingWidth * transform.k;
  const height = boundingHeight * transform.k;

  const padding = 8;

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Blue background box */}
      <div
        className="absolute rounded-lg bg-sky-400/10"
        style={{
          left: screenX - padding,
          top: screenY - padding,
          width: width + padding * 2,
          height: height + padding * 2
        }}
      />
      {/* Border highlight */}
      <div
        className="absolute rounded-lg border-2 border-sky-400/80 shadow-[0_0_20px_rgba(56,189,248,0.35)]"
        style={{
          left: screenX - padding,
          top: screenY - padding,
          width: width + padding * 2,
          height: height + padding * 2
        }}
      >
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full rounded-full bg-sky-500 px-2 py-1 text-xs font-medium text-black shadow">
          {selectedObjects.length === 1 ? 'Highlighted' : `${selectedObjects.length} Selected`}
        </div>
      </div>
    </div>
  );
}
