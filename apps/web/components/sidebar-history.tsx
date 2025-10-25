'use client';

import { useState } from "react";
import { ChevronLeft, ChevronRight, Settings, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/lib/session-store";
import { cn } from "@/lib/cn";
import { SettingsDialog } from "@/components/settings-dialog";

export function SidebarHistory() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);
  const createSession = useSessionStore((state) => state.createSession);
  const updateSessionTitle = useSessionStore((state) => state.updateSessionTitle);
  const deleteSession = useSessionStore((state) => state.deleteSession);

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
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn(
          "pointer-events-auto absolute left-0 top-4 z-40 flex h-8 w-8 items-center justify-center rounded-r-lg border border-l-0 border-slate-200 bg-white/95 text-slate-700 shadow-lg transition-all hover:bg-slate-50 hover:text-slate-900",
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
        "pointer-events-auto flex h-full flex-col overflow-hidden border-r border-slate-200 bg-white/95 backdrop-blur-sm transition-all duration-300",
        isCollapsed ? "w-0 border-r-0" : "w-80"
      )}>
        {/* Sidebar content */}
        <div className={cn(
          "flex h-full w-80 flex-col transition-opacity duration-300",
          isCollapsed ? "pointer-events-none opacity-0" : "opacity-100"
        )}>
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-lg font-semibold text-slate-900">Mentora</p>
          <p className="text-xs text-slate-600">Guided study sessions</p>
        </div>
        <Button size="sm" onClick={handleCreateSession}>
          New
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-3 scrollbar-thin">
        <p className="px-2 text-xs uppercase tracking-wide text-slate-600">
          Lessons
        </p>
        <ul className="mt-2 space-y-1">
          {sessions.map((session) => (
            <li key={session.id} className="group relative">
              <button
                type="button"
                onClick={() => setActiveSession(session.id)}
                className={cn(
                  "w-full rounded-md px-3 py-2 pr-20 text-left text-sm transition-colors",
                  activeSessionId === session.id
                    ? "bg-slate-200 text-slate-900"
                    : "text-slate-700 hover:bg-slate-100"
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
                    className="w-full bg-white border border-sky-500 rounded px-2 py-1 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                ) : (
                  <p className="font-medium">
                    {session.title}
                  </p>
                )}
                <p className="text-xs text-slate-600" suppressHydrationWarning>
                  {new Date(session.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric"
                  })}
                </p>
              </button>

              {/* Action buttons - always visible on hover or when active */}
              <div className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
                activeSessionId === session.id && "opacity-100"
              )}>
                <button
                  type="button"
                  onClick={(e) => handleStartEditing(session.id, session.title, e)}
                  className="p-1.5 rounded hover:bg-slate-300 text-slate-600 hover:text-slate-900 transition-colors"
                  title="Rename lesson"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDeleteSession(session.id, e)}
                  className="p-1.5 rounded hover:bg-red-100 text-slate-600 hover:text-red-600 transition-colors"
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
      <div className="border-t border-slate-200 p-3">
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100"
        >
          <Settings className="h-4 w-4" />
          <span>Settings</span>
        </button>
      </div>
      </div>
      </aside>

      {/* Delete Confirmation Dialog */}
      {deletingSessionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={cancelDelete} />
          <div className="relative bg-white rounded-xl border border-slate-200 p-6 shadow-2xl w-96 max-w-[95vw]">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Lesson?</h3>
            <p className="text-sm text-slate-600 mb-6">
              This will permanently delete this lesson and all its content. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={cancelDelete}
                className="border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 hover:border-slate-400"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
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
