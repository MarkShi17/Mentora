'use client';

import type { ComponentType } from "react";
import { ExternalLink, LocateFixed, MapPin, MousePointer2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/lib/session-store";
import { cn } from "@/lib/cn";

const BoxSelectIcon: ComponentType<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2.5" ry="2.5" />
    <path d="M7 7h4v4H7zM13 7h4v4h-4zM7 13h4v4H7zM13 13h4v4h-4z" />
  </svg>
);

export function FloatingHeader() {
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const sessions = useSessionStore((state) => state.sessions);
  const canvasMode = useSessionStore((state) => state.canvasMode);
  const setCanvasMode = useSessionStore((state) => state.setCanvasMode);
  const pins = useSessionStore((state) =>
    state.activeSessionId ? state.pins[state.activeSessionId] ?? [] : []
  );
  const requestFocus = useSessionStore((state) => state.requestFocus);
  const removePin = useSessionStore((state) => state.removePin);

  const activeSession = sessions.find((session) => session.id === activeSessionId);

  const togglePinMode = () => {
    if (!activeSessionId) {
      return;
    }
    setCanvasMode(canvasMode === "pin" ? "pan" : "pin");
  };

  return (
    <div className="pointer-events-none absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-3">
      {/* Sources Button */}
      <div className="pointer-events-auto rounded-full border border-sky-500/30 bg-white/95 px-4 py-2 shadow-lg backdrop-blur-md hover:border-sky-500/50 hover:bg-slate-50 transition-all">
        <button
          type="button"
          disabled={!activeSessionId}
          onClick={() => useSessionStore.getState().setSourcesDrawerOpen(true)}
          className={cn(
            "flex items-center gap-2 text-sm font-medium transition-colors",
            activeSessionId ? "text-sky-600 hover:text-sky-700" : "text-slate-400 cursor-not-allowed"
          )}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Sources
        </button>
      </div>

      {/* Session Title */}
      <div className="pointer-events-auto rounded-2xl border border-slate-200 bg-white/95 px-5 py-2.5 shadow-lg backdrop-blur-md">
        <h1 className="text-base font-bold text-slate-900 tracking-tight">
          {activeSession?.title ?? "Create a new lesson"}
        </h1>
      </div>

      {/* Tool Buttons */}
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-2 py-2 shadow-lg backdrop-blur-md">
        <IconButton
          icon={MousePointer2}
          active={canvasMode === "pan"}
          onClick={() => setCanvasMode("pan")}
          tooltip="Grab"
        />
        <IconButton
          icon={BoxSelectIcon}
          active={canvasMode === "lasso"}
          onClick={() => setCanvasMode("lasso")}
          disabled={!activeSessionId}
          tooltip="Box Select"
        />
        <IconButton
          icon={MapPin}
          active={canvasMode === "pin"}
          onClick={togglePinMode}
          disabled={!activeSessionId}
          tooltip={canvasMode === "pin" ? "Click to place pin" : "Drop Pin"}
        />
      </div>

      {/* Pin Tray */}
      {pins.length > 0 && (
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-md">
          <MapPin className="h-4 w-4 text-slate-600" />
          {pins.map((pin) => (
            <div
              key={pin.id}
              className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1"
            >
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-slate-700 transition-colors hover:text-sky-600"
                onClick={() => requestFocus({ id: pin.id, x: pin.x, y: pin.y })}
              >
                <LocateFixed className="h-3 w-3" />
                <span>{pin.label}</span>
              </button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-4 w-4 text-slate-500 hover:text-red-500"
                onClick={() => activeSessionId && removePin(activeSessionId, pin.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type IconButtonProps = {
  icon: ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  tooltip?: string;
};

function IconButton({ icon: Icon, active, onClick, disabled, tooltip }: IconButtonProps) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "rounded-full p-2 transition-all",
          active
            ? "bg-slate-200 text-sky-600 shadow-inner"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
          disabled && "cursor-not-allowed opacity-40"
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
      </button>
      {tooltip && !disabled && (
        <div className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="whitespace-nowrap rounded-md bg-white px-2 py-1 text-xs text-slate-700 shadow-lg ring-1 ring-slate-200">
            {tooltip}
            <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rotate-45 h-2 w-2 bg-white ring-1 ring-slate-200"></div>
          </div>
        </div>
      )}
    </div>
  );
}
