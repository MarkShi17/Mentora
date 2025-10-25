'use client';

import type { ComponentType } from "react";
import { MapPin, MousePointer2 } from "lucide-react";
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

export function CanvasToolbar() {
  const canvasMode = useSessionStore((state) => state.canvasMode);
  const setCanvasMode = useSessionStore((state) => state.setCanvasMode);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const pinCount = useSessionStore((state) =>
    state.activeSessionId ? (state.pins[state.activeSessionId] ?? []).length : 0
  );
  const selectedCount = useSessionStore((state) => {
    const sessionId = state.activeSessionId;
    if (!sessionId) {
      return 0;
    }
    return (state.canvasObjects[sessionId] ?? []).filter((object) => object.selected).length;
  });

  const togglePinMode = () => {
    if (!activeSessionId) {
      return;
    }
    setCanvasMode(canvasMode === "pin" ? "pan" : "pin");
  };

  return (
    <nav className="flex items-center justify-between rounded-lg border border-border bg-slate-950/70 px-4 py-2 text-sm text-slate-200 shadow-sm backdrop-blur">
      <div className="flex items-center gap-2">
        <ToolButton
          icon={MousePointer2}
          label="Pan"
          active={canvasMode === "pan"}
          onClick={() => setCanvasMode("pan")}
        />
        <ToolButton
          icon={BoxSelectIcon}
          label="Box Select"
          active={canvasMode === "lasso"}
          onClick={() => setCanvasMode("lasso")}
          disabled={!activeSessionId}
        />
        <Button
          type="button"
          size="sm"
          disabled={!activeSessionId}
          variant={canvasMode === "pin" ? "secondary" : "outline"}
          className="ml-2 gap-2"
          onClick={togglePinMode}
        >
          <MapPin className="h-4 w-4" />
          {canvasMode === "pin" ? "Click to place" : "Drop Pin"}
        </Button>
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span>{selectedCount} selected</span>
        <span>{pinCount} pins</span>
        <Button variant="outline" size="sm" disabled className="cursor-not-allowed text-xs">
          Future actions
        </Button>
      </div>
    </nav>
  );
}

type ToolButtonProps = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
};

function ToolButton({ icon: Icon, label, active, onClick, disabled }: ToolButtonProps) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "secondary" : "ghost"}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "gap-2",
        active ? "shadow-inner shadow-slate-900/40" : "hover:bg-slate-900/80"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Button>
  );
}
