'use client';

import { Fragment, useState, useRef } from "react";
import { ChevronLeft, ChevronRight, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VoiceControls } from "@/components/voice-controls";
import { formatTime } from "@/lib/utils";
import { useSessionStore } from "@/lib/session-store";
import { cn } from "@/lib/cn";

// Change this to switch between collapse styles: "icon" | "tab" | "bubble"
const COLLAPSE_STYLE: "icon" | "tab" | "bubble" = "icon";

type DragState = {
  isDragging: boolean;
  startX: number;
  startY: number;
  startLeft: number;
  startTop: number;
};

export function TimelinePanel() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [position, setPosition] = useState({ right: 16, top: 16 }); // 16px = 1rem (4 in Tailwind)
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);

  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const messages = useSessionStore((state) => state.messages);
  const dialogue = activeSessionId ? messages[activeSessionId] ?? [] : [];
  const captionsEnabled = useSessionStore((state) => state.captionsEnabled);
  const setCaptionsEnabled = useSessionStore((state) => state.setCaptionsEnabled);

  const handleDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    // Only allow dragging from the header area, not from buttons
    const target = event.target as HTMLElement;
    if (target.closest('button')) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    const state: DragState = {
      isDragging: true,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: position.right,
      startTop: position.top,
    };

    dragStateRef.current = state;
    setDragState(state);
  };

  const handleDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    if (!state || !state.isDragging) {
      return;
    }

    event.preventDefault();

    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;

    // Update position - subtract deltaX because we're positioning from the right
    setPosition({
      right: Math.max(0, state.startLeft - deltaX),
      top: Math.max(0, state.startTop + deltaY),
    });
  };

  const handleDragEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    if (!state || !state.isDragging) {
      return;
    }

    event.preventDefault();
    event.currentTarget.releasePointerCapture(event.pointerId);

    dragStateRef.current = null;
    setDragState(null);
  };

  // Icon button style - circular floating button
  if (COLLAPSE_STYLE === "icon" && !isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="pointer-events-auto absolute z-20 rounded-full border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur-md transition-all hover:bg-slate-50 hover:scale-110 active:scale-95 animate-in fade-in-0 slide-in-from-right-5 zoom-in-95 duration-300 group"
        style={{
          right: `${position.right}px`,
          top: `${position.top}px`,
        }}
      >
        <MessageSquare className="h-5 w-5 text-slate-600 transition-transform group-hover:rotate-12" />
        {dialogue.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-[10px] font-semibold text-white">
            {dialogue.length}
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
        className="pointer-events-auto absolute z-20 -translate-y-1/2 rounded-l-lg border border-r-0 border-slate-200 bg-white/95 px-2 py-8 shadow-lg backdrop-blur-md transition-all hover:bg-slate-50 hover:px-3 active:scale-95 animate-in fade-in-0 slide-in-from-right-5 zoom-in-95 duration-300 group"
        style={{
          right: 0,
          top: `${position.top}px`,
        }}
      >
        <div className="flex flex-col items-center gap-2">
          <ChevronLeft className="h-4 w-4 text-slate-600 transition-transform group-hover:-translate-x-0.5" />
          <p className="whitespace-nowrap text-xs font-semibold text-slate-600" style={{ writingMode: "vertical-rl" }}>
            Dialogue ({dialogue.length})
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
        className="pointer-events-auto absolute z-20 flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-4 py-2 shadow-lg backdrop-blur-md transition-all hover:bg-slate-50 hover:scale-105 active:scale-95 animate-in fade-in-0 slide-in-from-right-5 zoom-in-95 duration-300 group"
        style={{
          right: `${position.right}px`,
          top: `${position.top}px`,
        }}
      >
        <MessageSquare className="h-4 w-4 text-slate-600 transition-transform group-hover:rotate-12" />
        <span className="text-sm font-medium text-slate-700">
          Dialogue {dialogue.length > 0 && `(${dialogue.length})`}
        </span>
        <ChevronLeft className="h-4 w-4 text-slate-600 transition-transform group-hover:-translate-x-0.5" />
      </button>
    );
  }

  // Expanded state - floating panel
  return (
    <aside
      className="pointer-events-auto absolute z-20 flex w-96 max-h-[calc(100vh-8rem)] flex-col rounded-2xl border border-slate-200 bg-white/95 shadow-xl backdrop-blur-md animate-in fade-in-0 slide-in-from-right-5 duration-300"
      style={{
        right: `${position.right}px`,
        top: `${position.top}px`,
      }}
    >
      <div
        className={cn(
          "flex items-center justify-between border-b border-slate-200 px-4 py-3 shrink-0",
          dragState?.isDragging ? "cursor-grabbing" : "cursor-grab"
        )}
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
      >
        <div className="flex items-center gap-2 select-none">
          <MessageSquare className="h-4 w-4 text-slate-600" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Dialogue</p>
            <p className="text-xs text-slate-600">{dialogue.length} messages</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCaptionsEnabled(!captionsEnabled)}
            className={cn(
              "h-7 text-xs",
              !captionsEnabled && "bg-slate-200 text-slate-700 hover:bg-slate-300"
            )}
          >
            {captionsEnabled ? "Captions On" : "Captions Off"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(false)}
            className="h-7 w-7 transition-all hover:scale-105 active:scale-95 hover:bg-slate-100 group text-slate-600 hover:text-slate-900"
          >
            {COLLAPSE_STYLE === "tab" ? (
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            ) : (
              <X className="h-4 w-4 transition-transform group-hover:rotate-90" />
            )}
          </Button>
        </div>
      </div>
      <div className="space-y-3 overflow-y-auto px-4 py-4 scrollbar-thin">
        {dialogue.map((message) => (
          <Fragment key={message.id}>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p
                className={cn(
                  "text-sm font-semibold",
                  message.role === "assistant"
                    ? "text-sky-600"
                    : "text-slate-700"
                )}
              >
                <span className="capitalize">{message.role}</span>
                <span className="ml-2 text-xs font-normal text-slate-500">
                  {formatTime(message.timestamp)}
                </span>
              </p>
              <p className="mt-1 text-sm text-slate-700 leading-relaxed">{message.content}</p>
              {message.role === "assistant" && (
                <VoiceControls
                  text={message.content}
                  className="mt-2"
                />
              )}
            </div>
          </Fragment>
        ))}
        {dialogue.length === 0 ? (
          <p className="text-sm text-slate-600">
            No dialogue yet. Start with a question in the prompt bar.
          </p>
        ) : null}
      </div>
    </aside>
  );
}
