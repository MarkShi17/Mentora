'use client';

import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/lib/session-store";
import { cn } from "@/lib/cn";

export function SourcesDrawer() {
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const allSources = useSessionStore((state) => state.sources);
  const open = useSessionStore((state) => state.sourcesDrawerOpen);
  const setOpen = useSessionStore((state) => state.setSourcesDrawerOpen);
  const sources = activeSessionId ? allSources[activeSessionId] ?? [] : [];

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed bottom-0 right-0 m-4 w-96 max-w-[95vw] rounded-xl border border-border bg-slate-950 p-4 shadow-2xl">
          <Dialog.Title className="text-lg font-semibold text-slate-100">
            Referenced Sources
          </Dialog.Title>
          <Dialog.Description className="text-sm text-slate-400">
            Indexed documents grounding the most recent response.
          </Dialog.Description>
          <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1 scrollbar-thin">
            {sources.map((source) => (
              <div
                key={source.id}
                className="rounded-lg border border-border bg-slate-900/60 p-3"
              >
                <div className="flex items-center justify-between">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-sky-300 hover:underline"
                  >
                    {source.title}
                  </a>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      source.score > 0.9
                        ? "bg-emerald-500/20 text-emerald-300"
                        : source.score > 0.75
                          ? "bg-sky-500/20 text-sky-300"
                          : "bg-amber-500/20 text-amber-200"
                    )}
                  >
                    {(source.score * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-300">{source.snippet}</p>
              </div>
            ))}
            {sources.length === 0 ? (
              <p className="text-sm text-slate-500">
                No sources yet. Ask a question to populate grounded references.
              </p>
            ) : null}
          </div>
          <Dialog.Close asChild>
            <Button className="mt-4 w-full" variant="secondary">
              Close
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
