'use client';

import type { CSSProperties } from "react";
import { CanvasObject } from "@/types";
import { cn } from "@/lib/cn";

type ObjectLayerProps = {
  objects: CanvasObject[];
  transform: { x: number; y: number; k: number };
  onSelect: (id: string) => void;
};

export function ObjectLayer({ objects, transform, onSelect }: ObjectLayerProps) {
  const stageStyle: CSSProperties = {
    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
    transformOrigin: "0 0"
  };

  console.log('🎨 ObjectLayer rendering with transform:', transform, 'objects:', objects.length);

  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        className="relative h-full w-full"
        style={stageStyle}
      >
        {objects.map((object) => (
          <div
            key={object.id}
            className="pointer-events-auto absolute overflow-hidden rounded-lg border-2 border-transparent shadow-lg transition-colors"
            style={{
              left: object.x,
              top: object.y,
              width: object.width,
              height: object.height,
              background: `${object.color}20`
            }}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(object.id);
            }}
          >
            <div className={cn(
              "flex h-full w-full flex-col justify-between p-3 backdrop-blur transition-colors",
              object.selected ? "bg-slate-900/40" : "bg-slate-900/60"
            )}>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  {object.type}
                </p>
                <h3 className="mt-1 text-sm font-semibold text-slate-50">
                  {object.label}
                </h3>
              </div>
              {object.metadata ? (
                <p className="text-xs text-slate-300">{String(object.metadata?.description ?? "")}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
