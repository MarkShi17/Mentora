'use client';

import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/utils";
import { useSessionStore } from "@/lib/session-store";

export function TimelinePanel() {
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const timeline = useSessionStore((state) =>
    activeSessionId ? state.timeline[activeSessionId] ?? [] : []
  );
  const captionsEnabled = useSessionStore((state) => state.captionsEnabled);
  const setCaptionsEnabled = useSessionStore((state) => state.setCaptionsEnabled);

  return (
    <aside className="flex h-full w-80 flex-col border-l border-border bg-slate-950/40">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-200">Playback Timeline</p>
          <p className="text-xs text-slate-500">Live orchestrated events</p>
        </div>
        <Button
          variant={captionsEnabled ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setCaptionsEnabled(!captionsEnabled)}
        >
          {captionsEnabled ? "Hide Captions" : "Show Captions"}
        </Button>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4 scrollbar-thin">
        {timeline.map((event) => (
          <div
            key={event.id}
            className="rounded-lg border border-border bg-slate-900/60 px-3 py-2"
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
