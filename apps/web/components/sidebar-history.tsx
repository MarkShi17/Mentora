'use client';

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/lib/session-store";
import { cn } from "@/lib/cn";

export function SidebarHistory() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);
  const createSession = useSessionStore((state) => state.createSession);

  const handleCreateSession = async () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    const timeString = `${displayHours}:${displayMinutes} ${ampm}`;
    const title = `New Lesson ${timeString}`;
    await createSession({ title });
  };

  return (
    <div className="absolute left-0 top-0 z-30 h-full pointer-events-none">
      {/* Toggle button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn(
          "pointer-events-auto absolute left-0 top-4 z-40 flex h-8 w-8 items-center justify-center rounded-r-lg border border-l-0 border-border bg-slate-950/90 text-slate-300 shadow-lg transition-all hover:bg-slate-900 hover:text-slate-100",
          isCollapsed ? "translate-x-0" : "translate-x-80"
        )}
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>

      <aside className={cn(
        "pointer-events-auto flex h-full flex-col overflow-hidden border-r border-border bg-slate-950/95 backdrop-blur-sm transition-all duration-300",
        isCollapsed ? "w-0 border-r-0" : "w-80"
      )}>
        {/* Sidebar content */}
        <div className={cn(
          "flex h-full w-80 flex-col transition-opacity duration-300",
          isCollapsed ? "pointer-events-none opacity-0" : "opacity-100"
        )}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-lg font-semibold">Mentora</p>
          <p className="text-xs text-slate-400">Guided study sessions</p>
        </div>
        <Button size="sm" onClick={handleCreateSession}>
          New
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-3 scrollbar-thin">
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
                <p className="text-xs text-slate-400" suppressHydrationWarning>
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
      </div>
      </aside>
    </div>
  );
}
