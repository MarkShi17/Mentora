'use client';

import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { useSessionStore } from "@/lib/session-store";
import { cn } from "@/lib/cn";

const TOOL_LABELS: Record<string, string> = {
  render_animation: "Generating animation",
  execute_python: "Running Python code",
  sequential_thinking: "Thinking step-by-step",
};

export function MCPStatus() {
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const mcpTools = useSessionStore((state) =>
    activeSessionId ? state.mcpToolStatus[activeSessionId] || [] : []
  );

  // Only show running tools (hide completed/error notifications)
  const activeTools = mcpTools.filter(
    (tool) => tool.status === 'running'
  );

  if (activeTools.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30">
      <div className="flex flex-col gap-2">
        {activeTools.map((tool) => (
          <div
            key={`${tool.toolName}-${tool.startTime}`}
            className={cn(
              "rounded-lg border px-4 py-2.5 shadow-lg backdrop-blur-md transition-all",
              tool.status === 'running' && "border-blue-200 bg-blue-50/95",
              tool.status === 'complete' && "border-green-200 bg-green-50/95",
              tool.status === 'error' && "border-red-200 bg-red-50/95"
            )}
          >
            <div className="flex items-center gap-2">
              {tool.status === 'running' && (
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              )}
              {tool.status === 'complete' && (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
              {tool.status === 'error' && (
                <XCircle className="h-4 w-4 text-red-600" />
              )}

              <div className="flex-1">
                <p className={cn(
                  "text-sm font-medium",
                  tool.status === 'running' && "text-blue-900",
                  tool.status === 'complete' && "text-green-900",
                  tool.status === 'error' && "text-red-900"
                )}>
                  {TOOL_LABELS[tool.toolName] || tool.toolName}
                </p>

                {tool.status === 'error' && tool.error && (
                  <p className="text-xs text-red-700 mt-0.5">
                    {tool.error}
                  </p>
                )}

                {tool.status === 'complete' && tool.startTime && tool.endTime && (
                  <p className="text-xs text-green-700 mt-0.5">
                    Completed in {tool.endTime - tool.startTime}ms
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
