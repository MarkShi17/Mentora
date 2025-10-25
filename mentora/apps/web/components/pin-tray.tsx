'use client';

import { LocateFixed, MapPin, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/lib/session-store";
import { cn } from "@/lib/cn";

export function PinTray() {
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const pins = useSessionStore((state) =>
    state.activeSessionId ? state.pins[state.activeSessionId] ?? [] : []
  );
  const requestFocus = useSessionStore((state) => state.requestFocus);
  const removePin = useSessionStore((state) => state.removePin);

  if (!activeSessionId) {
    return null;
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-slate-950/60 px-3 py-2 text-xs text-slate-300 shadow-inner">
      <div className="flex items-center gap-2 text-slate-400">
        <MapPin className="h-4 w-4" />
        <span className="font-medium uppercase tracking-wide text-slate-400">Pins</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {pins.length === 0 ? (
          <span className="text-slate-500">
            Use <span className="text-slate-300">Drop Pin</span> then click the canvas to save a view.
          </span>
        ) : (
          pins.map((pin) => (
            <div
              key={pin.id}
              className={cn(
                "flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/80 px-2 py-1 shadow-sm"
              )}
            >
              <button
                type="button"
                className="flex items-center gap-1 text-slate-200 transition-colors hover:text-sky-300"
                onClick={() => requestFocus({ id: pin.id, x: pin.x, y: pin.y })}
              >
                <LocateFixed className="h-3 w-3" />
                <span>{pin.label}</span>
              </button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-5 w-5 text-slate-500 hover:text-red-400"
                onClick={() => removePin(activeSessionId, pin.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
