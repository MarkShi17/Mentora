'use client';

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Settings, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/lib/session-store";
import { cn } from "@/lib/cn";
import { SettingsDialog } from "@/components/settings-dialog";

export function SidebarHistory() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const isCollapsed = useSessionStore((state) => !state.sidebarOpen);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);
  const createSession = useSessionStore((state) => state.createSession);
  const updateSessionTitle = useSessionStore((state) => state.updateSessionTitle);
  const deleteSession = useSessionStore((state) => state.deleteSession);
  const setSidebarOpen = useSessionStore((state) => state.setSidebarOpen);

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

  const handleStartEditing = (sessionId: string, currentTitle: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setEditingSessionId(sessionId);
    setEditingTitle(currentTitle);
  };

  const handleSaveTitle = (sessionId: string) => {
    if (editingTitle.trim()) {
      updateSessionTitle(sessionId, editingTitle.trim());
    }
    setEditingSessionId(null);
    setEditingTitle("");
  };

  const handleCancelEdit = () => {
    setEditingSessionId(null);
    setEditingTitle("");
  };

  const handleDeleteSession = (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setDeletingSessionId(sessionId);
  };

  const confirmDelete = () => {
    if (deletingSessionId) {
      deleteSession(deletingSessionId);
      setDeletingSessionId(null);
    }
  };

  const cancelDelete = () => {
    setDeletingSessionId(null);
  };

  return (
    <div className="absolute left-0 top-0 z-30 h-full pointer-events-none">
      {/* Toggle button */}
      <button
        onClick={() => setSidebarOpen(isCollapsed)}
        className={cn(
          "pointer-events-auto absolute left-0 top-6 z-40 flex h-10 w-10 items-center justify-center rounded-r-2xl border border-l-0 border-white/50 glass-white text-slate-700 shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-all duration-300 hover:shadow-[0_12px_32px_rgba(0,0,0,0.16)] hover:text-slate-900 hover:scale-105 active:scale-95",
          isCollapsed ? "translate-x-0" : "translate-x-80"
        )}
      >
        {isCollapsed ? (
          <ChevronRight className="h-5 w-5" />
        ) : (
          <ChevronLeft className="h-5 w-5" />
        )}
      </button>

      <aside className={cn(
        "pointer-events-auto flex h-full flex-col overflow-hidden border-r border-white/30 glass-white backdrop-blur-2xl transition-all duration-300 shadow-[8px_0_32px_rgba(0,0,0,0.08)]",
        isCollapsed ? "w-0 border-r-0" : "w-80"
      )}>
        {/* Sidebar content */}
        <div className={cn(
          "flex h-full w-80 flex-col transition-opacity duration-300",
          isCollapsed ? "pointer-events-none opacity-0" : "opacity-100"
        )}>
      <div className="flex items-center justify-between border-b border-white/30 px-5 py-4">
        <div>
          <p className="text-lg font-black text-slate-900 tracking-tight">Mentora</p>
          <p className="text-xs text-slate-600 font-medium">Guided study sessions</p>
        </div>
        <Button
          size="sm"
          onClick={handleCreateSession}
          className="rounded-xl border-2 border-slate-900/20 hover:border-sky-400/40 hover:bg-sky-50 hover:shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 font-bold text-slate-900 hover:text-sky-600 bg-white/95"
        >
          New
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
        <p className="px-3 text-xs uppercase tracking-widest text-slate-600 font-black mb-3">
          Lessons
        </p>
        <ul className="mt-2 space-y-2">
          {sessions.map((session) => (
            <li key={session.id} className="group relative">
              <button
                type="button"
                onClick={() => setActiveSession(session.id)}
                className={cn(
                  "w-full rounded-2xl px-4 py-3 pr-20 text-left text-sm transition-all duration-300",
                  activeSessionId === session.id
                    ? "bg-gradient-to-r from-sky-400/20 to-blue-500/20 text-slate-900 shadow-lg border border-sky-400/30 font-bold"
                    : "text-slate-700 hover:bg-white/60 hover:shadow-md border border-transparent font-medium"
                )}
              >
                {editingSessionId === session.id ? (
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onBlur={() => handleSaveTitle(session.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSaveTitle(session.id);
                      } else if (e.key === "Escape") {
                        handleCancelEdit();
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    className="w-full glass-white border border-sky-400/50 rounded-xl px-3 py-1.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/50 shadow-lg"
                  />
                ) : (
                  <p className="font-bold">
                    {session.title}
                  </p>
                )}
                <p className="text-xs text-slate-600 font-medium" suppressHydrationWarning>
                  {new Date(session.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric"
                  })}
                </p>
              </button>

              {/* Action buttons - always visible on hover or when active */}
              <div className={cn(
                "absolute right-3 top-1/2 -translate-y-1/2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300",
                activeSessionId === session.id && "opacity-100"
              )}>
                <button
                  type="button"
                  onClick={(e) => handleStartEditing(session.id, session.title, e)}
                  className="p-2 rounded-xl hover:bg-white/60 text-slate-600 hover:text-slate-900 transition-all duration-300 hover:scale-110 active:scale-95 shadow-sm"
                  title="Rename lesson"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDeleteSession(session.id, e)}
                  className="p-2 rounded-xl hover:bg-red-50 text-slate-600 hover:text-red-600 transition-all duration-300 hover:scale-110 active:scale-95 shadow-sm"
                  title="Delete lesson"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Settings Button */}
      <div className="border-t border-white/30 p-4">
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 transition-all duration-300 hover:bg-white/60 hover:shadow-md hover:scale-105 active:scale-95"
        >
          <Settings className="h-5 w-5" />
          <span>Settings</span>
        </button>
      </div>
      </div>
      </aside>

      {/* Delete Confirmation Dialog */}
      {deletingSessionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto">
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md" onClick={cancelDelete} />
          <div className="relative glass-white rounded-3xl border border-white/50 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.25)] w-96 max-w-[95vw]">
            <h3 className="text-xl font-black text-slate-900 mb-3 tracking-tight">Delete Lesson?</h3>
            <p className="text-sm text-slate-600 mb-8 font-medium leading-relaxed">
              This will permanently delete this lesson and all its content. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={cancelDelete}
                className="rounded-2xl border-white/60 glass-white text-slate-700 hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-300 font-bold"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDelete}
                className="rounded-2xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 font-bold"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
