'use client';

import { Brain, Code, Dna, Palette, Sparkles } from "lucide-react";
import { useSessionStore } from "@/lib/session-store";
import { cn } from "@/lib/cn";
import type { BrainType } from "@/types";

const BRAIN_ICONS: Record<BrainType, typeof Brain> = {
  math: Sparkles,
  biology: Dna,
  code: Code,
  design: Palette,
  general: Brain,
};

const BRAIN_COLORS: Record<BrainType, { bg: string; text: string; border: string }> = {
  math: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  biology: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  code: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  design: { bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-200" },
  general: { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" },
};

export function BrainBadge() {
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const activeBrain = useSessionStore((state) =>
    activeSessionId ? state.activeBrain[activeSessionId] : null
  );

  // Don't show if no session or no brain selected
  if (!activeSessionId || !activeBrain || !activeBrain.brainType) {
    return (
      <div className="rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-medium text-slate-500">Auto</span>
        </div>
      </div>
    );
  }

  const Icon = BRAIN_ICONS[activeBrain.brainType];
  const colors = BRAIN_COLORS[activeBrain.brainType];

  return (
    <div className="group relative">
      <div className={cn(
        "rounded-full border px-3 py-1.5 shadow-sm backdrop-blur-md transition-all",
        colors.bg,
        colors.border
      )}>
        <div className="flex items-center gap-1.5">
          <Icon className={cn("h-3.5 w-3.5", colors.text)} />
          <span className={cn("text-xs font-semibold", colors.text)}>
            {activeBrain.brainName}
          </span>
          {activeBrain.confidence && (
            <span className={cn("text-[10px] font-medium opacity-70", colors.text)}>
              {Math.round(activeBrain.confidence * 100)}%
            </span>
          )}
        </div>
      </div>

      {/* Tooltip */}
      {activeBrain.reasoning && (
        <div className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="max-w-xs whitespace-normal rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-100 shadow-xl">
            <p className="font-semibold mb-1">Why this brain was selected:</p>
            <p className="text-slate-300">{activeBrain.reasoning}</p>
            <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rotate-45 h-2 w-2 bg-slate-900"></div>
          </div>
        </div>
      )}
    </div>
  );
}
