'use client';

import type { ComponentType } from "react";
import { ExternalLink, LocateFixed, MapPin, MousePointer2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/lib/session-store";
import { cn } from "@/lib/cn";
import { BrainBadge } from "@/components/brain-badge";

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
  // const pins = useSessionStore((state) =>
  //   state.activeSessionId ? state.pins[state.activeSessionId] ?? [] : []
  // );
  // const requestFocus = useSessionStore((state) => state.requestFocus);
  // const removePin = useSessionStore((state) => state.removePin);

  const activeSession = sessions.find((session) => session.id === activeSessionId);

  // const togglePinMode = () => {
  //   if (!activeSessionId) {
  //     return;
  //   }
  //   setCanvasMode(canvasMode === "pin" ? "pan" : "pin");
  // };

  return (
    <div className="pointer-events-none absolute left-1/2 top-6 z-20 flex -translate-x-1/2 items-center gap-3">
      {/* Sources Button */}
      <div className="pointer-events-auto rounded-2xl glass-white px-5 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.1)] backdrop-blur-2xl border border-white/50 hover:shadow-[0_12px_32px_rgba(6,182,212,0.2)] hover:border-sky-400/40 transition-all duration-300 hover:scale-105 active:scale-95">
        <button
          type="button"
          disabled={!activeSessionId}
          onClick={() => useSessionStore.getState().setSourcesDrawerOpen(true)}
          className={cn(
            "flex items-center gap-2.5 text-sm font-bold transition-colors",
            activeSessionId ? "text-sky-600 hover:text-sky-700" : "text-slate-400 cursor-not-allowed"
          )}
        >
          <ExternalLink className="h-4 w-4" />
          Sources
        </button>
      </div>

      {/* Session Title */}
      <div className="pointer-events-auto rounded-3xl glass-white px-7 py-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-2xl border border-white/50 hover:shadow-[0_12px_40px_rgba(0,0,0,0.16)] transition-all duration-300">
        <h1 className="text-base font-black text-slate-900 tracking-tight">
          {activeSession?.title ?? "Create a new lesson"}
        </h1>
      </div>

      {/* Brain Badge */}
      <BrainBadge />

      {/* Tool Buttons */}
      <div className="pointer-events-auto flex items-center gap-2.5 rounded-3xl glass-white px-3 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.1)] backdrop-blur-2xl border border-white/50">
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
        {/* <IconButton
          icon={MapPin}
          active={canvasMode === "pin"}
          onClick={togglePinMode}
          disabled={!activeSessionId}
          tooltip={canvasMode === "pin" ? "Click to place pin" : "Drop Pin"}
        /> */}
      </div>

      {/* Pin Tray */}
      {/* {pins.length > 0 && (
        <div className="pointer-events-auto flex items-center gap-2.5 rounded-3xl glass-white px-4 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.1)] backdrop-blur-2xl border border-white/50">
          <MapPin className="h-4 w-4 text-slate-600" />
          {pins.map((pin) => (
            <div
              key={pin.id}
              className="flex items-center gap-1.5 rounded-2xl border border-white/60 bg-white/40 px-3 py-1.5 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105"
            >
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs font-bold text-slate-700 transition-colors hover:text-sky-600"
                onClick={() => requestFocus({ id: pin.id, x: pin.x, y: pin.y })}
              >
                <LocateFixed className="h-3.5 w-3.5" />
                <span>{pin.label}</span>
              </button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-5 w-5 text-slate-500 hover:text-red-500 transition-colors"
                onClick={() => activeSessionId && removePin(activeSessionId, pin.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )} */}
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
          "rounded-2xl p-2.5 transition-all duration-300",
          active
            ? "bg-gradient-to-br from-sky-400/20 to-blue-500/20 text-sky-600 shadow-lg shadow-sky-400/20 border border-sky-400/30"
            : "text-slate-600 hover:bg-white/60 hover:text-slate-900 hover:shadow-md hover:scale-110 active:scale-95",
          disabled && "cursor-not-allowed opacity-40"
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
      </button>
      {tooltip && !disabled && (
        <div className="pointer-events-none absolute left-1/2 top-full mt-3 -translate-x-1/2 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0 translate-y-1">
          <div className="relative whitespace-nowrap rounded-xl glass-white px-3 py-2 text-xs font-bold text-slate-700 shadow-[0_8px_24px_rgba(0,0,0,0.12)] border border-white/50">
            {tooltip}
            <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rotate-45 h-2 w-2 bg-white border-l border-t border-white/50"></div>
          </div>
        </div>
      )}
    </div>
  );
}
