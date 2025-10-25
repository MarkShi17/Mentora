'use client';

import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/utils";
import { useSessionStore } from "@/lib/session-store";
import { cn } from "@/lib/cn";

export function SidebarHistory() {
  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);
  const createSession = useSessionStore((state) => state.createSession);
  const messages = useSessionStore((state) => state.messages);

  const handleCreateSession = () => {
    const title = `New Lesson ${new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    })}`;
    createSession({ title });
  };

  return (
    <aside className="flex h-full w-80 flex-col border-r border-border bg-slate-950/70">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-lg font-semibold">Mentora</p>
          <p className="text-xs text-slate-400">Guided study sessions</p>
        </div>
        <Button size="sm" onClick={handleCreateSession}>
          New
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4 scrollbar-thin">
        <div>
          <p className="px-2 text-xs uppercase tracking-wide text-slate-500">
            Lessons
          </p>
          <ul className="mt-2 space-y-1">
            {sessions.map((session) => (
              <li key={session.id}>
                <button
                  type="button"
                  onClick={() => setActiveSession(session.id)}
                  className={cn(
                    "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                    activeSessionId === session.id
                      ? "bg-slate-800 text-white"
                      : "text-slate-300 hover:bg-slate-900"
                  )}
                >
                  <p className="font-medium">{session.title}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(session.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric"
                    })}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="px-2 text-xs uppercase tracking-wide text-slate-500">
            Dialogue
          </p>
          <div className="mt-2 space-y-3 rounded-lg border border-border bg-slate-950/40 p-3">
            {(messages[activeSessionId ?? ""] ?? []).map((message) => (
              <Fragment key={message.id}>
                <div>
                  <p
                    className={cn(
                      "text-sm",
                      message.role === "assistant"
                        ? "text-sky-200"
                        : "text-slate-200"
                    )}
                  >
                    <span className="font-semibold capitalize">
                      {message.role}
                    </span>
                    <span className="ml-2 text-xs text-slate-500">
                      {formatTime(message.timestamp)}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-slate-300">{message.content}</p>
                </div>
              </Fragment>
            ))}
            {(messages[activeSessionId ?? ""] ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">
                No dialogue yet. Start with a question in the prompt bar.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}
