'use client';

import type { CanvasObject } from "@/types";

type SelectionLayerProps = {
  objects: CanvasObject[];
  transform: { x: number; y: number; k: number };
};

export function SelectionLayer({ objects, transform }: SelectionLayerProps) {
  const selectedObject = objects.find((object) => object.selected);
  if (!selectedObject) {
    return null;
  }

  const screenX = transform.x + selectedObject.x * transform.k;
  const screenY = transform.y + selectedObject.y * transform.k;
  const width = selectedObject.width * transform.k;
  const height = selectedObject.height * transform.k;

  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        className="absolute rounded-lg border-2 border-sky-400/80 shadow-[0_0_20px_rgba(56,189,248,0.35)]"
        style={{
          left: screenX - 8,
          top: screenY - 8,
          width: width + 16,
          height: height + 16
        }}
      >
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full rounded-full bg-sky-500 px-2 py-1 text-xs font-medium text-black shadow">
          Highlighted
        </div>
      </div>
    </div>
  );
}
