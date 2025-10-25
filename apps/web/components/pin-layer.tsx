'use client';

import type { CSSProperties } from "react";
import type { Pin } from "@/types";
import { cn } from "@/lib/cn";

type PinLayerProps = {
  pins: Pin[];
  transform: { x: number; y: number; k: number };
  onFocus?: (pin: Pin) => void;
  interactive?: boolean;
};

export function PinLayer({ pins, transform, onFocus, interactive = true }: PinLayerProps) {
  if (pins.length === 0) {
    return null;
  }

  const stageStyle: CSSProperties = {
    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
    transformOrigin: "0 0"
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="relative h-full w-full" style={stageStyle}>
        {pins.map((pin) => (
          <button
            key={pin.id}
            type="button"
            className={cn(
              "absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1",
              interactive ? "pointer-events-auto" : "pointer-events-none"
            )}
            style={{
              left: pin.x,
              top: pin.y
            }}
            onClick={(event) => {
              event.stopPropagation();
              onFocus?.(pin);
            }}
          >
            <span className="rounded-full border border-sky-400 bg-sky-500/80 px-2 py-0.5 text-xs font-medium text-slate-900 shadow-sm">
              {pin.label}
            </span>
            <span className="h-3 w-3 rounded-full border border-white bg-sky-400 shadow-lg" />
          </button>
        ))}
      </div>
    </div>
  );
}
