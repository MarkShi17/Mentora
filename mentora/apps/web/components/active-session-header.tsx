'use client';

import { useMemo } from "react";
import { useSessionStore } from "@/lib/session-store";

export function ActiveSessionHeader() {
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const sessions = useSessionStore((state) => state.sessions);
  const canvasObjects = useSessionStore((state) =>
    activeSessionId ? state.canvasObjects[activeSessionId] ?? [] : []
  );

  const activeSession = sessions.find((session) => session.id === activeSessionId);
  const selected = useMemo(
    () => canvasObjects.filter((object) => object.selected),
    [canvasObjects]
  );

  return (
    <div>
      <p className="text-sm uppercase tracking-wider text-slate-500">Active Lesson</p>
      <h1 className="mt-1 text-2xl font-semibold text-slate-100">
        {activeSession?.title ?? "Create a new lesson"}
      </h1>
      {selected.length > 0 ? (
        <p className="mt-2 text-sm text-sky-300">
          Highlighted context: {selected.map((object) => object.label).join(", ")}
        </p>
      ) : (
        <p className="mt-2 text-sm text-slate-400">
          Select visuals on the canvas to ground upcoming responses.
        </p>
      )}
    </div>
  );
}
