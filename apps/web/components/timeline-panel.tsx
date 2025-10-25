'use client';

import { useState } from "react";
import { ChevronLeft, ChevronRight, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/utils";
import { useSessionStore } from "@/lib/session-store";
import { cn } from "@/lib/cn";

// Change this to switch between collapse styles: "icon" | "tab" | "bubble"
const COLLAPSE_STYLE: "icon" | "tab" | "bubble" = "icon";

export function TimelinePanel() {
  const [isExpanded, setIsExpanded] = useState(true);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const timeline = useSessionStore((state) =>
    activeSessionId ? state.timeline[activeSessionId] ?? [] : []
  );
  const captionsEnabled = useSessionStore((state) => state.captionsEnabled);
  const setCaptionsEnabled = useSessionStore((state) => state.setCaptionsEnabled);

  // Icon button style - circular floating button
  if (COLLAPSE_STYLE === "icon" && !isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="pointer-events-auto absolute right-4 top-4 z-20 rounded-full border border-slate-700/50 bg-slate-950/80 p-3 shadow-lg backdrop-blur-md transition-all hover:bg-slate-900/80"
      >
        <Clock className="h-5 w-5 text-slate-300" />
        {timeline.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-[10px] font-semibold text-white">
            {timeline.length}
          </span>
        )}
      </button>
    );
  }

  // Vertical tab style - thin tab on right edge
  if (COLLAPSE_STYLE === "tab" && !isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="pointer-events-auto absolute right-0 top-1/2 z-20 -translate-y-1/2 rounded-l-lg border border-r-0 border-slate-700/50 bg-slate-950/80 px-2 py-8 shadow-lg backdrop-blur-md transition-all hover:bg-slate-900/80"
      >
        <div className="flex flex-col items-center gap-2">
          <ChevronLeft className="h-4 w-4 text-slate-300" />
          <p className="whitespace-nowrap text-xs font-semibold text-slate-300" style={{ writingMode: "vertical-rl" }}>
            Timeline ({timeline.length})
          </p>
        </div>
      </button>
    );
  }

  // Minimized bubble style - small bubble with count
  if (COLLAPSE_STYLE === "bubble" && !isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="pointer-events-auto absolute right-4 top-4 z-20 flex items-center gap-2 rounded-full border border-slate-700/50 bg-slate-950/80 px-4 py-2 shadow-lg backdrop-blur-md transition-all hover:bg-slate-900/80"
      >
        <Clock className="h-4 w-4 text-slate-300" />
        <span className="text-sm font-medium text-slate-200">
          Timeline {timeline.length > 0 && `(${timeline.length})`}
        </span>
        <ChevronLeft className="h-4 w-4 text-slate-400" />
      </button>
    );
  }

  // Expanded state - floating panel
  return (
    <aside className="pointer-events-auto absolute right-4 top-4 z-20 flex h-[calc(100vh-8rem)] w-80 flex-col rounded-2xl border border-slate-700/50 bg-slate-950/80 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-slate-700/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-400" />
          <div>
            <p className="text-sm font-semibold text-slate-200">Timeline</p>
            <p className="text-xs text-slate-500">{timeline.length} events</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={captionsEnabled ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setCaptionsEnabled(!captionsEnabled)}
            className="h-7 text-xs"
          >
            {captionsEnabled ? "Captions On" : "Captions Off"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(false)}
            className="h-7 w-7"
          >
            {COLLAPSE_STYLE === "tab" ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4 scrollbar-thin">
        {timeline.map((event) => (
          <div
            key={event.id}
            className="rounded-lg border border-slate-700/50 bg-slate-900/60 px-3 py-2"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {event.type}
            </p>
            <p className="mt-1 text-sm text-slate-200">{event.description}</p>
            <p className="text-[10px] text-slate-500">{formatTime(event.timestamp)}</p>
          </div>
        ))}
        {timeline.length === 0 ? (
          <p className="text-sm text-slate-500">
            Timeline events will appear here as the tutor orchestrates services.
          </p>
        ) : null}
      </div>
    </aside>
  );
}
